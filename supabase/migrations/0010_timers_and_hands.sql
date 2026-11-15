-- NEXORA 0.9 — Raise Hand + Class Timers
-- 1) Optional timers on Do Now / Exit ticket items (teacher's choice).
-- 2) class_timers: one live, synced countdown per class (Do Now, exit ticket or a manual timer).
-- 3) help_requests: a student "raises a hand" through the assistant; the teacher sees it under the bell.

-- ---------------------------------------------------------------- 1. Timer settings on items
alter table public.class_materials
  add column if not exists timer_minutes smallint check (timer_minutes between 1 and 60),
  add column if not exists timer_mode text check (timer_mode in ('manual', 'bell'));
alter table public.assignments
  add column if not exists timer_minutes smallint check (timer_minutes between 1 and 60),
  add column if not exists timer_mode text check (timer_mode in ('manual', 'bell'));

-- ---------------------------------------------------------------- 2. Live class timers
create table if not exists public.class_timers (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  kind text not null default 'manual' check (kind in ('do_now', 'exit_ticket', 'manual')),
  label text not null default '' check (char_length(label) <= 120),
  item_type text check (item_type in ('material', 'assignment')),
  item_id uuid,
  duration_s integer not null check (duration_s between 5 and 7200),
  -- running: ends_at is set; paused: remaining_s is set.
  ends_at timestamptz,
  remaining_s integer check (remaining_s >= 0),
  status text not null default 'running' check (status in ('running', 'paused', 'done', 'cancelled')),
  show_students boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists class_timers_class_idx on public.class_timers (class_id, created_at desc);
alter table public.class_timers enable row level security;

drop policy if exists "timers: read" on public.class_timers;
create policy "timers: read" on public.class_timers for select to authenticated
  using (public.teaches_class(class_id) or (show_students and public.in_class(class_id)));
drop policy if exists "timers: teacher writes" on public.class_timers;
create policy "timers: teacher writes" on public.class_timers for all to authenticated
  using (public.teaches_class(class_id)) with check (public.teaches_class(class_id));

drop trigger if exists class_timers_touch on public.class_timers;
create trigger class_timers_touch before update on public.class_timers
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- 3. Raised hands
create table if not exists public.help_requests (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'question' check (kind in ('question', 'stuck', 'tech', 'other')),
  note text check (char_length(note) <= 280),
  page_path text check (char_length(page_path) <= 300),
  page_title text check (char_length(page_title) <= 200),
  status text not null default 'raised' check (status in ('raised', 'seen', 'resolved', 'lowered')),
  created_at timestamptz not null default now(),
  seen_at timestamptz,
  closed_at timestamptz,
  handled_by uuid references public.profiles(id) on delete set null
);
create unique index if not exists help_one_open on public.help_requests (class_id, student_id) where status in ('raised', 'seen');
create index if not exists help_class_open_idx on public.help_requests (class_id, created_at) where status in ('raised', 'seen');
alter table public.help_requests enable row level security;

-- Read: the student who raised it, and the class's teacher. All writes go through the functions below.
drop policy if exists "help: read" on public.help_requests;
create policy "help: read" on public.help_requests for select to authenticated
  using (student_id = (select auth.uid()) or public.teaches_class(class_id));

-- Raise (or update) my hand in a class I'm enrolled in. Returns my place in line.
create or replace function public.raise_hand(p_class_id uuid, p_kind text default 'question', p_note text default null,
  p_page_path text default null, p_page_title text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); rid uuid; pos int; today_count int;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from public.enrollments e where e.class_id = p_class_id and e.user_id = uid) then
    raise exception 'not in this class';
  end if;
  select count(*) into today_count from public.help_requests
   where student_id = uid and created_at > now() - interval '1 day';
  if today_count >= 30 then raise exception 'too many requests today'; end if;
  select id into rid from public.help_requests
   where class_id = p_class_id and student_id = uid and status in ('raised', 'seen');
  if rid is null then
    insert into public.help_requests (class_id, student_id, kind, note, page_path, page_title)
    values (p_class_id, uid,
      case when p_kind in ('question', 'stuck', 'tech', 'other') then p_kind else 'question' end,
      nullif(left(btrim(coalesce(p_note, '')), 280), ''),
      left(p_page_path, 300), left(p_page_title, 200))
    returning id into rid;
  else
    update public.help_requests set
      kind = case when p_kind in ('question', 'stuck', 'tech', 'other') then p_kind else kind end,
      note = coalesce(nullif(left(btrim(coalesce(p_note, '')), 280), ''), note),
      page_path = coalesce(left(p_page_path, 300), page_path),
      page_title = coalesce(left(p_page_title, 200), page_title)
    where id = rid;
  end if;
  select count(*) into pos from public.help_requests h
   where h.class_id = p_class_id and h.status in ('raised', 'seen')
     and h.created_at <= (select created_at from public.help_requests where id = rid);
  return jsonb_build_object('id', rid, 'position', pos);
end; $$;

-- Lower my own hand.
create or replace function public.lower_hand(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.help_requests set status = 'lowered', closed_at = now()
   where id = p_id and student_id = auth.uid() and status in ('raised', 'seen');
end; $$;

-- Teacher: 'seen' (on my way) or 'resolved' (done). Only the class's teacher.
create or replace function public.handle_hand(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare cid uuid;
begin
  select class_id into cid from public.help_requests where id = p_id;
  if cid is null or not public.teaches_class(cid) then raise exception 'not allowed'; end if;
  if p_status = 'seen' then
    update public.help_requests set status = 'seen', seen_at = now(), handled_by = auth.uid()
     where id = p_id and status = 'raised';
  elsif p_status = 'resolved' then
    update public.help_requests set status = 'resolved', closed_at = now(), handled_by = auth.uid(),
      seen_at = coalesce(seen_at, now())
     where id = p_id and status in ('raised', 'seen');
  else
    raise exception 'bad status';
  end if;
end; $$;

-- Teacher: clear every open hand in a class (end of period).
create or replace function public.clear_hands(p_class_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.teaches_class(p_class_id) then raise exception 'not allowed'; end if;
  update public.help_requests set status = 'resolved', closed_at = now(), handled_by = auth.uid()
   where class_id = p_class_id and status in ('raised', 'seen');
end; $$;

revoke all on function public.raise_hand(uuid, text, text, text, text) from public, anon;
revoke all on function public.lower_hand(uuid) from public, anon;
revoke all on function public.handle_hand(uuid, text) from public, anon;
revoke all on function public.clear_hands(uuid) from public, anon;
grant execute on function public.raise_hand(uuid, text, text, text, text) to authenticated;
grant execute on function public.lower_hand(uuid) to authenticated;
grant execute on function public.handle_hand(uuid, text) to authenticated;
grant execute on function public.clear_hands(uuid) to authenticated;

-- ---------------------------------------------------------------- 4. Live updates
do $$ begin
  begin alter publication supabase_realtime add table public.help_requests; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.class_timers; exception when duplicate_object then null; end;
end $$;

-- ---------------------------------------------------------------- 5. nova_brief: include timer settings on today's items
CREATE OR REPLACE FUNCTION public.nova_brief()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid uuid := auth.uid();
  out jsonb := '[]'::jsonb;
  c record;
  is_teacher boolean;
  today date;
  prev date;
  items jsonb; due jsonb; missed jsonb; upd jsonb; ungraded int;
begin
  if uid is null then return jsonb_build_object('classes', '[]'::jsonb); end if;
  for c in
    select cl.id, cl.name, cl.section, cl.timezone, (cl.teacher_id = uid) as mine
    from public.classes cl
    where not cl.archived
      and (cl.teacher_id = uid or exists (select 1 from public.enrollments e where e.class_id = cl.id and e.user_id = uid))
    order by cl.created_at
    limit 12
  loop
    is_teacher := c.mine or public.teaches_class(c.id);
    today := (now() at time zone coalesce(nullif(c.timezone, ''), 'America/Chicago'))::date;
    select coalesce(jsonb_agg(x order by x->>'ord', x->>'title'), '[]'::jsonb) into items from (
      select jsonb_build_object('type', 'material', 'id', m.id, 'kind', m.kind, 'title', m.title, 'tag', m.tag, 'status', public.material_status(m.quiz_id, uid),
                                'due_at', m.due_at, 'timer_minutes', m.timer_minutes, 'timer_mode', m.timer_mode,
                                'ord', coalesce(array_position(array['do_now','lecture','activity','homework','exit_ticket','resource'], m.tag), 9)::text || lpad(m.position::text, 6, '0')) x
      from public.class_materials m
      where m.class_id = c.id and m.lesson_date = today and (is_teacher or m.published)
      union all
      select jsonb_build_object('type', 'assignment', 'id', a.id, 'kind', 'assignment', 'title', a.title, 'tag', a.tag,
                                'due_at', a.due_at, 'timer_minutes', a.timer_minutes, 'timer_mode', a.timer_mode,
                                'ord', coalesce(array_position(array['do_now','lecture','activity','homework','exit_ticket','resource'], a.tag), 9)::text || '000000',
                                'status', (select s.status from public.submissions s where s.assignment_id = a.id and s.student_id = uid))
      from public.assignments a
      where a.class_id = c.id and a.lesson_date = today and (is_teacher or a.status = 'published')
    ) t;
    select coalesce(jsonb_agg(x order by x->>'due_at'), '[]'::jsonb) into due from (
      select jsonb_build_object('type', 'assignment', 'id', a.id, 'kind', 'assignment', 'title', a.title, 'tag', a.tag, 'due_at', a.due_at,
                                'status', (select s.status from public.submissions s where s.assignment_id = a.id and s.student_id = uid)) x
      from public.assignments a
      where a.class_id = c.id and (is_teacher or a.status = 'published')
        and a.due_at between now() - interval '14 days' and now() + interval '7 days'
      union all
      select jsonb_build_object('type', 'material', 'id', m.id, 'kind', m.kind, 'title', m.title, 'tag', m.tag, 'due_at', m.due_at, 'status', public.material_status(m.quiz_id, uid))
      from public.class_materials m
      where m.class_id = c.id and (is_teacher or m.published)
        and m.due_at between now() - interval '2 days' and now() + interval '7 days'
    ) t;
    select max(d) into prev from (
      select m.lesson_date d from public.class_materials m where m.class_id = c.id and m.lesson_date < today and m.lesson_date >= today - 14 and (is_teacher or m.published)
      union all
      select a.lesson_date from public.assignments a where a.class_id = c.id and a.lesson_date < today and a.lesson_date >= today - 14 and (is_teacher or a.status = 'published')
    ) d;
    missed := '[]'::jsonb;
    if prev is not null then
      select coalesce(jsonb_agg(x order by x->>'title'), '[]'::jsonb) into missed from (
        select jsonb_build_object('type', 'material', 'id', m.id, 'kind', m.kind, 'title', m.title, 'tag', m.tag, 'due_at', m.due_at, 'status', public.material_status(m.quiz_id, uid)) x
        from public.class_materials m where m.class_id = c.id and m.lesson_date = prev and (is_teacher or m.published)
        union all
        select jsonb_build_object('type', 'assignment', 'id', a.id, 'kind', 'assignment', 'title', a.title, 'tag', a.tag, 'due_at', a.due_at,
                                  'status', (select s.status from public.submissions s where s.assignment_id = a.id and s.student_id = uid))
        from public.assignments a where a.class_id = c.id and a.lesson_date = prev and (is_teacher or a.status = 'published')
      ) t;
    end if;
    select jsonb_build_object('body', left(u.body, 400), 'created_at', u.created_at, 'pinned', u.pinned) into upd
    from public.class_updates u where u.class_id = c.id
    order by u.pinned desc, u.created_at desc limit 1;
    ungraded := null;
    if is_teacher then
      select count(*) into ungraded from public.submissions s join public.assignments a on a.id = s.assignment_id
      where a.class_id = c.id and s.status = 'submitted';
    end if;
    out := out || jsonb_build_array(jsonb_build_object(
      'id', c.id, 'name', c.name, 'section', c.section, 'teacher', is_teacher,
      'today', today, 'items', items, 'due', due, 'prev_date', prev, 'missed', missed,
      'update', upd, 'ungraded', ungraded));
  end loop;
  return jsonb_build_object('classes', out, 'now', now());
end; $function$;

-- ---------------------------------------------------------------- 6. My place in line (own hand only)
create or replace function public.hand_position(p_id uuid) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.help_requests h, public.help_requests me
   where me.id = p_id and me.student_id = auth.uid() and me.status in ('raised', 'seen')
     and h.class_id = me.class_id and h.status in ('raised', 'seen') and h.created_at <= me.created_at;
$$;
revoke all on function public.hand_position(uuid) from public, anon;
grant execute on function public.hand_position(uuid) to authenticated;

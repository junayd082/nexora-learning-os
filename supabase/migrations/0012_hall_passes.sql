-- NEXORA 1.0 — Hall passes
-- One student out at a time (per class setting). Every pass needs the teacher's approval.
-- Flow: pending → (teacher approves) → queued → out (automatically, when a spot is free) → back.
-- Classmates see the board (names, out/queued, times) but never another student's destination.

alter table public.classes
  add column if not exists passes_on boolean not null default true,
  add column if not exists pass_max_out smallint not null default 1 check (pass_max_out between 1 and 5),
  add column if not exists pass_minutes smallint not null default 8 check (pass_minutes between 1 and 60);

create table if not exists public.hall_passes (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  destination text not null default 'restroom' check (destination in ('restroom', 'water', 'nurse', 'office', 'other')),
  note text check (char_length(note) <= 200),
  with_classmate boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'denied', 'queued', 'out', 'back', 'cancelled', 'expired')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles(id) on delete set null,
  queued_at timestamptz,
  out_at timestamptz,
  back_at timestamptz
);
create unique index if not exists hall_one_open on public.hall_passes (class_id, student_id) where status in ('pending', 'queued', 'out');
create index if not exists hall_class_day_idx on public.hall_passes (class_id, requested_at desc);
alter table public.hall_passes enable row level security;

-- Direct reads: your own passes, or every pass in a class you teach. Classmates use pass_board().
drop policy if exists "passes: read" on public.hall_passes;
create policy "passes: read" on public.hall_passes for select to authenticated
  using (student_id = (select auth.uid()) or public.teaches_class(class_id));

-- A tiny per-class signal so every classmate's board refreshes live without seeing pass rows.
create table if not exists public.class_pulse (
  class_id uuid primary key references public.classes(id) on delete cascade,
  passes_at timestamptz not null default now()
);
alter table public.class_pulse enable row level security;
drop policy if exists "pulse: read" on public.class_pulse;
create policy "pulse: read" on public.class_pulse for select to authenticated
  using (public.teaches_class(class_id) or public.in_class(class_id));

create or replace function public.pulse_passes() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.class_pulse (class_id, passes_at) values (coalesce(new.class_id, old.class_id), now())
  on conflict (class_id) do update set passes_at = excluded.passes_at;
  return null;
end; $$;
drop trigger if exists hall_passes_pulse on public.hall_passes;
create trigger hall_passes_pulse after insert or update or delete on public.hall_passes
  for each row execute function public.pulse_passes();

-- Housekeeping: passes left open too long close themselves (forgotten "I'm back", end of day).
create or replace function public.tidy_passes(p_class_id uuid) returns void
language sql security definer set search_path = '' as $$
  update public.hall_passes set status = 'expired', back_at = coalesce(back_at, now())
   where class_id = p_class_id and (
         (status = 'out' and out_at < now() - interval '90 minutes')
      or (status in ('pending', 'queued') and requested_at < now() - interval '3 hours'));
$$;

-- Fill free spots from the line, oldest first.
create or replace function public.advance_passes(p_class_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare cap int; n_out int; nxt uuid;
begin
  select pass_max_out into cap from public.classes where id = p_class_id;
  loop
    select count(*) into n_out from public.hall_passes where class_id = p_class_id and status = 'out';
    exit when n_out >= coalesce(cap, 1);
    select id into nxt from public.hall_passes where class_id = p_class_id and status = 'queued'
     order by queued_at, requested_at limit 1 for update skip locked;
    exit when nxt is null;
    update public.hall_passes set status = 'out', out_at = now() where id = nxt;
  end loop;
end; $$;

-- Student: ask for a pass (or update the open one).
create or replace function public.request_pass(p_class_id uuid, p_destination text default 'restroom', p_note text default null, p_with_classmate boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); rid uuid; st text; on_ boolean; today_n int;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from public.enrollments e where e.class_id = p_class_id and e.user_id = uid) then raise exception 'not in this class'; end if;
  select passes_on into on_ from public.classes where id = p_class_id;
  if not coalesce(on_, false) then raise exception 'passes are off'; end if;
  perform public.tidy_passes(p_class_id);
  select count(*) into today_n from public.hall_passes where student_id = uid and requested_at > now() - interval '1 day';
  if today_n >= 12 then raise exception 'too many passes today'; end if;
  select id, status into rid, st from public.hall_passes where class_id = p_class_id and student_id = uid and status in ('pending', 'queued', 'out');
  if rid is null then
    insert into public.hall_passes (class_id, student_id, destination, note, with_classmate)
    values (p_class_id, uid,
      case when p_destination in ('restroom', 'water', 'nurse', 'office', 'other') then p_destination else 'other' end,
      nullif(left(btrim(coalesce(p_note, '')), 200), ''), coalesce(p_with_classmate, false))
    returning id, status into rid, st;
  elsif st = 'pending' then
    update public.hall_passes set
      destination = case when p_destination in ('restroom', 'water', 'nurse', 'office', 'other') then p_destination else destination end,
      note = coalesce(nullif(left(btrim(coalesce(p_note, '')), 200), ''), note),
      with_classmate = coalesce(p_with_classmate, with_classmate)
    where id = rid;
  end if;
  return jsonb_build_object('id', rid, 'status', st);
end; $$;

-- Teacher: approve (joins the line; goes out when a spot is free), approve_now (out right away), or deny.
create or replace function public.decide_pass(p_id uuid, p_action text) returns void
language plpgsql security definer set search_path = '' as $$
declare cid uuid;
begin
  select class_id into cid from public.hall_passes where id = p_id;
  if cid is null or not public.teaches_class(cid) then raise exception 'not allowed'; end if;
  if p_action = 'approve' then
    update public.hall_passes set status = 'queued', queued_at = now(), decided_at = now(), decided_by = auth.uid() where id = p_id and status = 'pending';
    perform public.advance_passes(cid);
  elsif p_action = 'approve_now' then
    update public.hall_passes set status = 'out', out_at = now(), queued_at = coalesce(queued_at, now()), decided_at = coalesce(decided_at, now()), decided_by = auth.uid()
     where id = p_id and status in ('pending', 'queued');
  elsif p_action = 'deny' then
    update public.hall_passes set status = 'denied', decided_at = now(), decided_by = auth.uid() where id = p_id and status in ('pending', 'queued');
    perform public.advance_passes(cid);
  else raise exception 'bad action'; end if;
end; $$;

-- Student (own) or teacher: "I'm back". The next student in line goes automatically.
create or replace function public.pass_back(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare cid uuid; sid uuid;
begin
  select class_id, student_id into cid, sid from public.hall_passes where id = p_id;
  if cid is null or not (sid = auth.uid() or public.teaches_class(cid)) then raise exception 'not allowed'; end if;
  update public.hall_passes set status = 'back', back_at = now() where id = p_id and status = 'out';
  perform public.advance_passes(cid);
end; $$;

-- Student (own, before leaving) or teacher (any open pass): cancel.
create or replace function public.cancel_pass(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare cid uuid; sid uuid;
begin
  select class_id, student_id into cid, sid from public.hall_passes where id = p_id;
  if cid is null then return; end if;
  if sid = auth.uid() then
    update public.hall_passes set status = 'cancelled', back_at = now() where id = p_id and status in ('pending', 'queued');
  elsif public.teaches_class(cid) then
    update public.hall_passes set status = 'cancelled', back_at = now() where id = p_id and status in ('pending', 'queued', 'out');
  else raise exception 'not allowed'; end if;
  perform public.advance_passes(cid);
end; $$;

-- The queue board for a class. Classmates get names and times; destinations and notes only for
-- the teacher and for the student's own pass. Pending requests are visible to the teacher and requester only.
create or replace function public.pass_board(p_class_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); is_t boolean; out_ jsonb; q jsonb; pend jsonb; cls record;
begin
  is_t := public.teaches_class(p_class_id);
  if not (is_t or public.in_class(p_class_id)) then raise exception 'not allowed'; end if;
  perform public.tidy_passes(p_class_id);
  select name, section, passes_on, pass_max_out, pass_minutes into cls from public.classes where id = p_class_id;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', h.id, 'name', coalesce(p.display_name, ''), 'mine', h.student_id = uid, 'student_id', case when is_t then h.student_id end,
      'destination', case when is_t or h.student_id = uid then h.destination end,
      'note', case when is_t or h.student_id = uid then h.note end,
      'with_classmate', h.with_classmate, 'out_at', h.out_at) order by h.out_at), '[]'::jsonb)
    into out_ from public.hall_passes h left join public.profiles p on p.id = h.student_id
   where h.class_id = p_class_id and h.status = 'out';
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', h.id, 'name', coalesce(p.display_name, ''), 'mine', h.student_id = uid, 'student_id', case when is_t then h.student_id end,
      'destination', case when is_t or h.student_id = uid then h.destination end,
      'note', case when is_t or h.student_id = uid then h.note end,
      'with_classmate', h.with_classmate, 'queued_at', h.queued_at) order by h.queued_at, h.requested_at), '[]'::jsonb)
    into q from public.hall_passes h left join public.profiles p on p.id = h.student_id
   where h.class_id = p_class_id and h.status = 'queued';
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', h.id, 'name', coalesce(p.display_name, ''), 'mine', h.student_id = uid, 'student_id', h.student_id,
      'destination', h.destination, 'note', h.note, 'with_classmate', h.with_classmate, 'requested_at', h.requested_at,
      'today', (select count(*) from public.hall_passes x where x.class_id = h.class_id and x.student_id = h.student_id and x.out_at > now() - interval '16 hours'),
      'week', (select count(*) from public.hall_passes x where x.class_id = h.class_id and x.student_id = h.student_id and x.out_at > now() - interval '7 days')
    ) order by h.requested_at), '[]'::jsonb)
    into pend from public.hall_passes h left join public.profiles p on p.id = h.student_id
   where h.class_id = p_class_id and h.status = 'pending' and (is_t or h.student_id = uid);
  return jsonb_build_object('class_id', p_class_id, 'name', cls.name, 'section', cls.section, 'teacher', is_t,
    'on', cls.passes_on, 'max_out', cls.pass_max_out, 'minutes', cls.pass_minutes,
    'out', out_, 'queue', q, 'pending', pend, 'now', now());
end; $$;

revoke all on function public.tidy_passes(uuid) from public, anon, authenticated;
revoke all on function public.advance_passes(uuid) from public, anon, authenticated;
revoke all on function public.pulse_passes() from public, anon, authenticated;
revoke all on function public.request_pass(uuid, text, text, boolean) from public, anon;
revoke all on function public.decide_pass(uuid, text) from public, anon;
revoke all on function public.pass_back(uuid) from public, anon;
revoke all on function public.cancel_pass(uuid) from public, anon;
revoke all on function public.pass_board(uuid) from public, anon;
grant execute on function public.request_pass(uuid, text, text, boolean) to authenticated;
grant execute on function public.decide_pass(uuid, text) to authenticated;
grant execute on function public.pass_back(uuid) to authenticated;
grant execute on function public.cancel_pass(uuid) to authenticated;
grant execute on function public.pass_board(uuid) to authenticated;

do $$ begin
  begin alter publication supabase_realtime add table public.hall_passes; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.class_pulse; exception when duplicate_object then null; end;
end $$;

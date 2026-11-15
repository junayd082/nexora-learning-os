-- ============================================================================
-- NEXORA 0.4 "Nova"
--   * Every material and assignment can be placed on a lesson day and tagged
--     (Do Now, Lecture, Activity, Homework, Exit ticket, Resource); files and links
--     can have their own due date.
--   * nova_brief(): everything Nova needs to answer "what are we doing today?"
-- Safe to run more than once.
-- ============================================================================

alter table public.classes add column if not exists timezone text not null default 'America/Chicago';

alter table public.class_materials add column if not exists lesson_date date;
alter table public.class_materials add column if not exists due_at timestamptz;
alter table public.class_materials add column if not exists tag text;
do $$ begin
  alter table public.class_materials add constraint class_materials_tag_check
    check (tag is null or tag in ('do_now', 'lecture', 'activity', 'homework', 'exit_ticket', 'resource'));
exception when duplicate_object then null; end $$;
create index if not exists class_materials_day_idx on public.class_materials(class_id, lesson_date);

alter table public.assignments add column if not exists lesson_date date;
alter table public.assignments add column if not exists tag text;
do $$ begin
  alter table public.assignments add constraint assignments_tag_check
    check (tag is null or tag in ('do_now', 'lecture', 'activity', 'homework', 'exit_ticket', 'resource'));
exception when duplicate_object then null; end $$;
create index if not exists assignments_day_idx on public.assignments(class_id, lesson_date);

-- ---------------------------------------------------------------------------
-- nova_brief(): one call, everything about "today" for the signed-in user.
-- Students see only published items in classes they belong to; teachers see their classes.
-- ---------------------------------------------------------------------------
create or replace function public.nova_brief()
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
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

    -- Today's items: materials + assignments placed on today's lesson day.
    select coalesce(jsonb_agg(x order by x->>'ord', x->>'title'), '[]'::jsonb) into items from (
      select jsonb_build_object('type', 'material', 'id', m.id, 'kind', m.kind, 'title', m.title, 'tag', m.tag,
                                'due_at', m.due_at, 'ord', coalesce(array_position(array['do_now','lecture','activity','homework','exit_ticket','resource'], m.tag), 9)::text || lpad(m.position::text, 6, '0')) x
      from public.class_materials m
      where m.class_id = c.id and m.lesson_date = today and (is_teacher or m.published)
      union all
      select jsonb_build_object('type', 'assignment', 'id', a.id, 'kind', 'assignment', 'title', a.title, 'tag', a.tag,
                                'due_at', a.due_at, 'ord', coalesce(array_position(array['do_now','lecture','activity','homework','exit_ticket','resource'], a.tag), 9)::text || '000000',
                                'status', (select s.status from public.submissions s where s.assignment_id = a.id and s.student_id = uid))
      from public.assignments a
      where a.class_id = c.id and a.lesson_date = today and (is_teacher or a.status = 'published')
    ) t;

    -- Due soon (next 7 days) and recently overdue (last 14 days, students: not yet submitted).
    select coalesce(jsonb_agg(x order by x->>'due_at'), '[]'::jsonb) into due from (
      select jsonb_build_object('type', 'assignment', 'id', a.id, 'kind', 'assignment', 'title', a.title, 'tag', a.tag, 'due_at', a.due_at,
                                'status', (select s.status from public.submissions s where s.assignment_id = a.id and s.student_id = uid)) x
      from public.assignments a
      where a.class_id = c.id and (is_teacher or a.status = 'published')
        and a.due_at between now() - interval '14 days' and now() + interval '7 days'
      union all
      select jsonb_build_object('type', 'material', 'id', m.id, 'kind', m.kind, 'title', m.title, 'tag', m.tag, 'due_at', m.due_at)
      from public.class_materials m
      where m.class_id = c.id and (is_teacher or m.published)
        and m.due_at between now() - interval '2 days' and now() + interval '7 days'
    ) t;

    -- What did I miss: the most recent earlier lesson day (within two weeks).
    select max(d) into prev from (
      select m.lesson_date d from public.class_materials m where m.class_id = c.id and m.lesson_date < today and m.lesson_date >= today - 14 and (is_teacher or m.published)
      union all
      select a.lesson_date from public.assignments a where a.class_id = c.id and a.lesson_date < today and a.lesson_date >= today - 14 and (is_teacher or a.status = 'published')
    ) d;
    missed := '[]'::jsonb;
    if prev is not null then
      select coalesce(jsonb_agg(x order by x->>'title'), '[]'::jsonb) into missed from (
        select jsonb_build_object('type', 'material', 'id', m.id, 'kind', m.kind, 'title', m.title, 'tag', m.tag, 'due_at', m.due_at) x
        from public.class_materials m where m.class_id = c.id and m.lesson_date = prev and (is_teacher or m.published)
        union all
        select jsonb_build_object('type', 'assignment', 'id', a.id, 'kind', 'assignment', 'title', a.title, 'tag', a.tag, 'due_at', a.due_at,
                                  'status', (select s.status from public.submissions s where s.assignment_id = a.id and s.student_id = uid))
        from public.assignments a where a.class_id = c.id and a.lesson_date = prev and (is_teacher or a.status = 'published')
      ) t;
    end if;

    -- Latest course update (pinned first).
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
end; $$;
revoke execute on function public.nova_brief() from public, anon;
grant execute on function public.nova_brief() to authenticated;

-- ============================================================================
-- NEXORA 0.5 "Checks" — Do Now, Exit Ticket and quizzes answered on the website.
--   * quizzes          one check (kind: do_now | exit_ticket | quiz) in a class
--   * quiz_questions   question text + public data (options…) + PRIVATE answer key
--   * quiz_attempts    a student's answers, auto-graded on submit
--   * bank_questions   each teacher's personal question bank
-- Students never read quiz_questions directly: quiz_take() returns questions without keys.
-- Safe to run more than once.
-- ============================================================================

create table if not exists public.quizzes (
  id                 uuid primary key default gen_random_uuid(),
  class_id           uuid not null references public.classes(id) on delete cascade,
  kind               text not null default 'do_now' check (kind in ('do_now', 'exit_ticket', 'quiz')),
  title              text not null check (char_length(title) between 1 and 200),
  instructions       text check (char_length(instructions) <= 4000),
  status             text not null default 'draft' check (status in ('draft', 'published', 'closed')),
  lesson_date        date,
  due_at             timestamptz,
  results_mode       text not null default 'answers' check (results_mode in ('answers', 'score', 'none')),
  released           boolean not null default false,
  shuffle_options    boolean not null default true,
  allow_retake       boolean not null default false,
  time_limit_minutes int check (time_limit_minutes is null or time_limit_minutes between 1 and 240),
  language           text not null default 'en',
  source_material_id uuid references public.class_materials(id) on delete set null,
  source_label       text,
  engine             text,
  created_by         uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  published_at       timestamptz
);
create index if not exists quizzes_class_idx on public.quizzes(class_id, lesson_date);

create table if not exists public.quiz_questions (
  id          uuid primary key default gen_random_uuid(),
  quiz_id     uuid not null references public.quizzes(id) on delete cascade,
  position    int not null default 0,
  type        text not null check (type in ('true_false', 'multiple_choice', 'ordering', 'short_answer', 'fill_blank', 'matching', 'text', 'page_break')),
  prompt      text not null default '' check (char_length(prompt) <= 4000),
  data        jsonb not null default '{}'::jsonb,   -- what students see (options, items…)
  key         jsonb not null default '{}'::jsonb,   -- answer key: teachers only
  points      numeric(6, 2) not null default 1 check (points >= 0 and points <= 100),
  explanation text check (char_length(explanation) <= 2000)
);
create index if not exists quiz_questions_quiz_idx on public.quiz_questions(quiz_id, position);

create table if not exists public.quiz_attempts (
  id            uuid primary key default gen_random_uuid(),
  quiz_id       uuid not null references public.quizzes(id) on delete cascade,
  student_id    uuid not null references public.profiles(id) on delete cascade,
  answers       jsonb not null default '{}'::jsonb,
  per_question  jsonb not null default '{}'::jsonb,  -- { qid: { "points": n|null, "max": n } }
  score         numeric(8, 2),
  max_score     numeric(8, 2),
  status        text not null default 'submitted' check (status in ('submitted', 'graded')),
  late          boolean not null default false,
  feedback      text check (char_length(feedback) <= 4000),
  started_at    timestamptz not null default now(),
  submitted_at  timestamptz not null default now(),
  graded_at     timestamptz,
  unique (quiz_id, student_id)
);
create index if not exists quiz_attempts_student_idx on public.quiz_attempts(student_id);

create table if not exists public.bank_questions (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  type        text not null check (type in ('true_false', 'multiple_choice', 'ordering', 'short_answer', 'fill_blank', 'matching', 'text')),
  prompt      text not null default '' check (char_length(prompt) <= 4000),
  data        jsonb not null default '{}'::jsonb,
  key         jsonb not null default '{}'::jsonb,
  points      numeric(6, 2) not null default 1,
  explanation text,
  topic       text check (char_length(topic) <= 120),
  created_at  timestamptz not null default now()
);
create index if not exists bank_questions_owner_idx on public.bank_questions(owner_id, topic);

-- Course materials can now be a check (shows in Materials, Today and Nova).
alter table public.class_materials add column if not exists quiz_id uuid references public.quizzes(id) on delete cascade;
alter table public.class_materials drop constraint if exists class_materials_kind_check;
alter table public.class_materials add constraint class_materials_kind_check
  check (kind in ('folder', 'experience', 'assignment', 'link', 'file', 'page', 'app', 'quiz'));

create or replace function public.quiz_class(qid uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select q.class_id from public.quizzes q where q.id = qid;
$$;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.bank_questions enable row level security;

drop policy if exists "quizzes: teacher all" on public.quizzes;
create policy "quizzes: teacher all" on public.quizzes for all to authenticated
  using (public.teaches_class(class_id)) with check (public.teaches_class(class_id));
drop policy if exists "quizzes: students read published" on public.quizzes;
create policy "quizzes: students read published" on public.quizzes for select to authenticated
  using (status in ('published', 'closed') and public.in_class(class_id));

drop policy if exists "questions: teacher all" on public.quiz_questions;
create policy "questions: teacher all" on public.quiz_questions for all to authenticated
  using (public.teaches_class(public.quiz_class(quiz_id))) with check (public.teaches_class(public.quiz_class(quiz_id)));

drop policy if exists "attempts: own read" on public.quiz_attempts;
create policy "attempts: own read" on public.quiz_attempts for select to authenticated
  using (student_id = (select auth.uid()) or public.teaches_class(public.quiz_class(quiz_id)));
drop policy if exists "attempts: teacher deletes" on public.quiz_attempts;
create policy "attempts: teacher deletes" on public.quiz_attempts for delete to authenticated
  using (public.teaches_class(public.quiz_class(quiz_id)));

drop policy if exists "bank: owner" on public.bank_questions;
create policy "bank: owner" on public.bank_questions for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()) and public.is_educator());

-- ---------------------------------------------------------------------------
-- Grading one answer → fraction 0..1, or null when a teacher must grade it.
-- ---------------------------------------------------------------------------
create or replace function public.quiz_norm(t text) returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(lower(trim(coalesce(t, ''))), '\s+', ' ', 'g');
$$;

create or replace function public.quiz_grade_one(p_type text, p_key jsonb, p_answer jsonb)
returns numeric language plpgsql immutable set search_path = '' as $$
declare n int; ok int := 0; i int; k text; accepted jsonb;
begin
  if p_answer is null or p_answer = 'null'::jsonb then
    return case when p_type = 'short_answer' then null else 0 end;
  end if;
  case p_type
    when 'true_false' then
      return case when jsonb_typeof(p_answer) = 'boolean' and p_answer = (p_key->'answer') then 1 else 0 end;
    when 'multiple_choice' then
      if jsonb_typeof(p_answer) <> 'array' then return 0; end if;
      return case when (select coalesce(array_agg(v order by v), '{}') from jsonb_array_elements_text(p_answer) v)
                     = (select coalesce(array_agg(v order by v), '{}') from jsonb_array_elements_text(p_key->'correct') v)
             then 1 else 0 end;
    when 'ordering' then
      n := jsonb_array_length(coalesce(p_key->'order', '[]'::jsonb));
      if n = 0 or jsonb_typeof(p_answer) <> 'array' then return 0; end if;
      for i in 0 .. n - 1 loop
        if p_answer->>i = p_key->'order'->>i then ok := ok + 1; end if;
      end loop;
      return round(ok::numeric / n, 4);
    when 'fill_blank' then
      n := jsonb_array_length(coalesce(p_key->'answers', '[]'::jsonb));
      if n = 0 or jsonb_typeof(p_answer) <> 'array' then return 0; end if;
      for i in 0 .. n - 1 loop
        accepted := p_key->'answers'->i;
        if exists (select 1 from jsonb_array_elements_text(accepted) a where public.quiz_norm(a) = public.quiz_norm(p_answer->>i) and public.quiz_norm(a) <> '') then
          ok := ok + 1;
        end if;
      end loop;
      return round(ok::numeric / n, 4);
    when 'matching' then
      select count(*) into n from jsonb_object_keys(coalesce(p_key->'pairs', '{}'::jsonb));
      if n = 0 or jsonb_typeof(p_answer) <> 'object' then return 0; end if;
      for k in select jsonb_object_keys(p_key->'pairs') loop
        if p_answer->>k = p_key->'pairs'->>k then ok := ok + 1; end if;
      end loop;
      return round(ok::numeric / n, 4);
    when 'short_answer' then
      return null;
    else
      return null;
  end case;
end; $$;

-- ---------------------------------------------------------------------------
-- quiz_take(): the check as a student sees it (no answer keys; shuffled per student).
-- ---------------------------------------------------------------------------
create or replace function public.quiz_take(p_quiz uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare q public.quizzes; uid uuid := auth.uid(); qs jsonb; att jsonb;
begin
  select * into q from public.quizzes where id = p_quiz;
  if not found or not (public.in_class(q.class_id) or public.teaches_class(q.class_id)) then
    raise exception 'Check not found.' using errcode = '42501';
  end if;
  if q.status = 'draft' and not public.teaches_class(q.class_id) then
    raise exception 'Check not found.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', x.id, 'type', x.type, 'prompt', x.prompt, 'points', x.points, 'position', x.position,
    'data', case
      when x.type = 'multiple_choice' and q.shuffle_options then jsonb_set(x.data, '{options}', coalesce((
        select jsonb_agg(o order by md5((o->>'id') || uid::text || x.id::text)) from jsonb_array_elements(x.data->'options') o), '[]'::jsonb))
      when x.type = 'ordering' then jsonb_set(x.data, '{items}', coalesce((
        select jsonb_agg(o order by md5((o->>'id') || uid::text || x.id::text)) from jsonb_array_elements(x.data->'items') o), '[]'::jsonb))
      when x.type = 'matching' then jsonb_set(x.data, '{right}', coalesce((
        select jsonb_agg(o order by md5((o->>'id') || uid::text || x.id::text)) from jsonb_array_elements(x.data->'right') o), '[]'::jsonb))
      else x.data end
  ) order by x.position), '[]'::jsonb) into qs
  from public.quiz_questions x where x.quiz_id = p_quiz;

  select to_jsonb(a) - 'per_question' into att from public.quiz_attempts a where a.quiz_id = p_quiz and a.student_id = uid;

  return jsonb_build_object(
    'quiz', jsonb_build_object('id', q.id, 'class_id', q.class_id, 'kind', q.kind, 'title', q.title, 'instructions', q.instructions,
      'status', q.status, 'due_at', q.due_at, 'lesson_date', q.lesson_date, 'results_mode', q.results_mode, 'released', q.released,
      'allow_retake', q.allow_retake, 'time_limit_minutes', q.time_limit_minutes, 'language', q.language),
    'questions', qs, 'attempt', att);
end; $$;
revoke execute on function public.quiz_take(uuid) from public, anon;
grant execute on function public.quiz_take(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- quiz_submit(): auto-grades everything except short answers.
-- ---------------------------------------------------------------------------
create or replace function public.quiz_submit(p_quiz uuid, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare q public.quizzes; uid uuid := auth.uid(); x record; frac numeric; pq jsonb := '{}'::jsonb;
        total numeric := 0; maxs numeric := 0; manual boolean := false; existing public.quiz_attempts; r public.quiz_attempts;
begin
  select * into q from public.quizzes where id = p_quiz;
  if not found or q.status = 'draft' or not public.in_class(q.class_id) then
    raise exception 'Check not found.' using errcode = '42501';
  end if;
  if q.status = 'closed' then raise exception 'This check is closed.' using errcode = '22023'; end if;
  p_answers := coalesce(p_answers, '{}'::jsonb);
  if jsonb_typeof(p_answers) <> 'object' or length(p_answers::text) > 60000 then
    raise exception 'Bad answers.' using errcode = '22023';
  end if;
  select * into existing from public.quiz_attempts where quiz_id = p_quiz and student_id = uid;
  if found and not q.allow_retake then raise exception 'You already turned this in.' using errcode = '22023'; end if;

  for x in select * from public.quiz_questions where quiz_id = p_quiz and type not in ('text', 'page_break') loop
    frac := public.quiz_grade_one(x.type, x.key, p_answers->(x.id::text));
    maxs := maxs + x.points;
    if frac is null then
      manual := manual or x.points > 0;
      pq := pq || jsonb_build_object(x.id::text, jsonb_build_object('points', null, 'max', x.points));
    else
      total := total + round(frac * x.points, 2);
      pq := pq || jsonb_build_object(x.id::text, jsonb_build_object('points', round(frac * x.points, 2), 'max', x.points));
    end if;
  end loop;

  insert into public.quiz_attempts (quiz_id, student_id, answers, per_question, score, max_score, status, late, submitted_at, graded_at)
  values (p_quiz, uid, p_answers, pq, total, maxs, case when manual then 'submitted' else 'graded' end,
          q.due_at is not null and now() > q.due_at, now(), case when manual then null else now() end)
  on conflict (quiz_id, student_id) do update
    set answers = excluded.answers, per_question = excluded.per_question, score = excluded.score, max_score = excluded.max_score,
        status = excluded.status, late = excluded.late, submitted_at = now(), graded_at = excluded.graded_at, feedback = null
  returning * into r;
  perform public.log_event('check.submitted', 'quiz', p_quiz);
  return public.quiz_result(p_quiz);
end; $$;

-- ---------------------------------------------------------------------------
-- quiz_result(): a student's own result; answers revealed when the teacher allows it.
-- ---------------------------------------------------------------------------
create or replace function public.quiz_result(p_quiz uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare q public.quizzes; a public.quiz_attempts; uid uuid := auth.uid(); reveal boolean; show_score boolean; qs jsonb;
begin
  select * into q from public.quizzes where id = p_quiz;
  if not found or not public.in_class(q.class_id) then raise exception 'Check not found.' using errcode = '42501'; end if;
  select * into a from public.quiz_attempts where quiz_id = p_quiz and student_id = uid;
  if not found then return jsonb_build_object('attempt', null); end if;
  reveal := q.results_mode = 'answers' or q.released;
  show_score := q.results_mode <> 'none' or q.released;
  if reveal then
    select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'key', x.key, 'explanation', x.explanation,
      'points', a.per_question->x.id::text->'points', 'max', x.points) order by x.position), '[]'::jsonb) into qs
    from public.quiz_questions x where x.quiz_id = p_quiz and x.type not in ('text', 'page_break');
  end if;
  return jsonb_build_object(
    'attempt', jsonb_build_object('id', a.id, 'answers', a.answers, 'status', a.status, 'late', a.late, 'submitted_at', a.submitted_at,
      'feedback', a.feedback,
      'score', case when show_score then a.score end, 'max_score', case when show_score then a.max_score end),
    'reveal', reveal, 'show_score', show_score, 'questions', coalesce(qs, '[]'::jsonb));
end; $$;
revoke execute on function public.quiz_submit(uuid, jsonb) from public, anon;
grant execute on function public.quiz_submit(uuid, jsonb) to authenticated;
revoke execute on function public.quiz_result(uuid) from public, anon;
grant execute on function public.quiz_result(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- quiz_grade(): the teacher scores short answers (or overrides any question).
-- ---------------------------------------------------------------------------
create or replace function public.quiz_grade(p_attempt uuid, p_points jsonb, p_feedback text default null)
returns public.quiz_attempts language plpgsql security definer set search_path = '' as $$
declare a public.quiz_attempts; k text; pq jsonb; total numeric := 0; pending boolean := false; v jsonb; mx numeric;
begin
  select * into a from public.quiz_attempts where id = p_attempt;
  if not found or not public.teaches_class(public.quiz_class(a.quiz_id)) then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  pq := a.per_question;
  for k in select jsonb_object_keys(coalesce(p_points, '{}'::jsonb)) loop
    if pq ? k then
      mx := (pq->k->>'max')::numeric;
      pq := jsonb_set(pq, array[k, 'points'], to_jsonb(greatest(0, least(mx, (p_points->>k)::numeric))));
    end if;
  end loop;
  for k, v in select * from jsonb_each(pq) loop
    if v->'points' is null or v->'points' = 'null'::jsonb then pending := true; else total := total + (v->>'points')::numeric; end if;
  end loop;
  update public.quiz_attempts
     set per_question = pq, score = total, status = case when pending then 'submitted' else 'graded' end,
         graded_at = case when pending then null else now() end,
         feedback = coalesce(nullif(trim(p_feedback), ''), feedback)
   where id = p_attempt returning * into a;
  return a;
end; $$;
revoke execute on function public.quiz_grade(uuid, jsonb, text) from public, anon;
grant execute on function public.quiz_grade(uuid, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Nova knows when a student already answered today's Do Now.
-- ---------------------------------------------------------------------------
create or replace function public.material_status(p_quiz uuid, p_uid uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case when p_quiz is null then null
              else (select case when a.status = 'graded' then 'returned' else 'submitted' end
                    from public.quiz_attempts a where a.quiz_id = p_quiz and a.student_id = p_uid) end;
$$;

-- nova_brief() again, now with the student's status on checks.
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
      select jsonb_build_object('type', 'material', 'id', m.id, 'kind', m.kind, 'title', m.title, 'tag', m.tag, 'status', public.material_status(m.quiz_id, uid),
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
      select jsonb_build_object('type', 'material', 'id', m.id, 'kind', m.kind, 'title', m.title, 'tag', m.tag, 'due_at', m.due_at, 'status', public.material_status(m.quiz_id, uid))
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
        select jsonb_build_object('type', 'material', 'id', m.id, 'kind', m.kind, 'title', m.title, 'tag', m.tag, 'due_at', m.due_at, 'status', public.material_status(m.quiz_id, uid)) x
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

-- Live results: teachers watch answers arrive.
do $$ begin
  alter publication supabase_realtime add table public.quiz_attempts;
exception when duplicate_object then null; end $$;

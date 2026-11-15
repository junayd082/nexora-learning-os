-- NEXORA 0.1 — demo safety and live-session visibility.

-- Students see a live session started for a class they are in, so Home can show "JOIN".
drop policy if exists "sessions: class members read live" on public.live_sessions;
create policy "sessions: class members read live" on public.live_sessions for select to authenticated
  using (status = 'live' and class_id is not null and public.in_class(class_id));

-- Shared demo accounts can never publish to the public library.
create or replace function public.guard_demo_experience() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.profiles p where p.id = new.creator_id and p.is_demo) then
    new.visibility := 'private';
    new.is_demo := true;
  end if;
  return new;
end; $$;
revoke execute on function public.guard_demo_experience() from public, anon, authenticated;
drop trigger if exists experiences_guard_demo on public.experiences;
create trigger experiences_guard_demo before insert or update on public.experiences
  for each row execute function public.guard_demo_experience();

-- Classes made by demo teachers are labelled as demo content.
create or replace function public.guard_demo_class() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.profiles p where p.id = new.teacher_id and p.is_demo) then
    new.is_demo := true;
  end if;
  return new;
end; $$;
revoke execute on function public.guard_demo_class() from public, anon, authenticated;
drop trigger if exists classes_guard_demo on public.classes;
create trigger classes_guard_demo before insert or update on public.classes
  for each row execute function public.guard_demo_class();

-- Portfolio items shared with "teachers" are readable by the student's teachers; public items need no login.
drop policy if exists "portfolio: shared read" on public.portfolio_items;
create policy "portfolio: shared read" on public.portfolio_items for select to anon, authenticated
  using (visibility = 'public' or (visibility = 'teachers' and public.teaches_student(user_id)));

-- New class code on request (teacher only).
create or replace function public.regenerate_join_code(p_class_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare c text;
begin
  if not exists (select 1 from public.classes k where k.id = p_class_id and k.teacher_id = auth.uid()) then
    raise exception 'You do not teach that class.' using errcode = '42501';
  end if;
  c := public.gen_join_code();
  update public.classes set join_code = c where id = p_class_id;
  perform public.audit('class.code_regenerated', 'class', p_class_id);
  return c;
end; $$;
revoke execute on function public.regenerate_join_code(uuid) from public, anon;
grant execute on function public.regenerate_join_code(uuid) to authenticated;

-- End a live session (host only).
create or replace function public.end_session(p_session_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.live_sessions set status = 'ended', ended_at = now()
   where id = p_session_id and host_id = auth.uid() and status = 'live';
end; $$;
revoke execute on function public.end_session(uuid) from public, anon;
grant execute on function public.end_session(uuid) to authenticated;

-- Full personal data export (data portability).
create or replace function public.export_my_data() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Sign in first.' using errcode = '28000'; end if;
  return jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = uid),
    'enrollments', coalesce((select jsonb_agg(jsonb_build_object('class', c.name, 'section', c.section, 'joined_at', e.joined_at))
                    from public.enrollments e join public.classes c on c.id = e.class_id where e.user_id = uid), '[]'::jsonb),
    'submissions', coalesce((select jsonb_agg(jsonb_build_object('assignment', a.title, 'body', s.body, 'url', s.url, 'submitted_at', s.submitted_at,
                    'score', s.score, 'points', a.points, 'feedback', s.feedback, 'status', s.status))
                    from public.submissions s join public.assignments a on a.id = s.assignment_id where s.student_id = uid), '[]'::jsonb),
    'portfolio', coalesce((select jsonb_agg(to_jsonb(i)) from public.portfolio_items i where i.user_id = uid), '[]'::jsonb),
    'favorites', coalesce((select jsonb_agg(x.slug) from public.favorites f join public.experiences x on x.id = f.experience_id where f.user_id = uid), '[]'::jsonb),
    'experiences_created', coalesce((select jsonb_agg(x.slug) from public.experiences x where x.creator_id = uid), '[]'::jsonb)
  );
end; $$;
revoke execute on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;

-- Admin audit read with actor names.
create or replace function public.admin_audit(p_limit int default 100)
returns table (id bigint, actor text, action text, entity_type text, details jsonb, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'Administrators only.' using errcode = '42501'; end if;
  return query select l.id, coalesce(p.display_name, '—'), l.action, l.entity_type, l.details, l.created_at
    from public.audit_logs l left join public.profiles p on p.id = l.actor_id
    order by l.created_at desc limit greatest(1, least(p_limit, 500));
end; $$;
revoke execute on function public.admin_audit(int) from public, anon;
grant execute on function public.admin_audit(int) to authenticated;
-- NEXORA demo accounts (shared, labelled, can be switched off with the demo_accounts flag).
-- Passwords are public on purpose: these accounts hold only sample data and cannot publish.
do $$
declare
  t_id uuid := 'd0000000-0000-4000-8000-00000000000a';
  s_id uuid := 'd0000000-0000-4000-8000-00000000000b';
  cls  uuid;
  a1   uuid;
  a2   uuid;
begin
  if exists (select 1 from auth.users where id = t_id) then return; end if;

  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  values
    ('00000000-0000-0000-0000-000000000000', t_id, 'authenticated', 'authenticated', 'demo.teacher@nexora.demo',
     extensions.crypt('nexora-demo-teacher', extensions.gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}', '{"display_name":"Demo Teacher","role":"teacher","is_demo":true}',
     now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', s_id, 'authenticated', 'authenticated', 'demo.student@nexora.demo',
     extensions.crypt('nexora-demo-student', extensions.gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}', '{"display_name":"Alex (demo)","role":"student","is_demo":true}',
     now(), now(), '', '', '', '');

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values
    (gen_random_uuid(), t_id, t_id::text, jsonb_build_object('sub', t_id::text, 'email', 'demo.teacher@nexora.demo', 'email_verified', true), 'email', now(), now(), now()),
    (gen_random_uuid(), s_id, s_id::text, jsonb_build_object('sub', s_id::text, 'email', 'demo.student@nexora.demo', 'email_verified', true), 'email', now(), now(), now());

  insert into public.classes (teacher_id, name, section, subject, description, is_demo)
  values (t_id, 'Architecture & Construction (Demo)', 'Period 2', 'Architecture & Construction',
          'Sample class for trying NEXORA. Everything here is demo content.', true)
  returning id into cls;
  insert into public.enrollments (class_id, user_id) values (cls, s_id);

  insert into public.assignments (class_id, experience_id, title, instructions, due_at, points, submission_type, created_by)
  values (cls, (select id from public.experiences where slug = 'autocad-l1-workspace-website'),
          'Lesson 1 — Workspace lab', 'Work through the lab, then paste your quick-check score and one thing you learned.',
          now() - interval '2 days', 20, 'text_or_url', t_id)
  returning id into a1;
  insert into public.assignments (class_id, experience_id, title, instructions, due_at, points, submission_type, created_by)
  values (cls, (select id from public.experiences where slug = 'autocad-l2-lines-website'),
          'Lesson 2 — Precise lines', 'Draw the practice rectangle at exactly 30''-0" × 24''-0". Submit a link to your exported PDF.',
          now() + interval '3 days', 20, 'text_or_url', t_id)
  returning id into a2;

  insert into public.submissions (assignment_id, student_id, body, status, submitted_at, score, feedback, graded_at, graded_by)
  values (a1, s_id, 'Quick check 5/5. I learned that the command line tells you what AutoCAD wants next — read it before you click.',
          'returned', now() - interval '3 days', 19, 'Great habit. Next time also name the Model and Layout tabs in your answer.', now() - interval '1 day', t_id);
end $$;

-- ============================================================================
-- NEXORA 0.3 "Connected"
--   * File storage: teachers upload experiences and course files; students upload submissions
--   * Course materials (Schoology-style folders), course updates (announcements)
--   * App Center: built-in and custom apps, pinned per class
-- Safe to run more than once.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.try_uuid(t text) returns uuid
language plpgsql immutable set search_path = '' as $$
begin return t::uuid; exception when others then return null; end; $$;

-- Students can open private experiences and apps their teacher placed in their class.
-- (plpgsql so they can be defined before the tables they read.)
create or replace function public.app_in_my_materials(aid uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  return exists (select 1 from public.class_materials m where m.app_id = aid and m.published and public.in_class(m.class_id));
end; $$;
create or replace function public.experience_in_my_class(eid uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  return exists (select 1 from public.class_materials m where m.experience_id = eid and m.published and public.in_class(m.class_id))
      or exists (select 1 from public.assignments a where a.experience_id = eid and a.status = 'published' and public.in_class(a.class_id));
end; $$;

create or replace function public.is_demo_user() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.is_demo from public.profiles p where p.id = auth.uid()), false);
$$;

-- ---------------------------------------------------------------------------
-- Experiences: files, apps and pages as sources (not only links)
-- ---------------------------------------------------------------------------
alter type public.experience_type add value if not exists 'document';
alter type public.experience_type add value if not exists 'presentation';
alter type public.experience_type add value if not exists 'spreadsheet';
alter type public.experience_type add value if not exists 'image';
alter type public.experience_type add value if not exists 'audio';
alter type public.experience_type add value if not exists 'model3d';
alter type public.experience_type add value if not exists 'file';
alter type public.experience_type add value if not exists 'app';

alter table public.experiences add column if not exists source text not null default 'link';
alter table public.experiences add column if not exists file_path text;
alter table public.experiences add column if not exists file_name text;
alter table public.experiences add column if not exists file_mime text;
alter table public.experiences add column if not exists file_size bigint;
alter table public.experiences add column if not exists app_id uuid;
alter table public.experiences add column if not exists launch_mode text not null default 'embed';
do $$ begin
  alter table public.experiences add constraint experiences_source_check check (source in ('link', 'file', 'app'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.experiences add constraint experiences_launch_mode_check check (launch_mode in ('embed', 'newtab'));
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- App Center
-- ---------------------------------------------------------------------------
create table if not exists public.apps (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name            text not null check (char_length(name) between 1 and 80),
  category        text not null default 'other',
  url             text not null check (url ~* '^https://'),
  launch_mode     text not null default 'newtab' check (launch_mode in ('embed', 'newtab')),
  color           text not null default '#8758FF',
  description     text,
  description_es  text,
  is_builtin      boolean not null default false,
  owner_id        uuid references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  visibility      text not null default 'private' check (visibility in ('private', 'organization', 'public')),
  created_at      timestamptz not null default now()
);

do $$ begin
  alter table public.experiences add constraint experiences_app_fk foreign key (app_id) references public.apps(id) on delete set null;
exception when duplicate_object then null; end $$;

create table if not exists public.class_apps (
  class_id     uuid not null references public.classes(id) on delete cascade,
  app_id       uuid not null references public.apps(id) on delete cascade,
  url_override text check (url_override is null or url_override ~* '^https://'),
  position     int not null default 0,
  primary key (class_id, app_id)
);

alter table public.apps enable row level security;
alter table public.class_apps enable row level security;

drop policy if exists "apps: read" on public.apps;
create policy "apps: read" on public.apps for select to anon, authenticated
  using (is_builtin or visibility = 'public' or owner_id = (select auth.uid())
         or (visibility = 'organization' and organization_id is not null and organization_id = public.my_org())
         or exists (select 1 from public.class_apps ca where ca.app_id = apps.id and (public.in_class(ca.class_id) or public.teaches_class(ca.class_id)))
         or public.app_in_my_materials(apps.id));
drop policy if exists "apps: educators create" on public.apps;
create policy "apps: educators create" on public.apps for insert to authenticated
  with check (public.is_educator() and owner_id = (select auth.uid()) and not is_builtin and not public.is_demo_user());
drop policy if exists "apps: owner updates" on public.apps;
create policy "apps: owner updates" on public.apps for update to authenticated
  using (owner_id = (select auth.uid()) and not is_builtin) with check (owner_id = (select auth.uid()) and not is_builtin);
drop policy if exists "apps: owner deletes" on public.apps;
create policy "apps: owner deletes" on public.apps for delete to authenticated
  using ((owner_id = (select auth.uid()) and not is_builtin) or public.is_platform_admin());

drop policy if exists "class apps: read" on public.class_apps;
create policy "class apps: read" on public.class_apps for select to authenticated
  using (public.in_class(class_id) or public.teaches_class(class_id));
drop policy if exists "class apps: teacher writes" on public.class_apps;
create policy "class apps: teacher writes" on public.class_apps for all to authenticated
  using (public.teaches_class(class_id)) with check (public.teaches_class(class_id));

-- Built-in catalogue. Brand names are used only to label links to each service.
insert into public.apps (slug, name, category, url, launch_mode, color, description, description_es, is_builtin, visibility) values
  ('schoology', 'Schoology', 'lms', 'https://app.schoology.com/home', 'newtab', '#2E7DD1', 'Your district learning management system. Pin it to a class with the course link.', 'El sistema de gestión del aprendizaje de tu distrito. Fíjalo a una clase con el enlace del curso.', true, 'public'),
  ('google-classroom', 'Google Classroom', 'lms', 'https://classroom.google.com', 'newtab', '#1E8E3E', 'Google Classroom courses and assignments.', 'Cursos y tareas de Google Classroom.', true, 'public'),
  ('autocad-web', 'AutoCAD Web', 'cad', 'https://web.autocad.com', 'newtab', '#C8102E', 'Open and edit DWG drawings in the browser (Autodesk account required).', 'Abre y edita dibujos DWG en el navegador (requiere cuenta de Autodesk).', true, 'public'),
  ('tinkercad', 'Tinkercad', 'cad', 'https://www.tinkercad.com', 'newtab', '#E9573F', '3D design, electronics and coding for beginners.', 'Diseño 3D, electrónica y programación para principiantes.', true, 'public'),
  ('onshape', 'Onshape', 'cad', 'https://cad.onshape.com', 'newtab', '#3C6E9E', 'Browser-based professional CAD (free education plan).', 'CAD profesional en el navegador (plan educativo gratuito).', true, 'public'),
  ('sketchup', 'SketchUp for Schools', 'cad', 'https://edu.sketchup.com', 'newtab', '#C1272D', '3D modeling for architecture in the browser.', 'Modelado 3D para arquitectura en el navegador.', true, 'public'),
  ('google-drive', 'Google Drive', 'google', 'https://drive.google.com', 'newtab', '#1A73E8', 'Files and folders. Paste any Drive link into NEXORA to preview it.', 'Archivos y carpetas. Pega cualquier enlace de Drive en NEXORA para verlo.', true, 'public'),
  ('google-docs', 'Google Docs', 'google', 'https://docs.google.com/document/u/0/', 'newtab', '#4285F4', 'Documents.', 'Documentos.', true, 'public'),
  ('google-slides', 'Google Slides', 'google', 'https://docs.google.com/presentation/u/0/', 'newtab', '#F4B400', 'Presentations.', 'Presentaciones.', true, 'public'),
  ('google-sheets', 'Google Sheets', 'google', 'https://docs.google.com/spreadsheets/u/0/', 'newtab', '#0F9D58', 'Spreadsheets.', 'Hojas de cálculo.', true, 'public'),
  ('google-forms', 'Google Forms', 'google', 'https://docs.google.com/forms/u/0/', 'newtab', '#7248B9', 'Quizzes and surveys.', 'Cuestionarios y encuestas.', true, 'public'),
  ('microsoft-365', 'Microsoft 365', 'productivity', 'https://www.office.com', 'newtab', '#D83B01', 'Word, Excel, PowerPoint and OneDrive.', 'Word, Excel, PowerPoint y OneDrive.', true, 'public'),
  ('canva', 'Canva for Education', 'create', 'https://www.canva.com/education/', 'newtab', '#00C4CC', 'Design posters, presentations and portfolios.', 'Diseña pósteres, presentaciones y portafolios.', true, 'public'),
  ('youtube', 'YouTube', 'media', 'https://www.youtube.com', 'newtab', '#FF0000', 'Videos. Paste a video link into NEXORA to embed it.', 'Videos. Pega un enlace de video en NEXORA para insertarlo.', true, 'public'),
  ('edpuzzle', 'Edpuzzle', 'media', 'https://edpuzzle.com', 'newtab', '#5B44C5', 'Interactive video lessons.', 'Lecciones de video interactivas.', true, 'public'),
  ('nearpod', 'Nearpod', 'engage', 'https://nearpod.com', 'newtab', '#3F5BD8', 'Interactive lessons and live participation.', 'Lecciones interactivas y participación en vivo.', true, 'public'),
  ('kahoot', 'Kahoot!', 'engage', 'https://kahoot.it', 'newtab', '#46178F', 'Game-based quizzes — students join with a PIN.', 'Cuestionarios en forma de juego: los estudiantes entran con un PIN.', true, 'public'),
  ('quizlet', 'Quizlet', 'engage', 'https://quizlet.com', 'newtab', '#4255FF', 'Flashcards and study sets.', 'Tarjetas y sets de estudio.', true, 'public'),
  ('kami', 'Kami', 'productivity', 'https://web.kamihq.com', 'newtab', '#2E9CF4', 'Annotate PDFs and documents.', 'Anota PDF y documentos.', true, 'public'),
  ('desmos', 'Desmos', 'math', 'https://www.desmos.com/calculator', 'newtab', '#2F7D32', 'Graphing calculator.', 'Calculadora gráfica.', true, 'public'),
  ('phet', 'PhET Simulations', 'science', 'https://phet.colorado.edu', 'newtab', '#E8811A', 'Free physics, chemistry and math simulations.', 'Simulaciones gratuitas de física, química y matemáticas.', true, 'public'),
  ('khan-academy', 'Khan Academy', 'learn', 'https://www.khanacademy.org', 'newtab', '#14BF96', 'Free lessons and practice.', 'Lecciones y práctica gratuitas.', true, 'public'),
  ('icev', 'iCEV', 'cte', 'https://www.icevonline.com', 'newtab', '#0B5394', 'CTE curriculum and industry certifications.', 'Currículo CTE y certificaciones de la industria.', true, 'public'),
  ('ixl', 'IXL', 'learn', 'https://www.ixl.com', 'newtab', '#3FA535', 'Skill practice.', 'Práctica de habilidades.', true, 'public'),
  ('britannica', 'Britannica School', 'research', 'https://school.eb.com', 'newtab', '#1F3B70', 'Encyclopedia and research.', 'Enciclopedia e investigación.', true, 'public')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Course materials (folders + items) and course updates
-- ---------------------------------------------------------------------------
create table if not exists public.class_materials (
  id            uuid primary key default gen_random_uuid(),
  class_id      uuid not null references public.classes(id) on delete cascade,
  parent_id     uuid references public.class_materials(id) on delete cascade,
  kind          text not null check (kind in ('folder', 'experience', 'assignment', 'link', 'file', 'page', 'app')),
  title         text not null check (char_length(title) between 1 and 200),
  body          text check (char_length(body) <= 20000),
  color         text,
  experience_id uuid references public.experiences(id) on delete cascade,
  assignment_id uuid references public.assignments(id) on delete cascade,
  app_id        uuid references public.apps(id) on delete cascade,
  url           text check (url is null or url ~* '^https?://'),
  file_path     text,
  file_name     text,
  file_mime     text,
  file_size     bigint,
  position      int not null default 0,
  published     boolean not null default true,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists class_materials_class_idx on public.class_materials(class_id, parent_id, position);

create table if not exists public.class_updates (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid not null references public.classes(id) on delete cascade,
  author_id  uuid references public.profiles(id) on delete set null,
  body       text not null check (char_length(body) between 1 and 5000),
  pinned     boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists class_updates_class_idx on public.class_updates(class_id, created_at desc);

alter table public.class_materials enable row level security;
alter table public.class_updates enable row level security;

drop policy if exists "materials: read" on public.class_materials;
create policy "materials: read" on public.class_materials for select to authenticated
  using (public.teaches_class(class_id) or (published and public.in_class(class_id)));
drop policy if exists "materials: teacher writes" on public.class_materials;
create policy "materials: teacher writes" on public.class_materials for all to authenticated
  using (public.teaches_class(class_id)) with check (public.teaches_class(class_id));

drop policy if exists "updates: read" on public.class_updates;
create policy "updates: read" on public.class_updates for select to authenticated
  using (public.teaches_class(class_id) or public.in_class(class_id));
drop policy if exists "updates: teacher writes" on public.class_updates;
create policy "updates: teacher writes" on public.class_updates for all to authenticated
  using (public.teaches_class(class_id)) with check (public.teaches_class(class_id) and author_id = (select auth.uid()));

drop policy if exists "experiences: read via my class" on public.experiences;
create policy "experiences: read via my class" on public.experiences for select to authenticated
  using (public.experience_in_my_class(id));

-- ---------------------------------------------------------------------------
-- Submissions with files
-- ---------------------------------------------------------------------------
alter table public.submissions add column if not exists files jsonb not null default '[]'::jsonb;
alter table public.assignments drop constraint if exists assignments_submission_type_check;
alter table public.assignments add constraint assignments_submission_type_check
  check (submission_type in ('text', 'url', 'text_or_url', 'file', 'any', 'none'));

drop function if exists public.submit_assignment(uuid, text, text);
create or replace function public.submit_assignment(p_assignment_id uuid, p_body text, p_url text, p_files jsonb default '[]'::jsonb)
returns public.submissions
language plpgsql security definer set search_path = '' as $$
declare a public.assignments; r public.submissions; f jsonb; prefix text; n int;
begin
  select * into a from public.assignments where id = p_assignment_id;
  if not found or a.status <> 'published' or not public.in_class(a.class_id) then
    raise exception 'Assignment not found.' using errcode = '42501';
  end if;
  p_files := coalesce(p_files, '[]'::jsonb);
  if jsonb_typeof(p_files) <> 'array' then raise exception 'Bad files.' using errcode = '22023'; end if;
  n := jsonb_array_length(p_files);
  if n > 10 then raise exception 'Attach up to 10 files.' using errcode = '22023'; end if;
  -- Every file must live in this student's own folder for this assignment.
  prefix := a.class_id::text || '/' || a.id::text || '/' || auth.uid()::text || '/';
  for f in select * from jsonb_array_elements(p_files) loop
    if coalesce(f->>'path', '') not like prefix || '%' then
      raise exception 'Bad file path.' using errcode = '42501';
    end if;
  end loop;
  if nullif(trim(coalesce(p_body, '')), '') is null and nullif(trim(coalesce(p_url, '')), '') is null and n = 0
     and a.submission_type <> 'none' then
    raise exception 'Add your work before submitting.' using errcode = '22023';
  end if;
  if p_url is not null and p_url <> '' and p_url !~* '^https?://' then
    raise exception 'Links must start with http:// or https://' using errcode = '22023';
  end if;
  insert into public.submissions (assignment_id, student_id, body, url, files)
  values (p_assignment_id, auth.uid(), nullif(p_body, ''), nullif(p_url, ''), p_files)
  on conflict (assignment_id, student_id) do update
    set body = excluded.body, url = excluded.url, files = excluded.files, submitted_at = now(), status = 'submitted'
    where public.submissions.status = 'submitted'
  returning * into r;
  if r.id is null then raise exception 'This work was already returned by your teacher.' using errcode = '22023'; end if;
  perform public.log_event('assignment.submitted', 'assignment', p_assignment_id);
  return r;
end; $$;
revoke execute on function public.submit_assignment(uuid, text, text, jsonb) from public, anon;
grant execute on function public.submit_assignment(uuid, text, text, jsonb) to authenticated;

-- Student-facing course reminders for the teacher (ungraded / resubmitted).
create or replace function public.class_reminders(p_class_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.teaches_class(p_class_id) then return '{}'::jsonb; end if;
  return jsonb_build_object(
    'ungraded', (select count(*) from public.submissions s join public.assignments a on a.id = s.assignment_id
                 where a.class_id = p_class_id and s.status = 'submitted'),
    'resubmitted', (select count(*) from public.submissions s join public.assignments a on a.id = s.assignment_id
                 where a.class_id = p_class_id and s.status = 'submitted' and s.graded_at is not null)
  );
end; $$;
revoke execute on function public.class_reminders(uuid) from public, anon;
grant execute on function public.class_reminders(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage buckets and policies
--   experience-files : public read (unguessable paths), educators write to their own folder
--   submission-files : private; path = class/assignment/student/file
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('experience-files', 'experience-files', true, 52428800),
       ('submission-files', 'submission-files', false, 52428800)
on conflict (id) do nothing;

drop policy if exists "nexora experience files: educators upload" on storage.objects;
create policy "nexora experience files: educators upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'experience-files' and (storage.foldername(name))[1] = (select auth.uid())::text
              and public.is_educator() and not public.is_demo_user());
drop policy if exists "nexora experience files: owner reads" on storage.objects;
create policy "nexora experience files: owner reads" on storage.objects for select to authenticated
  using (bucket_id = 'experience-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "nexora experience files: owner deletes" on storage.objects;
create policy "nexora experience files: owner deletes" on storage.objects for delete to authenticated
  using (bucket_id = 'experience-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "nexora submission files: student uploads" on storage.objects;
create policy "nexora submission files: student uploads" on storage.objects for insert to authenticated
  with check (bucket_id = 'submission-files' and (storage.foldername(name))[3] = (select auth.uid())::text
              and public.in_class(public.try_uuid((storage.foldername(name))[1])) and not public.is_demo_user());
drop policy if exists "nexora submission files: student and teacher read" on storage.objects;
create policy "nexora submission files: student and teacher read" on storage.objects for select to authenticated
  using (bucket_id = 'submission-files' and ((storage.foldername(name))[3] = (select auth.uid())::text
         or public.teaches_class(public.try_uuid((storage.foldername(name))[1]))));
drop policy if exists "nexora submission files: student deletes own" on storage.objects;
create policy "nexora submission files: student deletes own" on storage.objects for delete to authenticated
  using (bucket_id = 'submission-files' and (storage.foldername(name))[3] = (select auth.uid())::text);

-- Realtime: course updates appear without refresh.
do $$ begin
  alter publication supabase_realtime add table public.class_updates;
exception when duplicate_object then null; end $$;

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


-- ===================== 0008_appearance.sql =====================
-- ===========================================================================
-- NEXORA 1.3 "Appearance"
--   * appearance_preferences: a student's living scene + motion settings, so they follow them to every device
--   * period_icons: each student's private icon for each of their classes
--   * class_appearance: a teacher's per-class rules (allow custom images, lock a scene, e.g. 'calm' on test days)
--   * storage bucket 'period-icons' (private; each student can only touch their own folder)
-- Safe to run more than once.
-- ===========================================================================

create table if not exists public.appearance_preferences (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  scene       text not null default 'ambient',
  motion      text not null default 'full' check (motion in ('full', 'reduced', 'static')),
  intensity   real not null default 0.7 check (intensity between 0 and 1),
  contrast    real not null default 0.5 check (contrast between 0 and 1),
  focus_dim   boolean not null default true,
  updated_at  timestamptz not null default now()
);
alter table public.appearance_preferences enable row level security;
drop policy if exists "own appearance" on public.appearance_preferences;
create policy "own appearance" on public.appearance_preferences
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.period_icons (
  user_id     uuid not null references auth.users(id) on delete cascade,
  class_id    uuid not null references public.classes(id) on delete cascade,
  kind        text not null check (kind in ('scene', 'color', 'symbol', 'image')),
  scene       text,
  palette     smallint check (palette between 0 and 31),
  symbol      text,
  image_path  text,
  updated_at  timestamptz not null default now(),
  primary key (user_id, class_id),
  check (
    (kind = 'scene'  and scene is not null) or
    (kind = 'color'  and palette is not null) or
    (kind = 'symbol' and symbol is not null and palette is not null) or
    (kind = 'image'  and image_path is not null and image_path like (user_id::text || '/%'))
  )
);
alter table public.period_icons enable row level security;
-- Private by design: only the student who chose an icon can read or change it. Teachers never see it.
drop policy if exists "own period icons" on public.period_icons;
create policy "own period icons" on public.period_icons
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.class_appearance (
  class_id            uuid primary key references public.classes(id) on delete cascade,
  allow_custom_icons  boolean not null default true,
  lock_scene          text,              -- null = students choose; e.g. 'calm' during a test
  updated_at          timestamptz not null default now()
);
alter table public.class_appearance enable row level security;
drop policy if exists "read class appearance" on public.class_appearance;
create policy "read class appearance" on public.class_appearance for select to authenticated using (true);

-- Teachers manage their own classes. The teacher column name differs between schemas,
-- so find it instead of guessing.
do $$
declare col text;
begin
  select column_name into col from information_schema.columns
   where table_schema = 'public' and table_name = 'classes'
     and column_name in ('teacher_id', 'owner_id', 'created_by')
   order by array_position(array['teacher_id', 'owner_id', 'created_by'], column_name::text) limit 1;
  if col is null then
    raise notice 'class_appearance: no teacher column found on public.classes; add a write policy by hand.';
  else
    execute 'drop policy if exists "teacher writes class appearance" on public.class_appearance';
    execute format($p$create policy "teacher writes class appearance" on public.class_appearance
      for all to authenticated
      using (exists (select 1 from public.classes c where c.id = class_id and c.%1$I = auth.uid()))
      with check (exists (select 1 from public.classes c where c.id = class_id and c.%1$I = auth.uid()))$p$, col);
  end if;
end $$;

-- Storage: private bucket, 300 KB cap, images only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('period-icons', 'period-icons', false, 307200, array['image/webp', 'image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "period icons: own folder read"   on storage.objects;
drop policy if exists "period icons: own folder write"  on storage.objects;
drop policy if exists "period icons: own folder update" on storage.objects;
drop policy if exists "period icons: own folder delete" on storage.objects;
create policy "period icons: own folder read"   on storage.objects for select to authenticated using (bucket_id = 'period-icons' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "period icons: own folder write"  on storage.objects for insert to authenticated with check (bucket_id = 'period-icons' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "period icons: own folder update" on storage.objects for update to authenticated using (bucket_id = 'period-icons' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "period icons: own folder delete" on storage.objects for delete to authenticated using (bucket_id = 'period-icons' and (storage.foldername(name))[1] = auth.uid()::text);


-- ===================== 0009_scene_assistants.sql =====================
-- ===========================================================================
-- NEXORA 0.7 "Scene Assistants"
--   * appearance_preferences.companion_form: 'scene' (the helper changes form with the scene)
--     or a pinned form: nova, cora, lumi, maple, yuki, aurora, rain, nemo, ash, orbit, grid.
-- Safe to run more than once.
-- ===========================================================================
alter table public.appearance_preferences add column if not exists companion_form text not null default 'scene';
alter table public.appearance_preferences drop constraint if exists appearance_preferences_companion_form_check;
alter table public.appearance_preferences add constraint appearance_preferences_companion_form_check
  check (companion_form in ('scene', 'nova', 'cora', 'lumi', 'maple', 'yuki', 'aurora', 'rain', 'nemo', 'ash', 'orbit', 'grid'));

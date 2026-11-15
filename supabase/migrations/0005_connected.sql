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

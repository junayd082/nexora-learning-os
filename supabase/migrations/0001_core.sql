-- ============================================================================
-- NEXORA 0.1 "Foundation" — core schema
-- Founded and designed by M. Chinnakotla.
--
-- Logical services (one Postgres, clean boundaries):
--   identity       profiles, organizations
--   experiences    worlds, experiences, experience_translations, experience_teacher_notes,
--                  experience_versions, collections, collection_items, favorites
--   classrooms     classes, enrollments, assignments, submissions
--   portfolio      portfolio_items
--   live           live_sessions, session_participants
--   platform       analytics_events, audit_logs, feature_flags
--
-- Security model: every table has row-level security. Writes that cross a trust
-- boundary (joining a class, submitting, grading) go through SECURITY DEFINER
-- functions that check the caller, never through direct table writes.
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('student', 'teacher', 'admin');
create type public.experience_type as enum (
  'lesson', 'lecture', 'website', 'simulation', 'lab', 'project', 'game', 'quiz',
  'video', 'tool', 'career', 'coding', 'cad', 'assessment', 'field_trip', 'other'
);
create type public.visibility as enum ('private', 'organization', 'public');
create type public.content_status as enum ('draft', 'published', 'archived');

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------
create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  kind        text not null default 'school' check (kind in ('district', 'school', 'independent')),
  parent_id   uuid references public.organizations(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  display_name      text not null default '' check (char_length(display_name) <= 80),
  role              public.user_role not null default 'student',
  locale            text not null default 'en' check (locale in ('en', 'es')),
  organization_id   uuid references public.organizations(id) on delete set null,
  bio               text check (char_length(bio) <= 600),
  is_platform_admin boolean not null default false,
  is_demo           boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helper predicates (SECURITY DEFINER so policies never recurse)
-- ---------------------------------------------------------------------------
create or replace function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.is_platform_admin from public.profiles p where p.id = auth.uid()), false);
$$;

create or replace function public.is_educator() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.role in ('teacher', 'admin') or p.is_platform_admin
                   from public.profiles p where p.id = auth.uid()), false);
$$;

create or replace function public.my_org() returns uuid
language sql stable security definer set search_path = '' as $$
  select p.organization_id from public.profiles p where p.id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Experiences (the core object)
-- ---------------------------------------------------------------------------
create table public.worlds (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  name           text not null,
  name_es        text,
  description    text,
  description_es text,
  accent         text not null default '#2B4FD6',
  sort_order     int not null default 100,
  created_at     timestamptz not null default now()
);

create table public.experiences (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  creator_id       uuid references public.profiles(id) on delete set null,
  creator_name     text,
  organization_id  uuid references public.organizations(id) on delete set null,
  world_id         uuid references public.worlds(id) on delete set null,
  type             public.experience_type not null default 'lesson',
  subject          text,
  grade_range      text,
  difficulty       text check (difficulty in ('Beginner', 'Intermediate', 'Advanced')),
  duration_minutes int check (duration_minutes between 1 and 10000),
  resource_url     text,
  embed_url        text,
  worksheet_url    text,
  thumbnail_url    text,
  tags             text[] not null default '{}',
  skills           text[] not null default '{}',
  visibility       public.visibility not null default 'private',
  status           public.content_status not null default 'draft',
  quality          text check (quality in ('teacher_verified', 'district_approved', 'expert_reviewed', 'nexora_curated', 'community_rated')),
  version          text not null default '1.0',
  default_locale   text not null default 'en' check (default_locale in ('en', 'es')),
  launch_count     int not null default 0,
  remixed_from     uuid references public.experiences(id) on delete set null,
  is_demo          boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index experiences_world_idx on public.experiences(world_id);
create index experiences_creator_idx on public.experiences(creator_id);
create index experiences_tags_idx on public.experiences using gin(tags);

-- Platform language and content language are separate: this table is content language.
create table public.experience_translations (
  id                   uuid primary key default gen_random_uuid(),
  experience_id        uuid not null references public.experiences(id) on delete cascade,
  locale               text not null check (locale in ('en', 'es', 'fr', 'pt', 'hi', 'ar', 'zh', 'vi')),
  title                text not null check (char_length(title) between 1 and 200),
  short_description    text,
  description          text,
  learning_objective   text,
  student_instructions text,
  machine_translated   boolean not null default false,
  search               tsvector generated always as (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(short_description, '') || ' ' || coalesce(description, ''))
  ) stored,
  updated_at           timestamptz not null default now(),
  unique (experience_id, locale)
);
create index experience_translations_search_idx on public.experience_translations using gin(search);

-- Teacher notes live apart so row-level security can hide them from students.
create table public.experience_teacher_notes (
  experience_id uuid not null references public.experiences(id) on delete cascade,
  locale        text not null default 'en',
  notes         text not null default '',
  primary key (experience_id, locale)
);

create table public.experience_versions (
  id            uuid primary key default gen_random_uuid(),
  experience_id uuid not null references public.experiences(id) on delete cascade,
  version       text not null,
  snapshot      jsonb not null,
  note          text,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index experience_versions_exp_idx on public.experience_versions(experience_id, created_at desc);

create table public.collections (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  owner_id       uuid references public.profiles(id) on delete set null,
  title          text not null,
  title_es       text,
  description    text,
  description_es text,
  is_sequence    boolean not null default false,
  visibility     public.visibility not null default 'public',
  created_at     timestamptz not null default now()
);

create table public.collection_items (
  collection_id uuid not null references public.collections(id) on delete cascade,
  experience_id uuid not null references public.experiences(id) on delete cascade,
  position      int not null,
  primary key (collection_id, experience_id)
);

create table public.favorites (
  user_id       uuid not null references public.profiles(id) on delete cascade,
  experience_id uuid not null references public.experiences(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (user_id, experience_id)
);

-- ---------------------------------------------------------------------------
-- Classrooms
-- ---------------------------------------------------------------------------
create table public.classes (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  teacher_id      uuid not null references public.profiles(id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 120),
  section         text,
  subject         text,
  description     text,
  join_code       text not null unique,
  archived        boolean not null default false,
  is_demo         boolean not null default false,
  created_at      timestamptz not null default now()
);
create index classes_teacher_idx on public.classes(teacher_id);

create table public.enrollments (
  class_id  uuid not null references public.classes(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  role      text not null default 'student' check (role in ('student', 'co_teacher')),
  joined_at timestamptz not null default now(),
  primary key (class_id, user_id)
);
create index enrollments_user_idx on public.enrollments(user_id);

create or replace function public.teaches_class(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.classes c where c.id = cid and c.teacher_id = auth.uid())
      or exists (select 1 from public.enrollments e where e.class_id = cid and e.user_id = auth.uid() and e.role = 'co_teacher');
$$;

create or replace function public.in_class(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.enrollments e where e.class_id = cid and e.user_id = auth.uid());
$$;

-- True when the caller teaches any class the target user is enrolled in.
create or replace function public.teaches_student(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.enrollments e
    join public.classes c on c.id = e.class_id
    where e.user_id = uid and c.teacher_id = auth.uid()
  );
$$;

-- True when the target user teaches a class the caller is enrolled in.
create or replace function public.is_my_teacher(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.enrollments e
    join public.classes c on c.id = e.class_id
    where e.user_id = auth.uid() and c.teacher_id = uid
  );
$$;

create table public.assignments (
  id              uuid primary key default gen_random_uuid(),
  class_id        uuid not null references public.classes(id) on delete cascade,
  experience_id   uuid references public.experiences(id) on delete set null,
  title           text not null check (char_length(title) between 1 and 200),
  instructions    text,
  due_at          timestamptz,
  points          int check (points between 0 and 10000),
  submission_type text not null default 'text_or_url' check (submission_type in ('text', 'url', 'text_or_url', 'none')),
  status          text not null default 'published' check (status in ('draft', 'published')),
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index assignments_class_idx on public.assignments(class_id, due_at);

create or replace function public.assignment_class(aid uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select a.class_id from public.assignments a where a.id = aid;
$$;

create table public.submissions (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id    uuid not null references public.profiles(id) on delete cascade,
  body          text check (char_length(body) <= 20000),
  url           text check (char_length(url) <= 2000),
  status        text not null default 'submitted' check (status in ('submitted', 'returned')),
  submitted_at  timestamptz not null default now(),
  score         numeric(8, 2),
  feedback      text,
  graded_at     timestamptz,
  graded_by     uuid references public.profiles(id) on delete set null,
  unique (assignment_id, student_id)
);
create index submissions_student_idx on public.submissions(student_id);

-- ---------------------------------------------------------------------------
-- Portfolio
-- ---------------------------------------------------------------------------
create table public.portfolio_items (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  title         text not null check (char_length(title) between 1 and 200),
  description   text,
  url           text,
  reflection    text,
  submission_id uuid references public.submissions(id) on delete set null,
  experience_id uuid references public.experiences(id) on delete set null,
  skills        text[] not null default '{}',
  tools         text[] not null default '{}',
  visibility    text not null default 'private' check (visibility in ('private', 'teachers', 'public')),
  completed_on  date,
  created_at    timestamptz not null default now()
);
create index portfolio_user_idx on public.portfolio_items(user_id);

-- ---------------------------------------------------------------------------
-- Live sessions (presentation mode + QR join)
-- ---------------------------------------------------------------------------
create table public.live_sessions (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  host_id       uuid not null references public.profiles(id) on delete cascade,
  class_id      uuid references public.classes(id) on delete set null,
  experience_id uuid not null references public.experiences(id) on delete cascade,
  locale_mode   text not null default 'en' check (locale_mode in ('en', 'es', 'both')),
  status        text not null default 'live' check (status in ('live', 'ended')),
  started_at    timestamptz not null default now(),
  ended_at      timestamptz
);

create table public.session_participants (
  session_id   uuid not null references public.live_sessions(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  display_name text not null default '',
  joined_at    timestamptz not null default now(),
  primary key (session_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Platform
-- ---------------------------------------------------------------------------
create table public.analytics_events (
  id          bigint generated always as identity primary key,
  user_id     uuid references public.profiles(id) on delete set null,
  name        text not null check (name ~ '^[a-z_]+\.[a-z_]+$'),
  entity_type text,
  entity_id   uuid,
  props       jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index analytics_events_name_idx on public.analytics_events(name, created_at desc);
create index analytics_events_entity_idx on public.analytics_events(entity_id);

create table public.audit_logs (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.profiles(id) on delete set null,
  action      text not null,
  entity_type text,
  entity_id   uuid,
  details     jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs(created_at desc);

create table public.feature_flags (
  key         text primary key,
  enabled     boolean not null default false,
  description text,
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.organizations            enable row level security;
alter table public.profiles                 enable row level security;
alter table public.worlds                   enable row level security;
alter table public.experiences              enable row level security;
alter table public.experience_translations  enable row level security;
alter table public.experience_teacher_notes enable row level security;
alter table public.experience_versions      enable row level security;
alter table public.collections              enable row level security;
alter table public.collection_items         enable row level security;
alter table public.favorites                enable row level security;
alter table public.classes                  enable row level security;
alter table public.enrollments              enable row level security;
alter table public.assignments              enable row level security;
alter table public.submissions              enable row level security;
alter table public.portfolio_items          enable row level security;
alter table public.live_sessions            enable row level security;
alter table public.session_participants     enable row level security;
alter table public.analytics_events         enable row level security;
alter table public.audit_logs               enable row level security;
alter table public.feature_flags            enable row level security;

-- organizations
create policy "orgs: members and admins read" on public.organizations for select to authenticated
  using (id = public.my_org() or public.is_platform_admin());
create policy "orgs: admins write" on public.organizations for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- profiles: you, your students, your teachers, admins. Classmates do not see each other.
create policy "profiles: read" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.teaches_student(id) or public.is_my_teacher(id) or public.is_platform_admin());
create policy "profiles: update self" on public.profiles for update to authenticated
  using (id = (select auth.uid()) or public.is_platform_admin())
  with check (id = (select auth.uid()) or public.is_platform_admin());

-- worlds: public catalogue
create policy "worlds: anyone reads" on public.worlds for select to anon, authenticated using (true);
create policy "worlds: admins write" on public.worlds for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- experiences
create policy "experiences: read" on public.experiences for select to anon, authenticated
  using (
    (status = 'published' and visibility = 'public')
    or creator_id = (select auth.uid())
    or (status = 'published' and visibility = 'organization' and organization_id is not null and organization_id = public.my_org())
    or public.is_platform_admin()
  );
create policy "experiences: educators create" on public.experiences for insert to authenticated
  with check (public.is_educator() and creator_id = (select auth.uid()));
create policy "experiences: owner updates" on public.experiences for update to authenticated
  using (creator_id = (select auth.uid()) or public.is_platform_admin())
  with check (creator_id = (select auth.uid()) or public.is_platform_admin());
create policy "experiences: owner deletes" on public.experiences for delete to authenticated
  using (creator_id = (select auth.uid()) or public.is_platform_admin());

create or replace function public.owns_experience(eid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.experiences x where x.id = eid and x.creator_id = auth.uid())
      or public.is_platform_admin();
$$;

create policy "translations: read with experience" on public.experience_translations for select to anon, authenticated
  using (exists (select 1 from public.experiences x where x.id = experience_id));
create policy "translations: owner writes" on public.experience_translations for all to authenticated
  using (public.owns_experience(experience_id)) with check (public.owns_experience(experience_id));

create policy "teacher notes: educators read" on public.experience_teacher_notes for select to authenticated
  using (public.is_educator() and exists (select 1 from public.experiences x where x.id = experience_id));
create policy "teacher notes: owner writes" on public.experience_teacher_notes for all to authenticated
  using (public.owns_experience(experience_id)) with check (public.owns_experience(experience_id));

create policy "versions: owner reads" on public.experience_versions for select to authenticated
  using (public.owns_experience(experience_id));
create policy "versions: owner writes" on public.experience_versions for insert to authenticated
  with check (public.owns_experience(experience_id) and created_by = (select auth.uid()));

create policy "collections: read" on public.collections for select to anon, authenticated
  using (visibility = 'public' or owner_id = (select auth.uid()) or public.is_platform_admin());
create policy "collections: owner writes" on public.collections for all to authenticated
  using (owner_id = (select auth.uid()) or public.is_platform_admin())
  with check (owner_id = (select auth.uid()) or public.is_platform_admin());
create policy "collection items: read" on public.collection_items for select to anon, authenticated
  using (exists (select 1 from public.collections c where c.id = collection_id));
create policy "collection items: owner writes" on public.collection_items for all to authenticated
  using (exists (select 1 from public.collections c where c.id = collection_id and (c.owner_id = (select auth.uid()) or public.is_platform_admin())))
  with check (exists (select 1 from public.collections c where c.id = collection_id and (c.owner_id = (select auth.uid()) or public.is_platform_admin())));

create policy "favorites: own" on public.favorites for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- classes
create policy "classes: read" on public.classes for select to authenticated
  using (teacher_id = (select auth.uid()) or public.in_class(id) or public.is_platform_admin());
create policy "classes: educators create" on public.classes for insert to authenticated
  with check (public.is_educator() and teacher_id = (select auth.uid()));
create policy "classes: teacher updates" on public.classes for update to authenticated
  using (teacher_id = (select auth.uid())) with check (teacher_id = (select auth.uid()));
create policy "classes: teacher deletes" on public.classes for delete to authenticated
  using (teacher_id = (select auth.uid()));

-- enrollments: joining happens through join_by_code(); teachers may remove, students may leave.
create policy "enrollments: read" on public.enrollments for select to authenticated
  using (user_id = (select auth.uid()) or public.teaches_class(class_id) or public.is_platform_admin());
create policy "enrollments: remove" on public.enrollments for delete to authenticated
  using (user_id = (select auth.uid()) or public.teaches_class(class_id));

-- assignments
create policy "assignments: read" on public.assignments for select to authenticated
  using (public.teaches_class(class_id) or (status = 'published' and public.in_class(class_id)));
create policy "assignments: teacher writes" on public.assignments for all to authenticated
  using (public.teaches_class(class_id)) with check (public.teaches_class(class_id));

-- submissions: read only; writes go through submit_assignment() and grade_submission().
create policy "submissions: read" on public.submissions for select to authenticated
  using (student_id = (select auth.uid()) or public.teaches_class(public.assignment_class(assignment_id)));

-- portfolio
create policy "portfolio: owner all" on public.portfolio_items for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "portfolio: shared read" on public.portfolio_items for select to authenticated
  using (visibility = 'public' or (visibility = 'teachers' and public.teaches_student(user_id)));

-- live sessions
create policy "sessions: host and participants read" on public.live_sessions for select to authenticated
  using (host_id = (select auth.uid())
         or exists (select 1 from public.session_participants sp where sp.session_id = live_sessions.id and sp.user_id = (select auth.uid())));
create policy "sessions: host updates" on public.live_sessions for update to authenticated
  using (host_id = (select auth.uid())) with check (host_id = (select auth.uid()));

create or replace function public.hosts_session(sid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.live_sessions s where s.id = sid and s.host_id = auth.uid());
$$;
create policy "participants: host and self read" on public.session_participants for select to authenticated
  using (user_id = (select auth.uid()) or public.hosts_session(session_id));

-- platform
create policy "events: admins read" on public.analytics_events for select to authenticated using (public.is_platform_admin());
create policy "audit: admins read" on public.audit_logs for select to authenticated using (public.is_platform_admin());
create policy "flags: anyone reads" on public.feature_flags for select to anon, authenticated using (true);
create policy "flags: admins write" on public.feature_flags for update to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end; $$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger experiences_touch before update on public.experiences for each row execute function public.touch_updated_at();
create trigger translations_touch before update on public.experience_translations for each row execute function public.touch_updated_at();

-- Users cannot promote themselves.
create or replace function public.protect_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not public.is_platform_admin() then
    if new.role is distinct from old.role
       or new.is_platform_admin is distinct from old.is_platform_admin
       or new.organization_id is distinct from old.organization_id
       or new.is_demo is distinct from old.is_demo then
      raise exception 'Only a platform administrator can change role or organization.' using errcode = '42501';
    end if;
  end if;
  return new;
end; $$;
create trigger profiles_protect before update on public.profiles for each row execute function public.protect_profile();

-- New account → profile. The first real (non-demo) account becomes platform admin
-- and takes ownership of the seeded library (the founder's AutoCAD course).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  meta        jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  wants_role  text  := coalesce(meta->>'role', 'student');
  demo        boolean := coalesce((meta->>'is_demo')::boolean, false);
  first_admin boolean := false;
  loc         text := case when meta->>'locale' in ('en', 'es') then meta->>'locale' else 'en' end;
begin
  if wants_role not in ('student', 'teacher') then wants_role := 'student'; end if;
  if not demo then
    first_admin := not exists (select 1 from public.profiles where is_platform_admin and not is_demo);
  end if;

  insert into public.profiles (id, display_name, role, locale, is_platform_admin, is_demo)
  values (
    new.id,
    left(coalesce(nullif(trim(meta->>'display_name'), ''), split_part(new.email, '@', 1)), 80),
    case when first_admin then 'teacher'::public.user_role else wants_role::public.user_role end,
    loc, first_admin, demo
  );

  if first_admin then
    update public.experiences set creator_id = new.id where creator_id is null and not is_demo;
    update public.collections set owner_id = new.id where owner_id is null;
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
    values (new.id, 'platform.first_admin', 'profile', new.id, '{}'::jsonb);
  end if;
  return new;
end; $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
create or replace function public.gen_join_code() returns text
language plpgsql volatile set search_path = '' as $$
declare c text; i int := 0;
begin
  loop
    i := i + 1;
    if i < 40 then c := 'NXR-' || (1000 + floor(random() * 9000))::int::text;
    else c := 'NXR-' || (100000 + floor(random() * 900000))::int::text; end if;
    exit when not exists (select 1 from public.classes where join_code = c)
          and not exists (select 1 from public.live_sessions where code = c);
  end loop;
  return c;
end; $$;

alter table public.classes alter column join_code set default public.gen_join_code();
alter table public.live_sessions alter column code set default public.gen_join_code();

create or replace function public.log_event(p_name text, p_entity_type text default null, p_entity_id uuid default null, p_props jsonb default '{}')
returns void language sql security definer set search_path = '' as $$
  insert into public.analytics_events (user_id, name, entity_type, entity_id, props)
  values (auth.uid(), p_name, p_entity_type, p_entity_id, coalesce(p_props, '{}'::jsonb));
$$;

create or replace function public.audit(p_action text, p_entity_type text, p_entity_id uuid, p_details jsonb default '{}')
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, coalesce(p_details, '{}'::jsonb));
$$;
revoke execute on function public.audit(text, text, uuid, jsonb) from public, anon, authenticated;

-- One input for everything a student might type or scan: a live session code or a class code.
create or replace function public.join_by_code(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid  uuid := auth.uid();
  c    text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
  s    public.live_sessions;
  k    public.classes;
  slug text;
  nm   text;
begin
  if uid is null then raise exception 'Sign in to join.' using errcode = '28000'; end if;
  if c ~ '^[0-9]+$' then c := 'NXR-' || c; end if;
  if c ~ '^NXR[0-9]+$' then c := 'NXR-' || substr(c, 4); end if;

  select * into s from public.live_sessions where code = c and status = 'live';
  if found then
    select display_name into nm from public.profiles where id = uid;
    insert into public.session_participants (session_id, user_id, display_name)
    values (s.id, uid, coalesce(nm, '')) on conflict do nothing;
    if s.class_id is not null and not exists (select 1 from public.classes where id = s.class_id and teacher_id = uid) then
      insert into public.enrollments (class_id, user_id) values (s.class_id, uid) on conflict do nothing;
    end if;
    select x.slug into slug from public.experiences x where x.id = s.experience_id;
    perform public.log_event('session.joined', 'live_session', s.id);
    return jsonb_build_object('kind', 'session', 'id', s.id, 'experience_slug', slug);
  end if;

  select * into k from public.classes where join_code = c and not archived;
  if found then
    if k.teacher_id = uid then
      return jsonb_build_object('kind', 'class', 'id', k.id, 'already', true);
    end if;
    insert into public.enrollments (class_id, user_id) values (k.id, uid) on conflict do nothing;
    perform public.log_event('class.joined', 'class', k.id);
    return jsonb_build_object('kind', 'class', 'id', k.id);
  end if;

  return jsonb_build_object('kind', 'none');
end; $$;

create or replace function public.start_session(p_experience_id uuid, p_class_id uuid default null, p_locale_mode text default 'en')
returns public.live_sessions
language plpgsql security definer set search_path = '' as $$
declare s public.live_sessions;
begin
  if not public.is_educator() then raise exception 'Only educators can start a live session.' using errcode = '42501'; end if;
  if p_class_id is not null and not public.teaches_class(p_class_id) then
    raise exception 'You do not teach that class.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.experiences x where x.id = p_experience_id
                 and ((x.status = 'published' and x.visibility in ('public', 'organization')) or x.creator_id = auth.uid())) then
    raise exception 'Experience not available.' using errcode = '42501';
  end if;
  -- One live session per host at a time.
  update public.live_sessions set status = 'ended', ended_at = now() where host_id = auth.uid() and status = 'live';
  insert into public.live_sessions (host_id, class_id, experience_id, locale_mode)
  values (auth.uid(), p_class_id, p_experience_id, case when p_locale_mode in ('en', 'es', 'both') then p_locale_mode else 'en' end)
  returning * into s;
  perform public.log_event('session.started', 'live_session', s.id, jsonb_build_object('experience_id', p_experience_id));
  return s;
end; $$;

create or replace function public.submit_assignment(p_assignment_id uuid, p_body text, p_url text)
returns public.submissions
language plpgsql security definer set search_path = '' as $$
declare a public.assignments; r public.submissions;
begin
  select * into a from public.assignments where id = p_assignment_id;
  if not found or a.status <> 'published' or not public.in_class(a.class_id) then
    raise exception 'Assignment not found.' using errcode = '42501';
  end if;
  if nullif(trim(coalesce(p_body, '')), '') is null and nullif(trim(coalesce(p_url, '')), '') is null and a.submission_type <> 'none' then
    raise exception 'Add your work before submitting.' using errcode = '22023';
  end if;
  if p_url is not null and p_url <> '' and p_url !~* '^https?://' then
    raise exception 'Links must start with http:// or https://' using errcode = '22023';
  end if;
  insert into public.submissions (assignment_id, student_id, body, url)
  values (p_assignment_id, auth.uid(), nullif(p_body, ''), nullif(p_url, ''))
  on conflict (assignment_id, student_id) do update
    set body = excluded.body, url = excluded.url, submitted_at = now(), status = 'submitted'
    where public.submissions.status = 'submitted'
  returning * into r;
  if r.id is null then raise exception 'This work was already returned by your teacher.' using errcode = '22023'; end if;
  perform public.log_event('assignment.submitted', 'assignment', p_assignment_id);
  return r;
end; $$;

create or replace function public.grade_submission(p_submission_id uuid, p_score numeric, p_feedback text)
returns public.submissions
language plpgsql security definer set search_path = '' as $$
declare r public.submissions;
begin
  select * into r from public.submissions where id = p_submission_id;
  if not found or not public.teaches_class(public.assignment_class(r.assignment_id)) then
    raise exception 'Submission not found.' using errcode = '42501';
  end if;
  update public.submissions
     set score = p_score, feedback = nullif(p_feedback, ''), status = 'returned', graded_at = now(), graded_by = auth.uid()
   where id = p_submission_id returning * into r;
  perform public.audit('submission.graded', 'submission', p_submission_id, jsonb_build_object('score', p_score));
  perform public.log_event('submission.graded', 'submission', p_submission_id);
  return r;
end; $$;

create or replace function public.reopen_submission(p_submission_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.submissions;
begin
  select * into r from public.submissions where id = p_submission_id;
  if not found or not public.teaches_class(public.assignment_class(r.assignment_id)) then
    raise exception 'Submission not found.' using errcode = '42501';
  end if;
  update public.submissions set status = 'submitted' where id = p_submission_id;
  perform public.audit('submission.reopened', 'submission', p_submission_id);
end; $$;

create or replace function public.record_launch(p_experience_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.experiences x where x.id = p_experience_id
                 and ((x.status = 'published' and x.visibility = 'public') or x.creator_id = auth.uid()
                      or (x.status = 'published' and x.visibility = 'organization' and x.organization_id = public.my_org()))) then
    return;
  end if;
  update public.experiences set launch_count = launch_count + 1 where id = p_experience_id;
  perform public.log_event('experience.launched', 'experience', p_experience_id);
end; $$;

create or replace function public.search_experiences(q text, max_results int default 30)
returns table (experience_id uuid, rank real)
language plpgsql stable security invoker set search_path = '' as $$
declare
  term  text := nullif(trim(coalesce(q, '')), '');
  likep text;
  words text;
  tq    tsquery;
begin
  if term is null then return; end if;
  likep := '%' || replace(replace(replace(term, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  select string_agg(w || ':*', ' & ') into words
    from unnest(regexp_split_to_array(lower(regexp_replace(term, '[^[:alnum:]]+', ' ', 'g')), '\s+')) as w
   where w <> '';
  if words is not null then tq := to_tsquery('simple', words); end if;
  return query
    select t.experience_id,
           max((case when tq is not null and t.search @@ tq then ts_rank(t.search, tq) + 0.5 else 0 end)
               + (case when t.title ilike likep then 1 else 0 end))::real
      from public.experience_translations t
      join public.experiences x on x.id = t.experience_id
     where (tq is not null and t.search @@ tq)
        or t.title ilike likep
        or exists (select 1 from unnest(x.tags || x.skills) tag where tag ilike likep)
     group by t.experience_id
     order by 2 desc
     limit greatest(1, least(max_results, 100));
end; $$;

create or replace function public.remix_experience(p_experience_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare src public.experiences; new_id uuid; new_slug text; nm text;
begin
  if not public.is_educator() then raise exception 'Only educators can remix.' using errcode = '42501'; end if;
  select * into src from public.experiences x where x.id = p_experience_id
    and ((x.status = 'published' and x.visibility in ('public', 'organization')) or x.creator_id = auth.uid());
  if not found then raise exception 'Experience not available.' using errcode = '42501'; end if;
  select display_name into nm from public.profiles where id = auth.uid();
  new_slug := left(src.slug, 60) || '-remix-' || substr(md5(random()::text), 1, 5);
  insert into public.experiences (slug, creator_id, creator_name, organization_id, world_id, type, subject, grade_range, difficulty,
    duration_minutes, resource_url, embed_url, worksheet_url, thumbnail_url, tags, skills, visibility, status, version, default_locale, remixed_from)
  values (new_slug, auth.uid(), nm, public.my_org(), src.world_id, src.type, src.subject, src.grade_range, src.difficulty,
    src.duration_minutes, src.resource_url, src.embed_url, src.worksheet_url, src.thumbnail_url, src.tags, src.skills,
    'private', 'draft', '1.0', src.default_locale, src.id)
  returning id into new_id;
  insert into public.experience_translations (experience_id, locale, title, short_description, description, learning_objective, student_instructions)
  select new_id, locale, left(title || ' (Remix)', 200), short_description, description, learning_objective, student_instructions
  from public.experience_translations where experience_id = src.id;
  perform public.log_event('experience.remixed', 'experience', src.id, jsonb_build_object('remix_id', new_id));
  return new_slug;
end; $$;

create or replace function public.snapshot_experience(p_experience_id uuid, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare snap jsonb; v text;
begin
  if not public.owns_experience(p_experience_id) then raise exception 'Not yours.' using errcode = '42501'; end if;
  select to_jsonb(x) - 'launch_count', x.version into snap, v from public.experiences x where x.id = p_experience_id;
  snap := snap || jsonb_build_object('translations',
    coalesce((select jsonb_agg(to_jsonb(t) - 'search') from public.experience_translations t where t.experience_id = p_experience_id), '[]'::jsonb));
  insert into public.experience_versions (experience_id, version, snapshot, note, created_by)
  values (p_experience_id, v, snap, p_note, auth.uid());
end; $$;

-- Admin console
create or replace function public.admin_list_users()
returns table (id uuid, email text, display_name text, role public.user_role, is_platform_admin boolean,
               is_demo boolean, created_at timestamptz, last_sign_in_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'Administrators only.' using errcode = '42501'; end if;
  return query
    select p.id, u.email::text, p.display_name, p.role, p.is_platform_admin, p.is_demo, p.created_at, u.last_sign_in_at
    from public.profiles p join auth.users u on u.id = p.id
    order by p.created_at desc;
end; $$;

create or replace function public.admin_set_role(p_user_id uuid, p_role public.user_role) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'Administrators only.' using errcode = '42501'; end if;
  update public.profiles set role = p_role where id = p_user_id;
  perform public.audit('profile.role_changed', 'profile', p_user_id, jsonb_build_object('role', p_role));
end; $$;

create or replace function public.admin_set_flag(p_key text, p_enabled boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'Administrators only.' using errcode = '42501'; end if;
  update public.feature_flags set enabled = p_enabled, updated_at = now() where key = p_key;
  perform public.audit('flag.changed', 'feature_flag', null, jsonb_build_object('key', p_key, 'enabled', p_enabled));
end; $$;

create or replace function public.admin_stats() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'Administrators only.' using errcode = '42501'; end if;
  return jsonb_build_object(
    'students',    (select count(*) from public.profiles where role = 'student' and not is_demo),
    'educators',   (select count(*) from public.profiles where role in ('teacher', 'admin') and not is_demo),
    'classes',     (select count(*) from public.classes where not is_demo),
    'experiences', (select count(*) from public.experiences),
    'submissions', (select count(*) from public.submissions),
    'launches_7d', (select count(*) from public.analytics_events where name = 'experience.launched' and created_at > now() - interval '7 days')
  );
end; $$;

-- Lock down function execution: signed-in users only (functions default to EXECUTE for PUBLIC).
do $$
declare f text;
begin
  foreach f in array array[
    'public.join_by_code(text)', 'public.start_session(uuid, uuid, text)',
    'public.submit_assignment(uuid, text, text)', 'public.grade_submission(uuid, numeric, text)',
    'public.reopen_submission(uuid)', 'public.remix_experience(uuid)', 'public.snapshot_experience(uuid, text)',
    'public.admin_list_users()', 'public.admin_set_role(uuid, public.user_role)', 'public.admin_set_flag(text, boolean)',
    'public.admin_stats()', 'public.log_event(text, text, uuid, jsonb)', 'public.record_launch(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.protect_profile() from public, anon, authenticated;

-- Realtime: the presentation screen watches students arrive.
alter publication supabase_realtime add table public.session_participants;

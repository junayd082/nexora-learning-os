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

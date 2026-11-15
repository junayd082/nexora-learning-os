-- NEXORA 1.3 — Cornell notes. Each person's notebooks, per class; private to the author.
create table if not exists public.cornell_notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  class_id   uuid not null references public.classes(id) on delete cascade,
  title      text not null default '' check (char_length(title) <= 200),
  note_date  date,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists cornell_notes_owner_idx on public.cornell_notes(user_id, class_id, updated_at desc);
alter table public.cornell_notes enable row level security;
drop policy if exists "cornell: own" on public.cornell_notes;
create policy "cornell: own" on public.cornell_notes for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (public.in_class(class_id) or public.teaches_class(class_id)));
drop trigger if exists cornell_touch on public.cornell_notes;
create trigger cornell_touch before update on public.cornell_notes for each row execute function public.touch_updated_at();

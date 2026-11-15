-- NEXORA 1.1 — Student CVs (one per student, private to them).
create table if not exists public.cvs (
  user_id uuid primary key references public.profiles(id) on delete cascade default auth.uid(),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.cvs enable row level security;
drop policy if exists "cvs: own" on public.cvs;
create policy "cvs: own" on public.cvs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop trigger if exists cvs_touch on public.cvs;
create trigger cvs_touch before update on public.cvs for each row execute function public.touch_updated_at();

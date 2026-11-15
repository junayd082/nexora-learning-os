-- NEXORA 1.0.2 — Optional timer on generated Do Now / Exit ticket checks (copied to the check's class material).
alter table public.quizzes
  add column if not exists timer_minutes smallint check (timer_minutes between 1 and 60),
  add column if not exists timer_mode text check (timer_mode in ('manual', 'bell'));

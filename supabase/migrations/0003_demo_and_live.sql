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

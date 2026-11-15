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

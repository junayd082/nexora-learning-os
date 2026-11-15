-- ============================================================================
-- NEXORA 1.4 "Live" — the demo class behind /demo, filled with one real class period.
--
-- public.demo_live_reset() rebuilds the DEMO class (is_demo = true, owned by the demo teacher) so it
-- shows "today" in the class's time zone, exactly as the NEXORA Live film tells it:
--   * Architecture Design 1 (Demo), Period 3, teacher "Mr. C (Demo)", 24 students (23 sample + the demo
--     student login, who plays Sofia — absent today, so signing in as her shows the catch-up experience)
--   * Today: Lecture 2 (units, coordinates & precise lines), the Lesson 2 website, the worksheet due Friday
--   * Previous class day: Lecture 1 + the workspace lab (graded)
--   * Do Now (4 questions, 5-minute timer): 23 of 24 answered, class average 86% — still open for make-up
--   * Exit ticket (3 questions): 23 answered — 91% / 43% / 78%, the polar-input misconception
--   * Session summary (published) + private teacher notes + announcement + tomorrow's Do Now (draft)
--   * One open raised hand (Maya), one pending restroom pass (Jordan), Sofia's catch-up Cornell notes
--
-- Only touches the demo class and demo accounts. The 23 sample students have random, unknown passwords
-- (nobody can sign in as them). Safe to run more than once; every run replaces the demo class content.
-- Callable by platform admins (Admin → Feature flags → "Reset demo class") and by the database owner.
-- ============================================================================

create or replace function public.demo_live_reset() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  t_id  uuid := 'd0000000-0000-4000-8000-00000000000a';
  s_id  uuid := 'd0000000-0000-4000-8000-00000000000b';   -- the demo student login → "Sofia M."
  names text[] := array['Maya R.', 'Jordan T.', 'Aiden N.', 'Ethan B.', 'Priya P.', 'Liam C.', 'Zoe K.', 'Marcus J.',
                        'Ava T.', 'Daniel L.', 'Isabella G.', 'Noah W.', 'Chloe D.', 'Elijah M.', 'Mia H.', 'Lucas W.',
                        'Amara O.', 'Gabriel S.', 'Hannah S.', 'Ryan M.', 'Leah C.', 'Mateo R.', 'Grace W.'];
  ids   uuid[] := '{}';
  sid   uuid;
  i     int;
  cls   uuid;
  tz    text;
  d     date;     -- today in the class's time zone
  prev  date;     -- the previous class day
  nxt   date;     -- the next class day
  fri   date;     -- the worksheet's due day
  at    timestamptz;
  l1 uuid; l2 uuid; w1 uuid; w2 uuid;
  m_l2 uuid; a_lab uuid; a_ws uuid;
  dn uuid; dq1 uuid := gen_random_uuid(); dq2 uuid := gen_random_uuid(); dq3 uuid := gen_random_uuid(); dq4 uuid := gen_random_uuid();
  ex uuid; eq1 uuid := gen_random_uuid(); eq2 uuid := gen_random_uuid(); eq3 uuid := gen_random_uuid();
  nx uuid;
  r1 boolean; r2 boolean; r4 int; a1 text; a2 text; a3 text; pts numeric;
  sum_title text; sum_body text; notes_body text; lec_title text := 'Lecture 2 · Units, Coordinates & Precise Lines';
begin
  if not (coalesce(auth.uid() is null, false) or public.is_platform_admin()) then
    raise exception 'Only a platform admin can reset the demo class' using errcode = '42501';
  end if;
  if not exists (select 1 from auth.users where id = t_id) or not exists (select 1 from auth.users where id = s_id) then
    return jsonb_build_object('ok', false, 'reason', 'demo accounts missing (run 0004_demo_accounts.sql)');
  end if;

  -- ---------------------------------------------------------------- people
  update public.profiles set display_name = 'Mr. C (Demo)' where id = t_id;
  update public.profiles set display_name = 'Sofia M. (demo)' where id = s_id;

  for i in 1 .. array_length(names, 1) loop
    sid := ('d0000000-0000-4000-8000-0000000001' || lpad(i::text, 2, '0'))::uuid;
    ids := ids || sid;
    if not exists (select 1 from auth.users where id = sid) then
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                              raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                              confirmation_token, recovery_token, email_change_token_new, email_change)
      values ('00000000-0000-0000-0000-000000000000', sid, 'authenticated', 'authenticated',
              'demo.s' || lpad(i::text, 2, '0') || '@nexora.demo',
              extensions.crypt(gen_random_uuid()::text || gen_random_uuid()::text, extensions.gen_salt('bf')), now(),
              '{"provider":"email","providers":["email"]}',
              jsonb_build_object('display_name', names[i], 'role', 'student', 'is_demo', true),
              now(), now(), '', '', '', '');
      insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), sid, sid::text,
              jsonb_build_object('sub', sid::text, 'email', 'demo.s' || lpad(i::text, 2, '0') || '@nexora.demo', 'email_verified', true),
              'email', null, now(), now());
    end if;
    update public.profiles set display_name = names[i], is_demo = true where id = sid;
  end loop;

  -- ---------------------------------------------------------------- the class
  select c.id into cls from public.classes c where c.teacher_id = t_id and c.is_demo order by c.created_at limit 1;
  if cls is null then
    insert into public.classes (teacher_id, name, section, subject, description, is_demo)
    values (t_id, 'Architecture Design 1 (Demo)', 'Period 3', 'Architecture & Construction', '', true)
    returning id into cls;
  end if;
  update public.classes set name = 'Architecture Design 1 (Demo)', section = 'Period 3', subject = 'Architecture & Construction',
    description = 'Sample class for NEXORA Live. Every name and answer here is demo content.', archived = false
  where id = cls;
  select coalesce(c.timezone, 'America/Chicago') into tz from public.classes c where c.id = cls;

  d := (now() at time zone tz)::date;
  prev := d - case extract(isodow from d)::int when 1 then 3 when 7 then 2 else 1 end;
  nxt  := d + case extract(isodow from d)::int when 5 then 3 when 6 then 2 else 1 end;
  fri  := d + ((5 - extract(isodow from d)::int + 7) % 7);
  if fri = d then fri := d + 7; end if;

  -- wipe the class's previous demo content (demo class only)
  delete from public.cornell_notes where class_id = cls;
  delete from public.help_requests where class_id = cls;
  delete from public.hall_passes where class_id = cls;
  delete from public.class_updates where class_id = cls;
  delete from public.class_materials where class_id = cls;
  delete from public.quizzes where class_id = cls;
  delete from public.assignments where class_id = cls;
  delete from public.enrollments where class_id = cls and user_id <> all (ids || s_id);

  insert into public.enrollments (class_id, user_id, joined_at)
  select cls, u, now() - interval '9 weeks' from unnest(ids || s_id) u
  on conflict (class_id, user_id) do nothing;

  select id into l1 from public.experiences where slug = 'autocad-l1-workspace-lecture';
  select id into w1 from public.experiences where slug = 'autocad-l1-workspace-website';
  select id into l2 from public.experiences where slug = 'autocad-l2-lines-lecture';
  select id into w2 from public.experiences where slug = 'autocad-l2-lines-website';

  -- ---------------------------------------------------------------- previous class day: Lecture 1
  insert into public.class_materials (class_id, kind, title, experience_id, lesson_date, tag, position, published, created_by, created_at)
  values (cls, 'experience', 'Lecture 1 · The AutoCAD Workspace', l1, prev, 'lecture', 1, true, t_id, prev::timestamp at time zone tz);
  insert into public.assignments (class_id, experience_id, title, instructions, due_at, points, submission_type, created_by, lesson_date, tag, created_at)
  values (cls, w1, 'Lesson 1 — Workspace lab', 'Work through the lab, then paste your quick-check score and one thing you learned.',
          (prev + time '23:59') at time zone tz, 20, 'text_or_url', t_id, prev, 'homework', prev::timestamp at time zone tz)
  returning id into a_lab;
  insert into public.submissions (assignment_id, student_id, body, status, submitted_at, score, feedback, graded_at, graded_by)
  select a_lab, ids[k], 'Quick check ' || (4 + (k % 2)) || '/5. ' ||
         (array['The command line tells you what AutoCAD wants next.', 'Model space is where you draw at full size.',
                'Esc cancels a command when you get stuck.', 'The status bar holds Ortho, Snap and Object Snap.'])[1 + k % 4],
         'returned', (prev + time '20:00') at time zone tz - (k || ' minutes')::interval, 16 + (k % 5),
         case when k % 3 = 0 then 'Good — next time name the Model and Layout tabs too.' else 'Nice work.' end,
         (d + time '07:10') at time zone tz, t_id
  from generate_series(1, 20) k;

  -- ---------------------------------------------------------------- today: Lecture 2, website, worksheet
  insert into public.class_materials (class_id, kind, title, experience_id, lesson_date, tag, position, published, created_by, created_at)
  values (cls, 'experience', lec_title, l2, d, 'lecture', 2, true, t_id, (d + time '07:02') at time zone tz)
  returning id into m_l2;
  insert into public.class_materials (class_id, kind, title, body, experience_id, lesson_date, tag, position, published, created_by, created_at)
  values (cls, 'experience', 'Lesson 2 website · Practice house outline', 'Draw the 30''-0" × 24''-0" practice house outline.',
          w2, d, 'activity', 3, true, t_id, (d + time '07:03') at time zone tz);
  insert into public.assignments (class_id, experience_id, title, instructions, due_at, points, submission_type, created_by, lesson_date, tag, created_at)
  values (cls, w2, 'Lesson 2 — Precise lines worksheet',
          'Draw the practice rectangle at exactly 30''-0" × 24''-0" using relative (@x,y) and polar (@distance<angle) input. Submit a link to your exported PDF.',
          (fri + time '23:59') at time zone tz, 20, 'text_or_url', t_id, d, 'homework', (d + time '07:04') at time zone tz)
  returning id into a_ws;
  insert into public.submissions (assignment_id, student_id, body, status, submitted_at)
  select a_ws, ids[k], 'Finished the outline — 30''-0" × 24''-0" checked with DIST.', 'submitted', (d + time '15:40') at time zone tz + (k || ' minutes')::interval
  from generate_series(1, 6) k;

  -- ---------------------------------------------------------------- the Do Now (open for make-up)
  at := (d + time '10:25') at time zone tz;
  insert into public.quizzes (class_id, kind, title, instructions, status, lesson_date, results_mode, released, shuffle_options, language,
                              source_material_id, source_label, engine, created_by, created_at, published_at, timer_minutes, timer_mode)
  values (cls, 'do_now', 'Do Now · Units & precise lines', 'Answer from what you know — we''ll go over it together.', 'published', d, 'answers', true, true, 'en',
          m_l2, lec_title, 'ai', t_id, (d + time '07:06') at time zone tz, (d + time '07:08') at time zone tz, 5, 'manual')
  returning id into dn;
  insert into public.quiz_questions (id, quiz_id, position, type, prompt, data, key, points, explanation) values
   (dq1, dn, 1, 'multiple_choice', 'Why do we set AutoCAD to Architectural units for a house plan?',
    '{"options":[{"id":"a","text":"So numbers mean feet and inches"},{"id":"b","text":"So lines draw faster"},{"id":"c","text":"So the grid turns on"}],"multi":false}',
    jsonb_build_object('correct', jsonb_build_array('a'), 'source', jsonb_build_object('quote', 'Units tell AutoCAD how to read and show numbers.', 'passage', 'P1', 'page', null, 'heading', '2.1 Setting Architectural Units', 'verified', true)),
    1, 'Architecture in the U.S. uses feet and inches, so we use Architectural units.'),
   (dq2, dn, 2, 'multiple_choice', 'You need a wall 30 feet long. What do you type?',
    '{"options":[{"id":"a","text":"30"},{"id":"b","text":"30''"},{"id":"c","text":"30\""}],"multi":false}',
    jsonb_build_object('correct', jsonb_build_array('b'), 'source', jsonb_build_object('quote', 'Typing 30 for a 30-foot wall draws a wall 2''-6" long.', 'passage', 'P3', 'page', null, 'heading', '2.2 Typing Feet and Inches', 'verified', true)),
    1, 'A number with no mark means inches. Forgetting the foot mark is the #1 beginner mistake.'),
   (dq3, dn, 3, 'true_false', 'With Ortho on (F8), the cursor locks to horizontal and vertical.', '{}',
    jsonb_build_object('answer', true, 'source', jsonb_build_object('quote', 'F8 Ortho Locks the cursor to horizontal and vertical', 'passage', 'P4', 'page', null, 'heading', '2.3 Drawing Aids', 'verified', true)),
    1, 'F8 turns Ortho on and off.'),
   (dq4, dn, 4, 'short_answer', 'In your own words: what does @12'',0 tell AutoCAD?', '{"lines":2}',
    jsonb_build_object('sample', 'Go 12 feet to the right of the last point and 0 up.', 'source', jsonb_build_object('quote', '12 feet right of the last point, 0 up', 'passage', 'P5', 'page', null, 'heading', '2.4 Coordinates', 'verified', true)),
    2, '@ means "from the last point"; x first (right), then y (up).');

  for i in 1 .. 23 loop
    r1 := i <> 7;
    r2 := i not in (3, 9, 14, 20);
    r4 := case when i <= 14 then 2 when i <= 21 then 1 else 0 end;
    pts := (case when r1 then 1 else 0 end) + (case when r2 then 1 else 0 end) + 1 + r4;
    insert into public.quiz_attempts (quiz_id, student_id, answers, per_question, score, max_score, status, started_at, submitted_at, graded_at)
    values (dn, ids[i],
      jsonb_build_object(dq1::text, jsonb_build_array(case when r1 then 'a' else 'b' end),
                         dq2::text, jsonb_build_array(case when r2 then 'b' else 'a' end),
                         dq3::text, true,
                         dq4::text, (array['12 feet to the right of the last point, and 0 up.', 'Move 12 feet right from where you clicked last, not up or down.',
                                           'It goes 12 ft along X from the last point.', 'Go right 12', 'A point at 12,0'])[case when r4 = 2 then 1 + i % 3 when r4 = 1 then 4 else 5 end]),
      jsonb_build_object(dq1::text, jsonb_build_object('points', case when r1 then 1 else 0 end, 'max', 1),
                         dq2::text, jsonb_build_object('points', case when r2 then 1 else 0 end, 'max', 1),
                         dq3::text, jsonb_build_object('points', 1, 'max', 1),
                         dq4::text, jsonb_build_object('points', r4, 'max', 2)),
      pts, 5, 'graded', at + ((20 + i * 9) || ' seconds')::interval, at + ((95 + i * 8) || ' seconds')::interval, (d + time '12:10') at time zone tz);
  end loop;

  -- ---------------------------------------------------------------- the Exit ticket (closed)
  insert into public.quizzes (class_id, kind, title, instructions, status, lesson_date, results_mode, released, shuffle_options, language,
                              source_material_id, source_label, engine, created_by, created_at, published_at, timer_minutes, timer_mode)
  values (cls, 'exit_ticket', 'Exit ticket · Apply it', 'Show what you can do with today''s lesson.', 'closed', d, 'answers', true, true, 'en',
          m_l2, lec_title, 'ai', t_id, (d + time '11:30') at time zone tz, (d + time '11:42') at time zone tz, 5, 'manual')
  returning id into ex;
  insert into public.quiz_questions (id, quiz_id, position, type, prompt, data, key, points, explanation) values
   (eq1, ex, 1, 'multiple_choice', 'You need an exterior wall 30 feet long. What exactly do you type at the prompt?',
    '{"options":[{"id":"a","text":"30"},{"id":"b","text":"30''"},{"id":"c","text":"30\""},{"id":"d","text":"3''0"}],"multi":false}',
    jsonb_build_object('correct', jsonb_build_array('b'), 'source', jsonb_build_object('quote', 'Typing 30 for a 30-foot wall draws a wall 2''-6" long.', 'passage', 'P3', 'page', null, 'heading', '2.2 Typing Feet and Inches', 'verified', true)),
    1, 'Without the foot mark AutoCAD reads inches.'),
   (eq2, ex, 2, 'multiple_choice', 'From the last point, draw a line 10 feet straight up using polar input. What do you type?',
    '{"options":[{"id":"a","text":"@0,10"},{"id":"b","text":"@10''<0"},{"id":"c","text":"@10''<90"},{"id":"d","text":"@10<90"}],"multi":false}',
    jsonb_build_object('correct', jsonb_build_array('c'), 'source', jsonb_build_object('quote', 'Angles are measured from 0° pointing right (east), going counterclockwise: 90° is up', 'passage', 'P2', 'page', null, 'heading', '2.1 Setting Architectural Units', 'verified', true)),
    1, '0° points right (east); 90° is straight up.'),
   (eq3, ex, 3, 'multiple_choice', 'Which Object Snap grabs the exact end of a line?',
    '{"options":[{"id":"a","text":"Endpoint"},{"id":"b","text":"Midpoint"},{"id":"c","text":"Intersection"},{"id":"d","text":"Perpendicular"}],"multi":false}',
    jsonb_build_object('correct', jsonb_build_array('a'), 'source', jsonb_build_object('quote', 'Endpoint: the exact end of a line. Used constantly.', 'passage', 'P6', 'page', null, 'heading', 'Object Snap', 'verified', true)),
    1, 'Endpoint is the snap you will use most.');

  at := (d + time '11:42') at time zone tz;
  for i in 1 .. 23 loop
    a1 := case when i in (4, 17) then 'a' else 'b' end;
    a2 := case when i in (1, 2, 5, 6, 8, 10, 12, 13, 15, 18) then 'c' when i in (22, 23) then 'a' else 'b' end;
    a3 := case when i in (3, 9, 16, 20, 23) then 'b' else 'a' end;
    pts := (a1 = 'b')::int + (a2 = 'c')::int + (a3 = 'a')::int;
    insert into public.quiz_attempts (quiz_id, student_id, answers, per_question, score, max_score, status, started_at, submitted_at, graded_at)
    values (ex, ids[i],
      jsonb_build_object(eq1::text, jsonb_build_array(a1), eq2::text, jsonb_build_array(a2), eq3::text, jsonb_build_array(a3)),
      jsonb_build_object(eq1::text, jsonb_build_object('points', (a1 = 'b')::int, 'max', 1),
                         eq2::text, jsonb_build_object('points', (a2 = 'c')::int, 'max', 1),
                         eq3::text, jsonb_build_object('points', (a3 = 'a')::int, 'max', 1)),
      pts, 3, 'graded', at + ((15 + i * 7) || ' seconds')::interval, at + ((80 + i * 9) || ' seconds')::interval, at + ((80 + i * 9) || ' seconds')::interval);
  end loop;

  -- every check lives in Materials (as the app does on publish)
  insert into public.class_materials (class_id, kind, title, quiz_id, lesson_date, tag, position, published, created_by, timer_minutes, timer_mode, created_at)
  values (cls, 'quiz', 'Do Now · Units & precise lines', dn, d, 'do_now', 0, true, t_id, 5, 'manual', (d + time '07:08') at time zone tz),
         (cls, 'quiz', 'Exit ticket · Apply it', ex, d, 'exit_ticket', 5, true, t_id, 5, 'manual', (d + time '11:42') at time zone tz);

  -- ---------------------------------------------------------------- after class: the session summary
  sum_title := 'Session summary — Units, coordinates & precise lines · ' || to_char(d, 'FMMonth FMDD');
  sum_body := '**Architecture Design 1 · ' || to_char(d, 'FMDay, FMMonth FMDD') || '** — From the lesson: *' || lec_title || '*' || E'\n\n' ||
    E'## What we learned\nToday we set AutoCAD to Architectural units, typed exact feet-and-inch distances, and drew precise lines with relative (@x,y) and polar (@distance<angle) input, using Ortho and Object Snap to stay exact.\n\n' ||
    E'## Learning targets\n- I can set Architectural units.\n- I can type feet and inches correctly.\n- I can draw exact lines with @x,y and @distance<angle.\n\n' ||
    E'## Key ideas\n1. **Units** — Architectural units make numbers mean feet and inches; one drawing unit is one inch.\n   > “Units tell AutoCAD how to read and show numbers.”\n' ||
    E'2. **The foot mark** — a number with no mark means inches, so always type the foot mark for feet.\n   > “Typing 30 for a 30-foot wall draws a wall 2''-6\" long.”\n' ||
    E'3. **Relative input** — @ means “from the last point”: x first (right), then y (up).\n   > “12 feet right of the last point, 0 up”\n' ||
    E'4. **Polar input** — @distance<angle. Angles start at 0° pointing right and turn counterclockwise.\n   > “Angles are measured from 0° pointing right (east), going counterclockwise: 90° is up”\n\n' ||
    E'## Watch out for\n- Not: *@10''<0 for a line going up* → **@10''<90 (0° points right, 90° is up)**\n- Not: *30 for a 30-foot wall* → **30'' (with the foot mark)**\n\n' ||
    E'## Missed class? Catch up\n1. Read this summary.\n2. Open Lecture 2 in Materials and work through sections 2.1–2.4.\n3. Take the Do Now — it is open for make-up.\n4. Finish the Lesson 2 worksheet (due Friday).\n\n' ||
    E'## Check yourself\n- What do you type for a line 15 feet long pointing left?\n- Which key turns Ortho on?';
  notes_body := '**Architecture Design 1 · ' || to_char(d, 'FMDay, FMMonth FMDD') || '**' || E'\n\n' ||
    E'## Today''s checks\n- **Do Now · Units & precise lines** — 23/24 answered · class average 86%\n- **Exit ticket · Apply it** — 23/24 answered · class average 71%\n\n' ||
    E'**Hardest questions**\n- 43% · From the last point, draw a line 10 feet straight up using polar input. What do you type?\n- 78% · Which Object Snap grabs the exact end of a line?\n\n' ||
    E'## Re-teach\n- Polar input: 48% typed @10''<0, thinking 0° points up. Show the angle compass — 0° east, 90° north.\n- Quick drill: four lines, one in each direction, with polar input.\n\n' ||
    E'## Tomorrow''s Do Now\nSpiral back to polar input: @distance<angle, 0° points right, 90° is up.\n\n' ||
    E'## Notes\n- Sofia M. was absent — catch-up plan is in the summary; make-up Do Now is open.';
  insert into public.class_materials (class_id, kind, title, body, lesson_date, tag, position, published, created_by, created_at)
  values (cls, 'page', sum_title, sum_body, d, 'resource', 6, true, t_id, (d + time '15:05') at time zone tz),
         (cls, 'page', ('Teacher notes — ' || sum_title)::text, notes_body, d, null, 7, false, t_id, (d + time '15:05') at time zone tz);
  insert into public.class_updates (class_id, author_id, body, pinned, created_at) values
   (cls, t_id, 'Tomorrow we draw the practice house outline — bring your Lecture 2 notes. Worksheet is due Friday.', false, (prev + time '15:20') at time zone tz),
   (cls, t_id, 'The session summary is up: “' || sum_title || '”. Missed class or want a review? Open it in Materials.', false, (d + time '15:06') at time zone tz);

  -- tomorrow's Do Now, built from today's results (draft)
  insert into public.quizzes (class_id, kind, title, instructions, status, lesson_date, results_mode, released, language, source_material_id, source_label, engine, created_by, created_at, timer_minutes, timer_mode)
  values (cls, 'do_now', 'Do Now · Polar input, again', 'Focus: polar input — @distance<angle, 0° points right, 90° is up.', 'draft', nxt, 'answers', false, 'en',
          m_l2, lec_title, 'ai', t_id, (d + time '15:08') at time zone tz, 5, 'manual')
  returning id into nx;
  insert into public.quiz_questions (quiz_id, position, type, prompt, data, key, points, explanation) values
   (nx, 1, 'multiple_choice', 'Which way does 0° point in AutoCAD?',
    '{"options":[{"id":"a","text":"Up (north)"},{"id":"b","text":"Right (east)"},{"id":"c","text":"Left (west)"},{"id":"d","text":"Down (south)"}],"multi":false}',
    jsonb_build_object('correct', jsonb_build_array('b'), 'source', jsonb_build_object('quote', 'Angles are measured from 0° pointing right (east), going counterclockwise: 90° is up', 'passage', 'P2', 'page', null, 'heading', '2.1 Setting Architectural Units', 'verified', true)), 1, null),
   (nx, 2, 'multiple_choice', 'You need a line 15 feet long pointing left. What do you type?',
    '{"options":[{"id":"a","text":"@15''<0"},{"id":"b","text":"@15''<90"},{"id":"c","text":"@15''<180"},{"id":"d","text":"@15''<270"}],"multi":false}',
    jsonb_build_object('correct', jsonb_build_array('c'), 'source', jsonb_build_object('quote', 'Angles are measured from 0° pointing right (east), going counterclockwise: 90° is up, 180° is left, 270° is down', 'passage', 'P2', 'page', null, 'heading', '2.1 Setting Architectural Units', 'verified', true)), 1, null),
   (nx, 3, 'true_false', '@10''<90 draws a line 10 feet straight up from the last point.', '{}',
    jsonb_build_object('answer', true, 'source', jsonb_build_object('quote', 'Polar @10''<90 10 feet long at 90° (straight up)', 'passage', 'P5', 'page', null, 'heading', '2.4 Coordinates', 'verified', true)), 1, null);

  -- ---------------------------------------------------------------- the live room
  insert into public.help_requests (class_id, student_id, kind, note, page_path, page_title, status, created_at)
  values (cls, ids[1], 'question', 'Is 30'' the same as 30''-0"?', '/experiences/autocad-l2-lines-lecture', lec_title, 'raised', now() - interval '2 minutes');
  insert into public.hall_passes (class_id, student_id, destination, status, requested_at)
  values (cls, ids[2], 'restroom', 'pending', now() - interval '40 seconds');

  -- Sofia's catch-up notes (the demo student's own notebook)
  insert into public.cornell_notes (user_id, class_id, title, note_date, data, updated_at)
  values (s_id, cls, 'Lecture 2 — catch-up', d, jsonb_build_object(
    'id', gen_random_uuid()::text, 'classId', cls::text, 'title', 'Lecture 2 — catch-up', 'date', to_char(d, 'YYYY-MM-DD'),
    'name', 'Sofia M.', 'className', 'Architecture Design 1', 'period', 'Period 3',
    'question', 'How do I draw a line at an exact length and angle?', 'font', 'print',
    'pages', jsonb_build_array(jsonb_build_object('id', 'p1',
      'cues', E'Why Architectural units?\nFeet vs inches?\nWhat does @ mean?\nWhich way is 0°?',
      'notes', E'Architectural units → numbers mean feet + inches (1 unit = 1 inch).\n\nType the foot mark! 30 = 30 inches (2''-6"), 30'' = 30 feet.\n\n@x,y = relative: from the last point. @12'',0 → 12 ft right, 0 up.\n\n@distance<angle = polar. 0° points RIGHT (east), counterclockwise: 90° up, 180° left, 270° down.\n\nF8 Ortho = only horizontal/vertical. F3 Object Snap → Endpoint, Midpoint.',
      'summary', 'Set Architectural units, always type the foot mark, and use @ to measure from the last point. For polar input, 0° points right, so straight up is 90°.')),
    'updatedAt', (extract(epoch from now()) * 1000)::bigint), now());

  return jsonb_build_object('ok', true, 'class_id', cls, 'day', d, 'students', array_length(ids, 1) + 1);
end; $$;

revoke execute on function public.demo_live_reset() from public, anon;
grant execute on function public.demo_live_reset() to authenticated;

select public.demo_live_reset();

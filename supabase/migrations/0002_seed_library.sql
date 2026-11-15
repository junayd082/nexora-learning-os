-- NEXORA seed: worlds, feature flags, and the founder's AutoCAD for Beginners course (EN + ES).
insert into public.feature_flags (key, enabled, description) values
  ('demo_accounts', true,  'Show one-click demo sign-in on the login page. Turn off before inviting real students.'),
  ('live_sessions', true,  'Presentation Mode with QR join and live join count.'),
  ('portfolio',     true,  'Student portfolio.'),
  ('nexora_guide',  false, 'NEXORA Guide AI companion (Phase 4).'),
  ('marketplace',   false, 'NEXORA Marketplace (Phase 6).')
on conflict (key) do nothing;

insert into public.worlds (slug, name, name_es, description, description_es, accent, sort_order) values
  ('autocad', 'AutoCAD World', 'Mundo AutoCAD', 'Draft real buildings in AutoCAD, from a blank screen to a printed floor plan.', 'Dibuja edificios reales en AutoCAD, desde una pantalla en blanco hasta un plano impreso.', '#1E4F8F', 10),
  ('architecture', 'Architecture World', 'Mundo Arquitectura', 'Design spaces people live and work in: residential design, construction and the built environment.', 'Diseña espacios donde la gente vive y trabaja: diseño residencial, construcción y entorno construido.', '#8A5A2B', 20),
  ('engineering', 'Engineering World', 'Mundo Ingeniería', 'Solve problems with the engineering design process, structures and technical communication.', 'Resuelve problemas con el proceso de diseño de ingeniería, estructuras y comunicación técnica.', '#2F6B4F', 30),
  ('coding', 'Coding World', 'Mundo Programación', 'Build software, automate work and think computationally.', 'Crea software, automatiza tareas y piensa de forma computacional.', '#5B3FA8', 40)
on conflict (slug) do nothing;

insert into public.collections (slug, title, title_es, description, description_es, is_sequence, visibility) values
  ('autocad-for-beginners', 'AutoCAD for Beginners', 'AutoCAD para principiantes',
   'Six lessons from a blank screen to a printed floor plan. Play in order: Lecture, then Lesson Website, for Lessons 1 to 6.',
   'Seis lecciones, desde una pantalla en blanco hasta un plano impreso. Sigue el orden: Clase y luego Sitio de la lección, de la Lección 1 a la 6.',
   true, 'public')
on conflict (slug) do nothing;

with x as (
  insert into public.experiences (slug, creator_name, world_id, type, subject, grade_range, difficulty, duration_minutes, resource_url, embed_url, worksheet_url, tags, skills, visibility, status, quality, version, created_at)
  values ('autocad-l1-workspace-lecture', 'M. Chinnakotla', (select id from public.worlds where slug = 'autocad'), 'lecture', 'Architecture & Construction', '9–12', 'Beginner', 90, 'https://claude.ai/artifact/ADP3LVYhRXwGRbeEFtJg9s', '/experiences/autocad/L1-workspace/lecture.html', '/experiences/autocad/L1-workspace/worksheet.pdf', array['AutoCAD','Floor Plan','CAD','Workspace']::text[], array['CAD Drafting','Architectural Drafting','CAD Navigation']::text[], 'public', 'published', 'teacher_verified', '1.0', '2026-10-23T12:00:00-05')
  on conflict (slug) do nothing returning id),
t as (
  insert into public.experience_translations (experience_id, locale, title, short_description, description, learning_objective, student_instructions, machine_translated)
  select id, 'en', 'AutoCAD L1: Workspace — Lecture', 'Find your way around the screen and learn to talk to AutoCAD.', 'Lecture for Lesson 1 of AutoCAD for Beginners (The AutoCAD 2026 Workspace): chapter rail, worked examples, Try-it links, an exercise, a summary and the downloadable 3-page fillable worksheet.', 'Students will identify the main areas of the AutoCAD 2026 workspace, navigate a drawing, and respond to command-line prompts.', 'Read the lecture, try the example, then open the lesson website.', false from x
  union all
  select id, 'es', 'AutoCAD L1: Espacio de trabajo — Clase', 'Ubícate en la pantalla y aprende a comunicarte con AutoCAD.', 'Clase de la Lección 1 de AutoCAD para principiantes (El espacio de trabajo de AutoCAD 2026): índice de capítulos, ejemplos resueltos, enlaces «Pruébalo», un ejercicio, un resumen y la hoja de trabajo rellenable de 3 páginas para descargar.', 'Los estudiantes identificarán las áreas principales del espacio de trabajo de AutoCAD 2026, navegarán por un dibujo y responderán a las indicaciones de la línea de comandos.', 'Lee la clase, prueba el ejemplo y luego abre el sitio de la lección.', true from x
  returning experience_id),
n as (
  insert into public.experience_teacher_notes (experience_id, locale, notes)
  select id, 'en', 'Part of the 6-lesson AutoCAD for Beginners playlist (Lesson 1). Prerequisite: none. 90-minute block. Worksheet answer key is kept offline with the teacher. Original published version: https://claude.ai/artifact/ADP3LVYhRXwGRbeEFtJg9s — paired page: https://claude.ai/artifact/FvWywWhM2MpeSMuNXui4kW' from x union all select id, 'es', 'Parte de la serie de 6 lecciones AutoCAD para principiantes (Lección 1). Requisito previo: ninguno. Bloque de 90 minutos. La clave de respuestas de la hoja de trabajo se guarda fuera de línea con el docente.' from x
  returning experience_id)
insert into public.collection_items (collection_id, experience_id, position)
select (select id from public.collections where slug = 'autocad-for-beginners'), id, 0 from x;

with x as (
  insert into public.experiences (slug, creator_name, world_id, type, subject, grade_range, difficulty, duration_minutes, resource_url, embed_url, worksheet_url, tags, skills, visibility, status, quality, version, created_at)
  values ('autocad-l1-workspace-website', 'M. Chinnakotla', (select id from public.worlds where slug = 'autocad'), 'lesson', 'Architecture & Construction', '9–12', 'Beginner', 90, 'https://claude.ai/artifact/FvWywWhM2MpeSMuNXui4kW', '/experiences/autocad/L1-workspace/lesson.html', '/experiences/autocad/L1-workspace/worksheet.pdf', array['AutoCAD','Floor Plan','CAD','Workspace']::text[], array['CAD Drafting','Architectural Drafting','CAD Navigation']::text[], 'public', 'published', 'teacher_verified', '1.0', '2026-10-23T12:00:00-05')
  on conflict (slug) do nothing returning id),
t as (
  insert into public.experience_translations (experience_id, locale, title, short_description, description, learning_objective, student_instructions, machine_translated)
  select id, 'en', 'AutoCAD L1: Workspace — Lesson Website', 'Before we draw the practice house, we learn the cockpit: where every tool lives and how AutoCAD talks to you.', 'Interactive lesson website for Lesson 1 (The AutoCAD 2026 Workspace). The AutoCAD workspace is the screen layout: Ribbon on top, drawing area in the middle, command line below, Model and Layout tabs and the status bar at the bottom. Includes the lab, vocabulary, step-by-step AutoCAD tasks, a quick check, the worksheet download, an exit ticket, a rubric, Teacher mode and Present mode.', 'Students will identify the main areas of the AutoCAD 2026 workspace, navigate a drawing, and respond to command-line prompts.', 'Do the lab, follow the AutoCAD steps, take the quick check, then download and complete the worksheet.', false from x
  union all
  select id, 'es', 'AutoCAD L1: Espacio de trabajo — Sitio de la lección', 'Antes de dibujar la casa de práctica, conocemos la cabina: dónde está cada herramienta y cómo te habla AutoCAD.', 'Sitio interactivo de la Lección 1 (El espacio de trabajo de AutoCAD 2026). El espacio de trabajo de AutoCAD es la distribución de la pantalla: la cinta de opciones arriba, el área de dibujo en el centro, la línea de comandos debajo, y las pestañas Modelo y Presentación junto con la barra de estado en la parte inferior. Incluye el laboratorio, vocabulario, tareas paso a paso en AutoCAD, una revisión rápida, la hoja de trabajo para descargar, un boleto de salida, una rúbrica, el modo Docente y el modo Presentación.', 'Los estudiantes identificarán las áreas principales del espacio de trabajo de AutoCAD 2026, navegarán por un dibujo y responderán a las indicaciones de la línea de comandos.', 'Haz el laboratorio, sigue los pasos en AutoCAD, responde la revisión rápida y luego descarga y completa la hoja de trabajo.', true from x
  returning experience_id),
n as (
  insert into public.experience_teacher_notes (experience_id, locale, notes)
  select id, 'en', 'Part of the 6-lesson AutoCAD for Beginners playlist (Lesson 1). Prerequisite: none. 90-minute block. Worksheet answer key is kept offline with the teacher. Original published version: https://claude.ai/artifact/FvWywWhM2MpeSMuNXui4kW — paired page: https://claude.ai/artifact/ADP3LVYhRXwGRbeEFtJg9s' from x union all select id, 'es', 'Parte de la serie de 6 lecciones AutoCAD para principiantes (Lección 1). Requisito previo: ninguno. Bloque de 90 minutos. La clave de respuestas de la hoja de trabajo se guarda fuera de línea con el docente.' from x
  returning experience_id)
insert into public.collection_items (collection_id, experience_id, position)
select (select id from public.collections where slug = 'autocad-for-beginners'), id, 1 from x;

with x as (
  insert into public.experiences (slug, creator_name, world_id, type, subject, grade_range, difficulty, duration_minutes, resource_url, embed_url, worksheet_url, tags, skills, visibility, status, quality, version, created_at)
  values ('autocad-l2-lines-lecture', 'M. Chinnakotla', (select id from public.worlds where slug = 'autocad'), 'lecture', 'Architecture & Construction', '9–12', 'Beginner', 90, 'https://claude.ai/artifact/PjRYdvsRM78BTsGwV7WXkS', '/experiences/autocad/L2-lines/lecture.html', '/experiences/autocad/L2-lines/worksheet.pdf', array['AutoCAD','Floor Plan','CAD','Precise Lines']::text[], array['CAD Drafting','Architectural Drafting','Precision Drawing']::text[], 'public', 'published', 'teacher_verified', '1.0', '2026-10-23T12:00:00-05')
  on conflict (slug) do nothing returning id),
t as (
  insert into public.experience_translations (experience_id, locale, title, short_description, description, learning_objective, student_instructions, machine_translated)
  select id, 'en', 'AutoCAD L2: Precise Lines — Lecture', 'Set architectural units and draw lines at their exact real-world length.', 'Lecture for Lesson 2 of AutoCAD for Beginners (Units, Coordinates & Precise Lines): chapter rail, worked examples, Try-it links, an exercise, a summary and the downloadable 3-page fillable worksheet.', 'Students will set architectural units, enter feet-and-inch distances, and draw exact geometry using relative, polar and direct-distance input with drawing aids.', 'Read the lecture, try the example, then open the lesson website.', false from x
  union all
  select id, 'es', 'AutoCAD L2: Líneas precisas — Clase', 'Configura unidades arquitectónicas y dibuja líneas con su longitud real exacta.', 'Clase de la Lección 2 de AutoCAD para principiantes (Unidades, coordenadas y líneas precisas): índice de capítulos, ejemplos resueltos, enlaces «Pruébalo», un ejercicio, un resumen y la hoja de trabajo rellenable de 3 páginas para descargar.', 'Los estudiantes configurarán unidades arquitectónicas, introducirán distancias en pies y pulgadas, y dibujarán geometría exacta con entrada relativa, polar y de distancia directa usando las ayudas de dibujo.', 'Lee la clase, prueba el ejemplo y luego abre el sitio de la lección.', true from x
  returning experience_id),
n as (
  insert into public.experience_teacher_notes (experience_id, locale, notes)
  select id, 'en', 'Part of the 6-lesson AutoCAD for Beginners playlist (Lesson 2). Prerequisite: AutoCAD Lesson 1. 90-minute block. Worksheet answer key is kept offline with the teacher. Original published version: https://claude.ai/artifact/PjRYdvsRM78BTsGwV7WXkS — paired page: https://claude.ai/artifact/CWMbZvBmxz77oQrH7nY5uj' from x union all select id, 'es', 'Parte de la serie de 6 lecciones AutoCAD para principiantes (Lección 2). Requisito previo: Lección 1 de AutoCAD. Bloque de 90 minutos. La clave de respuestas de la hoja de trabajo se guarda fuera de línea con el docente.' from x
  returning experience_id)
insert into public.collection_items (collection_id, experience_id, position)
select (select id from public.collections where slug = 'autocad-for-beginners'), id, 2 from x;

with x as (
  insert into public.experiences (slug, creator_name, world_id, type, subject, grade_range, difficulty, duration_minutes, resource_url, embed_url, worksheet_url, tags, skills, visibility, status, quality, version, created_at)
  values ('autocad-l2-lines-website', 'M. Chinnakotla', (select id from public.worlds where slug = 'autocad'), 'lesson', 'Architecture & Construction', '9–12', 'Beginner', 90, 'https://claude.ai/artifact/CWMbZvBmxz77oQrH7nY5uj', '/experiences/autocad/L2-lines/lesson.html', '/experiences/autocad/L2-lines/worksheet.pdf', array['AutoCAD','Floor Plan','CAD','Precise Lines']::text[], array['CAD Drafting','Architectural Drafting','Precision Drawing']::text[], 'public', 'published', 'teacher_verified', '1.0', '2026-10-23T12:00:00-05')
  on conflict (slug) do nothing returning id),
t as (
  insert into public.experience_translations (experience_id, locale, title, short_description, description, learning_objective, student_instructions, machine_translated)
  select id, 'en', 'AutoCAD L2: Precise Lines — Lesson Website', 'Today the numbers start meaning something. Set the units, then put every point exactly where it belongs.', 'Interactive lesson website for Lesson 2 (Units, Coordinates & Precise Lines). Units tell AutoCAD that numbers are feet and inches. Coordinates and drawing aids tell it exactly where each point goes. Includes the lab, vocabulary, step-by-step AutoCAD tasks, a quick check, the worksheet download, an exit ticket, a rubric, Teacher mode and Present mode.', 'Students will set architectural units, enter feet-and-inch distances, and draw exact geometry using relative, polar and direct-distance input with drawing aids.', 'Do the lab, follow the AutoCAD steps, take the quick check, then download and complete the worksheet.', false from x
  union all
  select id, 'es', 'AutoCAD L2: Líneas precisas — Sitio de la lección', 'Hoy los números empiezan a significar algo. Configura las unidades y coloca cada punto exactamente donde debe ir.', 'Sitio interactivo de la Lección 2 (Unidades, coordenadas y líneas precisas). Las unidades le indican a AutoCAD que los números son pies y pulgadas. Las coordenadas y las ayudas de dibujo le dicen exactamente dónde va cada punto. Incluye el laboratorio, vocabulario, tareas paso a paso en AutoCAD, una revisión rápida, la hoja de trabajo para descargar, un boleto de salida, una rúbrica, el modo Docente y el modo Presentación.', 'Los estudiantes configurarán unidades arquitectónicas, introducirán distancias en pies y pulgadas, y dibujarán geometría exacta con entrada relativa, polar y de distancia directa usando las ayudas de dibujo.', 'Haz el laboratorio, sigue los pasos en AutoCAD, responde la revisión rápida y luego descarga y completa la hoja de trabajo.', true from x
  returning experience_id),
n as (
  insert into public.experience_teacher_notes (experience_id, locale, notes)
  select id, 'en', 'Part of the 6-lesson AutoCAD for Beginners playlist (Lesson 2). Prerequisite: AutoCAD Lesson 1. 90-minute block. Worksheet answer key is kept offline with the teacher. Original published version: https://claude.ai/artifact/CWMbZvBmxz77oQrH7nY5uj — paired page: https://claude.ai/artifact/PjRYdvsRM78BTsGwV7WXkS' from x union all select id, 'es', 'Parte de la serie de 6 lecciones AutoCAD para principiantes (Lección 2). Requisito previo: Lección 1 de AutoCAD. Bloque de 90 minutos. La clave de respuestas de la hoja de trabajo se guarda fuera de línea con el docente.' from x
  returning experience_id)
insert into public.collection_items (collection_id, experience_id, position)
select (select id from public.collections where slug = 'autocad-for-beginners'), id, 3 from x;

with x as (
  insert into public.experiences (slug, creator_name, world_id, type, subject, grade_range, difficulty, duration_minutes, resource_url, embed_url, worksheet_url, tags, skills, visibility, status, quality, version, created_at)
  values ('autocad-l3-layers-lecture', 'M. Chinnakotla', (select id from public.worlds where slug = 'autocad'), 'lecture', 'Architecture & Construction', '9–12', 'Beginner', 90, 'https://claude.ai/artifact/9h8zkQBuSfPBEtQpKDnxUU', '/experiences/autocad/L3-layers/lecture.html', '/experiences/autocad/L3-layers/worksheet.pdf', array['AutoCAD','Floor Plan','CAD','Layers']::text[], array['CAD Drafting','Architectural Drafting','Drawing Organization']::text[], 'public', 'published', 'teacher_verified', '1.0', '2026-10-23T12:00:00-05')
  on conflict (slug) do nothing returning id),
t as (
  insert into public.experience_translations (experience_id, locale, title, short_description, description, learning_objective, student_instructions, machine_translated)
  select id, 'en', 'AutoCAD L3: Layers — Lecture', 'Put every object on the layer that says what it is.', 'Lecture for Lesson 3 of AutoCAD for Beginners (Layers: Organizing the Drawing): chapter rail, worked examples, Try-it links, an exercise, a summary and the downloadable 3-page fillable worksheet.', 'Students will create the seven class layers with correct names, colors and lineweights, set the current layer, and move objects onto the correct layer.', 'Read the lecture, try the example, then open the lesson website.', false from x
  union all
  select id, 'es', 'AutoCAD L3: Capas — Clase', 'Coloca cada objeto en la capa que dice qué es.', 'Clase de la Lección 3 de AutoCAD para principiantes (Capas: organizar el dibujo): índice de capítulos, ejemplos resueltos, enlaces «Pruébalo», un ejercicio, un resumen y la hoja de trabajo rellenable de 3 páginas para descargar.', 'Los estudiantes crearán las siete capas de la clase con los nombres, colores y grosores de línea correctos, establecerán la capa actual y moverán objetos a la capa correcta.', 'Lee la clase, prueba el ejemplo y luego abre el sitio de la lección.', true from x
  returning experience_id),
n as (
  insert into public.experience_teacher_notes (experience_id, locale, notes)
  select id, 'en', 'Part of the 6-lesson AutoCAD for Beginners playlist (Lesson 3). Prerequisite: AutoCAD Lesson 2. 90-minute block. Worksheet answer key is kept offline with the teacher. Original published version: https://claude.ai/artifact/9h8zkQBuSfPBEtQpKDnxUU — paired page: https://claude.ai/artifact/7KkzSYChoJYqjPYBhuyYJw' from x union all select id, 'es', 'Parte de la serie de 6 lecciones AutoCAD para principiantes (Lección 3). Requisito previo: Lección 2 de AutoCAD. Bloque de 90 minutos. La clave de respuestas de la hoja de trabajo se guarda fuera de línea con el docente.' from x
  returning experience_id)
insert into public.collection_items (collection_id, experience_id, position)
select (select id from public.collections where slug = 'autocad-for-beginners'), id, 4 from x;

with x as (
  insert into public.experiences (slug, creator_name, world_id, type, subject, grade_range, difficulty, duration_minutes, resource_url, embed_url, worksheet_url, tags, skills, visibility, status, quality, version, created_at)
  values ('autocad-l3-layers-website', 'M. Chinnakotla', (select id from public.worlds where slug = 'autocad'), 'lesson', 'Architecture & Construction', '9–12', 'Beginner', 90, 'https://claude.ai/artifact/7KkzSYChoJYqjPYBhuyYJw', '/experiences/autocad/L3-layers/lesson.html', '/experiences/autocad/L3-layers/worksheet.pdf', array['AutoCAD','Floor Plan','CAD','Layers']::text[], array['CAD Drafting','Architectural Drafting','Drawing Organization']::text[], 'public', 'published', 'teacher_verified', '1.0', '2026-10-23T12:00:00-05')
  on conflict (slug) do nothing returning id),
t as (
  insert into public.experience_translations (experience_id, locale, title, short_description, description, learning_objective, student_instructions, machine_translated)
  select id, 'en', 'AutoCAD L3: Layers — Lesson Website', 'Organize before the drawing gets big. Seven layers, one rule: every object lives on the layer that says what it is.', 'Interactive lesson website for Lesson 3 (Layers: Organizing the Drawing). Layers are categories of information, each with its own color, lineweight and visibility. Includes the lab, vocabulary, step-by-step AutoCAD tasks, a quick check, the worksheet download, an exit ticket, a rubric, Teacher mode and Present mode.', 'Students will create the seven class layers with correct names, colors and lineweights, set the current layer, and move objects onto the correct layer.', 'Do the lab, follow the AutoCAD steps, take the quick check, then download and complete the worksheet.', false from x
  union all
  select id, 'es', 'AutoCAD L3: Capas — Sitio de la lección', 'Organiza antes de que el dibujo crezca. Siete capas, una regla: cada objeto vive en la capa que dice qué es.', 'Sitio interactivo de la Lección 3 (Capas: organizar el dibujo). Las capas son categorías de información, cada una con su propio color, grosor de línea y visibilidad. Incluye el laboratorio, vocabulario, tareas paso a paso en AutoCAD, una revisión rápida, la hoja de trabajo para descargar, un boleto de salida, una rúbrica, el modo Docente y el modo Presentación.', 'Los estudiantes crearán las siete capas de la clase con los nombres, colores y grosores de línea correctos, establecerán la capa actual y moverán objetos a la capa correcta.', 'Haz el laboratorio, sigue los pasos en AutoCAD, responde la revisión rápida y luego descarga y completa la hoja de trabajo.', true from x
  returning experience_id),
n as (
  insert into public.experience_teacher_notes (experience_id, locale, notes)
  select id, 'en', 'Part of the 6-lesson AutoCAD for Beginners playlist (Lesson 3). Prerequisite: AutoCAD Lesson 2. 90-minute block. Worksheet answer key is kept offline with the teacher. Original published version: https://claude.ai/artifact/7KkzSYChoJYqjPYBhuyYJw — paired page: https://claude.ai/artifact/9h8zkQBuSfPBEtQpKDnxUU' from x union all select id, 'es', 'Parte de la serie de 6 lecciones AutoCAD para principiantes (Lección 3). Requisito previo: Lección 2 de AutoCAD. Bloque de 90 minutos. La clave de respuestas de la hoja de trabajo se guarda fuera de línea con el docente.' from x
  returning experience_id)
insert into public.collection_items (collection_id, experience_id, position)
select (select id from public.collections where slug = 'autocad-for-beginners'), id, 5 from x;

with x as (
  insert into public.experiences (slug, creator_name, world_id, type, subject, grade_range, difficulty, duration_minutes, resource_url, embed_url, worksheet_url, tags, skills, visibility, status, quality, version, created_at)
  values ('autocad-l4-walls-lecture', 'M. Chinnakotla', (select id from public.worlds where slug = 'autocad'), 'lecture', 'Architecture & Construction', '9–12', 'Beginner', 90, 'https://claude.ai/artifact/LQNorE7A4nAGT8BqFSQxtP', '/experiences/autocad/L4-walls/lecture.html', '/experiences/autocad/L4-walls/worksheet.pdf', array['AutoCAD','Floor Plan','CAD','Walls']::text[], array['CAD Drafting','Architectural Drafting','Wall Construction']::text[], 'public', 'published', 'teacher_verified', '1.0', '2026-10-23T12:00:00-05')
  on conflict (slug) do nothing returning id),
t as (
  insert into public.experience_translations (experience_id, locale, title, short_description, description, learning_objective, student_instructions, machine_translated)
  select id, 'en', 'AutoCAD L4: Walls — Lecture', 'Turn one rectangle into real walls with exact thickness.', 'Lecture for Lesson 4 of AutoCAD for Beginners (Building the Walls): chapter rail, worked examples, Try-it links, an exercise, a summary and the downloadable 3-page fillable worksheet.', 'Students will build the practice house exterior walls with OFFSET, add 4" interior walls, and clean every intersection with TRIM, EXTEND and FILLET.', 'Read the lecture, try the example, then open the lesson website.', false from x
  union all
  select id, 'es', 'AutoCAD L4: Muros — Clase', 'Convierte un rectángulo en muros reales con el grosor exacto.', 'Clase de la Lección 4 de AutoCAD para principiantes (Construcción de los muros): índice de capítulos, ejemplos resueltos, enlaces «Pruébalo», un ejercicio, un resumen y la hoja de trabajo rellenable de 3 páginas para descargar.', 'Los estudiantes construirán los muros exteriores de la casa de práctica con OFFSET, añadirán muros interiores de 4" y limpiarán cada intersección con TRIM, EXTEND y FILLET.', 'Lee la clase, prueba el ejemplo y luego abre el sitio de la lección.', true from x
  returning experience_id),
n as (
  insert into public.experience_teacher_notes (experience_id, locale, notes)
  select id, 'en', 'Part of the 6-lesson AutoCAD for Beginners playlist (Lesson 4). Prerequisite: AutoCAD Lesson 3. 90-minute block. Worksheet answer key is kept offline with the teacher. Original published version: https://claude.ai/artifact/LQNorE7A4nAGT8BqFSQxtP — paired page: https://claude.ai/artifact/Lbv4sxpRKhgVhMGpsuDcS8' from x union all select id, 'es', 'Parte de la serie de 6 lecciones AutoCAD para principiantes (Lección 4). Requisito previo: Lección 3 de AutoCAD. Bloque de 90 minutos. La clave de respuestas de la hoja de trabajo se guarda fuera de línea con el docente.' from x
  returning experience_id)
insert into public.collection_items (collection_id, experience_id, position)
select (select id from public.collections where slug = 'autocad-for-beginners'), id, 6 from x;

with x as (
  insert into public.experiences (slug, creator_name, world_id, type, subject, grade_range, difficulty, duration_minutes, resource_url, embed_url, worksheet_url, tags, skills, visibility, status, quality, version, created_at)
  values ('autocad-l4-walls-website', 'M. Chinnakotla', (select id from public.worlds where slug = 'autocad'), 'lesson', 'Architecture & Construction', '9–12', 'Beginner', 90, 'https://claude.ai/artifact/Lbv4sxpRKhgVhMGpsuDcS8', '/experiences/autocad/L4-walls/lesson.html', '/experiences/autocad/L4-walls/worksheet.pdf', array['AutoCAD','Floor Plan','CAD','Walls']::text[], array['CAD Drafting','Architectural Drafting','Wall Construction']::text[], 'public', 'published', 'teacher_verified', '1.0', '2026-10-23T12:00:00-05')
  on conflict (slug) do nothing returning id),
t as (
  insert into public.experience_translations (experience_id, locale, title, short_description, description, learning_objective, student_instructions, machine_translated)
  select id, 'en', 'AutoCAD L4: Walls — Lesson Website', 'The rectangle becomes a building. Two faces per wall, exact thickness, clean intersections.', 'Interactive lesson website for Lesson 4 (Building the Walls). Exterior walls form the building envelope. Interior walls divide the inside into rooms. Each wall is two parallel lines. Includes the lab, vocabulary, step-by-step AutoCAD tasks, a quick check, the worksheet download, an exit ticket, a rubric, Teacher mode and Present mode.', 'Students will build the practice house exterior walls with OFFSET, add 4" interior walls, and clean every intersection with TRIM, EXTEND and FILLET.', 'Do the lab, follow the AutoCAD steps, take the quick check, then download and complete the worksheet.', false from x
  union all
  select id, 'es', 'AutoCAD L4: Muros — Sitio de la lección', 'El rectángulo se convierte en un edificio. Dos caras por muro, grosor exacto, intersecciones limpias.', 'Sitio interactivo de la Lección 4 (Construcción de los muros). Los muros exteriores forman la envolvente del edificio. Los muros interiores dividen el interior en habitaciones. Cada muro son dos líneas paralelas. Incluye el laboratorio, vocabulario, tareas paso a paso en AutoCAD, una revisión rápida, la hoja de trabajo para descargar, un boleto de salida, una rúbrica, el modo Docente y el modo Presentación.', 'Los estudiantes construirán los muros exteriores de la casa de práctica con OFFSET, añadirán muros interiores de 4" y limpiarán cada intersección con TRIM, EXTEND y FILLET.', 'Haz el laboratorio, sigue los pasos en AutoCAD, responde la revisión rápida y luego descarga y completa la hoja de trabajo.', true from x
  returning experience_id),
n as (
  insert into public.experience_teacher_notes (experience_id, locale, notes)
  select id, 'en', 'Part of the 6-lesson AutoCAD for Beginners playlist (Lesson 4). Prerequisite: AutoCAD Lesson 3. 90-minute block. Worksheet answer key is kept offline with the teacher. Original published version: https://claude.ai/artifact/Lbv4sxpRKhgVhMGpsuDcS8 — paired page: https://claude.ai/artifact/LQNorE7A4nAGT8BqFSQxtP' from x union all select id, 'es', 'Parte de la serie de 6 lecciones AutoCAD para principiantes (Lección 4). Requisito previo: Lección 3 de AutoCAD. Bloque de 90 minutos. La clave de respuestas de la hoja de trabajo se guarda fuera de línea con el docente.' from x
  returning experience_id)
insert into public.collection_items (collection_id, experience_id, position)
select (select id from public.collections where slug = 'autocad-for-beginners'), id, 7 from x;

with x as (
  insert into public.experiences (slug, creator_name, world_id, type, subject, grade_range, difficulty, duration_minutes, resource_url, embed_url, worksheet_url, tags, skills, visibility, status, quality, version, created_at)
  values ('autocad-l5-doors-lecture', 'M. Chinnakotla', (select id from public.worlds where slug = 'autocad'), 'lecture', 'Architecture & Construction', '9–12', 'Beginner', 90, 'https://claude.ai/artifact/B7bh4pyM8KFimsTsFiK7R4', '/experiences/autocad/L5-doors/lecture.html', '/experiences/autocad/L5-doors/worksheet.pdf', array['AutoCAD','Floor Plan','CAD','Doors & Labels']::text[], array['CAD Drafting','Architectural Drafting','Blocks & Annotation']::text[], 'public', 'published', 'teacher_verified', '1.0', '2026-10-23T12:00:00-05')
  on conflict (slug) do nothing returning id),
t as (
  insert into public.experience_translations (experience_id, locale, title, short_description, description, learning_objective, student_instructions, machine_translated)
  select id, 'en', 'AutoCAD L5: Doors & Labels — Lecture', 'Cut real openings, insert door and window blocks, and label every room.', 'Lecture for Lesson 5 of AutoCAD for Beginners (Doors, Windows & Room Labels): chapter rail, worked examples, Try-it links, an exercise, a summary and the downloadable 3-page fillable worksheet.', 'Students will cut wall openings, create and insert a door block with a correct swing, add windows, and label rooms with MTEXT at a readable height.', 'Read the lecture, try the example, then open the lesson website.', false from x
  union all
  select id, 'es', 'AutoCAD L5: Puertas y etiquetas — Clase', 'Corta vanos reales, inserta bloques de puertas y ventanas, y etiqueta cada habitación.', 'Clase de la Lección 5 de AutoCAD para principiantes (Puertas, ventanas y etiquetas de habitaciones): índice de capítulos, ejemplos resueltos, enlaces «Pruébalo», un ejercicio, un resumen y la hoja de trabajo rellenable de 3 páginas para descargar.', 'Los estudiantes cortarán vanos en los muros, crearán e insertarán un bloque de puerta con el abatimiento correcto, añadirán ventanas y etiquetarán las habitaciones con MTEXT a una altura legible.', 'Lee la clase, prueba el ejemplo y luego abre el sitio de la lección.', true from x
  returning experience_id),
n as (
  insert into public.experience_teacher_notes (experience_id, locale, notes)
  select id, 'en', 'Part of the 6-lesson AutoCAD for Beginners playlist (Lesson 5). Prerequisite: AutoCAD Lesson 4. 90-minute block. Worksheet answer key is kept offline with the teacher. Original published version: https://claude.ai/artifact/B7bh4pyM8KFimsTsFiK7R4 — paired page: https://claude.ai/artifact/GgWJtbnWny1maRqMydcxte' from x union all select id, 'es', 'Parte de la serie de 6 lecciones AutoCAD para principiantes (Lección 5). Requisito previo: Lección 4 de AutoCAD. Bloque de 90 minutos. La clave de respuestas de la hoja de trabajo se guarda fuera de línea con el docente.' from x
  returning experience_id)
insert into public.collection_items (collection_id, experience_id, position)
select (select id from public.collections where slug = 'autocad-for-beginners'), id, 8 from x;

with x as (
  insert into public.experiences (slug, creator_name, world_id, type, subject, grade_range, difficulty, duration_minutes, resource_url, embed_url, worksheet_url, tags, skills, visibility, status, quality, version, created_at)
  values ('autocad-l5-doors-website', 'M. Chinnakotla', (select id from public.worlds where slug = 'autocad'), 'lesson', 'Architecture & Construction', '9–12', 'Beginner', 90, 'https://claude.ai/artifact/GgWJtbnWny1maRqMydcxte', '/experiences/autocad/L5-doors/lesson.html', '/experiences/autocad/L5-doors/worksheet.pdf', array['AutoCAD','Floor Plan','CAD','Doors & Labels']::text[], array['CAD Drafting','Architectural Drafting','Blocks & Annotation']::text[], 'public', 'published', 'teacher_verified', '1.0', '2026-10-23T12:00:00-05')
  on conflict (slug) do nothing returning id),
t as (
  insert into public.experience_translations (experience_id, locale, title, short_description, description, learning_objective, student_instructions, machine_translated)
  select id, 'en', 'AutoCAD L5: Doors & Labels — Lesson Website', 'Walls become rooms people can use. Cut the openings, hang the doors, glaze the windows, name the rooms.', 'Interactive lesson website for Lesson 5 (Doors, Windows & Room Labels). Openings are gaps cut in the walls. Doors and windows are blocks placed in those openings. Labels name each room. Includes the lab, vocabulary, step-by-step AutoCAD tasks, a quick check, the worksheet download, an exit ticket, a rubric, Teacher mode and Present mode.', 'Students will cut wall openings, create and insert a door block with a correct swing, add windows, and label rooms with MTEXT at a readable height.', 'Do the lab, follow the AutoCAD steps, take the quick check, then download and complete the worksheet.', false from x
  union all
  select id, 'es', 'AutoCAD L5: Puertas y etiquetas — Sitio de la lección', 'Los muros se convierten en espacios que la gente puede usar. Corta los vanos, coloca las puertas, pon las ventanas y nombra las habitaciones.', 'Sitio interactivo de la Lección 5 (Puertas, ventanas y etiquetas de habitaciones). Los vanos son aberturas cortadas en los muros. Las puertas y ventanas son bloques colocados en esos vanos. Las etiquetas nombran cada habitación. Incluye el laboratorio, vocabulario, tareas paso a paso en AutoCAD, una revisión rápida, la hoja de trabajo para descargar, un boleto de salida, una rúbrica, el modo Docente y el modo Presentación.', 'Los estudiantes cortarán vanos en los muros, crearán e insertarán un bloque de puerta con el abatimiento correcto, añadirán ventanas y etiquetarán las habitaciones con MTEXT a una altura legible.', 'Haz el laboratorio, sigue los pasos en AutoCAD, responde la revisión rápida y luego descarga y completa la hoja de trabajo.', true from x
  returning experience_id),
n as (
  insert into public.experience_teacher_notes (experience_id, locale, notes)
  select id, 'en', 'Part of the 6-lesson AutoCAD for Beginners playlist (Lesson 5). Prerequisite: AutoCAD Lesson 4. 90-minute block. Worksheet answer key is kept offline with the teacher. Original published version: https://claude.ai/artifact/GgWJtbnWny1maRqMydcxte — paired page: https://claude.ai/artifact/B7bh4pyM8KFimsTsFiK7R4' from x union all select id, 'es', 'Parte de la serie de 6 lecciones AutoCAD para principiantes (Lección 5). Requisito previo: Lección 4 de AutoCAD. Bloque de 90 minutos. La clave de respuestas de la hoja de trabajo se guarda fuera de línea con el docente.' from x
  returning experience_id)
insert into public.collection_items (collection_id, experience_id, position)
select (select id from public.collections where slug = 'autocad-for-beginners'), id, 9 from x;

with x as (
  insert into public.experiences (slug, creator_name, world_id, type, subject, grade_range, difficulty, duration_minutes, resource_url, embed_url, worksheet_url, tags, skills, visibility, status, quality, version, created_at)
  values ('autocad-l6-sheet-lecture', 'M. Chinnakotla', (select id from public.worlds where slug = 'autocad'), 'lecture', 'Architecture & Construction', '9–12', 'Beginner', 90, 'https://claude.ai/artifact/DB5chifa9CYrmtLToiWBBG', '/experiences/autocad/L6-sheet/lecture.html', '/experiences/autocad/L6-sheet/worksheet.pdf', array['AutoCAD','Floor Plan','CAD','Sheets & Plotting']::text[], array['CAD Drafting','Architectural Drafting','Dimensioning & Plotting']::text[], 'public', 'published', 'teacher_verified', '1.0', '2026-10-23T12:00:00-05')
  on conflict (slug) do nothing returning id),
t as (
  insert into public.experience_translations (experience_id, locale, title, short_description, description, learning_objective, student_instructions, machine_translated)
  select id, 'en', 'AutoCAD L6: Sheets & Plotting — Lecture', 'Dimension the plan, set it on a sheet at 1/4" = 1''-0", and print a PDF that measures true.', 'Lecture for Lesson 6 of AutoCAD for Beginners (Dimensions, Layouts & Printing to Scale): chapter rail, worked examples, Try-it links, an exercise, a summary and the downloadable 3-page fillable worksheet.', 'Students will set a dimension style with an overall scale of 48, place organized dimension strings, create an ANSI B layout with a locked 1/4" = 1''-0" viewport, and plot a PDF that measures true.', 'Read the lecture, try the example, then open the lesson website.', false from x
  union all
  select id, 'es', 'AutoCAD L6: Hojas e impresión — Clase', 'Acota el plano, colócalo en una hoja a 1/4" = 1''-0" e imprime un PDF que mida correctamente.', 'Clase de la Lección 6 de AutoCAD para principiantes (Cotas, presentaciones e impresión a escala): índice de capítulos, ejemplos resueltos, enlaces «Pruébalo», un ejercicio, un resumen y la hoja de trabajo rellenable de 3 páginas para descargar.', 'Los estudiantes configurarán un estilo de cota con una escala general de 48, colocarán cadenas de cotas ordenadas, crearán una presentación ANSI B con una ventana gráfica bloqueada a 1/4" = 1''-0" e imprimirán un PDF que mida correctamente.', 'Lee la clase, prueba el ejemplo y luego abre el sitio de la lección.', true from x
  returning experience_id),
n as (
  insert into public.experience_teacher_notes (experience_id, locale, notes)
  select id, 'en', 'Part of the 6-lesson AutoCAD for Beginners playlist (Lesson 6). Prerequisite: AutoCAD Lesson 5. 90-minute block. Worksheet answer key is kept offline with the teacher. Original published version: https://claude.ai/artifact/DB5chifa9CYrmtLToiWBBG — paired page: https://claude.ai/artifact/F6BBfHHoU781paxMtvvYxA' from x union all select id, 'es', 'Parte de la serie de 6 lecciones AutoCAD para principiantes (Lección 6). Requisito previo: Lección 5 de AutoCAD. Bloque de 90 minutos. La clave de respuestas de la hoja de trabajo se guarda fuera de línea con el docente.' from x
  returning experience_id)
insert into public.collection_items (collection_id, experience_id, position)
select (select id from public.collections where slug = 'autocad-for-beginners'), id, 10 from x;

with x as (
  insert into public.experiences (slug, creator_name, world_id, type, subject, grade_range, difficulty, duration_minutes, resource_url, embed_url, worksheet_url, tags, skills, visibility, status, quality, version, created_at)
  values ('autocad-l6-sheet-website', 'M. Chinnakotla', (select id from public.worlds where slug = 'autocad'), 'lesson', 'Architecture & Construction', '9–12', 'Beginner', 90, 'https://claude.ai/artifact/F6BBfHHoU781paxMtvvYxA', '/experiences/autocad/L6-sheet/lesson.html', '/experiences/autocad/L6-sheet/worksheet.pdf', array['AutoCAD','Floor Plan','CAD','Sheets & Plotting']::text[], array['CAD Drafting','Architectural Drafting','Dimensioning & Plotting']::text[], 'public', 'published', 'teacher_verified', '1.0', '2026-10-23T12:00:00-05')
  on conflict (slug) do nothing returning id),
t as (
  insert into public.experience_translations (experience_id, locale, title, short_description, description, learning_objective, student_instructions, machine_translated)
  select id, 'en', 'AutoCAD L6: Sheets & Plotting — Lesson Website', 'The finish line: dimension the house, put it on a sheet, and print a PDF that measures true with an architect''s scale.', 'Interactive lesson website for Lesson 6 (Dimensions, Layouts & Printing to Scale). Dimensions state sizes. A layout is the printable sheet. A viewport shows the model on that sheet at an exact scale. Includes the lab, vocabulary, step-by-step AutoCAD tasks, a quick check, the worksheet download, an exit ticket, a rubric, Teacher mode and Present mode.', 'Students will set a dimension style with an overall scale of 48, place organized dimension strings, create an ANSI B layout with a locked 1/4" = 1''-0" viewport, and plot a PDF that measures true.', 'Do the lab, follow the AutoCAD steps, take the quick check, then download and complete the worksheet.', false from x
  union all
  select id, 'es', 'AutoCAD L6: Hojas e impresión — Sitio de la lección', 'La meta: acota la casa, colócala en una hoja e imprime un PDF que mida correctamente con un escalímetro de arquitecto.', 'Sitio interactivo de la Lección 6 (Cotas, presentaciones e impresión a escala). Las cotas indican tamaños. Una presentación es la hoja imprimible. Una ventana gráfica muestra el modelo en esa hoja a una escala exacta. Incluye el laboratorio, vocabulario, tareas paso a paso en AutoCAD, una revisión rápida, la hoja de trabajo para descargar, un boleto de salida, una rúbrica, el modo Docente y el modo Presentación.', 'Los estudiantes configurarán un estilo de cota con una escala general de 48, colocarán cadenas de cotas ordenadas, crearán una presentación ANSI B con una ventana gráfica bloqueada a 1/4" = 1''-0" e imprimirán un PDF que mida correctamente.', 'Haz el laboratorio, sigue los pasos en AutoCAD, responde la revisión rápida y luego descarga y completa la hoja de trabajo.', true from x
  returning experience_id),
n as (
  insert into public.experience_teacher_notes (experience_id, locale, notes)
  select id, 'en', 'Part of the 6-lesson AutoCAD for Beginners playlist (Lesson 6). Prerequisite: AutoCAD Lesson 5. 90-minute block. Worksheet answer key is kept offline with the teacher. Original published version: https://claude.ai/artifact/F6BBfHHoU781paxMtvvYxA — paired page: https://claude.ai/artifact/DB5chifa9CYrmtLToiWBBG' from x union all select id, 'es', 'Parte de la serie de 6 lecciones AutoCAD para principiantes (Lección 6). Requisito previo: Lección 5 de AutoCAD. Bloque de 90 minutos. La clave de respuestas de la hoja de trabajo se guarda fuera de línea con el docente.' from x
  returning experience_id)
insert into public.collection_items (collection_id, experience_id, position)
select (select id from public.collections where slug = 'autocad-for-beginners'), id, 11 from x;


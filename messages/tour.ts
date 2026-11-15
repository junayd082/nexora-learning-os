// NEXORA 1.2 — Guided tour and first-time tool tips.
// {name} = the assistant's current form (Nova, Cora, Grid…). Steps are shown most-useful first.

export const tourEn = {
  guideMe: 'Guide me',
  next: 'Next',
  back: 'Back',
  skip: 'Skip tour',
  finish: 'Start exploring',
  gotIt: 'Got it',
  tipsOff: 'Don’t show tips',
  stepOf: '{n} of {total}',
  inMenu: 'On your phone it lives in the ☰ menu at the top left.',
  keys: '← → to move · Esc to close',
  replay: 'You can replay this any time: your profile picture → Guide me.',
  settingsHint: 'Let your assistant show you around NEXORA again, step by step, or bring back the quick tips that appear the first time you open each tool.',
  settingsStart: 'Start the tour',
  settingsReset: 'Show tool tips again',
  settingsResetDone: 'Done. Tips will appear again the next time you open each tool.',
  // ---------------------------------------------------------------- the main tour
  s: {
    welcome: {
      title: 'Hi, I’m {name}. Welcome to NEXORA.',
      student: 'NEXORA is your whole school day in one place: your classes, today’s work, your assistant, your portfolio. Give me one minute and I’ll show you where everything is.',
      teacher: 'NEXORA is your classroom’s operating system: your periods, materials, Do Now and Exit tickets, timers, raised hands, hall passes and session summaries, all in one place. One minute, and I’ll show you around.',
    },
    classnow: {
      title: 'Right now',
      student: 'This card knows the Westfield bell schedule. It shows the class you’re in now: period, teacher, what’s due before class and the latest announcement. Use the arrows (or swipe) to flip through your other periods.',
      teacher: 'Your periods, live on the bell schedule. The class meeting now is in front; flip with the arrows to see each period, what’s due and what you announced. Timer and Classroom tools are one tap away.',
    },
    upcoming: {
      title: 'Upcoming: your to-do list',
      student: 'Everything you need to do, from every class: today’s Do Now and lesson, work that’s due (late work shows in red), announcements, and what you missed last class. Tap a chip to filter.',
      teacher: 'What your students see coming up, across your classes.',
    },
    assistant: {
      title: 'I live down here',
      student: 'Tap me any time. I know today’s Do Now, the lecture and what’s due. You can raise your hand or ask for a hall pass through me (“Ask your teacher”), or just type a question.',
      teacher: 'Tap me any time. I bring up today’s plan, and your Hands, Passes and Timer buttons. Students raise their hands and ask for passes through me, and you approve them.',
    },
    classrooms: {
      title: 'Classrooms',
      student: 'All your classes. Open one to see its materials by day, updates from your teacher, your grades and the class apps.',
      teacher: 'Your classes. Inside each one: Add materials, generate a Do Now or Exit ticket from your lecture, write a Session summary, Classroom tools (timer, hands, passes), Gradebook and Members.',
    },
    teach: {
      title: 'Teach: build lessons',
      teacher: 'Create interactive lessons and experiences, upload your files, and publish them to your classes or the library.',
    },
    timer: {
      title: 'Class timer',
      teacher: 'Start a timer for the room: a manual countdown, or today’s timed Do Now / Exit ticket. Put it on the projector full screen.',
    },
    bell: {
      title: 'Hands and passes',
      teacher: 'Raised hands and hall-pass requests arrive here with a chime. Approve, send now or deny a pass; see who’s out and who’s next.',
    },
    portfolio: {
      title: 'Portfolio and your CV',
      student: 'Your best work lives here. Open My CV to build a professional one-page CV for summer jobs, part-time work and training programs. NEXORA fills in what it already knows.',
    },
    explore: {
      title: 'Explore',
      student: 'Discover, Worlds, Library and Apps: interactive lessons, career worlds, things you saved and tools your classes use. Curious? Start here.',
      teacher: 'Discover, Worlds, Library and Apps: lessons from the community, career worlds, your saved items and the apps your classes use.',
    },
    search: {
      title: 'Search anything',
      student: 'Find any class, lesson or page in a second. On a computer press Ctrl K (⌘ K on a Mac).',
      teacher: 'Jump to any class, lesson or page. On a computer press Ctrl K (⌘ K on a Mac).',
    },
    theme: {
      title: 'Make it yours',
      student: 'Pick a living scene: beach, snow, deep space, blueprint and more. I change form with the scene. Calm turns all motion down.',
      teacher: 'Pick a living scene for yourself, or lock one for a class. Calm turns all motion down.',
    },
    user: {
      title: 'You, settings and Guide me',
      student: 'Your profile, language, sound and motion settings live here, and so does Guide me if you ever want this tour again.',
      teacher: 'Your profile and settings, and Guide me if you ever want this tour again.',
    },
    done: {
      title: 'You’re ready.',
      student: 'When you open a tool for the first time, I’ll pop in with a quick tip. Have a great day.',
      teacher: 'When you open a tool for the first time, I’ll pop in with a quick tip. Have a great class.',
    },
  },
  // ---------------------------------------------------------------- first-time tool tips
  tools: {
    classes: { title: 'Your classrooms', student: 'Tap a class to open it. Joining a new class? Use Join with the code your teacher gives you.|Each class shows its teacher and period.', teacher: 'Tap a class to open it, or create a new one.|Share the join code so students can enroll.' },
    classStudent: { title: 'Inside your class', student: 'Materials are grouped by lesson day; today’s are on top.|Updates has your teacher’s announcements.|Gradebook shows your scores and feedback.|Cornell Notes (the paper card) is your notebook for this class.' },
    classTeacher: { title: 'Your class control room', teacher: 'Add materials: upload a file, a page, a link, a lesson, or generate a Do Now / Exit ticket.|Classroom tools: timer, raised hands, passes and Session summary.|Schedule anything for a lesson day so students see it on Home.' },
    checkNew: { title: 'The question engine', teacher: 'Pick the lecture or PDF you used; NEXORA removes indexes, headers and teacher notes and writes from the teaching paragraphs.|Every AI question quotes the lesson; “Show source” proves it.|You review and edit every question before students see it.' },
    summary: { title: 'Session summary', teacher: 'Choose what you taught today. NEXORA writes a one-page student summary and private notes from today’s Do Now / Exit ticket results.|Edit, publish to the lesson day, and build tomorrow’s Do Now from it.' },
    cornell: { title: 'Cornell Notes', student: 'Tap New notes. Write main ideas in Notes during class.|After class, add questions and keywords on the left, and a 2–3 sentence summary at the bottom.|Keep typing: when a page is full it continues on the next page. Download as Word or PDF.', teacher: 'Your students’ notebook for this class: cues, notes and summary, as many pages as they need.|They can download it as Word or PDF. Try it yourself to model good notes.' },
    portfolio: { title: 'Your portfolio', student: 'Your best projects and work, in one place you can share.|Tap My CV to build a one-page CV.' },
    cv: { title: 'My CV', student: 'Fill the sections on the left; the page on the right updates live and always fits one page.|Pick skills from the drop-downs or type your own; Write it for me helps with wording.|Download PDF when you’re done.' },
    discover: { title: 'Discover', student: 'Interactive lessons you can open and play. Save the ones you like to your Library.', teacher: 'Lessons from NEXORA and other teachers. Save one, or add it to a class.' },
    worlds: { title: 'Worlds', student: 'Each world is a career path: architecture, construction, engineering… Explore what people in that field do.', teacher: 'Career worlds that group lessons by pathway.' },
    library: { title: 'Library', student: 'Everything you saved, ready to open again.', teacher: 'Everything you saved and built, ready to add to a class.' },
    apps: { title: 'Apps', student: 'Tools your classes use, one tap away.', teacher: 'Add the web apps your classes use; pin them to a class.' },
    teach: { title: 'Teach', teacher: 'Build an interactive lesson from your files or a template.|Publish it to a class or keep it as a draft.' },
    profile: { title: 'Settings', student: 'Change your name, language, living scene, sound and motion.|Guide me is here to replay the tour.', teacher: 'Change your profile, language, scene, sound and motion.|Guide me is here to replay the tour.' },
  },
};

export const tourEs: typeof tourEn = {
  guideMe: 'Guíame',
  next: 'Siguiente',
  back: 'Atrás',
  skip: 'Saltar el recorrido',
  finish: 'Empezar a explorar',
  gotIt: 'Entendido',
  tipsOff: 'No mostrar consejos',
  stepOf: '{n} de {total}',
  inMenu: 'En tu teléfono está en el menú ☰ arriba a la izquierda.',
  keys: '← → para moverte · Esc para cerrar',
  replay: 'Puedes repetirlo cuando quieras: tu foto de perfil → Guíame.',
  settingsHint: 'Deja que tu asistente te muestre NEXORA otra vez, paso a paso, o vuelve a activar los consejos que aparecen la primera vez que abres cada herramienta.',
  settingsStart: 'Empezar el recorrido',
  settingsReset: 'Mostrar consejos otra vez',
  settingsResetDone: 'Listo. Los consejos aparecerán de nuevo al abrir cada herramienta.',
  s: {
    welcome: {
      title: 'Hola, soy {name}. Bienvenido a NEXORA.',
      student: 'NEXORA es todo tu día escolar en un solo lugar: tus clases, el trabajo de hoy, tu asistente y tu portafolio. Dame un minuto y te muestro dónde está todo.',
      teacher: 'NEXORA es el sistema operativo de tu salón: tus periodos, materiales, Do Now y Exit tickets, temporizadores, manos levantadas, pases y resúmenes de sesión, todo en un lugar. Un minuto y te lo muestro.',
    },
    classnow: {
      title: 'Ahora mismo',
      student: 'Esta tarjeta conoce el horario de Westfield. Muestra la clase en la que estás: periodo, maestro, lo que vence antes de clase y el último anuncio. Usa las flechas (o desliza) para ver tus otros periodos.',
      teacher: 'Tus periodos, en vivo según el horario. La clase actual va al frente; usa las flechas para ver cada periodo, lo que vence y lo que anunciaste.',
    },
    upcoming: {
      title: 'Próximo: tu lista de tareas',
      student: 'Todo lo que tienes que hacer, de todas tus clases: el Do Now y la lección de hoy, lo que vence (lo atrasado en rojo), anuncios y lo que te perdiste. Toca un filtro.',
      teacher: 'Lo que tus estudiantes tienen próximamente, en todas tus clases.',
    },
    assistant: {
      title: 'Vivo aquí abajo',
      student: 'Tócame cuando quieras. Sé el Do Now de hoy, la clase y lo que vence. Puedes levantar la mano o pedir un pase conmigo (“Pregúntale a tu maestro”), o escribir una pregunta.',
      teacher: 'Tócame cuando quieras. Te muestro el plan de hoy y los botones de Manos, Pases y Temporizador. Los estudiantes levantan la mano y piden pases conmigo, y tú los apruebas.',
    },
    classrooms: {
      title: 'Clases',
      student: 'Todas tus clases. Abre una para ver sus materiales por día, los anuncios, tus calificaciones y las apps.',
      teacher: 'Tus clases. Dentro de cada una: Agregar materiales, generar un Do Now o Exit ticket desde tu clase, escribir un Resumen de la sesión, Herramientas (temporizador, manos, pases), Calificaciones y Miembros.',
    },
    teach: {
      title: 'Enseñar: crea lecciones',
      teacher: 'Crea lecciones y experiencias interactivas, sube tus archivos y publícalas en tus clases o en la biblioteca.',
    },
    timer: {
      title: 'Temporizador',
      teacher: 'Inicia un temporizador para el salón: manual, o el Do Now / Exit ticket de hoy. Muéstralo en pantalla completa en el proyector.',
    },
    bell: {
      title: 'Manos y pases',
      teacher: 'Las manos levantadas y las solicitudes de pase llegan aquí con un sonido. Aprueba, envía ya o niega un pase; ve quién está fuera y quién sigue.',
    },
    portfolio: {
      title: 'Portafolio y tu CV',
      student: 'Aquí vive tu mejor trabajo. Abre Mi CV para crear un CV profesional de una página para trabajos de verano, medio tiempo y programas de capacitación.',
    },
    explore: {
      title: 'Explorar',
      student: 'Descubrir, Mundos, Biblioteca y Apps: lecciones interactivas, mundos de carreras, lo que guardaste y las herramientas de tus clases.',
      teacher: 'Descubrir, Mundos, Biblioteca y Apps: lecciones de la comunidad, mundos de carreras, lo guardado y las apps de tus clases.',
    },
    search: {
      title: 'Busca lo que sea',
      student: 'Encuentra cualquier clase, lección o página en un segundo. En computadora presiona Ctrl K (⌘ K en Mac).',
      teacher: 'Ve a cualquier clase, lección o página. En computadora presiona Ctrl K (⌘ K en Mac).',
    },
    theme: {
      title: 'Hazlo tuyo',
      student: 'Elige una escena viva: playa, nieve, espacio, plano y más. Yo cambio de forma con la escena. Calma reduce todo el movimiento.',
      teacher: 'Elige una escena para ti o fija una para una clase. Calma reduce todo el movimiento.',
    },
    user: {
      title: 'Tú, ajustes y Guíame',
      student: 'Tu perfil, idioma, sonido y movimiento están aquí, y también Guíame si quieres ver este recorrido otra vez.',
      teacher: 'Tu perfil y ajustes, y Guíame si quieres ver este recorrido otra vez.',
    },
    done: {
      title: 'Listo.',
      student: 'Cuando abras una herramienta por primera vez, apareceré con un consejo rápido. ¡Que tengas un gran día!',
      teacher: 'Cuando abras una herramienta por primera vez, apareceré con un consejo rápido. ¡Que tengas una gran clase!',
    },
  },
  tools: {
    classes: { title: 'Tus clases', student: 'Toca una clase para abrirla. ¿Clase nueva? Usa Unirse con el código de tu maestro.|Cada clase muestra su maestro y periodo.', teacher: 'Toca una clase para abrirla o crea una nueva.|Comparte el código para que se inscriban.' },
    classStudent: { title: 'Dentro de tu clase', student: 'Los materiales están por día de lección; los de hoy arriba.|Anuncios tiene los avisos de tu maestro.|Calificaciones muestra tus notas y comentarios.|Notas Cornell (la tarjeta de papel) es tu cuaderno para esta clase.' },
    classTeacher: { title: 'El centro de control de tu clase', teacher: 'Agregar materiales: archivo, página, enlace, lección, o genera un Do Now / Exit ticket.|Herramientas: temporizador, manos, pases y Resumen de la sesión.|Programa todo para un día de lección y los estudiantes lo verán en Inicio.' },
    checkNew: { title: 'El generador de preguntas', teacher: 'Elige la clase o el PDF que usaste; NEXORA quita índices, encabezados y notas del maestro y escribe desde los párrafos que enseñan.|Cada pregunta con IA cita la lección; “Ver fuente” lo demuestra.|Revisas y editas todo antes de que lo vean.' },
    summary: { title: 'Resumen de la sesión', teacher: 'Elige lo que enseñaste hoy. NEXORA escribe un resumen de una página y notas privadas con los resultados del Do Now / Exit ticket.|Edítalo, publícalo en el día de la lección y crea el Do Now de mañana desde ahí.' },
    cornell: { title: 'Notas Cornell', student: 'Toca Nuevas notas. Escribe las ideas principales en Notas durante la clase.|Después, agrega preguntas y palabras clave a la izquierda y un resumen de 2–3 oraciones abajo.|Sigue escribiendo: cuando una página se llena, continúa en la siguiente. Descarga en Word o PDF.', teacher: 'El cuaderno de tus estudiantes para esta clase: claves, notas y resumen, con todas las páginas que necesiten.|Pueden descargarlo en Word o PDF. Pruébalo para modelar buenas notas.' },
    portfolio: { title: 'Tu portafolio', student: 'Tus mejores proyectos, en un lugar que puedes compartir.|Toca Mi CV para crear un CV de una página.' },
    cv: { title: 'Mi CV', student: 'Llena las secciones a la izquierda; la página a la derecha se actualiza y siempre cabe en una hoja.|Elige habilidades de las listas o escribe las tuyas; Escríbelo por mí ayuda con la redacción.|Descarga el PDF al terminar.' },
    discover: { title: 'Descubrir', student: 'Lecciones interactivas para abrir y jugar. Guarda las que te gusten en tu Biblioteca.', teacher: 'Lecciones de NEXORA y de otros maestros. Guárdalas o agrégalas a una clase.' },
    worlds: { title: 'Mundos', student: 'Cada mundo es una carrera: arquitectura, construcción, ingeniería… Explora lo que hacen en ese campo.', teacher: 'Mundos de carreras que agrupan lecciones por trayectoria.' },
    library: { title: 'Biblioteca', student: 'Todo lo que guardaste, listo para abrir.', teacher: 'Todo lo que guardaste y creaste, listo para agregar a una clase.' },
    apps: { title: 'Apps', student: 'Las herramientas de tus clases, a un toque.', teacher: 'Agrega las apps web que usan tus clases; fíjalas a una clase.' },
    teach: { title: 'Enseñar', teacher: 'Crea una lección interactiva desde tus archivos o una plantilla.|Publícala en una clase o guárdala como borrador.' },
    profile: { title: 'Ajustes', student: 'Cambia tu nombre, idioma, escena, sonido y movimiento.|Aquí está Guíame para repetir el recorrido.', teacher: 'Cambia tu perfil, idioma, escena, sonido y movimiento.|Aquí está Guíame para repetir el recorrido.' },
  },
};

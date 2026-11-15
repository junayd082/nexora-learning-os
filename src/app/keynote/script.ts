/**
 * The keynote narration, one line per build (scene id → builds). `text` is the caption; `say` is
 * how the narrator should pronounce it when that differs (brand names, acronyms). An ellipsis (…)
 * is a held breath: the recording puts a real pause there.
 * The recordings in /public/keynote/voice/<voice>/<scene>-<build>.mp3 are made from this file by
 * scripts/keynote-voice.py — re-run it after editing a line.
 */
export interface NarrationLine { text: string; say?: string; lang?: 'es' }
type L = string | NarrationLine;

export const SCRIPT: Record<string, L[]> = {
  open: ['', 'Every school day begins the same way.', 'With a bell.'],
  chaos: [
    'And then… the tabs. Slides here. A quiz site there. A timer on someone’s phone. Paper hall passes. A bell schedule, buried in a PDF.',
    'Every period, a teacher juggles all of it, while thirty students wait.',
    'Twelve tools. And not one of them talks to the others.',
  ],
  question: ['So we asked a simple question. What if the classroom… had an operating system?'],
  reveal: [
    { text: 'Introducing… NEXORA.', say: 'Introducing… Nexora.' },
    'The Learning Operating System. One place to learn, to build, to explore… and to become.',
  ],
  home: [
    'It starts with Home. And Home knows exactly what period it is.',
    'The Westfield bell schedule is built right in. Odd days, even days, Wednesdays, every lunch. Sign in, and NEXORA opens on the class you’re in right now: your teacher, your room, and how much time is left.',
    'Just below: today’s Do Now, what’s due before class, and the latest announcement. Swipe… and you’re in your next period.',
  ],
  room: [
    'Then, the room comes alive. Raise your hand… without raising your hand.',
    'A student asks the assistant, and the teacher’s bell rings with their name and their place in line. Hall passes are requested, approved, and queued, one student out at a time, timed automatically. And the Do Now timer goes up on the projector with a single tap.',
    'And it’s private by default. Classmates only ever see “out of room.” Never where.',
  ],
  engine: [
    'Now, the part teachers asked for most. The question engine. Where every question proves its answer.',
    'Give it the lecture you actually taught. NEXORA reads every page, and sets aside everything that isn’t teaching: the table of contents, the index, page headers, pacing guides, teacher notes.',
    'What’s left is the teaching core, the paragraphs that actually explain. And that’s the only place questions come from.',
    'Every question carries a quote from the lesson that proves its answer. NEXORA checks that quote against the file. And if it can’t find it… the teacher knows.',
  ],
  loop: [
    'And then… it closes the loop.',
    'Teach. Check, with a Do Now and an Exit ticket. Summarize, in one clear page for every student. And re-teach… exactly what the class missed.',
    'Today’s Exit ticket results shape tomorrow’s Do Now. And a student who was absent gets a catch-up plan, automatically.',
  ],
  alive: [
    'And NEXORA is alive. Eleven companions, one for every scene. A fox, a crab, a firefly, an owl… all the way to a little drafting robot.',
    'On your very first day, one of them flies across the screen… and shows you where everything is.',
  ],
  students: [
    { text: 'For students, NEXORA builds something that lasts beyond the classroom. A professional, one-page CV. Built in high school, for summer jobs, part-time work, and training programs.', say: 'For students, Nexora builds something that lasts beyond the classroom. A professional, one-page C.V. Built in high school, for summer jobs, part-time work, and training programs.' },
    { text: 'In English. Y en español.', say: 'In English… Y en español.', lang: 'es' },
  ],
  notes: [
    'And for every class… a notebook. Cornell notes, the method great students have trusted for decades, now built right into the classroom.',
    'Notes on the right. Questions and keywords on the left. A summary at the bottom. And when a page fills up, it simply continues on the next one.',
    { text: 'Then cover your notes, and quiz yourself. And when you’re done… download it, as Word or PDF.', say: 'Then cover your notes, and quiz yourself. And when you’re done… download it, as Word, or P.D.F.' },
  ],
  numbers: [{ text: 'Eight periods. Eleven companions. Two languages. One home, for the whole day. Zero paper hall passes. And every AI question… cites the lesson.', say: 'Eight periods. Eleven companions. Two languages. One home, for the whole day. Zero paper hall passes. And every A.I. question… cites the lesson.' }],
  founder: [
    { text: 'NEXORA wasn’t built in a boardroom. It was built from the classroom outward.', say: 'Nexora wasn’t built in a boardroom. It was built from the classroom, outward.' },
    { text: 'Designed and built in Room 105 at Westfield High School, by a career and technical education teacher who wanted one place for everything his students need.', say: 'Designed and built in Room one-oh-five, at Westfield High School, by a career and technical education teacher… who wanted one place for everything his students need.' },
  ],
  onemore: [
    'But… there’s one more thing.',
    { text: 'NEXORA is built with teachers. Not just for them. So… what would make your day easier? I want to hear it.', say: 'Nexora is built with teachers. Not just for them. So… what would make your day easier? I want to hear it.' },
  ],
  close: [{ text: 'NEXORA. Learn. Build. Explore. Become. Available now.', say: 'Nexora. Learn. Build. Explore. Become. Available now.' }],
};

export function lineOf(id: string, b: number): Required<Omit<NarrationLine, 'lang'>> & { lang: 'en' | 'es' } {
  const l = SCRIPT[id]?.[b] ?? '';
  if (typeof l === 'string') return { text: l, say: l.replace(/NEXORA/g, 'Nexora'), lang: 'en' };
  return { text: l.text, say: l.say ?? l.text.replace(/NEXORA/g, 'Nexora'), lang: l.lang ?? 'en' };
}

/** The recorded narrators (files in /public/keynote/voice/<id>/). */
export const NARRATORS = [
  { id: 'heart', label: 'Heart', note: 'warm, natural' },
  { id: 'michael', label: 'Michael', note: 'deep, cinematic' },
] as const;
export type NarratorId = (typeof NARRATORS)[number]['id'];

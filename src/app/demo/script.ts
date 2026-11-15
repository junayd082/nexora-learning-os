/**
 * NEXORA Live — the narration for the live product demonstration (one class period, teacher's side).
 * One line per build. `text` is the caption; `say` is the spoken form when it differs.
 * An ellipsis (…) is a held breath in the recording. Recordings: /public/demo/voice/<voice>/<chapter>-<build>.mp3
 * (made by scripts/keynote-voice.py from this file via scripts/demo-script.ts).
 */
import type { NarrationLine } from '../keynote/script';

type L = string | NarrationLine;

export const DEMO_SCRIPT: Record<string, L[]> = {
  cold: [
    { text: 'This is not a slideshow. What you’re about to see is NEXORA, running one real class period, from the first bell of the morning to the last student at night, from the teacher’s side.', say: 'This is not a slideshow. What you’re about to see is Nexora… running one real class period, from the first bell of the morning, to the last student at night… from the teacher’s side.' },
    'One teacher, Mr. C. Twenty-four students in Architecture Design one. And one real AutoCAD lesson from the library: lecture two, units, coordinates, and precise lines.',
  ],
  morning: [
    'It’s six fifty-eight on a Thursday morning. Mr. C signs in… and before he clicks anything, Home already knows what his day looks like, and what period three needs.',
    { text: 'Period three, Architecture Design one, starts at eight forty-five in Room 105. Every period of the Westfield bell schedule, odd days, even days, Wednesdays, and every lunch, sits right here on the rail.', say: 'Period three, Architecture Design one, starts at eight forty-five, in Room one-oh-five. Every period of the Westfield bell schedule, odd days, even days, Wednesdays, and every lunch, sits right here on the rail.' },
    'And just below: what’s due before class, the announcement he posted, and, from his attendance sheet, the two students who missed last class. Everything that needs his attention… on one screen.',
  ],
  plan: [
    'First, today’s lesson. He opens the class, chooses Add materials, and goes straight to the NEXORA library, where all six AutoCAD lectures are already waiting.',
    'Lecture two: units, coordinates, and precise lines. He tags it as today’s lecture, and schedules it for Thursday… so it lands on the Home screen of every student in period three.',
    'The lesson website, with the practice house outline, and the worksheet, due Friday, go right beside it. Students absent today will find all of it under catch up. That’s the whole plan… in under a minute.',
  ],
  donow: [
    'Now, the Do Now. Instead of writing it from scratch, he asks NEXORA to write it… from the same lecture the students will see, so every question matches what he’s about to teach.',
    'NEXORA reads every section of the lecture. First, it sets aside everything that isn’t teaching: the navigation, the page header and footer, the headings, the stray labels and links. Then it finds the teaching core… fourteen passages that actually explain.',
    'Four questions, written from those passages. Each one carries a quote from the lesson that proves its answer, and NEXORA checks that quote against the file, word for word. Here it is: typing thirty, for a thirty-foot wall, draws a wall two feet six inches long.',
    'He sets a five-minute timer, so it opens and closes with the bell, and he publishes it to period three. Done… before the coffee gets cold.',
  ],
  room: [
    'Eight forty-five. The bell rings. The Do Now is waiting on every student’s Home, marked start here, and the five-minute timer goes up on the projector, for the whole room to see.',
    'While they work, he takes attendance, on a sheet that looks just like the paper one. One click marks everyone present… one more marks Sofia absent. It’s kept for the whole term, and tonight, it’s how Sofia’s Home knows what she missed.',
    'Answers arrive live, as students submit. Twelve… nineteen… twenty-three of twenty-three, everyone in the room. No collecting paper. No guessing who is still working.',
    'Maya has a question. She raises her hand… without raising her hand, right from the assistant. Mr. C’s bell lights up with her name, her place in line, and her question: is thirty feet the same as thirty feet, zero inches.',
    'Then Jordan asks for a restroom pass. Mr. C sees it’s his first pass today, and nobody else is out. One tap to approve. The timer starts, and the class pass board only ever says: out of room.',
  ],
  notes: [
    'During the lecture, Ava takes Cornell notes, right inside the class. Name, class, period and date are already filled in, so she just writes.',
    'Main ideas on the right. Her own questions and keywords on the left. A short summary at the bottom, in her own words. And when a page fills up, her notes simply continue on the next one.',
    'Tonight, she’ll cover the notes and quiz herself with her own questions. And when she’s done… she can download the whole notebook, as a Word document or a PDF.',
  ],
  exit: [
    'Ten minutes before the bell: the Exit ticket. Same engine. Same lecture. But this time, a deeper level of thinking. Students have to apply what they learned, not just recall it.',
    'Results arrive question by question, as students hand in. Typing a thirty-foot wall: ninety-one percent. The right Object Snap: seventy-eight. And polar input… forty-three percent.',
    'And the weakest question stands out right away: polar input, at forty-three percent. Its source is one click away, and the lesson says it plainly: zero degrees points right. Now he knows exactly what didn’t land. Not next week. Right now.',
  ],
  summary: [
    'After class, he writes the session summary. Or rather… NEXORA does. He picks the lecture, ticks one box to use today’s Do Now and Exit ticket results, and lets it write.',
    'A one-page summary for students: what we learned, the key ideas, each one quoted from the lesson, and a catch-up plan for anyone who was absent. And private notes, just for him: re-teach polar input, and show the angle compass, zero degrees east.',
    'He publishes it to Thursday. Then, one click builds tomorrow’s Do Now, with the focus already filled in from today’s results: polar input, zero degrees points right. The loop… is closed.',
  ],
  student: [
    'And here’s what Sofia sees tonight. She was out sick today… and in most classrooms, she would walk in tomorrow completely lost.',
    'Instead, Home tells her exactly what she missed in period three. The session summary is waiting, with the key ideas, and a four-step catch-up plan: read, open the lecture, try the Do Now, finish the worksheet.',
    'She asks the assistant, what’s due? It knows: the worksheet, on Friday. And today’s Do Now is still open, right there on her Home. She’s back on track… before first period.',
  ],
  close: [
    'That was one class period. A lesson planned, a Do Now written and checked, a live room, notes, an Exit ticket, a summary, and a student caught up. Every tool, in one place. Built by a teacher… for teachers.',
    { text: 'This is NEXORA. And now… let’s open it live.', say: 'This is Nexora. And now… let’s open it, live.' },
  ],
};

export function demoLine(id: string, b: number): { text: string; say: string; lang: 'en' | 'es' } {
  const l = DEMO_SCRIPT[id]?.[b] ?? '';
  if (typeof l === 'string') return { text: l, say: l.replace(/NEXORA/g, 'Nexora'), lang: 'en' };
  return { text: l.text, say: l.say ?? l.text.replace(/NEXORA/g, 'Nexora'), lang: l.lang ?? 'en' };
}

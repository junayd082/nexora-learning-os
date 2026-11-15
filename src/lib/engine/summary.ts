/**
 * Session summary engine. Turns the lecture / PDF a teacher used today into a student-facing
 * summary (what we learned, key ideas with the lesson's own words, vocabulary, steps, common
 * mistakes, catch-up for absent students, self-check) plus teacher-only notes that use today's
 * Do Now / Exit ticket results to say what to re-teach and what tomorrow's checks should target.
 *
 * Same pipeline as the question engine: prepareLesson() strips tables of contents, indexes,
 * headers, teacher pacing notes and so on, ranks the teaching paragraphs, and every key idea the
 * AI writes must quote the lesson; NEXORA checks each quote (findEvidence) and marks it verified.
 * Without an AI key a built-in summary is assembled from the strongest passages.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { Source } from './extract';
import { findEvidence, parsePages, prepareLesson, type Prepared } from './core';
import { aiEnabled, call, LANG, lessonBlocks, AiKeyError } from './ai';
import { analyse } from './builtin';

export interface CheckResult {
  title: string; kind: 'do_now' | 'exit_ticket' | 'quiz'; answered: number; roster: number;
  /** Class average 0–100 on auto-graded questions, null when nothing is graded yet. */
  avg: number | null;
  questions: { prompt: string; pct: number | null; n: number }[];
}

export interface SessionSummary {
  topic: string;
  overview: string;
  objectives: string[];
  concepts: { name: string; explanation: string; evidence: string; page: number | null; verified: boolean }[];
  vocabulary: { term: string; definition: string }[];
  steps: { title: string; items: string[] } | null;
  connections: string[];
  misconceptions: { wrong: string; right: string }[];
  catchUp: string[];
  selfCheck: string[];
  teacher: { reteach: string[]; doNowFocus: string; exitFocus: string; notes: string[] };
  engine: 'ai' | 'builtin';
  language: 'en' | 'es';
}

export interface SummaryOpts { language: 'en' | 'es'; level: string; focus: string; pages: string; date: string; className: string; results: CheckResult[] }

// ---------------------------------------------------------------------------- headings
const H = {
  en: {
    overview: 'What we learned', objectives: 'Learning targets', concepts: 'Key ideas', vocab: 'Vocabulary', steps: 'Steps',
    connections: 'Where this shows up', mistakes: 'Watch out for', catchUp: 'Missed class? Catch up', selfCheck: 'Check yourself',
    source: 'From the lesson', page: 'p.', ican: 'I can', insteadOf: 'Not', but: 'but',
    teacherTitle: 'Teacher notes', results: "Today's checks", reteach: 'Re-teach', nextDoNow: "Tomorrow's Do Now", nextExit: 'Next Exit ticket',
    answered: 'answered', avg: 'class average', weakest: 'Hardest questions', notes: 'Notes',
  },
  es: {
    overview: 'Lo que aprendimos', objectives: 'Metas de aprendizaje', concepts: 'Ideas clave', vocab: 'Vocabulario', steps: 'Pasos',
    connections: 'Dónde se usa', mistakes: 'Cuidado con', catchUp: '¿Faltaste? Ponte al día', selfCheck: 'Compruébalo',
    source: 'De la lección', page: 'pág.', ican: 'Puedo', insteadOf: 'No', but: 'sino',
    teacherTitle: 'Notas del maestro', results: 'Revisiones de hoy', reteach: 'Volver a enseñar', nextDoNow: 'Do Now de mañana', nextExit: 'Próximo Exit ticket',
    answered: 'respondieron', avg: 'promedio de la clase', weakest: 'Preguntas más difíciles', notes: 'Notas',
  },
};

// ---------------------------------------------------------------------------- AI
const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['topic', 'overview', 'objectives', 'concepts', 'vocabulary', 'steps', 'connections', 'misconceptions', 'catch_up', 'self_check', 'teacher'],
  properties: {
    topic: { type: 'string' },
    overview: { type: 'string' },
    objectives: { type: 'array', items: { type: 'string' } },
    concepts: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'explanation', 'evidence', 'source'],
      properties: { name: { type: 'string' }, explanation: { type: 'string' }, evidence: { type: 'string' }, source: { type: 'string' } } } },
    vocabulary: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['term', 'definition'], properties: { term: { type: 'string' }, definition: { type: 'string' } } } },
    steps: { type: 'object', additionalProperties: false, required: ['title', 'items'], properties: { title: { type: 'string' }, items: { type: 'array', items: { type: 'string' } } } },
    connections: { type: 'array', items: { type: 'string' } },
    misconceptions: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['wrong', 'right'], properties: { wrong: { type: 'string' }, right: { type: 'string' } } } },
    catch_up: { type: 'array', items: { type: 'string' } },
    self_check: { type: 'array', items: { type: 'string' } },
    teacher: { type: 'object', additionalProperties: false, required: ['reteach', 'do_now_focus', 'exit_focus', 'notes'],
      properties: { reteach: { type: 'array', items: { type: 'string' } }, do_now_focus: { type: 'string' }, exit_focus: { type: 'string' }, notes: { type: 'array', items: { type: 'string' } } } },
  },
};

function resultsBlock(results: CheckResult[]) {
  if (!results.length) return '<class_results>No Do Now or Exit ticket results for this day.</class_results>';
  return ['<class_results>', ...results.map((r) => [
    `${r.kind === 'do_now' ? 'DO NOW' : r.kind === 'exit_ticket' ? 'EXIT TICKET' : 'QUIZ'} "${r.title}": ${r.answered}/${r.roster || '?'} students answered${r.avg != null ? `, class average ${r.avg}%` : ''}.`,
    ...r.questions.map((q, i) => `  Q${i + 1} (${q.pct == null ? 'teacher-graded' : `${q.pct}% correct`}, n=${q.n}): ${q.prompt.slice(0, 220)}`),
  ].join('\n')), '</class_results>'].join('\n');
}

async function aiSummary(src: Source, prep: Prepared, o: SummaryOpts): Promise<SessionSummary> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 1 });
  const system = 'You are a master high-school Career & Technical Education teacher (architecture, construction, engineering, design) and instructional coach. You write clear, accurate, warm lesson summaries for students, and sharp, practical notes for teachers. You never invent facts that are not in the lesson.';
  const task = [
    `Write the SESSION SUMMARY for "${o.className}" on ${o.date}, from the lesson the teacher used today.`,
    'SOURCE RULES:',
    '- Summarise only what the lesson teaches students. Ignore title pages, tables of contents, indexes, headers/footers, page numbers, references, standards codes, pacing and teacher notes.',
    prep.strong ? '- Build the key ideas from the passages in <teaching_core>.' : '- The file has little explanatory text (slides or a worksheet): use its text, tables and figures, but nothing teacher-facing.',
    '- For every key idea fill "evidence" with 8–30 consecutive words copied exactly from the lesson that support it, and "source" with the passage id (P1, P2…) or "file". NEXORA checks every quote.',
    o.pages ? `- The teacher used only page(s) ${o.pages} today. Summarise those pages.` : '',
    'FIELDS:',
    '- topic: the lesson topic in 3–8 words.',
    '- overview: 2–4 sentences a student could read in 30 seconds: what today was about and why it matters.',
    '- objectives: 2–4 learning targets that complete the sentence "I can …" (write only the part after "I can", start with a verb).',
    '- concepts: the 3–6 most important ideas, in teaching order. name = short label; explanation = 1–3 plain sentences in your own words, accurate to the lesson.',
    '- vocabulary: 3–10 key terms with student-friendly definitions faithful to the lesson. [] if the lesson has none.',
    '- steps: if the lesson teaches a procedure or command sequence, its title and the ordered steps (imperative, short). Otherwise title "" and items [].',
    '- connections: 1–3 real-world or career uses (a drafter, a builder, an engineer…), grounded in the lesson.',
    '- misconceptions: 2–4 likely mistakes: "wrong" = what students might think/do, "right" = the correct idea. Use the class results below when they reveal real mistakes.',
    '- catch_up: 3–5 concrete steps for a student who missed class (what to read/watch, what to try, what to turn in, who to ask). Do not invent assignment names or dates.',
    '- self_check: 3–4 short questions a student can answer to test themselves (no answers).',
    '- teacher (NEVER shown to students): reteach = 1–4 specific things to re-teach tomorrow, citing the class results (question numbers and %) when available; do_now_focus = one sentence describing what tomorrow\'s Do Now should target (spiral the weakest idea + preview); exit_focus = one sentence for the next Exit ticket; notes = 0–3 other observations (participation, pacing of ideas). If there are no results, base this on what is hardest in the lesson and say results were not available.',
    `Reading level for students: ${o.level}. Write everything in ${LANG[o.language] ?? 'English'}.`,
    o.focus ? `The teacher adds: ${o.focus}` : '',
  ].filter(Boolean).join('\n');
  const content: Anthropic.ContentBlockParam[] = [...lessonBlocks(src, prep, o.pages), { type: 'text', text: resultsBlock(o.results) }, { type: 'text', text: task }];
  const r = await call(client, content, SCHEMA, 100_000, system, 8_000) as {
    topic: string; overview: string; objectives: string[]; concepts: { name: string; explanation: string; evidence: string; source: string }[];
    vocabulary: { term: string; definition: string }[]; steps: { title: string; items: string[] }; connections: string[];
    misconceptions: { wrong: string; right: string }[]; catch_up: string[]; self_check: string[];
    teacher: { reteach: string[]; do_now_focus: string; exit_focus: string; notes: string[] };
  };
  return {
    topic: r.topic || src.title, overview: r.overview, objectives: (r.objectives ?? []).map((x) => x.replace(/^i can\s+/i, '')).slice(0, 5),
    concepts: (r.concepts ?? []).slice(0, 7).map((c) => {
      const p = findEvidence(c.evidence, prep);
      return { name: c.name, explanation: c.explanation, evidence: p ? c.evidence : '', page: p?.page ?? null, verified: !!p };
    }),
    vocabulary: (r.vocabulary ?? []).slice(0, 12), steps: r.steps?.items?.length ? { title: r.steps.title, items: r.steps.items.slice(0, 12) } : null,
    connections: (r.connections ?? []).slice(0, 4), misconceptions: (r.misconceptions ?? []).slice(0, 5),
    catchUp: (r.catch_up ?? []).slice(0, 6), selfCheck: (r.self_check ?? []).slice(0, 5),
    teacher: { reteach: r.teacher?.reteach ?? [], doNowFocus: r.teacher?.do_now_focus ?? '', exitFocus: r.teacher?.exit_focus ?? '', notes: r.teacher?.notes ?? [] },
    engine: 'ai', language: o.language,
  };
}

// ---------------------------------------------------------------------------- built-in
const ABBR = /(?:\b[A-Z]|\be\.g|\bi\.e|\betc|\bvs|\bFig|\bapprox|\bNo|\bSt|\bDr|\bMr|\bMrs|\bMs)\.$/;
/** Sentences, without breaking on U.S., e.g., Fig. and similar. */
function sentences(t: string) {
  const parts = t.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+(?=["“(]?[A-Z0-9])/);
  const out: string[] = [];
  for (const p of parts) { if (out.length && ABBR.test(out[out.length - 1])) out[out.length - 1] += ` ${p}`; else out.push(p); }
  return out.filter(Boolean);
}
const wc = (t: string) => t.split(/\s+/).filter(Boolean).length;
const clip = (t: string, n: number) => { const w = t.split(/\s+/); return w.length <= n ? t : `${w.slice(0, n).join(' ')}…`; };
/** "2.1 Setting Architectural Units" → "Setting Architectural Units"; "Lesson 2 · Lecture …" → "…". */
const cleanHeading = (h: string) => h.replace(/^(lesson|unit|chapter|section|part|module)\s*\d+[a-z]?\s*[·:.\-–—]?\s*(lecture|notes|lesson)?\s*/i, '')
  .replace(/^\d+(\.\d+)*[.)]?\s+/, '').replace(/^(lecture|notes)\s*[·:\-–—]?\s*/i, '').trim();
/** Prose (a paragraph that explains), not a flattened table, list of labels or keyboard chart. */
function isProse(t: string) {
  const ss = sentences(t).filter((x) => /[.!?]["”)]?$/.test(x));
  if (!ss.length) return false;
  const good = ss.filter((x) => wc(x) >= 6 && wc(x) <= 45 && /\b(is|are|was|means?|lets?|tells?|makes?|shows?|uses?|gives?|helps?|keeps?|grabs?|draws?|can|will|should|must|has|have)\b/i.test(x));
  // Most of the words must sit in real sentences (a flattened table has a sentence or two tacked on).
  return good.reduce((n, x) => n + wc(x), 0) / Math.max(1, wc(t)) >= 0.6;
}
const BAD_TERM = /^(method|step|part|option|example|figure|table|note|tip|page|slide|lesson)\b/i;
function goodDef(d: { term: string; def: string }) {
  return !BAD_TERM.test(d.term) && wc(d.term) <= 5 && wc(d.def) >= 4 && /[a-z]{3,}\s+[a-z]{2,}/.test(d.def) && !/:\s*\d/.test(d.def);
}

function builtinSummary(src: Source, prep: Prepared, o: SummaryOpts): SessionSummary {
  const es = o.language === 'es';
  const a = analyse(prep.cleanText || src.text);
  const META = /essential question|\b\d+[-\s]?minute\b|learning targets?|objectives?:|\bI can\b/i;
  const prose = prep.core.filter((p) => isProse(p.text) && !META.test(p.text) && !META.test(p.heading ?? ''));
  const pool = prose.length >= 2 ? prose : prep.core;
  const ranked = [...pool].sort((x, y) => y.score - x.score).slice(0, 5);
  const chosen = pool.filter((p) => ranked.includes(p));
  const names = new Set<string>();
  const UI = /\b(?:(?:try it yourself|submit answer|show answer|hide answer|click here)\s*[»›]?|(?:next|previous)\s*[»›])\s*/gi;
  const okHeading = (h: string | null) => !!h && /^[A-Za-z¿¡]/.test(h) && !/[»›]/.test(h) && wc(h) <= 8;
  const concepts = chosen.map((p) => {
    const text = p.text.replace(UI, '').replace(/^\s*(tip|note|remember|important)\b\s*[:·-]?\s*/i, '').replace(/([.!?])\s*(tip|note)\s+/gi, '$1 ');
    const ss = sentences(text);
    const def = a.defs.find((d) => p.text.includes(d.sentence) && goodDef(d));
    const heading = p.heading ? cleanHeading(p.heading) : '';
    let name = (okHeading(heading) ? heading : '') || def?.term || clip(ss[0] ?? '', 6).replace(/…$/, '').replace(/[.,;:]$/, '');
    if (!name || names.has(name.toLowerCase())) name = def?.term || clip(ss[0] ?? '', 6).replace(/…$/, '');
    names.add(name.toLowerCase());
    // When the name is the first sentence itself, explain with what follows it.
    const body = name && ss[0]?.startsWith(name) && ss.length > 1 ? ss.slice(1, 3) : ss.slice(0, 2);
    return { name, explanation: clip(body.join(' '), 50), evidence: '', page: p.page, verified: true };
  }).filter((c) => c.explanation);
  const firstOf = (p: { text: string }) => sentences(p.text)[0] ?? '';
  const overviewBits = [...new Set(a.summary.length ? a.summary.slice(0, 3) : chosen.slice(0, 3).map(firstOf))];
  const vocab = a.defs.filter(goodDef).slice(0, 8).map((d) => ({ term: d.term, definition: d.def.replace(/\.\s*$/, '') }));
  const weak = weakest(o.results);
  return {
    topic: cleanHeading(src.title) || src.title,
    overview: [a.essential ? (es ? `Pregunta esencial: ${a.essential}` : `Essential question: ${a.essential}`) : '', ...overviewBits].filter(Boolean).join(' ').slice(0, 900),
    objectives: a.objectives.slice(0, 4),
    concepts,
    vocabulary: vocab,
    steps: a.sequences[0] ? { title: es ? 'Pasos de la lección' : 'Steps from the lesson', items: a.sequences[0].slice(0, 10) } : null,
    connections: [],
    misconceptions: [],
    catchUp: es
      ? ['Lee este resumen y las ideas clave.', `Abre el material de la lección: ${src.title}.`, 'Responde las preguntas de "Compruébalo" en tu cuaderno.', 'Haz el Do Now o Exit ticket de hoy si sigue abierto.', 'Pide ayuda con el asistente (Pregúntale a tu maestro) si algo no queda claro.']
      : ['Read this summary and the key ideas.', `Open the lesson material: ${src.title}.`, 'Answer the "Check yourself" questions in your notebook.', "Do today's Do Now or Exit ticket if it is still open.", 'Ask for help through the assistant (Ask your teacher) if anything is unclear.'],
    selfCheck: [
      ...vocab.slice(0, 2).map((d) => (es ? `¿Qué significa ${d.term}?` : `What does ${d.term} mean?`)),
      ...concepts.slice(0, 3).map((c) => (es ? `Explica con tus palabras: ${c.name}.` : `Explain in your own words: ${c.name}.`)),
    ].slice(0, 4),
    teacher: {
      reteach: weak.map((w) => `${w.check} · Q${w.i + 1} (${w.pct}%): ${w.prompt.slice(0, 140)}`),
      doNowFocus: weak[0] ? (es ? `Repasar: ${weak[0].prompt.slice(0, 120)}` : `Spiral back to: ${weak[0].prompt.slice(0, 120)}`) : (concepts[0] ? (es ? `Repasar ${concepts[0].name} y anticipar la próxima lección.` : `Review ${concepts[0].name} and preview the next lesson.`) : ''),
      exitFocus: concepts.length ? (es ? `Aplicar: ${concepts.slice(0, 2).map((c) => c.name).join(' y ')}.` : `Apply: ${concepts.slice(0, 2).map((c) => c.name).join(' and ')}.`) : '',
      notes: o.results.length ? [] : [es ? 'No hay resultados de Do Now / Exit ticket para este día.' : 'No Do Now / Exit ticket results for this day yet.'],
    },
    engine: 'builtin', language: o.language,
  };
}

export function weakest(results: CheckResult[]) {
  return results.flatMap((r) => r.questions.map((q, i) => ({ check: r.title, i, pct: q.pct, prompt: q.prompt, n: q.n })))
    .filter((q): q is { check: string; i: number; pct: number; prompt: string; n: number } => q.pct != null && q.n >= 1 && q.pct < 70)
    .sort((a, b) => a.pct - b.pct).slice(0, 4);
}

// ---------------------------------------------------------------------------- run
export async function summarise(src: Source, o: SummaryOpts): Promise<{ summary: SessionSummary; notes: string[] }> {
  const prep = prepareLesson(src.text, { pages: parsePages(o.pages) });
  const notes: string[] = [];
  if (aiEnabled()) {
    try { return { summary: await aiSummary(src, prep, o), notes }; }
    catch (e) { notes.push(e instanceof AiKeyError ? 'ai_key' : 'ai_failed'); }
  }
  if (!prep.core.length && !src.text.trim()) throw new Error('no_text');
  return { summary: builtinSummary(src, prep, o), notes };
}

// ---------------------------------------------------------------------------- markdown
export function studentMarkdown(s: SessionSummary, o: { date: string; className: string; sourceTitle: string }) {
  const h = H[s.language];
  const out: string[] = [];
  out.push(`**${o.className} · ${o.date}** — ${h.source}: *${o.sourceTitle}*`, '');
  out.push(`## ${h.overview}`, s.overview, '');
  if (s.objectives.length) out.push(`## ${h.objectives}`, ...s.objectives.map((x) => `- ${h.ican} ${x.replace(/[.]+$/, '')}.`), '');
  if (s.concepts.length) {
    out.push(`## ${h.concepts}`);
    s.concepts.forEach((c, i) => {
      out.push(`${i + 1}. **${c.name}** — ${c.explanation}`);
      if (c.evidence) out.push(`   > “${c.evidence}”${c.page ? ` (${h.page} ${c.page})` : ''}`);
    });
    out.push('');
  }
  if (s.vocabulary.length) out.push(`## ${h.vocab}`, ...s.vocabulary.map((v) => `- **${v.term}** — ${v.definition}`), '');
  if (s.steps?.items.length) out.push(`## ${h.steps}${s.steps.title ? `: ${s.steps.title}` : ''}`, ...s.steps.items.map((x, i) => `${i + 1}. ${x}`), '');
  if (s.connections.length) out.push(`## ${h.connections}`, ...s.connections.map((x) => `- ${x}`), '');
  if (s.misconceptions.length) out.push(`## ${h.mistakes}`, ...s.misconceptions.map((m) => `- ${h.insteadOf}: *${m.wrong}* → **${m.right}**`), '');
  if (s.catchUp.length) out.push(`## ${h.catchUp}`, ...s.catchUp.map((x, i) => `${i + 1}. ${x}`), '');
  if (s.selfCheck.length) out.push(`## ${h.selfCheck}`, ...s.selfCheck.map((x) => `- ${x}`), '');
  return out.join('\n').trim();
}

export function teacherMarkdown(s: SessionSummary, results: CheckResult[], o: { date: string; className: string }) {
  const h = H[s.language];
  const out: string[] = [`**${o.className} · ${o.date}**`, ''];
  if (results.length) {
    out.push(`## ${h.results}`);
    results.forEach((r) => out.push(`- **${r.title}** — ${r.answered}/${r.roster} ${h.answered}${r.avg != null ? ` · ${h.avg} ${r.avg}%` : ''}`));
    const w = weakest(results);
    if (w.length) out.push('', `**${h.weakest}**`, ...w.map((q) => `- ${q.pct}% · ${q.prompt.slice(0, 160)}`));
    out.push('');
  }
  if (s.teacher.reteach.length) out.push(`## ${h.reteach}`, ...s.teacher.reteach.map((x) => `- ${x}`), '');
  if (s.teacher.doNowFocus) out.push(`## ${h.nextDoNow}`, s.teacher.doNowFocus, '');
  if (s.teacher.exitFocus) out.push(`## ${h.nextExit}`, s.teacher.exitFocus, '');
  if (s.teacher.notes.length) out.push(`## ${h.notes}`, ...s.teacher.notes.map((x) => `- ${x}`), '');
  return out.join('\n').trim();
}

/**
 * NEXORA's built-in question writer. No AI service and no cost: it finds terms and
 * definitions, key sentences and step-by-step lists in the lesson text and turns them
 * into questions. Teachers review every question before publishing.
 */
import type { CheckKind, Counts, QType, RawQuestion } from './types';

const STOP = new Set(('a an the and or but if then than that this these those there their they them it its is are was were be been being to of in on at by for with from as into about over under between through during before after above below up down out off again further once here when where why how all any both each few more most other some such no nor not only own same so too very can will just should now you your we our he she his her i me my do does did have has had also may might must would could use used using one two three new like get make made see')
  .split(' '));
const PRONOUN_START = /^(it|this|that|these|those|there|they|he|she|we|you|i|which|what|who|when|where|here|each|some|one)\b/i;

export interface Def { term: string; def: string; sentence: string; colon?: boolean }

const rnd = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
function shuffle<T>(a: T[]) { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const words = (s: string) => s.split(/\s+/).filter(Boolean);
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const LABEL = /^(note|tip|example|remember|important|key idea|hint|warning|caution)\b\s*[:·-]?\s*/i;
const JUNK = /^(try it|exercise|submit|show answer|pdf|after the lecture|❮|previous|next|click here|download|page \d|slide \d+$)/i;
// Teacher-guide material is never turned into questions.
const TEACHER_ONLY = /\b(pacing|\d+[-\s]?minutes?|class periods?|block schedule|lesson (plan|overview)|standards?|TEKS|NGSS|CCSS|materials? (list|needed)|supplies|prep time|duration|prerequisites?|teacher (notes?|guide|tip)|answer key|grading|rubric|textbook pages?|page numbers?|copyright|all rights reserved|student (handout|direct)|differentiation|accommodations?|ELL support|extension activity)\b/i;
const BAD_FIRST = new Set('so and but or if then also its every each example note tip check your my our this that these the step question answer task lesson page slide worksheet name date period i you we they he she students student teacher class today'.split(' '));
const BAD_LAST = new Set('it is to the and of a an or for with on in by'.split(' '));
const IMPERATIVE = new Set('type click double-click right-click select open choose press draw set enter pick save close create add drag move start use go find specify turn name check print plot measure cut mark apply write read hold release zoom pan copy paste insert attach connect place label sketch trim extend offset rotate scale fill load run test record repeat finish begin'.split(' '));
const GENERIC_CAPS = new Set('PAGE PAGES LESSON NAME DATE WHAT WHY HOW WHO THE AND FOR FROM WITH THIS THAT YOUR DESIGN FILLABLE PDF NOTE TIP STEP PART UNIT CLASS WORKSHEET BEGINNERS'.split(' '));

export function analyse(text: string) {
  const rawLines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const lines = rawLines
    .map((l) => l.replace(/^\s*(slide \d+:|notes:)\s*/i, '').replace(/^[•\-*–▪◦●]\s*/, '').replace(LABEL, '').trim())
    .filter((l) => l && !JUNK.test(l) && !TEACHER_ONLY.test(l));

  // Big ideas teachers already wrote: essential question, "I can…" targets, summary points.
  const essential = rawLines.map((l) => l.match(/essential question\s*[:·-]?\s*(.+\?)/i)?.[1]).find(Boolean) ?? null;
  const objectives = lines.map((l) => l.match(/^I can\s+(.{6,160}?)[.!]?$/i)?.[1]).filter(Boolean) as string[];
  const summary: string[] = [];
  let inSummary = false;
  for (const l of rawLines) {
    if (/\b(summary|what to remember|key points|takeaways|remember)\b/i.test(l) && l.length < 60) { inSummary = true; continue; }
    if (inSummary) {
      if (/^[•\-*▪◦●]/.test(l)) summary.push(l.replace(/^[•\-*–▪◦●]\s*/, '').trim());
      else if (summary.length) inSummary = false;
    }
  }

  // Sentences (6–40 words).
  const sentences: string[] = [];
  const seen = new Set<string>();
  const bulletSet = new Set(rawLines.filter((l) => /^[•\-*▪◦●]/.test(l)).map((l) => l.replace(/^[•\-*–▪◦●]\s*/, '').replace(LABEL, '').trim()));
  for (const l of lines) {
    if (/^I can\b/i.test(l)) continue;
    if (!/[.!?]["”)]?$/.test(l) && !bulletSet.has(l)) continue;   // table rows and headings are not sentences
    for (const raw of l.split(/(?<=[.!?])\s+(?=[A-Z0-9“"])/)) {
      const st = raw.trim().replace(/\s+/g, ' ');
      const n = words(st).length;
      if (n < 6 || n > 40 || /\?$/.test(st) || /^(slide|page|figure|table)\s*\d/i.test(st) || /https?:\/\//.test(st)) continue;
      const letters = st.replace(/[^A-Za-z]/g, '');
      if (letters.length && letters.replace(/[^A-Z]/g, '').length / letters.length > 0.5) continue;  // shouty headings
      if (!/^[A-Z0-9“"(]/.test(st)) continue;
      if (IMPERATIVE.has(st.split(/\s+/)[0].toLowerCase())) continue;   // instructions make poor statements
      const k = st.toLowerCase();
      if (!seen.has(k)) { seen.add(k); sentences.push(/[.!?]$/.test(st) ? st : `${st}.`); }
    }
  }

  // Definitions: "Term: meaning", "Term – meaning", "Term is/are/means/refers to …", "… is called Term".
  const defs: Def[] = [];
  const addDef = (term: string, def: string, sentence: string, colon = false) => {
    term = term.replace(/^(an?|the)\s+/i, '').replace(/[“”"*]/g, '').trim();
    def = def.replace(/\s+/g, ' ').replace(/^[,:;\-–—\s]+/, '').trim().replace(/[.;:]+$/, '');
    const tw = words(term);
    if (!term || tw.length > 4 || term.length < 2 || PRONOUN_START.test(term)) return;
    if (BAD_FIRST.has(tw[0].toLowerCase()) || BAD_LAST.has(tw[tw.length - 1].toLowerCase()) || STOP.has(term.toLowerCase())) return;
    if (/\b(is|are|was|were|that|which|who|can|will|you|we|i|they|he|she|me|us|them|your|our)\b/i.test(term) || IMPERATIVE.has(tw[0].toLowerCase()) || /^(one|two|three|four|five|six|\d)/i.test(term)) return;
    if (words(def).length < 3 || def.length > 220 || TEACHER_ONLY.test(term) || TEACHER_ONLY.test(def)) return;
    if (defs.some((d) => d.term.toLowerCase() === term.toLowerCase())) return;
    defs.push({ term, def, sentence, colon });
  };
  for (const l of lines) {
    const m = l.match(/^([A-Za-z][\w\s/()'&-]{1,45}?)\s*(?::|\s[–—-])\s+(.{12,220})$/);
    if (m && !/[.!?]/.test(m[1])) addDef(m[1], m[2], `${m[1].trim()}: ${m[2].trim()}`, true);
  }
  for (const st of sentences) {
    const m = st.match(/^((?:an?|the)\s+)?([A-Za-z][\w\s/'-]{1,40}?)\s+(?:is|are|refers to|means|is defined as|is known as)\s+((?:an?|the)\s+)?(.{8,200}?)[.!?]$/i);
    if (m) addDef(m[2], `${m[3] ?? ''}${m[4]}`, st);
    const c = st.match(/^(.{10,160}?)\s+(?:is|are)\s+called\s+(?:an?\s+|the\s+)?([A-Za-z][\w\s-]{1,40}?)[.!?]$/i);
    if (c) addDef(c[2], c[1], st);
  }

  // Key terms: definitions first, then ALL-CAPS commands (LINE, OFFSET), capitalised phrases, frequent nouns.
  const freq = new Map<string, number>();
  for (const st of sentences) for (const w of st.match(/[A-Za-z][A-Za-z-]{3,}/g) ?? []) {
    const k = w.toLowerCase();
    if (!STOP.has(k) && !BAD_FIRST.has(k) && !/(ed|ing|ly)$/.test(k)) freq.set(k, (freq.get(k) ?? 0) + 1);
  }
  const caps = new Map<string, number>();
  for (const st of sentences) {
    for (const w of st.match(/\b[A-Z][A-Z-]{2,14}\b/g) ?? []) if (!GENERIC_CAPS.has(w)) caps.set(w, (caps.get(w) ?? 0) + 2);
    for (const w of st.slice(1).match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\b/g) ?? []) {
      const f = w.split(' ')[0].toLowerCase();
      if (!STOP.has(w.toLowerCase()) && !BAD_FIRST.has(f) && !STOP.has(f)) caps.set(w, (caps.get(w) ?? 0) + 1);
    }
  }
  const terms: string[] = [];
  const push = (t: string) => { if (t && !terms.some((x) => x.toLowerCase() === t.toLowerCase())) terms.push(t); };
  defs.forEach((d) => push(d.term));
  [...caps.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 25).forEach(([t]) => push(t));
  [...freq.entries()].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).slice(0, 25).forEach(([t]) => push(t));

  // Step lists: numbered lines (1. 2. 3. / Step 1), or ≥3 bullets in a row that start with an action verb.
  const sequences: string[][] = [];
  let cur: string[] = [];
  let expect = 1;
  for (const l of rawLines) {
    const m = l.match(/^(?:step\s*)?(\d{1,2})[.)\]:-]\s+(.{3,160})$/i);
    if (m && Number(m[1]) === expect) { cur.push(m[2].replace(/[.;]+$/, '')); expect++; continue; }
    if (m && Number(m[1]) === 1) { if (cur.length >= 3) sequences.push(cur); cur = [m[2].replace(/[.;]+$/, '')]; expect = 2; continue; }
    if (cur.length >= 3) sequences.push(cur);
    cur = []; expect = 1;
  }
  if (cur.length >= 3) sequences.push(cur);
  let run: string[] = [];
  const flush = () => {
    const acts = run.filter((x) => IMPERATIVE.has(x.split(/\s+/)[0].toLowerCase().replace(/[^a-z-]/g, '')));
    if (run.length >= 3 && acts.length / run.length >= 0.8) sequences.push(run.slice(0, 7).map((x) => x.replace(/[.;]+$/, '')));
    run = [];
  };
  for (const l of rawLines) {
    if (/^[•\-*▪◦●]\s*/.test(l)) run.push(l.replace(/^[•\-*–▪◦●]\s*/, '').trim()); else flush();
  }
  flush();

  return { sentences, defs, terms, sequences, essential, objectives, summary };
}

type A = ReturnType<typeof analyse>;

function sentenceWith(a: A, used: Set<string>) {
  // A sentence that contains a key term (not yet used), and that term.
  for (const s of shuffle(a.sentences)) {
    if (used.has(s)) continue;
    const t = a.terms.find((term) => term.length > 3 && new RegExp(`\\b${esc(term)}\\b`, 'i').test(s) && words(s).length >= 7);
    if (t) { used.add(s); return { s, t }; }
  }
  return null;
}

function distractors(a: A, correct: string, n: number) {
  const not = (t: string) => t.toLowerCase() !== correct.toLowerCase() && !correct.toLowerCase().includes(t.toLowerCase()) && !t.toLowerCase().includes(correct.toLowerCase());
  const tiers = [
    a.defs.map((d) => d.term),
    a.terms.filter((t) => /^[A-Z]/.test(t) && (t === t.toUpperCase()) === (correct === correct.toUpperCase())),
    a.terms,
  ];
  const out: string[] = [];
  for (const tier of tiers) for (const t of shuffle(tier.filter(not))) {
    if (out.length >= n) break;
    if (!out.some((x) => x.toLowerCase() === t.toLowerCase())) out.push(t);
  }
  const shape = (t: string) => (/^[A-Z]/.test(correct) ? cap(t) : t);
  return out.map(shape);
}

export function builtin(text: string, counts: Counts, kind: CheckKind, topic: string): { questions: RawQuestion[]; notes: string[] } {
  const a = analyse(text);
  const out: RawQuestion[] = [];
  const notes: string[] = [];
  const used = new Set<string>();
  const usedTerms = new Set<string>();
  const nextDef = () => { const d = shuffle(a.defs).find((x) => !usedTerms.has(x.term)); if (d) usedTerms.add(d.term); return d; };

  const n = (t: QType) => Math.max(0, Math.min(20, counts[t] ?? 0));

  for (let i = 0; i < n('multiple_choice'); i++) {
    const d = a.defs.length >= 3 ? nextDef() : undefined;
    if (d) {
      const wrong = distractors(a, d.term, 3);
      if (wrong.length >= 2) {
        const opts = shuffle([d.term, ...wrong]);
        out.push({ type: 'multiple_choice', prompt: `Which term is defined as “${d.def.replace(/[.]+$/, '')}”?`, options: opts, correct: [opts.indexOf(d.term)], explanation: `${d.term}: ${d.def}.` });
        continue;
      }
    }
    const hit = sentenceWith(a, used);
    if (!hit) break;
    const wrong = distractors(a, hit.t, 3);
    if (wrong.length < 2) break;
    const opts = shuffle([hit.t, ...wrong]);
    out.push({ type: 'multiple_choice', prompt: `Which word best completes the sentence? “${hit.s.replace(new RegExp(`\\b${esc(hit.t)}\\b`, 'i'), '_____')}”`, options: opts, correct: [opts.indexOf(hit.t)], explanation: hit.s });
  }
  if (out.filter((q) => q.type === 'multiple_choice').length < n('multiple_choice')) notes.push('multiple_choice');

  const tfStart = out.length;
  for (let i = 0; i < n('true_false'); i++) {
    const makeFalse = i % 2 === 1;
    const d = a.defs.length >= 2 ? nextDef() : undefined;
    if (d) {
      const other = makeFalse ? distractors(a, d.term, 1)[0] : undefined;
      if (!makeFalse || other) {
        const say = (t: string) => (d.colon ? `“${cap(t)}” means: ${/^[A-Z][a-z]/.test(d.def) ? d.def.charAt(0).toLowerCase() + d.def.slice(1) : d.def}.` : `${cap(t)} ${/[^s]s$/i.test(t) ? 'are' : 'is'} ${d.def.replace(/^(is|are)\s+/i, '')}.`);
        out.push({ type: 'true_false', prompt: say(makeFalse ? other! : d.term), answer: !makeFalse, explanation: makeFalse ? `False — ${say(d.term)}` : say(d.term) });
        continue;
      }
    }
    const fromSummary = a.summary.map((x) => ({ s: /[.!?]$/.test(x) ? x : `${x}.`, t: a.terms.find((term) => new RegExp(`\\b${esc(term)}\\b`, 'i').test(x)) }))
      .find((x) => x.t && !used.has(x.s));
    if (fromSummary) used.add(fromSummary.s);
    const hit = fromSummary ? { s: fromSummary.s, t: fromSummary.t! } : sentenceWith(a, used);
    if (!hit) break;
    const swap = makeFalse ? distractors(a, hit.t, 1)[0] : undefined;
    const stmt = swap ? hit.s.replace(new RegExp(`\\b${esc(hit.t)}\\b`, 'i'), swap) : hit.s;
    out.push({ type: 'true_false', prompt: stmt, answer: !swap, explanation: swap ? `False — ${hit.s}` : undefined });
  }
  if (out.length - tfStart < n('true_false')) notes.push('true_false');

  const fbStart = out.length;
  for (let i = 0; i < n('fill_blank'); i++) {
    const d = shuffle(a.defs).find((x) => !usedTerms.has(x.term) && new RegExp(`\\b${esc(x.term)}\\b`, 'i').test(x.sentence) && words(x.sentence).length >= 6);
    let s: string; let t: string;
    if (d) { usedTerms.add(d.term); s = d.sentence; t = d.term; } else {
      const hit = sentenceWith(a, used); if (!hit) break; s = hit.s; t = hit.t;
    }
    const prompt = s.replace(new RegExp(`\\b${esc(t)}\\b`, 'i'), '[blank]');
    const variants = [t, t.toLowerCase(), t.endsWith('s') ? t.slice(0, -1) : `${t}s`];
    out.push({ type: 'fill_blank', prompt, blanks: [[...new Set(variants)]], explanation: s });
  }
  if (out.length - fbStart < n('fill_blank')) notes.push('fill_blank');

  for (let i = 0; i < n('matching'); i++) {
    const pool = shuffle(a.defs.filter((d) => !usedTerms.has(d.term))).slice(0, 5);
    const pairs = (pool.length >= 3 ? pool : shuffle(a.defs).slice(0, 5)).map((d) => ({ left: d.term, right: cap(d.def) }));
    if (pairs.length < 3) { notes.push('matching'); break; }
    pairs.forEach((p) => usedTerms.add(p.left));
    out.push({ type: 'matching', prompt: 'Match each term with its meaning.', pairs, points: pairs.length });
  }

  for (let i = 0; i < n('ordering'); i++) {
    const seq = a.sequences[i];
    if (!seq) { notes.push('ordering'); break; }
    out.push({ type: 'ordering', prompt: 'Put these steps in the correct order.', items: seq.slice(0, 7) });
  }

  const doNow = [
    (t: string) => `In your own words, what is ${t}? Give one example.`,
    (t: string) => `What do you already know about ${t}? Write two facts or ideas.`,
    (t: string) => `Where might you see or use ${t} outside of class?`,
    () => `Look back at last class: what is one thing you remember about ${topic}?`,
  ];
  const exit = [
    (t: string) => `Explain ${t} to a classmate who missed today's lesson.`,
    () => `What is one thing you learned about ${topic} today, and one question you still have?`,
    (t: string) => `Why does ${t} matter when working on ${topic}?`,
    (t: string) => `Describe a mistake someone could make with ${t} and how to avoid it.`,
  ];
  const tpl = kind === 'exit_ticket' ? exit : doNow;
  // Questions the teacher already wrote come first: the essential question and the "I can" targets.
  const own: string[] = [];
  if (a.essential) own.push(kind === 'exit_ticket' ? `Answer today's essential question: ${a.essential}` : `Before we start — what do you think? ${a.essential}`);
  if (kind === 'exit_ticket') a.objectives.forEach((o) => own.push(`Show what you learned: explain how you ${o.replace(/^I can\s+/i, '').replace(/[.!]$/, '')}.`));
  for (let i = 0; i < n('short_answer'); i++) {
    if (own[i]) { out.push({ type: 'short_answer', prompt: own[i], sample_answer: a.summary.slice(0, 3).join(' ') }); continue; }
    const d = a.defs[i] ?? undefined;
    const t = d?.term ?? a.terms[i] ?? topic;
    out.push({ type: 'short_answer', prompt: tpl[i % tpl.length](t), sample_answer: d ? `${d.term}: ${d.def}.` : '' });
  }

  if (!a.sentences.length) notes.push('no_text');
  return { questions: out, notes: [...new Set(notes)] };
}

export { rnd };

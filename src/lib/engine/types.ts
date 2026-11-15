/** Question formats shared by the engine, the editor, the student view and the database. */

export const QTYPES = ['true_false', 'multiple_choice', 'ordering', 'short_answer', 'fill_blank', 'matching'] as const;
export type QType = (typeof QTYPES)[number];
export type BlockType = QType | 'text' | 'page_break';
export type Counts = Partial<Record<QType, number>>;
export type CheckKind = 'do_now' | 'exit_ticket' | 'quiz';

export interface Opt { id: string; text: string }

/**
 * data = what students see; key = the answer key (never sent to students).
 *  true_false       data {}                          key { answer: boolean }
 *  multiple_choice  data { options: Opt[], multi }   key { correct: string[] }
 *  ordering         data { items: Opt[] }            key { order: string[] }   (items stored in the correct order)
 *  short_answer     data { lines?: number }          key { sample: string }
 *  fill_blank       prompt has [blank] markers        key { answers: string[][] } (accepted answers per blank)
 *  matching         data { left: Opt[], right: Opt[] } key { pairs: Record<leftId, rightId> }
 */
export interface Question {
  id?: string;
  type: BlockType;
  prompt: string;
  data: Record<string, unknown>;
  key: Record<string, unknown>;
  points: number;
  explanation?: string | null;
  position?: number;
}

export const BLANK = '[blank]';
export const DEFAULT_POINTS: Record<QType, number> = {
  true_false: 1, multiple_choice: 1, fill_blank: 1, ordering: 2, matching: 2, short_answer: 2,
};

const letters = 'abcdefghijklmnopqrstuvwxyz';
export const optId = (i: number) => letters[i] ?? `o${i}`;

const clean = (s: unknown, max = 600) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/** Raw shape the AI (and the built-in generator) produce — friendlier than the stored one. */
export interface RawQuestion {
  type: QType;
  prompt?: string;
  options?: string[];
  correct?: number[];
  answer?: boolean;
  items?: string[];
  pairs?: { left: string; right: string }[];
  blanks?: string[][];
  sample_answer?: string;
  explanation?: string;
  points?: number;
}

/** Turn a raw question into the stored format; returns null if it is not usable. */
export function fromRaw(r: RawQuestion): Question | null {
  const prompt = clean(r.prompt, 1200);
  const explanation = clean(r.explanation, 600) || null;
  const points = Math.max(0, Math.min(100, Number(r.points) || DEFAULT_POINTS[r.type] || 1));
  switch (r.type) {
    case 'true_false':
      if (!prompt || typeof r.answer !== 'boolean') return null;
      return { type: 'true_false', prompt, data: {}, key: { answer: r.answer }, points, explanation };
    case 'multiple_choice': {
      const opts = (r.options ?? []).map((o) => clean(o, 300)).filter(Boolean).slice(0, 8);
      const correct = (r.correct ?? []).filter((i) => Number.isInteger(i) && i >= 0 && i < opts.length);
      if (!prompt || opts.length < 2 || !correct.length) return null;
      const options = opts.map((text, i) => ({ id: optId(i), text }));
      return { type: 'multiple_choice', prompt, data: { options, multi: correct.length > 1 }, key: { correct: [...new Set(correct)].map(optId) }, points, explanation };
    }
    case 'ordering': {
      const items = (r.items ?? []).map((o) => clean(o, 300)).filter(Boolean).slice(0, 10);
      if (items.length < 3) return null;
      const opts = items.map((text, i) => ({ id: optId(i), text }));
      return { type: 'ordering', prompt: prompt || 'Put these in the correct order.', data: { items: opts }, key: { order: opts.map((o) => o.id) }, points, explanation };
    }
    case 'short_answer':
      if (!prompt) return null;
      return { type: 'short_answer', prompt, data: { lines: 4 }, key: { sample: clean(r.sample_answer, 1200) }, points, explanation };
    case 'fill_blank': {
      let p = prompt.replace(/_{3,}|\[\s*blank\s*\]|\(\s*blank\s*\)/gi, BLANK);
      const n = p.split(BLANK).length - 1;
      const answers = (r.blanks ?? []).map((a) => (Array.isArray(a) ? a : [a]).map((x) => clean(x, 120)).filter(Boolean)).filter((a) => a.length);
      if (!n || answers.length < n) return null;
      p = p.slice(0, 1200);
      return { type: 'fill_blank', prompt: p, data: { blanks: n }, key: { answers: answers.slice(0, n) }, points, explanation };
    }
    case 'matching': {
      const pairs = (r.pairs ?? []).map((x) => ({ left: clean(x.left, 200), right: clean(x.right, 300) })).filter((x) => x.left && x.right).slice(0, 10);
      if (pairs.length < 2) return null;
      const left = pairs.map((x, i) => ({ id: `l${i + 1}`, text: x.left }));
      const right = pairs.map((x, i) => ({ id: `r${i + 1}`, text: x.right }));
      return {
        type: 'matching', prompt: prompt || 'Match each term with its meaning.', data: { left, right },
        key: { pairs: Object.fromEntries(left.map((l, i) => [l.id, right[i].id])) }, points: r.points ? points : Math.max(points, pairs.length), explanation,
      };
    }
    default:
      return null;
  }
}

/** Empty question of a type, for "Add Question" in the editor. */
export function blank(type: BlockType): Question {
  switch (type) {
    case 'true_false': return { type, prompt: '', data: {}, key: { answer: true }, points: 1 };
    case 'multiple_choice': return { type, prompt: '', data: { options: [0, 1, 2, 3].map((i) => ({ id: optId(i), text: '' })), multi: false }, key: { correct: ['a'] }, points: 1 };
    case 'ordering': return { type, prompt: 'Put these in the correct order.', data: { items: [0, 1, 2].map((i) => ({ id: optId(i), text: '' })) }, key: { order: ['a', 'b', 'c'] }, points: 2 };
    case 'short_answer': return { type, prompt: '', data: { lines: 4 }, key: { sample: '' }, points: 2 };
    case 'fill_blank': return { type, prompt: `The ${BLANK} …`, data: { blanks: 1 }, key: { answers: [['']] }, points: 1 };
    case 'matching': return { type, prompt: 'Match each term with its meaning.', data: { left: [{ id: 'l1', text: '' }, { id: 'l2', text: '' }], right: [{ id: 'r1', text: '' }, { id: 'r2', text: '' }] }, key: { pairs: { l1: 'r1', l2: 'r2' } }, points: 2 };
    case 'text': return { type, prompt: '', data: {}, key: {}, points: 0 };
    case 'page_break': return { type, prompt: '', data: {}, key: {}, points: 0 };
  }
}

const BLOCKS: BlockType[] = ['true_false', 'multiple_choice', 'ordering', 'short_answer', 'fill_blank', 'matching', 'text', 'page_break'];
const optList = (v: unknown, max = 12) => (Array.isArray(v) ? v : []).slice(0, max)
  .map((o, i) => ({ id: clean((o as Opt)?.id, 12).replace(/[^\w-]/g, '') || optId(i), text: clean((o as Opt)?.text, 300) }));

/** Rebuild a question from untrusted input (the editor) so only valid fields are stored. */
export function sanitize(q: Partial<Question>): Question | null {
  const type = q.type as BlockType;
  if (!BLOCKS.includes(type)) return null;
  const prompt = String(q.prompt ?? '').slice(0, 4000);
  const points = Math.max(0, Math.min(100, Math.round((Number(q.points) || 0) * 100) / 100));
  const explanation = clean(q.explanation, 2000) || null;
  const d = (q.data ?? {}) as Record<string, unknown>;
  const k = (q.key ?? {}) as Record<string, unknown>;
  switch (type) {
    case 'true_false': return { type, prompt, data: {}, key: { answer: k.answer !== false }, points, explanation };
    case 'multiple_choice': {
      const options = optList(d.options, 10);
      const ids = new Set(options.map((o) => o.id));
      const correct = (Array.isArray(k.correct) ? k.correct : []).map((x) => clean(x, 12).replace(/[^\w-]/g, '')).filter((x) => ids.has(x));
      return { type, prompt, data: { options, multi: correct.length > 1 }, key: { correct }, points, explanation };
    }
    case 'ordering': {
      const items = optList(d.items, 12);
      return { type, prompt, data: { items }, key: { order: items.map((i) => i.id) }, points, explanation };
    }
    case 'short_answer': return { type, prompt, data: { lines: Math.max(1, Math.min(20, Number(d.lines) || 4)) }, key: { sample: clean(k.sample, 2000) }, points, explanation };
    case 'fill_blank': {
      const n = prompt.split(BLANK).length - 1;
      const raw = Array.isArray(k.answers) ? k.answers : [];
      const answers = Array.from({ length: n }, (_, i) => (Array.isArray(raw[i]) ? raw[i] : []).map((x: unknown) => clean(x, 120)).filter(Boolean).slice(0, 10));
      return { type, prompt, data: { blanks: n }, key: { answers }, points, explanation };
    }
    case 'matching': {
      const left = optList(d.left, 12); const right = optList(d.right, 12);
      const rid = new Set(right.map((r) => r.id));
      const pairsIn = (k.pairs ?? {}) as Record<string, unknown>;
      const pairs = Object.fromEntries(left.map((l) => [l.id, clean(pairsIn[l.id], 12).replace(/[^\w-]/g, '')]).filter(([, r]) => rid.has(r)));
      return { type, prompt, data: { left, right }, key: { pairs }, points, explanation };
    }
    case 'text': return { type, prompt, data: {}, key: {}, points: 0, explanation: null };
    case 'page_break': return { type, prompt: '', data: {}, key: {}, points: 0, explanation: null };
  }
}

/**
 * "Import Test/Quiz": paste questions from a Word doc or Google Doc.
 *   1. Which tool draws a line?        ← question (numbered)
 *   a) CIRCLE                          ← options; * marks the right one(s)
 *   *b) LINE
 *   2. AutoCAD saves files as .dwg. (True)     ← (True)/(False) or "Answer: True" → True/False
 *   3. The ___ tab holds the drawing. [Model]   ← ___ blanks, answers in [ ] separated by |
 *   4. Explain what layers are for.           ← nothing else → short answer
 *   5. Order: Open | Draw | Save              ← "Order:" items in the right order
 *   6. Match: Line = draws a segment; Circle = draws a round shape
 */
export function parseImport(text: string): Question[] {
  const blocks: string[][] = [];
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const l = raw.trim();
    if (!l) continue;
    if (/^(?:q(?:uestion)?\s*)?\d{1,3}[.)]\s+/i.test(l) || !blocks.length) blocks.push([l.replace(/^(?:q(?:uestion)?\s*)?\d{1,3}[.)]\s+/i, '')]);
    else blocks[blocks.length - 1].push(l);
  }
  const out: Question[] = [];
  for (const [head, ...rest] of blocks) {
    let prompt = head;
    const opts = rest.filter((l) => /^\*?\s*[a-hA-H][.)]\s+/.test(l));
    const answerLine = rest.find((l) => /^(answer|ans|key)\s*[:=-]/i.test(l))?.replace(/^(answer|ans|key)\s*[:=-]\s*/i, '').trim();
    const tf = prompt.match(/\((true|false|t|f)\)\s*$/i)?.[1] ?? (answerLine && /^(true|false|t|f)$/i.test(answerLine) ? answerLine : null);
    let raw: RawQuestion | null = null;
    if (/^order\s*:/i.test(prompt)) {
      raw = { type: 'ordering', prompt: 'Put these in the correct order.', items: prompt.replace(/^order\s*:\s*/i, '').split('|').map((s) => s.trim()) };
    } else if (/^match\s*:/i.test(prompt)) {
      const pairs = prompt.replace(/^match\s*:\s*/i, '').split(/;|\|/).map((p) => p.split(/\s*=\s*|\s+[-–—]\s+/)).filter((p) => p.length === 2).map(([left, right]) => ({ left, right }));
      raw = { type: 'matching', prompt: 'Match each term with its meaning.', pairs };
    } else if (opts.length >= 2) {
      const correct = opts.map((o, i) => (o.startsWith('*') || (answerLine && answerLine.toLowerCase().startsWith(o.replace(/^\*?\s*/, '').charAt(0).toLowerCase())) ? i : -1)).filter((i) => i >= 0);
      raw = { type: 'multiple_choice', prompt, options: opts.map((o) => o.replace(/^\*?\s*[a-hA-H][.)]\s+/, '')), correct: correct.length ? correct : [0] };
    } else if (tf) {
      prompt = prompt.replace(/\((true|false|t|f)\)\s*$/i, '').trim();
      raw = { type: 'true_false', prompt, answer: /^t/i.test(tf) };
    } else if (/_{3,}/.test(prompt)) {
      const ans = prompt.match(/\[([^\]]+)\]\s*$/)?.[1] ?? answerLine ?? '';
      prompt = prompt.replace(/\[([^\]]+)\]\s*$/, '').trim();
      const n = (prompt.match(/_{3,}/g) ?? []).length;
      const groups = ans.split(/;|,(?![^|]*\|)/).map((g) => g.split('|').map((s) => s.trim()).filter(Boolean));
      raw = { type: 'fill_blank', prompt, blanks: Array.from({ length: n }, (_, i) => groups[i] ?? ['']) };
    } else {
      raw = { type: 'short_answer', prompt: [prompt, ...rest.filter((l) => l !== answerLine && !/^(answer|ans|key)\s*[:=-]/i.test(l))].join(' '), sample_answer: answerLine ?? '' };
    }
    const q = raw && fromRaw(raw);
    if (q) out.push(q);
  }
  return out.slice(0, 100);
}

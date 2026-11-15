/**
 * What students chose, question by question — the answer-choice breakdown behind the results page
 * and the session summary's teacher notes. Pure: works on the stored question (data + key) and the
 * attempts' answers / per-question points, on the server or in the browser.
 *
 * For each question: every option (or every distinct answer typed) with how many chose it, who,
 * whether it is correct, and — for the most common wrong answer — the likely misconception
 * (key.why, written with the question) and the lesson quote that proves the right answer.
 */
import type { Opt } from '../../src/lib/engine/types';

export interface InsightQuestion {
  id: string; type: string; prompt: string; position?: number;
  data: Record<string, unknown>; key: Record<string, unknown>; explanation?: string | null;
}
export interface InsightAttempt { student_id: string; answers: Record<string, unknown> | null; per_question: Record<string, { points: number | null; max: number }> | null }

export interface Choice {
  key: string;
  /** Option letter (A, B…) for multiple choice, null for typed answers. */
  letter: string | null;
  label: string;
  count: number;
  /** Share of students who answered this question, 0–100. */
  pct: number;
  correct: boolean;
  /** Student ids who chose it. */
  students: string[];
  /** Why a student might choose it (wrong answers only, when the question carries it). */
  why: string | null;
}
export interface QuestionInsight {
  id: string; type: string; prompt: string;
  answered: number;
  pctCorrect: number | null;
  choices: Choice[];
  /** The wrong answer most students chose (null when nobody got it wrong). */
  topWrong: Choice | null;
  /** Lesson quote that proves the right answer, when the question has one. */
  quote: string | null;
  explanation: string | null;
  /** Short answers are graded by the teacher: how many still need grading. */
  ungraded: number;
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const norm = (s: string) => s.normalize('NFKC').toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
const answered = (v: unknown) => !(v == null || v === '' || (Array.isArray(v) && (v.length === 0 || v.every((x) => x == null || x === ''))));
const pctOf = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

function whyMap(key: Record<string, unknown>): Record<string, string> {
  const w = key.why;
  return w && typeof w === 'object' && !Array.isArray(w) ? Object.fromEntries(Object.entries(w as Record<string, unknown>).filter(([, v]) => typeof v === 'string' && v.trim()).map(([k, v]) => [k, String(v).trim()])) : {};
}

export function questionInsight(q: InsightQuestion, attempts: InsightAttempt[], labels: { yes: string; no: string; full: string; partial: string; none: string; other: string }): QuestionInsight {
  const ans = attempts.filter((a) => answered(a.answers?.[q.id]));
  const n = ans.length;
  const why = whyMap(q.key);
  const pq = (a: InsightAttempt) => a.per_question?.[q.id];
  const graded = attempts.map(pq).filter((v): v is { points: number; max: number } => !!v && v.points != null && v.max > 0);
  const pctCorrect = graded.length ? Math.round((graded.reduce((s, v) => s + v.points / v.max, 0) / graded.length) * 100) : null;
  const src = (q.key.source ?? null) as { quote?: string } | null;
  const base = { id: q.id, type: q.type, prompt: q.prompt, answered: n, pctCorrect, quote: src?.quote?.trim() || null, explanation: q.explanation?.trim() || null };
  let choices: Choice[] = [];
  let ungraded = 0;

  if (q.type === 'multiple_choice') {
    const opts = (q.data.options as Opt[]) ?? [];
    const right = new Set(((q.key.correct as string[]) ?? []).map(String));
    choices = opts.map((o, i) => {
      const who = ans.filter((a) => (a.answers?.[q.id] as unknown[]).map(String).includes(o.id)).map((a) => a.student_id);
      return { key: o.id, letter: LETTERS[i] ?? null, label: o.text, count: who.length, pct: pctOf(who.length, n), correct: right.has(o.id), students: who, why: right.has(o.id) ? null : why[o.id] ?? null };
    });
  } else if (q.type === 'true_false') {
    const right = q.key.answer === true;
    choices = [true, false].map((v) => {
      const who = ans.filter((a) => a.answers?.[q.id] === v).map((a) => a.student_id);
      return { key: String(v), letter: null, label: v ? labels.yes : labels.no, count: who.length, pct: pctOf(who.length, n), correct: v === right, students: who, why: v === right ? null : why[String(v)] ?? null };
    });
  } else if (q.type === 'short_answer') {
    // Typed sentences don't group; show how the grading came out instead.
    const buckets = { full: [] as string[], partial: [] as string[], none: [] as string[] };
    for (const a of ans) {
      const v = pq(a);
      if (!v || v.points == null) { ungraded += 1; continue; }
      (v.points >= v.max ? buckets.full : v.points > 0 ? buckets.partial : buckets.none).push(a.student_id);
    }
    const g = n - ungraded;
    choices = (['full', 'partial', 'none'] as const).map((k) => ({ key: k, letter: null, label: labels[k], count: buckets[k].length, pct: pctOf(buckets[k].length, g), correct: k === 'full', students: buckets[k], why: null }));
  } else {
    // Fill in the blank, ordering, matching: group identical answers.
    const label = (v: unknown): string => {
      if (q.type === 'ordering' && Array.isArray(v)) {
        const items = new Map(((q.data.items as Opt[]) ?? []).map((o) => [o.id, o.text]));
        return v.map((id) => items.get(String(id)) ?? String(id)).join(' → ');
      }
      if (q.type === 'matching' && v && typeof v === 'object') {
        const left = (q.data.left as Opt[]) ?? [], right = new Map(((q.data.right as Opt[]) ?? []).map((o) => [o.id, o.text]));
        return left.map((l) => `${l.text} → ${right.get((v as Record<string, string>)[l.id]) ?? '—'}`).join('; ');
      }
      return Array.isArray(v) ? v.map((x) => String(x ?? '').trim()).join(' · ') : String(v ?? '');
    };
    const groups = new Map<string, { label: string; students: string[]; full: number }>();
    for (const a of ans) {
      const v = a.answers?.[q.id];
      const k = q.type === 'fill_blank' ? norm(label(v)) : JSON.stringify(v);
      const g = groups.get(k) ?? { label: label(v), students: [], full: 0 };
      g.students.push(a.student_id);
      const p = pq(a);
      if (p && p.points != null && p.points >= p.max) g.full += 1;
      groups.set(k, g);
    }
    const all = [...groups.entries()].map(([k, g]) => ({ key: k, letter: null, label: g.label, count: g.students.length, pct: pctOf(g.students.length, n), correct: g.full === g.students.length && g.full > 0, students: g.students, why: null }))
      .sort((a, b) => b.count - a.count || Number(b.correct) - Number(a.correct));
    const top = all.slice(0, 6), rest = all.slice(6);
    choices = rest.length ? [...top, { key: '_other', letter: null, label: labels.other, count: rest.reduce((s, c) => s + c.count, 0), pct: pctOf(rest.reduce((s, c) => s + c.count, 0), n), correct: false, students: rest.flatMap((c) => c.students), why: null }] : top;
  }

  const wrong = choices.filter((c) => !c.correct && c.count > 0 && c.key !== '_other' && q.type !== 'short_answer');
  const topWrong = wrong.length ? wrong.reduce((a, b) => (b.count > a.count ? b : a)) : null;
  return { ...base, choices, topWrong, ungraded };
}

/** One line a teacher (or the summary writer) can act on: "48% chose “@10'<0” — thinks 0° points up." */
export function wrongLine(i: QuestionInsight, chose: (p: { pct: number; answer: string }) => string): string | null {
  if (!i.topWrong) return null;
  const w = i.topWrong;
  return `${chose({ pct: w.pct, answer: w.label })}${w.why ? ` — ${w.why.replace(/[.]+$/, '')}.` : '.'}`;
}

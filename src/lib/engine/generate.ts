/** The NEXORA question engine: AI when it is switched on, the built-in writer otherwise. */
import { AiKeyError, aiEnabled, aiGenerate, type Raw } from './ai';
import { findEvidence, parsePages, prepareLesson, type Prepared } from './core';
import { builtin } from './builtin';
import type { Source } from './extract';
import { fromRaw, optId, QTYPES, type CheckKind, type Counts, type Opt, type Question } from './types';

export interface GenResult { questions: Question[]; engine: 'ai' | 'builtin'; notes: string[]; topic: string }

/** Where a question came from, kept with the answer key (students never see it). */
export interface QSource { quote: string; passage: string | null; page: number | null; heading: string | null; verified: boolean }

function withSource(raw: Raw, prep: Prepared): Question | null {
  const q = fromRaw(raw);
  if (!q) return null;
  const hit = findEvidence(raw.evidence, prep);
  const source: QSource = { quote: (raw.evidence ?? '').slice(0, 400), passage: hit?.id ?? raw.source ?? null, page: hit?.page ?? null, heading: hit?.heading ?? null, verified: !!hit };
  return { ...q, key: { ...q.key, source } };
}

/** AI models tend to put the right answer in the same slot; spread it across A–D. */
function spreadAnswers(qs: Question[]) {
  let slot = Math.floor(Math.random() * 4);
  return qs.map((q) => {
    if (q.type !== 'multiple_choice') return q;
    const opts = (q.data.options as Opt[]) ?? [];
    const correct = (q.key.correct as string[]) ?? [];
    if (correct.length !== 1 || opts.length < 2) return q;
    const right = opts.find((o) => o.id === correct[0]);
    if (!right) return q;
    const others = opts.filter((o) => o !== right).sort(() => Math.random() - 0.5);
    const at = slot++ % opts.length;
    const order = [...others.slice(0, at), right, ...others.slice(at)];
    const options = order.map((o, i) => ({ id: optId(i), text: o.text }));
    return { ...q, data: { ...q.data, options }, key: { ...q.key, correct: [optId(at)] } };
  });
}

export async function generate(src: Source, counts: Counts, kind: CheckKind, opts: { language: string; level: string; focus: string; pages?: string }): Promise<GenResult> {
  const notes: string[] = [];
  // Clean the lesson and find its teaching core first (tables of contents, indexes, headers… removed).
  const pageSet = parsePages(opts.pages);
  const prep = prepareLesson(src.text, { pages: pageSet });
  if (pageSet && !prep.passages.length) notes.push('pages_empty');
  const order = (qs: Question[]) => qs.sort((a, b) => QTYPES.indexOf(a.type as never) - QTYPES.indexOf(b.type as never));
  const canAI = aiEnabled() && (src.text.trim().length > 40 || !!src.binary);

  if (canAI) {
    try {
      const r = await aiGenerate(src, counts, kind, opts, prep);
      const qs = r.questions.map((x) => withSource(x, prep)).filter((q): q is Question => !!q);
      const grounded = qs.filter((q) => (q.key.source as QSource | undefined)?.verified).length;
      notes.push(grounded === qs.length ? 'grounded' : `ungrounded_${qs.length - grounded}`);
      // Grounded questions first, so any extras that get trimmed are the unverified ones.
      qs.sort((a, b) => Number(!!(b.key.source as QSource | undefined)?.verified) - Number(!!(a.key.source as QSource | undefined)?.verified));
      const seen: Record<string, number> = {};
      const kept = qs.filter((q) => (seen[q.type] = (seen[q.type] ?? 0) + 1) <= (counts[q.type as keyof Counts] ?? 0));
      for (const t of QTYPES) if ((counts[t] ?? 0) > (seen[t] ?? 0)) notes.push(t);
      if (r.reviewed) notes.push('reviewed');
      if (kept.length) return { questions: spreadAnswers(order(kept)), engine: 'ai', notes, topic: r.topic || src.title };
      notes.push('ai_empty');
    } catch (e) {
      console.error('AI engine failed, using built-in engine:', (e as Error).message);
      notes.push(e instanceof AiKeyError ? 'ai_key' : 'ai_failed');
    }
  }
  if (!src.text.trim()) return { questions: [], engine: 'builtin', notes: [...notes, src.warning ?? 'no_text'], topic: src.title };
  // The built-in writer reads the cleaned lesson, strongest passages first.
  const ordered = prep.passages.length
    ? [...prep.core, ...prep.passages.filter((p) => !prep.core.includes(p))].map((p) => p.text).join('\n\n')
    : src.text.replace(/\f/g, '\n');
  const r = builtin(ordered, counts, kind, src.title);
  const qs = r.questions.map(fromRaw).filter((q): q is Question => !!q);
  return { questions: order(qs), engine: 'builtin', notes: [...notes, ...r.notes], topic: src.title };
}

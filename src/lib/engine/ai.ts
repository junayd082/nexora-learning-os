/**
 * AI question writer (Claude). Used only when ANTHROPIC_API_KEY is set on the server.
 *
 * Two passes, like a writer and an editor on an assessment team:
 *   1. WRITER   — reads the lesson (the PDF itself, so tables, diagrams and slides count),
 *                 maps its concepts, vocabulary and skills, separates teacher-only material,
 *                 then drafts questions against a professional item-writing rubric.
 *   2. REVIEWER — checks every draft against the lesson and the rubric, scores it, and
 *                 rewrites or replaces anything weak, inaccurate or off-level.
 * Output is strict JSON (structured outputs). If the reviewer runs out of time the
 * writer's draft is used, and if the AI fails entirely the built-in engine takes over.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { Source } from './extract';
import { coreForPrompt, findEvidence, removedSummary, type Prepared } from './core';
import type { CheckKind, Counts, QType, RawQuestion } from './types';

export const aiEnabled = () => !!process.env.ANTHROPIC_API_KEY;
export const MODEL = () => process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const BUDGET_MS = 105_000; // stays under the route's 120 s limit

export class AiKeyError extends Error {}

// ---------------------------------------------------------------------------- rubric
const RUBRIC = `
PROFESSIONAL ITEM-WRITING STANDARDS (follow every rule)

Content
- Assess only what the lesson teaches to students. IGNORE teacher-facing material: pacing guides, lesson
  durations, standards codes (TEKS, NGSS…), materials/supply lists, teacher notes, answer keys, grading
  directions, page headers/footers, slide numbers, copyright lines and file names.
- Every question targets one important concept, skill or procedure from the lesson — never trivia
  (titles, page numbers, who wrote the lesson, how many slides).
- Each question stands alone: no question gives away another's answer.
- Accuracy first: the keyed answer must be correct according to the lesson and to the profession.

Cognitive demand (Webb's Depth of Knowledge)
- Mix levels: DOK 1 = recall/identify; DOK 2 = apply, explain, compare, classify, interpret a diagram or
  value; DOK 3 = analyze a scenario, troubleshoot, justify a choice.
- Prefer realistic Career & Technical Education situations (a drafter on a job, a client request, a
  plan that has an error, a shop or lab procedure) whenever the content allows.

Stems
- Write each stem as a complete, direct question or statement that a student could answer before seeing
  the options. Put the problem in the stem, not in the options.
- Positive wording. Avoid NOT/EXCEPT; if unavoidable, write it in capitals.
- Never use the pattern "Which term matches this description". Ask the way a teacher would:
  "What is the purpose of…", "A drafter needs to… Which command should they use?", "Why does…".
- Clear, precise high-school vocabulary (grades 9–12). Define any term the lesson did not teach.

Multiple choice
- Exactly 4 options, ONE clearly best answer (unless the teacher asked for select-all).
- Distractors are plausible and come from real student misconceptions or closely related lesson concepts
  of the SAME category (all commands, all units, all materials…). Parallel grammar and similar length.
- No "all of the above", "none of the above", "both A and B", joke answers, or clues such as repeating
  a stem word only in the correct option or making it the longest.

True / False
- One idea per statement, unambiguously true or false according to the lesson. Avoid "always/never"
  unless the lesson says so. False statements must be plausible (a common misconception), not silly.
  Balance true and false across the set.

Fill in the blank
- Blank a key term or value, never a filler word. The sentence must give enough context for one answer.
  List every acceptable spelling/form (singular/plural, abbreviation, with or without units).

Matching
- 4–6 pairs from ONE homogeneous category (all terms with definitions, all tools with uses…).
  Write the meanings in student-friendly language.

Ordering
- Only real sequences from the lesson (steps of a procedure, stages of a process). 3–6 items, each
  written as a short parallel action.

Short answer / essay
- Requires explaining, applying or justifying (DOK 2–3), answerable in 2–4 sentences.
- sample_answer = a model answer containing the 2–3 key points a teacher should look for.

Explanations
- One or two sentences students see after answering: why the right answer is right (and, for multiple
  choice, why the most tempting wrong answer is wrong). Point to the lesson section/slide when possible.

Style
- Professional, concise, encouraging. No emojis, no "In this lesson…" filler, no references to "the PDF".
`;

// Two short exemplars set the bar (style, not content).
const EXAMPLES = `
EXAMPLES OF THE QUALITY EXPECTED (different topic — imitate the style, not the content):
1. multiple_choice (DOK 2)
   prompt: "A drafter needs a second wall line exactly 6 inches inside an exterior wall. Which command creates it most accurately?"
   options: ["OFFSET", "COPY", "MOVE", "EXTEND"], correct: [0]
   explanation: "OFFSET creates a parallel copy at an exact distance. COPY can place a line 6 inches away, but only if every base point is picked perfectly."
2. true_false (DOK 1)
   prompt: "Objects drawn on a frozen layer are hidden and ignored when AutoCAD regenerates the drawing.", answer: true
3. short_answer (DOK 3)
   prompt: "A classmate drew every wall, door and dimension on layer 0. Explain two problems this causes when the plan is revised or printed."
   sample_answer: "Nothing can be hidden, locked or printed by category, so editing one system means picking objects one by one. All lines print with the same color and lineweight, so walls do not stand out from dimensions."
`;

const TYPE_HELP: Record<QType, string> = {
  true_false: 'true_false — "prompt" is the statement; "answer" is true or false.',
  multiple_choice: 'multiple_choice — "prompt" is the stem; exactly 4 "options"; "correct" holds the 0-based index of the right option (more than one only for select-all).',
  ordering: 'ordering — "prompt" says what to put in order; "items" are 3–6 steps IN THE CORRECT ORDER (students see them shuffled).',
  short_answer: 'short_answer — "prompt" is the open question; "sample_answer" is the model answer with the key points.',
  fill_blank: 'fill_blank — "prompt" is one sentence with each missing word written as ___ ; "blanks" has one list per ___ with every acceptable answer.',
  matching: 'matching — "prompt" is the instruction; "pairs" are 4–6 {left, right} pairs from one category.',
};

// ---------------------------------------------------------------------------- schemas
const QUESTION = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['true_false', 'multiple_choice', 'ordering', 'short_answer', 'fill_blank', 'matching'] },
    concept: { type: 'string', description: 'The lesson concept or skill this question assesses' },
    dok: { type: 'integer', description: 'Depth of Knowledge level 1, 2 or 3' },
    prompt: { type: 'string' },
    options: { type: 'array', items: { type: 'string' } },
    correct: { type: 'array', items: { type: 'integer' } },
    answer: { type: 'boolean' },
    items: { type: 'array', items: { type: 'string' } },
    pairs: { type: 'array', items: { type: 'object', properties: { left: { type: 'string' }, right: { type: 'string' } }, required: ['left', 'right'], additionalProperties: false } },
    blanks: { type: 'array', items: { type: 'array', items: { type: 'string' } } },
    sample_answer: { type: 'string' },
    explanation: { type: 'string' },
    evidence: { type: 'string', description: '8–30 consecutive words copied EXACTLY from the lesson text that prove the keyed answer' },
    source: { type: 'string', description: 'Passage id from the teaching core, e.g. "P3" (or "file" if it came from a figure, table or slide)' },
  },
  required: ['type', 'concept', 'dok', 'prompt', 'options', 'correct', 'answer', 'items', 'pairs', 'blanks', 'sample_answer', 'explanation', 'evidence', 'source'],
  additionalProperties: false,
};

const WRITER_SCHEMA = {
  type: 'object',
  properties: {
    analysis: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'Short, student-facing name of the lesson topic' },
        key_concepts: { type: 'array', items: { type: 'string' }, description: 'The 4–10 most important ideas students must learn' },
        vocabulary: { type: 'array', items: { type: 'object', properties: { term: { type: 'string' }, meaning: { type: 'string' } }, required: ['term', 'meaning'], additionalProperties: false } },
        procedures: { type: 'array', items: { type: 'string' }, description: 'Step-by-step procedures taught, each summarized in one line' },
        misconceptions: { type: 'array', items: { type: 'string' }, description: 'Likely student mistakes or confusions about this content' },
        teacher_only: { type: 'array', items: { type: 'string' }, description: 'Material in the file that is for the teacher and must NOT be assessed (pacing, standards, materials…)' },
      },
      required: ['topic', 'key_concepts', 'vocabulary', 'procedures', 'misconceptions', 'teacher_only'],
      additionalProperties: false,
    },
    questions: { type: 'array', items: QUESTION },
  },
  required: ['analysis', 'questions'],
  additionalProperties: false,
};

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    reviews: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: { type: 'integer' },
          score: { type: 'integer', description: '1–5 against the standards; 5 = publishable as is' },
          issues: { type: 'string' },
        },
        required: ['index', 'score', 'issues'],
        additionalProperties: false,
      },
    },
    questions: { type: 'array', items: QUESTION, description: 'The final, corrected set — same count and types as requested' },
  },
  required: ['reviews', 'questions'],
  additionalProperties: false,
};

export const LANG: Record<string, string> = {
  en: 'English',
  es: 'Spanish (Latin American, academic school register)',
  both: 'English, followed by a Spanish translation in parentheses in each prompt, option and item',
};

export type Raw = RawQuestion & { concept?: string; dok?: number; evidence?: string; source?: string };

export function lessonBlocks(src: Source, prep: Prepared, pages: string): Anthropic.ContentBlockParam[] {
  const out: Anthropic.ContentBlockParam[] = [];
  const core = coreForPrompt(prep);
  if (src.binary?.mime === 'application/pdf') {
    out.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: Buffer.from(src.binary.data).toString('base64') }, title: src.title.slice(0, 200) });
  } else if (src.binary && /^image\/(png|jpe?g|gif|webp)$/.test(src.binary.mime)) {
    out.push({ type: 'image', source: { type: 'base64', media_type: src.binary.mime.replace('jpg', 'jpeg') as 'image/png', data: Buffer.from(src.binary.data).toString('base64') } });
  }
  const isPdf = src.binary?.mime === 'application/pdf' && src.text.length > 200;
  if (src.text && !isPdf) {
    out.push({ type: 'text', text: `<lesson title="${src.title.replace(/"/g, "'")}">\n${(prep.cleanText || src.text).slice(0, 60_000)}\n</lesson>` });
  }
  if (prep.core.length) {
    out.push({ type: 'text', text: [
      `<teaching_core strength="${prep.strong ? 'strong' : 'thin'}"${pages ? ` pages="${pages}"` : ''}>`,
      'NEXORA cleaned this lesson and ranked its paragraphs by how much they teach. These are the passages that carry the concepts:',
      core.slice(0, 16_000),
      '</teaching_core>',
      prep.removed && Object.keys(prep.removed).length ? `<ignored>Already removed as non-teaching material: ${removedSummary(prep)}. Never write questions about these.</ignored>` : '',
    ].filter(Boolean).join('\n') });
  }
  return out;
}

/** Which questions' evidence can't be found in the lesson. */
function unverified(qs: Raw[], prep: Prepared) {
  return qs.map((q, i) => (findEvidence(q.evidence, prep) ? -1 : i)).filter((i) => i >= 0);
}

export async function call(client: Anthropic, content: Anthropic.ContentBlockParam[], schema: object, timeout: number, system: string, maxTokens = 12_000) {
  try {
    const res = await client.messages.create({
      model: MODEL(),
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content }],
      output_config: { format: { type: 'json_schema', schema: schema as Record<string, unknown> } },
    }, { timeout });
    const text = res.content.find((b) => b.type === 'text');
    if (!text || text.type !== 'text') throw new Error('No answer from the AI engine.');
    return JSON.parse(text.text);
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) throw new AiKeyError(String((e as Error).message));
    throw e;
  }
}

export async function aiGenerate(src: Source, counts: Counts, kind: CheckKind, opts: { language: string; level: string; focus: string; pages?: string }, prep: Prepared):
  Promise<{ questions: Raw[]; topic: string; reviewed: boolean }> {
  const started = Date.now();
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 1 });
  const wanted = (Object.entries(counts) as [QType, number][]).filter(([, n]) => n > 0);
  const total = wanted.reduce((s, [, n]) => s + n, 0);
  const spec = wanted.map(([t, n]) => `${n} × ${t}`).join(', ');

  const purpose = kind === 'do_now'
    ? 'a DO NOW: a 5-minute bell-ringer at the start of class. Activate prior knowledge and preview this lesson\'s key ideas. Mostly DOK 1–2, with at least one question connecting the topic to a real-world or career situation. Avoid details students cannot know before the lesson unless they review earlier learning.'
    : kind === 'exit_ticket'
      ? 'an EXIT TICKET: a 5-minute check at the end of class showing whether each student mastered today\'s most important ideas and skills. At least half the questions at DOK 2 or higher, including one that asks students to apply or explain.'
      : 'a short QUIZ covering the main ideas of the lesson fairly, with a mix of DOK 1, 2 and 3.';

  const grounding = [
    'SOURCE RULES (most important):',
    prep.strong
      ? '- Build every question from the passages in <teaching_core>. They hold the lesson\'s concepts and theory. The rest of the file (title pages, tables of contents, indexes, headings, headers/footers, page numbers, references, teacher notes, review questions) is NOT content.'
      : '- This file has little explanatory text (likely a worksheet or slides). Use the whole lesson — text, tables, figures and slides — but never the title page, table of contents, index, headers/footers, page numbers, references or teacher notes.',
    '- A heading tells you a topic exists; it is never enough to write a question. The question must be answerable from a paragraph that explains the idea.',
    kind === 'do_now'
      ? '- DO NOW: pick the lesson\'s central idea from the strongest passages; ask students to recall related prior knowledge, predict, or connect it to a real situation, so the question previews today\'s concept.'
      : kind === 'exit_ticket'
        ? '- EXIT TICKET: target the most important concepts the strongest passages teach today; ask students to apply, explain or distinguish them, not to recall a heading or a single word.'
        : '- QUIZ: cover the teaching core evenly — one concept per question, spread across the passages.',
    '- For EVERY question fill "evidence" with 8–30 consecutive words copied exactly (verbatim) from the lesson that prove the keyed answer, and "source" with the passage id (P1, P2…) or "file". NEXORA checks every quote against the lesson; questions whose quote is not found are rejected.',
    opts.pages ? `- The teacher asked to use only page(s) ${opts.pages} of the file.` : '',
  ].filter(Boolean).join('\n');

  const system = `You are a senior assessment writer for high-school Career & Technical Education (architecture, construction, engineering, design). You write professional, accurate, standards-quality classroom assessment items. ${RUBRIC}`;

  // ---- 1. writer
  const writerTask = [
    `Read the lesson carefully — every page, table, diagram and slide. First fill "analysis", then write ${purpose}`,
    grounding,
    `Write exactly ${total} questions in this order: ${spec}. No other types, no extra questions.`,
    'Field rules:', ...wanted.map(([t]) => `- ${TYPE_HELP[t]}`),
    'For every question fill unused fields with empty values ("" for strings, [] for arrays, false for "answer").',
    `Reading level: ${opts.level}. Language: ${LANG[opts.language] ?? 'English'}.`,
    opts.focus ? `The teacher wants this check to focus on: ${opts.focus}` : '',
    EXAMPLES,
  ].filter(Boolean).join('\n');
  const blocks = lessonBlocks(src, prep, opts.pages ?? '');
  const draft = await call(client, [...blocks, { type: 'text', text: writerTask }], WRITER_SCHEMA, 75_000, system) as
    { analysis: { topic: string; teacher_only: string[]; key_concepts: string[]; misconceptions: string[] }; questions: Raw[] };
  const topic = draft.analysis?.topic || src.title;

  // ---- 2. reviewer (only if there is time left)
  const left = BUDGET_MS - (Date.now() - started);
  if (left < 25_000 || !draft.questions?.length) return { questions: draft.questions ?? [], topic, reviewed: false };
  const bad = unverified(draft.questions, prep);
  const reviewTask = [
    'You are now the REVIEWING EDITOR. Check each draft question below against the lesson and the standards.',
    'For each one: verify the keyed answer is correct per the lesson; check it assesses an important student-facing concept (not teacher-only material);',
    'check stem clarity, distractor quality and parallelism, DOK level, grade-level vocabulary, and that it does not give away another question.',
    'Score each 1–5 in "reviews" (index = position in the draft, starting at 0) and name the issues briefly.',
    `Then return "questions": the FINAL set — exactly ${total} questions in this order: ${spec}. Keep questions that scored 5,`,
    'rewrite anything scoring 4 or lower, and replace any question that is inaccurate, trivial or about teacher-only material with a better one on a key concept.',
    grounding,
    bad.length ? `NEXORA could NOT find the evidence quote of draft question(s) ${bad.join(', ')} in the lesson. Rewrite or replace each of them so it is grounded in a teaching passage, with an exact quote.` : 'Every draft evidence quote was found in the lesson; keep each question\'s evidence accurate if you rewrite it.',
    `Teacher-only material identified earlier (never assess it): ${JSON.stringify(draft.analysis?.teacher_only ?? []).slice(0, 1500)}`,
    `Key concepts: ${JSON.stringify(draft.analysis?.key_concepts ?? []).slice(0, 1500)}`,
    `Likely misconceptions (good distractors): ${JSON.stringify(draft.analysis?.misconceptions ?? []).slice(0, 1500)}`,
    `Purpose: ${purpose}`,
    `Language: ${LANG[opts.language] ?? 'English'}.`,
    `DRAFT QUESTIONS:\n${JSON.stringify(draft.questions)}`,
  ].join('\n');
  try {
    const final = await call(client, [...blocks, { type: 'text', text: reviewTask }], REVIEW_SCHEMA, Math.min(70_000, left - 3_000), system) as
      { reviews: { index: number; score: number; issues: string }[]; questions: Raw[] };
    if (final.questions?.length >= Math.min(total, draft.questions.length)) return { questions: final.questions, topic, reviewed: true };
  } catch (e) {
    if (e instanceof AiKeyError) throw e;
    console.error('AI reviewer skipped:', (e as Error).message);
  }
  return { questions: draft.questions, topic, reviewed: false };
}

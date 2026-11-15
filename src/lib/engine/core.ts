/**
 * Lesson cleaner + teaching-core finder. Runs before any question is written (AI or built-in).
 *
 * Real lesson files are full of things that are not teaching: title pages, tables of contents with
 * dot leaders, indexes ("object snaps, 5–6"), running headers and footers, page numbers, copyright
 * lines, reference lists, teacher pacing notes and review questions. The actual concepts sit in a
 * handful of paragraphs. This module:
 *   1. removes the non-teaching material (and reports what it removed),
 *   2. rebuilds real paragraphs from PDF line-wraps, keeping each one's page and section heading,
 *   3. ranks every paragraph by how much it teaches — definitions, explanations (cause/effect),
 *      procedures, examples, comparisons — plus how central it is to the document (TF-IDF keywords
 *      and a TextRank similarity graph),
 *   4. returns the top passages as the "teaching core" that questions must come from,
 *   5. verifies that a question's evidence quote really appears in that core.
 */

export interface Passage { id: string; page: number | null; heading: string | null; text: string; score: number; kind: 'definition' | 'explanation' | 'procedure' | 'example' | 'text' }
export interface Prepared {
  passages: Passage[];        // every teaching paragraph, in document order
  core: Passage[];            // the best ones (document order), what questions must come from
  cleanText: string;          // headings + kept paragraphs, for the built-in writer
  removed: Record<string, number>;
  pageCount: number;
  /** True when the file has real explanatory text (a reading, notes, a textbook) rather than a worksheet or slides. */
  strong: boolean;
  /** Normalised full text, for checking evidence in files with little explanatory text. */
  all: string;
}

const STOP = new Set(('a an the and or but if then than that this these those there their they them it its is are was were be been being to of in on at by for with from as into about over under between through during before after above below up down out off again once here when where why how all any both each few more most other some such no nor not only own same so too very can will just should now you your we our he she his her i me my do does did have has had also may might must would could use used using one two three new like get make made see which what who whom while because therefore however so-called called example').split(' '));

// Teacher-guide / admin material — never teaching content for students.
const TEACHER_ONLY = /\b(pacing|\d+[-\s]?minute (class )?periods?|class periods?|block schedule|lesson (plan|overview)|TEKS|NGSS|CCSS|standards?:|materials? (list|needed)|supplies|prep time|prerequisites?|teacher (notes?|guide|tip)|answer key|grading|rubric|differentiation|accommodations?|ELL support|extension activity)\b/i;
const COPYRIGHT = /(©|\(c\)\s*\d{4}|copyright|all rights reserved|isbn|printed in)/i;
const PAGE_NO = /^(page|p\.|pg\.?)?\s*\d{1,4}(\s*(of|\/)\s*\d{1,4})?$/i;
const DOT_LEADER = /(\.{4,}|…{2,}|(\s\.){3,}|_{4,})\s*\d{1,4}\s*$/;
const TOC_HEAD = /^(table of )?contents$|^contents at a glance$/i;
const INDEX_HEAD = /^(index|subject index)$/i;
const REF_HEAD = /^(references|bibliography|works cited|sources|credits|image credits|further reading)$/i;
const TEACHER_HEAD = /^(teacher('s)? (notes?|guide|page)|notes? (for|to) (the )?teacher|lesson (plan|overview)|pacing( guide)?|answer key)/i;
const REVIEW_HEAD = /^(check your understanding|review questions?|questions|discussion questions?|quiz|self[- ]check|exercises?|practice problems?)$/i;
const GLOSSARY_HEAD = /^(glossary|key terms|vocabulary|key vocabulary|terms to know)\b/i;
const INDEX_LINE = /^[A-Za-z][^.!?]{1,80},\s*\d{1,4}(\s*[-–]\s*\d{1,4})?(\s*,\s*\d{1,4}(\s*[-–]\s*\d{1,4})?)*\.?$/;
const NUM_HEAD = /^(\d+(\.\d+){0,3}|[IVX]+\.|chapter \d+|unit \d+|lesson \d+|section \d+|part \d+)\b/i;

const SIGNALS: [Passage['kind'], RegExp, number][] = [
  ['definition', /\b(is (a|an|the) [a-z]+|are [a-z]+ (that|which)|refers? to|means|is defined as|is called|are called|known as|consists? of|is made (up )?of|stands for)\b/i, 1.3],
  ['explanation', /\b(because|therefore|so that|as a result|which (means|allows|prevents|causes)|this (means|allows|prevents|ensures)|in order to|the reason|results? in|leads? to|depends? on|if .{3,60}, (then )?)\b/i, 1.1],
  ['procedure', /\b(first|then|next|finally|step \d|after that|to (draw|create|make|set|start|open) .{2,40}, )\b/i, 0.6],
  ['example', /\b(for example|for instance|such as|e\.g\.|like a|imagine|suppose)\b/i, 0.5],
  ['explanation', /\b(unlike|whereas|compared (to|with)|in contrast|the difference|both .{2,40} and|instead of)\b/i, 0.5],
];

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9@<]+/g, ' ').trim();
const toks = (s: string) => norm(s).split(' ').filter(Boolean);
const lineKey = (l: string) => l.toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ').trim();
const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;
const isHeadingLike = (l: string) => {
  const w = wordCount(l);
  if (w === 0 || w > 12 || /[.!?;,]$/.test(l)) return false;
  if (NUM_HEAD.test(l)) return true;
  const letters = l.replace(/[^A-Za-z]/g, '');
  if (letters && letters.replace(/[^A-Z]/g, '').length / letters.length > 0.6) return true;      // ALL CAPS
  const caps = l.split(/\s+/).filter((x) => /^[A-Z]/.test(x)).length;
  return caps / w >= 0.6 || w <= 3;                                                              // Title Case or a short label
};

/** Parse "3-6, 9" → {3,4,5,6,9}. */
export function parsePages(s: string | null | undefined): Set<number> | null {
  if (!s || !s.trim()) return null;
  const out = new Set<number>();
  for (const part of s.split(/[,;\s]+/)) {
    const m = part.match(/^(\d{1,4})(?:\s*[-–]\s*(\d{1,4}))?$/);
    if (!m) continue;
    const a = Number(m[1]), b = Number(m[2] ?? m[1]);
    for (let p = Math.min(a, b); p <= Math.max(a, b) && out.size < 500; p++) out.add(p);
  }
  return out.size ? out : null;
}

export function prepareLesson(text: string, opts: { pages?: Set<number> | null } = {}): Prepared {
  const removed: Record<string, number> = {};
  const drop = (k: string, n = 1) => { removed[k] = (removed[k] ?? 0) + n; };
  const pages = text.replace(/\r/g, '').split('\f');
  const pageLines = pages.map((p) => p.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean));

  // ---- 1. Running headers/footers: the same line (digits ignored) on many pages.
  const seenOn = new Map<string, number>();
  pageLines.forEach((ls) => new Set(ls.map(lineKey)).forEach((k) => seenOn.set(k, (seenOn.get(k) ?? 0) + 1)));
  const repeatMin = pages.length >= 3 ? Math.max(2, Math.ceil(pages.length * 0.4)) : Infinity;
  const repeated = new Set([...seenOn].filter(([k, n]) => n >= repeatMin && k.length > 2 && wordCount(k) <= 20).map(([k]) => k));

  // ---- 2. Walk every line, removing non-teaching material and rebuilding paragraphs.
  type Block = { page: number; heading: string | null; lines: string[]; glossary: boolean };
  const blocks: Block[] = [];
  let heading: string | null = null;
  let mode: 'normal' | 'toc' | 'index' | 'refs' | 'teacher' | 'review' | 'glossary' = 'normal';
  let cur: Block | null = null;
  const flush = () => { if (cur && cur.lines.length) blocks.push(cur); cur = null; };

  pageLines.forEach((ls, pi) => {
    const pageNo = pi + 1;
    const maxLen = Math.max(40, ...ls.map((l) => l.length));
    if (mode === 'refs' || mode === 'index') mode = mode === 'index' && ls.some((l) => INDEX_LINE.test(l)) ? 'index' : 'normal';
    flush();
    ls.forEach((raw, li) => {
      let l = raw;
      if (repeated.has(lineKey(l))) { drop('headers'); return; }
      if (PAGE_NO.test(l)) { drop('page_numbers'); return; }
      if (COPYRIGHT.test(l) && wordCount(l) < 30) { drop('copyright'); return; }
      if (/https?:\/\/|www\./i.test(l) && wordCount(l) < 25) { drop('links'); return; }
      l = l.replace(/^[•\-*–▪◦●]\s*/, '');

      if (TOC_HEAD.test(l)) { flush(); mode = 'toc'; drop('toc'); return; }
      if (INDEX_HEAD.test(l)) { flush(); mode = 'index'; drop('index'); return; }
      if (REF_HEAD.test(l)) { flush(); mode = 'refs'; drop('references'); return; }
      if (TEACHER_HEAD.test(l)) { flush(); mode = 'teacher'; drop('teacher_notes'); return; }
      if (REVIEW_HEAD.test(l)) { flush(); mode = 'review'; drop('review_questions'); return; }
      if (DOT_LEADER.test(l)) { drop('toc'); return; }
      if (mode === 'toc') { if (/\d{1,4}\s*$/.test(l) && wordCount(l) <= 14) { drop('toc'); return; } mode = 'normal'; }
      if (mode === 'index') { if (INDEX_LINE.test(l) || (wordCount(l) <= 4 && !/[.!?]$/.test(l))) { drop('index'); return; } mode = 'normal'; }
      if (mode === 'refs') { drop('references'); return; }
      if (INDEX_LINE.test(l) && wordCount(l) <= 8) { drop('index'); return; }

      // Headings close the paragraph and set the section; teacher/review sections end at the next heading.
      const nextLine = ls[li + 1] ?? '';
      if (isHeadingLike(l) && !(cur && !/[.!?:]$/.test(cur.lines[cur.lines.length - 1]) && /^[a-z]/.test(l))) {
        flush();
        if (GLOSSARY_HEAD.test(l)) { mode = 'glossary'; heading = l; drop('headings'); return; }
        if (mode === 'teacher' || mode === 'review' || mode === 'glossary') mode = 'normal';
        // A lone short label right before a paragraph is a heading; a list of single words is a fragment list.
        if (wordCount(l) <= 2 && !NUM_HEAD.test(l) && isHeadingLike(nextLine) && wordCount(nextLine) <= 2) { drop('fragments'); return; }
        heading = l.replace(/[:\s]+$/, '');
        drop('headings');
        return;
      }
      if (mode === 'teacher' || TEACHER_ONLY.test(l)) { drop('teacher_notes'); if (TEACHER_ONLY.test(l) && mode === 'normal') { /* single line */ } return; }
      if (mode === 'review') { drop('review_questions'); return; }
      if (/^key terms?:?$|^vocabulary:?$/i.test(l)) { drop('fragments'); return; }

      // Glossary lines ("Term: meaning") are each their own definition.
      if (mode === 'glossary' || /^[A-Z][\w\s()\-/’']{1,40}:\s+\S.{8,}/.test(l)) {
        flush(); blocks.push({ page: pageNo, heading, lines: [l], glossary: true }); return;
      }
      if (!cur) cur = { page: pageNo, heading, lines: [], glossary: false };
      cur.lines.push(l);
      // A short line that ends a sentence usually ends the paragraph (PDF line wraps fill the width).
      if (/[.!?]["”)]?$/.test(l) && l.length < maxLen * 0.8) flush();
    });
  });
  flush();

  // ---- 3. Paragraphs → passages (skip fragments and question lists).
  let passages: Passage[] = blocks.map((b, i) => {
    const text = b.lines.join(' ').replace(/\s+/g, ' ').replace(/(\w)- (\w)/g, '$1$2').trim();
    return { id: `P${i + 1}`, page: pages.length > 1 ? b.page : null, heading: b.heading, text, score: 0, kind: b.glossary ? 'definition' as const : 'text' as const };
  }).filter((p) => {
    const w = wordCount(p.text);
    const qs = (p.text.match(/\?/g) ?? []).length;
    if (qs >= 2 && qs >= (p.text.match(/[.!]/g) ?? []).length) { drop('review_questions'); return false; }
    if (w < (p.kind === 'definition' ? 4 : 9)) { drop('fragments'); return false; }
    return true;
  });
  if (opts.pages) passages = passages.filter((p) => p.page == null || opts.pages!.has(p.page));
  passages.forEach((p, i) => { p.id = `P${i + 1}`; });

  // ---- 4. Score: teaching signals + TF-IDF keyword centrality + TextRank.
  const docs = passages.map((p) => toks(p.text).filter((w) => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w)));
  const df = new Map<string, number>();
  docs.forEach((d) => new Set(d).forEach((w) => df.set(w, (df.get(w) ?? 0) + 1)));
  const N = Math.max(1, docs.length);
  const vecs = docs.map((d) => {
    const tf = new Map<string, number>();
    d.forEach((w) => tf.set(w, (tf.get(w) ?? 0) + 1));
    const v = new Map<string, number>();
    tf.forEach((n, w) => v.set(w, (1 + Math.log(n)) * Math.log(1 + N / (df.get(w) ?? 1))));
    return v;
  });
  // Document keywords: frequent across the lesson, plus words used in section headings.
  const headingWords = new Set(passages.flatMap((p) => toks(p.heading ?? '')).filter((w) => w.length > 2 && !STOP.has(w)));
  const total = new Map<string, number>();
  docs.forEach((d) => d.forEach((w) => total.set(w, (total.get(w) ?? 0) + 1)));
  const keywords = new Set([...total].filter(([w, n]) => n >= 2 || headingWords.has(w)).sort((a, b) => b[1] - a[1]).slice(0, 18).map(([w]) => w));
  const cos = (a: Map<string, number>, b: Map<string, number>) => {
    let dot = 0, na = 0, nb = 0;
    a.forEach((x, w) => { na += x * x; const y = b.get(w); if (y) dot += x * y; });
    b.forEach((y) => { nb += y * y; });
    return na && nb ? dot / Math.sqrt(na * nb) : 0;
  };
  // TextRank (PageRank over the similarity graph).
  const sim = vecs.map((a, i) => vecs.map((b, j) => (i === j ? 0 : cos(a, b))));
  let rank = vecs.map(() => 1 / N);
  for (let it = 0; it < 25; it++) {
    rank = rank.map((_, i) => 0.15 / N + 0.85 * sim.reduce((s, row, j) => {
      const out = row.reduce((x, y) => x + y, 0);
      return out ? s + (row[i] / out) * rank[j] : s;
    }, 0));
  }
  const maxRank = Math.max(...rank, 1e-9);

  passages.forEach((p, i) => {
    const w = wordCount(p.text);
    let s = Math.min(w, 110) / 110;                                              // enough substance
    if (w > 320) s -= 0.4;
    let best: Passage['kind'] = p.kind, bestW = 0;
    for (const [kind, re, weight] of SIGNALS) if (re.test(p.text)) { s += weight; if (weight > bestW && p.kind !== 'definition') { best = kind; bestW = weight; } }
    p.kind = best;
    const kw = new Set(docs[i].filter((x) => keywords.has(x))).size;
    s += Math.min(kw, 6) * 0.18;                                                 // talks about the lesson's main terms
    s += (rank[i] / maxRank) * 1.0;                                              // central to the document
    if (p.heading && toks(p.heading).some((x) => docs[i].includes(x))) s += 0.2; // matches its section
    const digits = (p.text.match(/\d/g) ?? []).length / Math.max(1, p.text.length);
    if (digits > 0.15) s -= 1;
    if (/^(click|type|press|open|select|go to|draw|complete|answer|read|write)\b/i.test(p.text) && !/\b(because|so that|which)\b/i.test(p.text)) s -= 0.3;
    p.score = Math.round(s * 100) / 100;
  });

  // ---- 5. Teaching core: the strongest passages (kept in reading order), within a size budget.
  const sorted = [...passages].sort((a, b) => b.score - a.score);
  const top = sorted[0]?.score ?? 0;
  const core: Passage[] = [];
  let chars = 0;
  for (const p of sorted) {
    if (core.length >= 16 || chars > 12_000) break;
    if (p.score < top * 0.45 && core.length >= 3) break;
    core.push(p); chars += p.text.length;
  }
  core.sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));

  const cleanText = passages.map((p) => (p.kind === 'definition' && !p.text.includes(':') && p.heading ? `${p.heading}: ${p.text}` : p.text)).join('\n\n');
  const strongOnes = core.filter((p) => p.score >= 2.5 && wordCount(p.text) >= 25);
  const strong = strongOnes.length >= 2 && strongOnes.reduce((n, p) => n + wordCount(p.text), 0) >= 120;
  return { passages, core, cleanText, removed, pageCount: pages.length, strong, all: toks(text).join(' ') };
}

/** The teaching core as the AI sees it: numbered passages with page and section. */
export function coreForPrompt(prep: Prepared) {
  return prep.core.map((p) => `[${p.id}${p.page ? ` · page ${p.page}` : ''}${p.heading ? ` · ${p.heading}` : ''}]\n${p.text}`).join('\n\n');
}

export function removedSummary(prep: Prepared) {
  const labels: Record<string, string> = { toc: 'table of contents', index: 'index', headers: 'running headers/footers', page_numbers: 'page numbers', copyright: 'copyright lines', references: 'references', teacher_notes: 'teacher notes / pacing / standards', review_questions: 'review questions', headings: 'headings', fragments: 'fragments and labels', links: 'links' };
  return Object.entries(prep.removed).map(([k, n]) => `${labels[k] ?? k} (${n})`).join(', ');
}

/**
 * Does `quote` really appear in the lesson? Exact match after normalising, or a window of the
 * same length where ≥ 85% of the words match in order-insensitive terms. Returns the passage it
 * came from, or null.
 */
export function findEvidence(quote: string | null | undefined, prep: Prepared): Passage | null {
  const q = toks(quote ?? '');
  if (q.length < 4) return null;
  const qn = q.join(' ');
  for (const p of prep.passages) if (toks(p.text).join(' ').includes(qn)) return p;
  // Worksheets and slides: the evidence may sit in a table, a label or a figure caption.
  if (!prep.strong && prep.all.includes(qn)) return { id: 'file', page: null, heading: null, text: quote ?? '', score: 0, kind: 'text' };
  const need = Math.ceil(q.length * 0.85);
  const qset = new Map<string, number>();
  q.forEach((w) => qset.set(w, (qset.get(w) ?? 0) + 1));
  for (const p of prep.passages) {
    const h = toks(p.text);
    if (h.length < q.length * 0.8) continue;
    for (let i = 0; i + Math.min(q.length, h.length) <= h.length; i++) {
      const win = h.slice(i, i + q.length);
      const left = new Map(qset);
      let hit = 0;
      for (const w of win) { const n = left.get(w); if (n) { hit++; left.set(w, n - 1); } }
      if (hit >= need) return p;
    }
  }
  return null;
}

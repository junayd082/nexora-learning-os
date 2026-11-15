/**
 * Cornell notes — the model shared by the editor and the Word / PDF exporters.
 * A notebook ("note") has a header like the classic Word template (name, class, period, date, topic,
 * essential question) and any number of pages. Every page has the three Cornell areas: cues
 * (questions / keywords) on the left, notes on the right, and a summary across the bottom.
 */
export interface CornellPage { id: string; cues: string; notes: string; summary: string }
export interface CornellNote {
  id: string;
  classId: string;
  title: string;          // topic
  date: string;           // YYYY-MM-DD
  name: string;
  className: string;
  period: string;
  question: string;       // essential question (optional)
  font: 'print' | 'hand';
  pages: CornellPage[];
  updatedAt: number;
}

/** Lines per page in the editor and in the downloads (Letter paper, ~7 mm rule). */
export const NOTE_LINES = 22;
export const CUE_SHARE = 0.3; // cue column ≈ 2.5" of 8.5" in the classic layout

export const uid = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);
export const newPage = (): CornellPage => ({ id: uid(), cues: '', notes: '', summary: '' });

export function emptyNote(p: { classId: string; title?: string; date: string; name: string; className: string; period: string }): CornellNote {
  return { id: uid(), classId: p.classId, title: p.title ?? '', date: p.date, name: p.name, className: p.className, period: p.period, question: '', font: 'print', pages: [newPage()], updatedAt: Date.now() };
}

export function normalizeNote(raw: unknown, fallback: CornellNote): CornellNote {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<CornellNote>;
  const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d);
  const pages = Array.isArray(r.pages) && r.pages.length
    ? r.pages.map((pg) => ({ id: str((pg as CornellPage)?.id, uid()), cues: str((pg as CornellPage)?.cues), notes: str((pg as CornellPage)?.notes), summary: str((pg as CornellPage)?.summary) }))
    : [newPage()];
  return {
    id: str(r.id, fallback.id), classId: str(r.classId, fallback.classId), title: str(r.title).slice(0, 200), date: str(r.date, fallback.date),
    name: str(r.name, fallback.name), className: str(r.className, fallback.className), period: str(r.period, fallback.period),
    question: str(r.question), font: r.font === 'hand' ? 'hand' : 'print', pages, updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : Date.now(),
  };
}

export const hasContent = (n: CornellNote) => !!(n.title.trim() || n.question.trim() || n.pages.some((p) => p.cues.trim() || p.notes.trim() || p.summary.trim()));

export function fileBase(n: CornellNote) {
  // Plain characters only: Chrome drops a download's name if it contains e.g. an em dash.
  const safe = (s: string) => s.replace(/[\u2012-\u2015]/g, '-').replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]/g, '')
    .replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim();
  return safe(`Cornell Notes - ${n.title || 'Untitled'} - ${n.date}`).slice(0, 120);
}

export function prettyDate(iso: string, locale = 'en-US') {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(locale, { month: 'long', day: 'numeric', year: 'numeric' });
}

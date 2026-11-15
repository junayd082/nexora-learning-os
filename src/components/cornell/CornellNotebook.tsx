'use client';

import '@fontsource/caveat/500.css';
import '@fontsource/caveat/600.css';
import './cornell.css';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { ArrowLeft, BookOpenCheck, Check, ChevronDown, Cloud, CloudOff, Download, Eye, EyeOff, FileText, FileType2, List, Loader2, NotebookPen, Plus, Trash2, Type } from 'lucide-react';
import { emptyNote, hasContent, newPage, NOTE_LINES, prettyDate, type CornellNote, type CornellPage } from '@/lib/cornell/model';
import { deleteCloud, merge, readCloud, readLocal, writeCloud, writeLocal } from '@/lib/cornell/store';
import { cn } from '@/lib/util';

const SUMMARY_LINES = 4;
const localDay = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/**
 * Cornell notes for one class. A list of the student's notebooks, and the editor: paper with the
 * classic layout (header, questions/keywords | notes, summary) and as many pages as needed. When the
 * notes column of a page is full, the text flows onto the next page by itself. Autosaves; downloads
 * as Word or PDF; “Quiz myself” covers the notes so the cues become a self-test.
 */
export function CornellNotebook({ classId, userId, className, period, name, lessonTitle, locale }: {
  classId: string; userId: string; className: string; period: string; name: string; lessonTitle: string; locale: string;
}) {
  const t = useTranslations('cornell');
  const f = useFormatter();
  const router = useRouter();
  const sp = useSearchParams();
  const here = usePathname();
  const openId = sp.get('n');
  const base = useMemo(() => emptyNote({ classId, date: localDay(), name, className, period, title: '' }), [classId, name, className, period]);
  const [notes, setNotes] = useState<CornellNote[] | null>(null);
  const [cloud, setCloud] = useState<boolean | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const dirty = useRef(new Set<string>());
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  // Load: device first (instant), then merge with the account copy.
  useEffect(() => {
    const local = readLocal(userId, classId, base);
    setNotes(local);
    void readCloud(classId, base).then((remote) => {
      if (remote == null) { setCloud(false); return; }
      setCloud(true);
      setNotes((cur) => {
        const m = merge(cur ?? local, remote);
        writeLocal(userId, classId, m);
        // push device-only notebooks up
        for (const n of m) if (!remote.some((r) => r.id === n.id) && hasContent(n)) void writeCloud(n);
        return m;
      });
    });
  }, [userId, classId]); // eslint-disable-line react-hooks/exhaustive-deps

  const flush = useCallback((list: CornellNote[]) => {
    writeLocal(userId, classId, list);
    const ids = [...dirty.current]; dirty.current.clear();
    if (cloud === false) { setStatus('saved'); return; }
    setStatus('saving');
    void Promise.all(ids.map((id) => { const n = list.find((x) => x.id === id); return n && hasContent(n) ? writeCloud(n) : Promise.resolve(true); }))
      .then((ok) => { if (ok.some((x) => !x)) setCloud(false); setStatus('saved'); });
  }, [userId, classId, cloud]);

  const update = useCallback((id: string, fn: (n: CornellNote) => CornellNote) => {
    setNotes((cur) => {
      if (!cur) return cur;
      const list = cur.map((n) => (n.id === id ? { ...fn(n), updatedAt: Date.now() } : n));
      dirty.current.add(id);
      clearTimeout(timer.current);
      setStatus('saving');
      timer.current = setTimeout(() => flush(list), 700);
      return list;
    });
  }, [flush]);
  // Save immediately when leaving the page.
  const latest = useRef<CornellNote[] | null>(null); latest.current = notes;
  useEffect(() => {
    const out = () => { if (latest.current && dirty.current.size) { clearTimeout(timer.current); flush(latest.current); } };
    addEventListener('pagehide', out);
    return () => { removeEventListener('pagehide', out); out(); };
  }, [flush]);

  const create = () => {
    const n = { ...emptyNote({ classId, date: localDay(), name, className, period, title: lessonTitle }) };
    setNotes((cur) => { const list = [n, ...(cur ?? [])]; writeLocal(userId, classId, list); return list; });
    router.push(`${here}?n=${n.id}`);
  };
  const remove = (id: string) => {
    setNotes((cur) => { const list = (cur ?? []).filter((n) => n.id !== id); writeLocal(userId, classId, list); return list; });
    void deleteCloud(id); setConfirmDel(null);
    if (openId === id) router.push(here);
  };

  if (!notes) return <div className="flex h-60 items-center justify-center text-muted"><Loader2 className="animate-spin" size={20} aria-hidden /></div>;
  const note = openId ? notes.find((n) => n.id === openId) : null;

  // ------------------------------------------------------------------ the list
  if (!note) {
    return (
      <div className="space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <Link href={`/classes/${classId}`} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft size={14} aria-hidden />{t('backClass')}</Link>
            <h1 className="display flex items-center gap-3 text-3xl"><NotebookPen size={28} className="ember-text" aria-hidden />{t('title')}</h1>
            <p className="mt-2 max-w-2xl text-muted">{t('intro', { className })}</p>
          </div>
          <SyncBadge cloud={cloud} status="idle" />
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <button type="button" onClick={create} className="group card flex min-h-[220px] flex-col items-center justify-center gap-3 border-dashed p-6 text-center transition hover:border-ember/60">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ember/15 ember-text transition group-hover:scale-105"><Plus size={26} aria-hidden /></span>
            <span className="text-lg font-semibold">{t('newNote')}</span>
            <span className="text-xs text-muted">{t('newNoteSub')}</span>
          </button>
          {notes.map((n) => (
            <div key={n.id} className="card group relative flex min-h-[220px] flex-col overflow-hidden p-0">
              <Link href={`${here}?n=${n.id}`} className="flex flex-1 flex-col" aria-label={`${t('open')}: ${n.title || t('untitled')}`}>
                <MiniPaper note={n} />
                <div className="border-t border-line px-4 py-3">
                  <div className="truncate font-semibold">{n.title || t('untitled')}</div>
                  <div className="mt-0.5 text-xs text-muted">{prettyDate(n.date, locale)} · {t('pages', { n: n.pages.length })} · {t('edited', { when: f.relativeTime(new Date(n.updatedAt), Date.now()) })}</div>
                </div>
              </Link>
              {confirmDel === n.id ? (
                <div className="absolute inset-x-3 top-3 z-10 rounded-lg border border-bad/40 bg-[rgb(var(--raise))] p-3 text-sm shadow-xl">
                  <p>{t('removeConfirm')}</p>
                  <div className="mt-2 flex justify-end gap-2">
                    <button type="button" className="btn-ghost btn-sm" onClick={() => setConfirmDel(null)}>{t('cancel')}</button>
                    <button type="button" className="btn btn-sm border-bad/50 text-bad" onClick={() => remove(n.id)}><Trash2 size={13} aria-hidden />{t('remove')}</button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmDel(n.id)} aria-label={t('remove')} className="absolute right-2 top-2 rounded-md bg-black/40 p-1.5 text-white/80 opacity-0 transition hover:text-white group-hover:opacity-100 focus:opacity-100"><Trash2 size={14} aria-hidden /></button>
              )}
            </div>
          ))}
        </div>

        <section className="card max-w-3xl p-6">
          <h2 className="mb-3 flex items-center gap-2 font-semibold"><BookOpenCheck size={17} className="ember-text" aria-hidden />{t('how')}</h2>
          <ol className="space-y-2 text-sm text-muted">
            {(['how1', 'how2', 'how3', 'how4'] as const).map((k, i) => <li key={k} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ember/15 font-mono text-xs ember-text">{i + 1}</span><span className="pt-0.5">{t(k)}</span></li>)}
          </ol>
        </section>
      </div>
    );
  }

  return <Editor key={note.id} note={note} cloud={cloud} status={status} locale={locale} onChange={(fn) => update(note.id, fn)} onBack={() => router.push(here)} />;
}

// ---------------------------------------------------------------------------------------------- editor
function Editor({ note, cloud, status, locale, onChange, onBack }: {
  note: CornellNote; cloud: boolean | null; status: 'idle' | 'saving' | 'saved'; locale: string;
  onChange: (fn: (n: CornellNote) => CornellNote) => void; onBack: () => void;
}) {
  const t = useTranslations('cornell');
  const [quiz, setQuiz] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState<'' | 'pdf' | 'docx'>('');
  const [full, setFull] = useState<Record<string, number>>({});
  const focusNext = useRef<{ id: string; at: number } | null>(null);
  const mirror = useRef<HTMLTextAreaElement | null>(null);
  const refs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  const setField = <K extends keyof CornellNote>(k: K, v: CornellNote[K]) => onChange((n) => ({ ...n, [k]: v }));
  const setPage = (id: string, patch: Partial<CornellPage>) => onChange((n) => ({ ...n, pages: n.pages.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
  const addPage = (after?: string, notes = '') => {
    const pg = { ...newPage(), notes };
    onChange((n) => {
      const i = after ? n.pages.findIndex((p) => p.id === after) : n.pages.length - 1;
      const pages = [...n.pages]; pages.splice(i + 1, 0, pg); return { ...n, pages };
    });
    return pg.id;
  };
  const delPage = (id: string) => onChange((n) => (n.pages.length > 1 ? { ...n, pages: n.pages.filter((p) => p.id !== id) } : n));

  // Overflow → the rest of the notes continue on the next page (like a real notebook).
  const fits = (el: HTMLTextAreaElement, text: string) => {
    let m = mirror.current;
    if (!m) { m = document.createElement('textarea'); m.setAttribute('aria-hidden', 'true'); m.tabIndex = -1; document.body.appendChild(m); mirror.current = m; }
    const cs = getComputedStyle(el);
    Object.assign(m.style, { position: 'fixed', left: '-9999px', top: '0', visibility: 'hidden', height: '0px', width: `${el.clientWidth}px`, font: cs.font, lineHeight: cs.lineHeight,
      padding: cs.padding, letterSpacing: cs.letterSpacing, boxSizing: 'border-box', border: '0', whiteSpace: 'pre-wrap', overflowWrap: 'break-word', wordBreak: cs.wordBreak });
    m.value = text;
    return m.scrollHeight <= el.clientHeight + 1;
  };
  useEffect(() => () => { mirror.current?.remove(); }, []);
  const onNotes = (pg: CornellPage, idx: number, el: HTMLTextAreaElement, value: string) => {
    if (fits(el, value)) { setPage(pg.id, { notes: value }); if (full[pg.id]) setFull((s) => { const c = { ...s }; delete c[pg.id]; return c; }); return; }
    // find the longest head that fits, cut at a line or word break
    let lo = 0, hi = value.length;
    while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (fits(el, value.slice(0, mid))) lo = mid; else hi = mid - 1; }
    let cut = Math.max(value.lastIndexOf('\n', lo), value.lastIndexOf(' ', lo));
    if (cut <= 0) cut = lo;
    const head = value.slice(0, cut).replace(/\s+$/, '');
    const tail = value.slice(cut).replace(/^[ \n]/, '');
    const nextPg = note.pages[idx + 1];
    if (nextPg && !nextPg.notes.trim()) {
      onChange((n) => ({ ...n, pages: n.pages.map((p) => (p.id === pg.id ? { ...p, notes: head } : p.id === nextPg.id ? { ...p, notes: tail } : p)) }));
      focusNext.current = { id: nextPg.id, at: tail.length };
    } else {
      setPage(pg.id, { notes: head });
      const nid = addPage(pg.id, tail);
      focusNext.current = { id: nid, at: tail.length };
    }
    setFull((s) => ({ ...s, [pg.id]: idx + 2 }));
  };
  useLayoutEffect(() => {
    const f = focusNext.current; if (!f) return;
    const el = refs.current[f.id];
    if (el) { focusNext.current = null; el.focus(); el.setSelectionRange(f.at, f.at); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  });

  // Bullets continue on Enter, like Word.
  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    const el = e.currentTarget; const pos = el.selectionStart;
    const lineStart = el.value.lastIndexOf('\n', pos - 1) + 1;
    const line = el.value.slice(lineStart, pos);
    const m = line.match(/^(\s*)([•\-*]|\d+[.)])\s+/);
    if (!m) return;
    e.preventDefault();
    if (line.trim() === m[0].trim()) { // empty bullet → end the list
      const v = el.value.slice(0, lineStart) + el.value.slice(pos);
      setNative(el, v, lineStart); return;
    }
    const num = m[2].match(/^(\d+)([.)])$/);
    const marker = num ? `${Number(num[1]) + 1}${num[2]}` : m[2];
    const ins = `\n${m[1]}${marker} `;
    setNative(el, el.value.slice(0, pos) + ins + el.value.slice(el.selectionEnd), pos + ins.length);
  };
  const insertBullet = () => {
    const el = document.activeElement as HTMLTextAreaElement | null;
    if (!el || el.tagName !== 'TEXTAREA' || !el.closest('.cn-paper')) return;
    const pos = el.selectionStart; const lineStart = el.value.lastIndexOf('\n', pos - 1) + 1;
    if (el.value.slice(lineStart).startsWith('• ')) return;
    setNative(el, el.value.slice(0, lineStart) + '• ' + el.value.slice(lineStart), pos + 2);
  };
  // Write through the input event so React state and auto-flow stay in charge.
  const setNative = (el: HTMLTextAreaElement, v: string, caret: number) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
    setter.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true }));
    requestAnimationFrame(() => { try { el.setSelectionRange(caret, caret); } catch { /* */ } });
  };

  const labels = useMemo(() => ({
    heading: t('heading'), name: t('name'), class: t('class'), period: t('period'), date: t('date'), topic: t('topic'), question: t('question'),
    cues: t('cues'), notes: t('notes'), summary: t('summary'), page: t('page'), of: t('of'), continued: t('continued'), untitled: t('untitled'),
  }), [t]);
  const download = async (kind: 'pdf' | 'docx') => {
    setMenu(false); setBusy(kind);
    try {
      const ex = await import('@/lib/cornell/export');
      if (kind === 'pdf') await ex.downloadPdf(note, labels, locale); else await ex.downloadDocx(note, labels, locale);
    } finally { setBusy(''); }
  };
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => { if (!(e.target as Element).closest?.('[data-dl]')) setMenu(false); };
    document.addEventListener('mousedown', close); return () => document.removeEventListener('mousedown', close);
  }, [menu]);

  const total = note.pages.length;
  return (
    <div className="space-y-5">
      {/* toolbar */}
      <div className="nx-glass sticky top-14 z-20 -mx-2 flex flex-wrap items-center gap-2 rounded-xl border border-line px-3 py-2 shadow-lg sm:mx-0">
        <button type="button" onClick={onBack} className="btn-ghost btn-sm"><List size={15} aria-hidden /><span className="hidden sm:inline">{t('back')}</span></button>
        <div className="min-w-0 flex-1 truncate text-sm font-semibold">{note.title || t('untitled')}</div>
        <SyncBadge cloud={cloud} status={status} />
        <button type="button" className="btn btn-sm" onClick={insertBullet} onMouseDown={(e) => e.preventDefault()} title={t('bullet')}><span aria-hidden>•</span><span className="hidden md:inline">{t('bullet')}</span></button>
        <button type="button" className={cn('btn btn-sm', note.font === 'hand' && 'border-ember/60 ember-text')} onClick={() => setField('font', note.font === 'hand' ? 'print' : 'hand')} title={t('font')}>
          <Type size={14} aria-hidden /><span className="hidden md:inline">{note.font === 'hand' ? t('fontHand') : t('fontPrint')}</span>
        </button>
        <button type="button" className={cn('btn btn-sm', quiz && 'border-ember/60 ember-text')} onClick={() => { setQuiz((q) => !q); setRevealed(new Set()); }}>
          {quiz ? <Eye size={14} aria-hidden /> : <EyeOff size={14} aria-hidden />}<span className="hidden md:inline">{quiz ? t('quizOn') : t('quiz')}</span>
        </button>
        <button type="button" className="btn btn-sm" onClick={() => { const id = addPage(); focusNext.current = { id, at: 0 }; }}><Plus size={14} aria-hidden /><span className="hidden md:inline">{t('addPage')}</span></button>
        <div className="relative" data-dl>
          <button type="button" className="btn-primary btn-sm" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)} disabled={!!busy}>
            {busy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Download size={14} aria-hidden />}{busy ? t('preparing') : t('download')}<ChevronDown size={13} aria-hidden />
          </button>
          {menu && (
            <div role="menu" className="surface-3 absolute right-0 z-30 mt-1 w-52 p-1">
              <button role="menuitem" type="button" onClick={() => download('docx')} className="flex w-full items-center gap-2.5 rounded px-3 py-2 text-left text-sm hover:bg-ember/10"><FileText size={15} className="text-[#2b7cd3]" aria-hidden />{t('downloadWord')}</button>
              <button role="menuitem" type="button" onClick={() => download('pdf')} className="flex w-full items-center gap-2.5 rounded px-3 py-2 text-left text-sm hover:bg-ember/10"><FileType2 size={15} className="text-[#e5484d]" aria-hidden />{t('downloadPdf')}</button>
            </div>
          )}
        </div>
      </div>

      {/* pages */}
      {note.pages.map((pg, idx) => (
        <article key={pg.id} className={cn('cn-paper', note.font === 'hand' && 'cn-hand')} aria-label={`${t('page')} ${idx + 1} ${t('of')} ${total}`}>
          <div className="cn-top">
            <span className="cn-brand">{t('heading')}</span>
            <span className="cn-pageno">{t('page')} {idx + 1} {t('of')} {total}</span>
          </div>
          {idx === 0 ? (
            <>
              <div className="cn-fields">
                <div className="cn-field"><label htmlFor={`cn-name`}>{t('name')}</label><input id="cn-name" value={note.name} maxLength={80} onChange={(e) => setField('name', e.target.value)} /></div>
                <div className="cn-field"><label htmlFor={`cn-class`}>{t('class')}</label><input id="cn-class" value={note.className} maxLength={80} onChange={(e) => setField('className', e.target.value)} /></div>
                <div className="cn-field"><label htmlFor={`cn-period`}>{t('period')}</label><input id="cn-period" value={note.period} maxLength={20} onChange={(e) => setField('period', e.target.value)} /></div>
                <div className="cn-field"><label htmlFor={`cn-date`}>{t('date')}</label><input id="cn-date" type="date" value={note.date} onChange={(e) => setField('date', e.target.value)} /></div>
              </div>
              <div className="cn-field cn-topic mt-3"><label htmlFor="cn-topic">{t('topic')}</label><input id="cn-topic" value={note.title} maxLength={200} placeholder={t('topicPh')} onChange={(e) => setField('title', e.target.value)} /></div>
              <div className="cn-field cn-eq mt-2"><label htmlFor="cn-eq">{t('question')}</label><input id="cn-eq" value={note.question} maxLength={300} placeholder={t('questionPh')} onChange={(e) => setField('question', e.target.value)} /></div>
            </>
          ) : (
            <div className="cn-cont">{note.title || t('untitled')}<span>{prettyDate(note.date, locale)}</span></div>
          )}
          <div className="cn-heavy" aria-hidden />

          <div className="cn-body">
            <div className="cn-col">
              <span className="cn-label"><span className="hidden sm:inline">{t('cues')}</span><span className="sm:hidden">{t('cuesShort')}</span></span>
              <textarea aria-label={`${t('cues')} · ${t('page')} ${idx + 1}`} className="cn-ta cn-cues" rows={NOTE_LINES} style={{ height: `calc(var(--line) * ${NOTE_LINES})` }}
                value={pg.cues} placeholder={idx === 0 ? t('cuesPh') : ''} onChange={(e) => setPage(pg.id, { cues: e.target.value })} onKeyDown={onKey} spellCheck />
            </div>
            <div className="cn-col">
              <span className="cn-label">{t('notes')}</span>
              <textarea ref={(el) => { refs.current[pg.id] = el; }} aria-label={`${t('notes')} · ${t('page')} ${idx + 1}`} className="cn-ta" rows={NOTE_LINES} style={{ height: `calc(var(--line) * ${NOTE_LINES})` }}
                value={pg.notes} placeholder={idx === 0 ? t('notesPh') : ''} onChange={(e) => onNotes(pg, idx, e.currentTarget, e.target.value)} onKeyDown={onKey} spellCheck />
              {quiz && !revealed.has(pg.id) && (
                <div className="cn-cover">
                  <p className="max-w-xs">{t('quizCover')}</p>
                  <button type="button" onClick={() => setRevealed((s) => new Set(s).add(pg.id))}><Eye size={14} className="mr-1.5 inline" aria-hidden />{t('reveal')}</button>
                </div>
              )}
            </div>
          </div>

          <div className="cn-heavy" aria-hidden />
          <span className="cn-label cn-summary-label">{t('summary')}</span>
          <textarea aria-label={`${t('summary')} · ${t('page')} ${idx + 1}`} className="cn-ta" rows={SUMMARY_LINES} style={{ height: `calc(var(--line) * ${SUMMARY_LINES})` }}
            value={pg.summary} placeholder={t('summaryPh')} onChange={(e) => setPage(pg.id, { summary: e.target.value })} spellCheck />

          <div className="cn-foot">
            <span className="cn-full" role="status">{full[pg.id] ? t('pageFull', { n: full[pg.id] }) : ''}</span>
            {total > 1 && <DeletePage n={idx + 1} onDelete={() => delPage(pg.id)} />}
          </div>
        </article>
      ))}

      <div className="flex justify-center pb-6">
        <button type="button" className="btn" onClick={() => { const id = addPage(); focusNext.current = { id, at: 0 }; }}><Plus size={15} aria-hidden />{t('addAnother')}</button>
      </div>
    </div>
  );
}

function DeletePage({ n, onDelete }: { n: number; onDelete: () => void }) {
  const t = useTranslations('cornell');
  const [ask, setAsk] = useState(false);
  return ask ? (
    <span className="flex items-center gap-2 text-xs text-[#6f6f78]">{t('deletePageConfirm', { n })}
      <button type="button" className="rounded px-2 py-1 hover:bg-black/5" onClick={() => setAsk(false)}>{t('cancel')}</button>
      <button type="button" className="rounded bg-[#c2373f] px-2 py-1 font-semibold text-white" onClick={onDelete}>{t('deletePage')}</button>
    </span>
  ) : (
    <button type="button" className="flex items-center gap-1 rounded px-2 py-1 text-xs text-[#8a8a94] hover:bg-black/5 hover:text-[#c2373f]" onClick={() => setAsk(true)}><Trash2 size={12} aria-hidden />{t('deletePage')}</button>
  );
}

function SyncBadge({ cloud, status }: { cloud: boolean | null; status: 'idle' | 'saving' | 'saved' }) {
  const t = useTranslations('cornell');
  if (status === 'saving') return <span className="inline-flex items-center gap-1 text-2xs text-muted"><Loader2 size={12} className="animate-spin" aria-hidden />{t('saving')}</span>;
  if (cloud === false) return <span className="inline-flex items-center gap-1 text-2xs text-muted" title={t('savedLocal')}><CloudOff size={12} aria-hidden />{t('savedLocal')}</span>;
  if (cloud) return <span className="inline-flex items-center gap-1 text-2xs text-ok"><Cloud size={12} aria-hidden /><Check size={11} aria-hidden />{t('saved')}</span>;
  return null;
}

/** Thumbnail of a notebook's first page in the Cornell layout. */
function MiniPaper({ note }: { note: CornellNote }) {
  const p = note.pages[0];
  const lines = (s: string, n: number) => s.split('\n').filter((x) => x.trim()).slice(0, n);
  return (
    <div className="relative h-36 overflow-hidden bg-[#fffdf7] px-3 pb-2 pl-7 pt-2.5 text-[#1c1c21]" aria-hidden
      style={{ backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0 13px, #c9dbe9 13px 14px)', backgroundPosition: '0 30px' }}>
      <span className="absolute inset-y-0 left-4 w-px bg-[#e58b8b]" />
      <div className="truncate text-[11px] font-bold">{note.title || '—'}</div>
      <div className="mt-1 h-[2px] bg-[#17171b]" />
      <div className="grid h-[78px] grid-cols-[30%_1fr]">
        <div className="space-y-[3px] overflow-hidden border-r-2 border-[#17171b] pr-1 pt-1 text-[8px] font-semibold leading-[11px]">{lines(p?.cues ?? '', 6).map((l, i) => <div key={i} className="truncate">{l}</div>)}</div>
        <div className="space-y-[3px] overflow-hidden pl-1.5 pt-1 text-[8px] leading-[11px]">{lines(p?.notes ?? '', 6).map((l, i) => <div key={i} className="truncate">{l}</div>)}</div>
      </div>
      <div className="h-[2px] bg-[#17171b]" />
      <div className="truncate pt-0.5 text-[8px] leading-[11px]">{p?.summary}</div>
    </div>
  );
}

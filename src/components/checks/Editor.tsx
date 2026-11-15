'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  ArrowDown, ArrowUp, Bookmark, ChevronDown, Copy, Database, FileDown, Loader2, Plus, Sparkles, Trash2, X, BookOpenCheck, ShieldAlert,
} from 'lucide-react';
import {
  addFromBank, addQuestion, deleteBankQuestion, deleteQuestion, duplicateQuestion, generateMore, importQuestions, moveQuestion, saveQuestion, saveToBank,
} from '@/lib/checks';
import { BLANK, QTYPES, optId, type BlockType, type Opt, type Question, type QType } from '@/lib/engine/types';
import { FormMessage, SubmitButton } from '@/components/forms';
import { cn } from '@/lib/util';
import { QTypeIcon } from './icons';

export type QRow = Question & { id: string; position: number };
export interface BankRow { id: string; type: string; prompt: string; topic: string | null; points: number }

// ---------------------------------------------------------------------------- shell
export function Editor({ quizId, questions, bank, others, materials, ai }: {
  quizId: string; questions: QRow[]; bank: BankRow[]; ai: boolean;
  others: { id: string; title: string }[]; materials: { id: string; label: string }[];
}) {
  const t = useTranslations('checks');
  const [dialog, setDialog] = useState<null | 'bank' | 'import' | 'more'>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const add = (type: BlockType) => start(async () => { await addQuestion(quizId, type); router.refresh(); });
  let n = 0;
  return (
    <div>
      <AddMenu onAdd={add} onDialog={setDialog} busy={pending} />
      {questions.length === 0
        ? <p className="mt-6 rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">{t('empty')}</p>
        : (
          <ol className="mt-5 space-y-3">
            {questions.map((q, i) => {
              const gradable = q.type !== 'text' && q.type !== 'page_break';
              if (gradable) n++;
              return <li key={q.id}><QuestionCard q={q} number={gradable ? n : null} quizId={quizId} first={i === 0} last={i === questions.length - 1} /></li>;
            })}
          </ol>
        )}
      {questions.length > 2 && <div className="mt-5"><AddMenu onAdd={add} onDialog={setDialog} busy={pending} up /></div>}
      {dialog === 'bank' && <BankDialog quizId={quizId} bank={bank} onClose={() => setDialog(null)} />}
      {dialog === 'import' && <ImportDialog quizId={quizId} others={others} onClose={() => setDialog(null)} />}
      {dialog === 'more' && <MoreDialog quizId={quizId} materials={materials} ai={ai} onClose={() => setDialog(null)} />}
    </div>
  );
}

function AddMenu({ onAdd, onDialog, busy, up }: { onAdd: (t: BlockType) => void; onDialog: (d: 'bank' | 'import' | 'more') => void; busy: boolean; up?: boolean }) {
  const t = useTranslations('checks');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close); return () => document.removeEventListener('mousedown', close);
  }, []);
  const item = (label: React.ReactNode, onClick: () => void, icon: React.ReactNode) => (
    <button type="button" role="menuitem" onClick={() => { setOpen(false); onClick(); }}
      className="flex w-full items-center gap-2.5 rounded px-3 py-2 text-left text-sm hover:bg-ember/10">{icon}{label}</button>
  );
  const plus = <Plus size={14} className="text-ok" aria-hidden />;
  return (
    <div ref={ref} className="relative inline-block">
      <button type="button" className="btn-primary" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} disabled={busy}>
        {busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Plus size={15} aria-hidden />}{t('addQuestion')}<ChevronDown size={14} aria-hidden />
      </button>
      {open && (
        <div role="menu" className={cn('surface-3 absolute left-0 z-30 w-72 p-1', up ? 'bottom-full mb-1' : 'mt-1')}>
          {QTYPES.map((q) => <div key={q}>{item(t(`types.${q}`), () => onAdd(q), plus)}</div>)}
          <div className="my-1 border-t border-line" />
          {item(t('generateMore'), () => onDialog('more'), <Sparkles size={14} className="violet-text" aria-hidden />)}
          {item(t('fromBank'), () => onDialog('bank'), <Database size={14} className="text-ok" aria-hidden />)}
          {item(t('importQuiz'), () => onDialog('import'), <FileDown size={14} className="text-ok" aria-hidden />)}
          <div className="my-1 border-t border-line" />
          {item(t('types.page_break'), () => onAdd('page_break'), plus)}
          {item(t('types.text'), () => onAdd('text'), plus)}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------- one question
function QuestionCard({ q, number, quizId, first, last }: { q: QRow; number: number | null; quizId: string; first: boolean; last: boolean }) {
  const t = useTranslations('checks');
  const router = useRouter();
  const [d, setD] = useState<Question>(q);
  const [status, setStatus] = useState<'' | 'saving' | 'saved' | 'error'>('');
  const [note, setNote] = useState('');
  const [busy, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const latest = useRef<Question>(q);
  const update = (patch: Partial<Question>) => {
    const cur = latest.current;
    const next = { ...cur, ...patch, data: { ...cur.data, ...(patch.data ?? {}) }, key: { ...cur.key, ...(patch.key ?? {}) } };
    latest.current = next;
    setD(next);
    clearTimeout(timer.current);
    setStatus('saving');
    timer.current = setTimeout(async () => {
      const r = await saveQuestion(quizId, q.id, latest.current);
      setStatus(r.error ? 'error' : 'saved');
    }, 650);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  const act = (fn: () => Promise<unknown>) => start(async () => { await fn(); router.refresh(); });

  if (q.type === 'page_break') {
    return (
      <div className="group flex items-center gap-3 py-1">
        <span className="h-px flex-1 border-t-2 border-dashed border-line" />
        <span className="font-mono text-2xs uppercase tracking-wider text-faint">{t('pageBreak')}</span>
        <span className="h-px flex-1 border-t-2 border-dashed border-line" />
        <Tools first={first} last={last} busy={busy} onUp={() => act(() => moveQuestion(quizId, q.id, -1))} onDown={() => act(() => moveQuestion(quizId, q.id, 1))}
          onDelete={() => act(() => deleteQuestion(quizId, q.id))} />
      </div>
    );
  }

  const opts = (d.data.options as Opt[] | undefined) ?? [];
  const correct = (d.key.correct as string[] | undefined) ?? [];
  const items = (d.data.items as Opt[] | undefined) ?? [];
  const left = (d.data.left as Opt[] | undefined) ?? [];
  const right = (d.data.right as Opt[] | undefined) ?? [];
  const pairs = (d.key.pairs as Record<string, string> | undefined) ?? {};
  const answers = (d.key.answers as string[][] | undefined) ?? [];
  const nextId = (list: Opt[], prefix = '') => { for (let i = 0; ; i++) { const id = prefix ? `${prefix}${i + 1}` : optId(i); if (!list.some((o) => o.id === id)) return id; } };

  return (
    <article className={cn('card p-4', busy && 'opacity-60')}>
      <header className="mb-3 flex items-center gap-2.5">
        <QTypeIcon type={q.type} size={15} />
        <div className="min-w-0 flex-1">
          <div className="text-2xs font-semibold uppercase tracking-wide text-muted">{number != null ? `${number} · ` : ''}{t(`types.${q.type}`)}</div>
        </div>
        <span className={cn('text-2xs', status === 'error' ? 'text-bad' : 'text-faint')} aria-live="polite">
          {status === 'saving' ? t('saving') : status === 'saved' ? t('saved') : status === 'error' ? '!' : note}
        </span>
        {q.type !== 'text' && (
          <label className="flex items-center gap-1 text-xs text-muted">
            <input type="number" min={0} max={100} step={0.5} value={d.points} onChange={(e) => update({ points: Number(e.target.value) })}
              className="input h-7 w-14 px-1.5 text-center font-mono text-xs" aria-label={t('points')} />{t('points')}
          </label>
        )}
        <Tools first={first} last={last} busy={busy}
          onUp={() => act(() => moveQuestion(quizId, q.id, -1))} onDown={() => act(() => moveQuestion(quizId, q.id, 1))}
          onCopy={() => act(() => duplicateQuestion(quizId, q.id))}
          onBank={q.type !== 'text' ? () => {
            const topic = window.prompt(t('bankTopic')) ?? '';
            start(async () => { const r = await saveToBank(q.id, topic); setNote(r.error ? '!' : t('savedBank')); });
          } : undefined}
          onDelete={() => { if (window.confirm(t('confirmDeleteQ'))) act(() => deleteQuestion(quizId, q.id)); }} />
      </header>

      {q.type === 'fill_blank' ? (
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="label mb-0" htmlFor={`p-${q.id}`}>{t('question')}</label>
            <button type="button" className="chip text-2xs hover:text-ink" onClick={() => {
              const el = document.getElementById(`p-${q.id}`) as HTMLTextAreaElement | null;
              const at = el?.selectionStart ?? d.prompt.length;
              const prompt = `${d.prompt.slice(0, at)}${BLANK}${d.prompt.slice(at)}`;
              const n = prompt.split(BLANK).length - 1;
              update({ prompt, key: { answers: Array.from({ length: n }, (_, i) => answers[i] ?? []) } });
            }}>+ {t('insertBlank')}</button>
          </div>
          <textarea id={`p-${q.id}`} value={d.prompt} rows={2} className="textarea font-medium"
            onChange={(e) => { const n = e.target.value.split(BLANK).length - 1; update({ prompt: e.target.value, key: { answers: Array.from({ length: n }, (_, i) => answers[i] ?? []) } }); }} />
          <p className="mt-1 text-2xs text-faint">{t('blankPromptHint')}</p>
          <div className="mt-3 space-y-2">
            {answers.map((a, i) => (
              <div key={i}><label className="label" htmlFor={`b-${q.id}-${i}`}>{t('accepted', { n: i + 1 })}</label>
                <input id={`b-${q.id}-${i}`} className="input" defaultValue={a.join(', ')}
                  onChange={(e) => { const next = [...answers]; next[i] = e.target.value.split(',').map((s) => s.trim()).filter(Boolean); update({ key: { answers: next } }); }} /></div>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <label className="sr-only" htmlFor={`p-${q.id}`}>{q.type === 'true_false' ? t('statement') : t('question')}</label>
          <textarea id={`p-${q.id}`} value={d.prompt} rows={q.type === 'text' ? 4 : 2} placeholder={q.type === 'true_false' ? t('statement') : q.type === 'text' ? t('textHint') : t('question')}
            className={cn('textarea', q.type !== 'text' && 'font-medium')} onChange={(e) => update({ prompt: e.target.value })} />
        </div>
      )}

      {q.type === 'true_false' && (
        <div className="mt-3 flex items-center gap-2 text-sm" role="radiogroup" aria-label={t('correctAnswer')}>
          <span className="text-muted">{t('correctAnswer')}:</span>
          {[true, false].map((v) => (
            <button key={String(v)} type="button" role="radio" aria-checked={d.key.answer === v} onClick={() => update({ key: { answer: v } })}
              className={cn('chip px-3 py-1', d.key.answer === v && 'border-ok/60 bg-ok/10 text-ok')}>{v ? t('true') : t('false')}</button>
          ))}
        </div>
      )}

      {q.type === 'multiple_choice' && (
        <div className="mt-3 space-y-2">
          {opts.map((o, i) => {
            const on = correct.includes(o.id);
            return (
              <div key={o.id} className="flex items-center gap-2">
                <button type="button" aria-pressed={on} title={t('correct')} aria-label={`${t('correct')} — ${t('option', { n: i + 1 })}`}
                  onClick={() => update({ key: { correct: on ? correct.filter((c) => c !== o.id) : [...correct, o.id] }, data: { multi: (on ? correct.length - 1 : correct.length + 1) > 1 } })}
                  className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-mono text-xs', on ? 'border-ok bg-ok/15 text-ok' : 'border-line text-muted')}>
                  {String.fromCharCode(65 + i)}
                </button>
                <input className={cn('input h-9 flex-1', on && 'border-ok/50')} value={o.text} placeholder={t('option', { n: i + 1 })}
                  onChange={(e) => update({ data: { options: opts.map((x) => (x.id === o.id ? { ...x, text: e.target.value } : x)) } })} />
                <button type="button" className="btn-ghost btn-sm text-faint hover:text-bad" aria-label={t('remove')} disabled={opts.length <= 2}
                  onClick={() => update({ data: { options: opts.filter((x) => x.id !== o.id) }, key: { correct: correct.filter((c) => c !== o.id) } })}><X size={14} aria-hidden /></button>
              </div>
            );
          })}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button type="button" className="chip hover:text-ink" disabled={opts.length >= 10}
              onClick={() => update({ data: { options: [...opts, { id: nextId(opts), text: '' }] } })}><Plus size={12} aria-hidden />{t('addOption')}</button>
            <span className="text-2xs text-faint">{t('multiHint')}</span>
          </div>
        </div>
      )}

      {q.type === 'ordering' && (
        <div className="mt-3 space-y-2">
          <p className="text-2xs text-faint">{t('itemsHint')}</p>
          {items.map((o, i) => (
            <div key={o.id} className="flex items-center gap-2">
              <span className="w-6 text-center font-mono text-xs text-muted">{i + 1}</span>
              <input className="input h-9 flex-1" value={o.text} onChange={(e) => update({ data: { items: items.map((x) => (x.id === o.id ? { ...x, text: e.target.value } : x)) } })} />
              <button type="button" className="btn-ghost btn-sm" aria-label={t('moveUp')} disabled={i === 0}
                onClick={() => { const a = [...items]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; update({ data: { items: a }, key: { order: a.map((x) => x.id) } }); }}><ArrowUp size={13} aria-hidden /></button>
              <button type="button" className="btn-ghost btn-sm" aria-label={t('moveDown')} disabled={i === items.length - 1}
                onClick={() => { const a = [...items]; [a[i + 1], a[i]] = [a[i], a[i + 1]]; update({ data: { items: a }, key: { order: a.map((x) => x.id) } }); }}><ArrowDown size={13} aria-hidden /></button>
              <button type="button" className="btn-ghost btn-sm text-faint hover:text-bad" aria-label={t('remove')} disabled={items.length <= 2}
                onClick={() => { const a = items.filter((x) => x.id !== o.id); update({ data: { items: a }, key: { order: a.map((x) => x.id) } }); }}><X size={13} aria-hidden /></button>
            </div>
          ))}
          <button type="button" className="chip hover:text-ink" disabled={items.length >= 12}
            onClick={() => { const a = [...items, { id: nextId(items), text: '' }]; update({ data: { items: a }, key: { order: a.map((x) => x.id) } }); }}><Plus size={12} aria-hidden />{t('addItem')}</button>
        </div>
      )}

      {q.type === 'matching' && (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-[1fr_1.4fr_auto] gap-2 text-2xs font-semibold uppercase tracking-wide text-muted"><span>{t('term')}</span><span>{t('meaning')}</span><span /></div>
          {left.map((l, i) => {
            const r = right.find((x) => x.id === pairs[l.id]) ?? right[i];
            return (
              <div key={l.id} className="grid grid-cols-[1fr_1.4fr_auto] gap-2">
                <input className="input h-9" value={l.text} onChange={(e) => update({ data: { left: left.map((x) => (x.id === l.id ? { ...x, text: e.target.value } : x)) } })} />
                <input className="input h-9" value={r?.text ?? ''} onChange={(e) => update({ data: { right: right.map((x) => (x.id === r?.id ? { ...x, text: e.target.value } : x)) } })} />
                <button type="button" className="btn-ghost btn-sm text-faint hover:text-bad" aria-label={t('remove')} disabled={left.length <= 2}
                  onClick={() => { const np = { ...pairs }; delete np[l.id]; update({ data: { left: left.filter((x) => x.id !== l.id), right: right.filter((x) => x.id !== r?.id) }, key: { pairs: np } }); }}><X size={13} aria-hidden /></button>
              </div>
            );
          })}
          <button type="button" className="chip hover:text-ink" disabled={left.length >= 12} onClick={() => {
            const lid = nextId(left, 'l'); const rid = nextId(right, 'r');
            update({ data: { left: [...left, { id: lid, text: '' }], right: [...right, { id: rid, text: '' }] }, key: { pairs: { ...pairs, [lid]: rid } } });
          }}><Plus size={12} aria-hidden />{t('addPair')}</button>
        </div>
      )}

      {q.type === 'short_answer' && (
        <div className="mt-3"><label className="label" htmlFor={`s-${q.id}`}>{t('sample')}</label>
          <textarea id={`s-${q.id}`} rows={2} className="textarea text-sm" value={String(d.key.sample ?? '')} onChange={(e) => update({ key: { sample: e.target.value } })} /></div>
      )}

      {q.type !== 'text' && (d.key.source as { quote?: string } | undefined)?.quote && <SourceNote source={d.key.source as SourceInfo} />}

      {q.type !== 'text' && (
        <details className="mt-3" open={!!d.explanation}>
          <summary className="cursor-pointer text-xs text-muted hover:text-ink">{t('explanation')}</summary>
          <input className="input mt-1.5 h-9 text-sm" value={d.explanation ?? ''} onChange={(e) => update({ explanation: e.target.value })} />
        </details>
      )}
    </article>
  );
}

type SourceInfo = { quote: string; passage: string | null; page: number | null; heading: string | null; verified: boolean };

/** "Show source": the exact lesson passage this question came from, and whether NEXORA found it in the file. */
function SourceNote({ source }: { source: SourceInfo }) {
  const t = useTranslations('checks');
  return (
    <details className="mt-3">
      <summary className={cn('inline-flex cursor-pointer items-center gap-1.5 text-xs', source.verified ? 'text-muted hover:text-ink' : 'text-warn')}>
        {source.verified ? <BookOpenCheck size={13} aria-hidden /> : <ShieldAlert size={13} aria-hidden />}
        {source.verified ? t('showSource') : t('sourceUnverified')}
      </summary>
      <blockquote className="mt-1.5 border-l-2 border-line pl-3 text-sm italic text-ink/85">“{source.quote}”</blockquote>
      <p className="mt-1 text-2xs text-faint">
        {[source.page ? t('sourcePage', { n: source.page }) : null, source.heading].filter(Boolean).join(' · ')}
        {!source.verified && <span className="ml-1">{t('sourceUnverifiedHint')}</span>}
      </p>
    </details>
  );
}

function Tools({ first, last, busy, onUp, onDown, onCopy, onBank, onDelete }:
  { first: boolean; last: boolean; busy: boolean; onUp: () => void; onDown: () => void; onCopy?: () => void; onBank?: () => void; onDelete: () => void }) {
  const t = useTranslations('checks');
  return (
    <div className="flex items-center">
      <button type="button" className="btn-ghost btn-sm" disabled={first || busy} onClick={onUp} aria-label={t('moveUp')} title={t('moveUp')}><ArrowUp size={14} aria-hidden /></button>
      <button type="button" className="btn-ghost btn-sm" disabled={last || busy} onClick={onDown} aria-label={t('moveDown')} title={t('moveDown')}><ArrowDown size={14} aria-hidden /></button>
      {onCopy && <button type="button" className="btn-ghost btn-sm" disabled={busy} onClick={onCopy} aria-label={t('duplicate')} title={t('duplicate')}><Copy size={14} aria-hidden /></button>}
      {onBank && <button type="button" className="btn-ghost btn-sm" disabled={busy} onClick={onBank} aria-label={t('toBank')} title={t('toBank')}><Bookmark size={14} aria-hidden /></button>}
      <button type="button" className="btn-ghost btn-sm text-faint hover:text-bad" disabled={busy} onClick={onDelete} aria-label={t('deleteQ')} title={t('deleteQ')}><Trash2 size={14} aria-hidden /></button>
    </div>
  );
}

// ---------------------------------------------------------------------------- dialogs
export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  const t = useTranslations('checks');
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={title} className={cn('flex max-h-[88vh] w-full flex-col rounded-xl border border-line shadow-2xl', wide ? 'max-w-3xl' : 'max-w-xl')} style={{ background: 'rgb(var(--panel))' }}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h3 className="font-semibold">{title}</h3>
          <button type="button" className="btn-ghost btn-sm" onClick={onClose} aria-label={t('close')}><X size={15} aria-hidden /></button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

function BankDialog({ quizId, bank, onClose }: { quizId: string; bank: BankRow[]; onClose: () => void }) {
  const t = useTranslations('checks');
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>([]);
  const [list, setList] = useState(bank);
  const [filter, setFilter] = useState('');
  const [pending, start] = useTransition();
  const shown = list.filter((b) => !filter || `${b.topic ?? ''} ${b.prompt}`.toLowerCase().includes(filter.toLowerCase()));
  return (
    <Modal title={t('bankTitle')} onClose={onClose} wide>
      {list.length === 0 ? <p className="text-sm text-muted">{t('bankEmpty')}</p> : (
        <>
          <input className="input mb-3" placeholder="🔍" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter" />
          <ul className="divide-y divide-line rounded-lg border border-line">
            {shown.map((b) => (
              <li key={b.id} className="flex items-start gap-3 px-3 py-2.5">
                <input type="checkbox" className="mt-1 accent-[rgb(var(--nx-ember))]" checked={picked.includes(b.id)} aria-label={b.prompt}
                  onChange={(e) => setPicked((p) => (e.target.checked ? [...p, b.id] : p.filter((x) => x !== b.id)))} />
                <QTypeIcon type={b.type as QType} size={13} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm">{b.prompt || '—'}</div>
                  <div className="text-2xs text-muted">{t(`types.${b.type as QType}`)}{b.topic ? ` · ${b.topic}` : ''}</div>
                </div>
                <button type="button" className="btn-ghost btn-sm text-faint hover:text-bad" aria-label={t('remove')}
                  onClick={() => start(async () => { await deleteBankQuestion(b.id); setList((l) => l.filter((x) => x.id !== b.id)); })}><Trash2 size={13} aria-hidden /></button>
              </li>
            ))}
          </ul>
          <button type="button" className="btn-primary mt-4" disabled={!picked.length || pending}
            onClick={() => start(async () => { await addFromBank(quizId, picked); router.refresh(); onClose(); })}>
            {pending ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Plus size={15} aria-hidden />}{t('bankAdd')} ({picked.length})
          </button>
        </>
      )}
    </Modal>
  );
}

function ImportDialog({ quizId, others, onClose }: { quizId: string; others: { id: string; title: string }[]; onClose: () => void }) {
  const t = useTranslations('checks');
  const router = useRouter();
  const [tab, setTab] = useState<'paste' | 'copy'>('paste');
  const [state, action] = useActionState(importQuestions, null);
  useEffect(() => { if (state?.ok) { router.refresh(); const tm = setTimeout(onClose, 900); return () => clearTimeout(tm); } }, [state, router, onClose]);
  return (
    <Modal title={t('importTitle')} onClose={onClose} wide>
      <div className="mb-4 flex gap-1.5">
        {(['paste', 'copy'] as const).map((k) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={cn('chip px-3 py-1.5', tab === k && 'border-ember/60 bg-ember/10 text-ink')}>{k === 'paste' ? t('importPaste') : t('importCopy')}</button>
        ))}
      </div>
      <form action={action} className="space-y-3">
        <input type="hidden" name="quiz_id" value={quizId} />
        {tab === 'paste' ? (
          <div className="grid gap-4 md:grid-cols-[1.3fr_1fr]">
            <textarea name="text" required className="textarea min-h-[260px] font-mono text-xs" aria-label={t('importPaste')} />
            <pre className="whitespace-pre-wrap rounded-lg border border-line bg-sunk/60 p-3 font-mono text-2xs leading-relaxed text-muted">{t('importHelp')}</pre>
          </div>
        ) : (
          <div><label className="label" htmlFor="imp-from">{t('chooseCheck')}</label>
            <select id="imp-from" name="from_check" className="input" required defaultValue="">
              <option value="" disabled>—</option>
              {others.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
            </select></div>
        )}
        <div className="flex items-center gap-3"><SubmitButton>{t('importBtn')}</SubmitButton><FormMessage state={state} /></div>
      </form>
    </Modal>
  );
}

function MoreDialog({ quizId, materials, ai, onClose }: { quizId: string; materials: { id: string; label: string }[]; ai: boolean; onClose: () => void }) {
  const t = useTranslations('checks');
  const router = useRouter();
  const [state, action] = useActionState(generateMore, null);
  const [src, setSrc] = useState<'material' | 'paste'>(materials.length ? 'material' : 'paste');
  const [counts, setCounts] = useState<Partial<Record<QType, number>>>({ multiple_choice: 2 });
  useEffect(() => { if (state?.ok) { router.refresh(); const tm = setTimeout(onClose, 900); return () => clearTimeout(tm); } }, [state, router, onClose]);
  return (
    <Modal title={t('moreTitle')} onClose={onClose}>
      <form action={action} className="space-y-4">
        <input type="hidden" name="quiz_id" value={quizId} />
        <input type="hidden" name="source" value={src} />
        {QTYPES.map((q) => <input key={q} type="hidden" name={`n_${q}`} value={counts[q] ?? 0} />)}
        <div className="flex gap-1.5">
          {(['material', 'paste'] as const).map((k) => (
            <button key={k} type="button" onClick={() => setSrc(k)} disabled={k === 'material' && !materials.length}
              className={cn('chip px-3 py-1.5', src === k && 'border-ember/60 bg-ember/10 text-ink')}>{t(`src.${k}`)}</button>
          ))}
        </div>
        {src === 'material'
          ? <select name="material_id" className="input" aria-label={t('pickMaterial')}>{materials.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select>
          : <textarea name="text" required className="textarea min-h-[120px]" placeholder={t('pasteHint')} />}
        <div className="grid grid-cols-2 gap-2">
          {QTYPES.map((q) => (
            <label key={q} className="flex items-center justify-between gap-2 rounded-md border border-line px-2.5 py-1.5 text-sm">
              <span className="truncate">{t(`types.${q}`)}</span>
              <input type="number" min={0} max={15} value={counts[q] ?? 0} onChange={(e) => setCounts((c) => ({ ...c, [q]: Math.max(0, Math.min(15, Number(e.target.value) || 0)) }))}
                className="input h-7 w-14 px-1 text-center font-mono" />
            </label>
          ))}
        </div>
        <p className="text-2xs text-muted">{ai ? t('engineAi') : t('engineBuiltin')}</p>
        <div className="flex items-center gap-3"><SubmitButton pendingText={t('generating')}><Sparkles size={15} aria-hidden />{t('generate')}</SubmitButton><FormMessage state={state} /></div>
      </form>
    </Modal>
  );
}

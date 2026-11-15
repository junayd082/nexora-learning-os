'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Building2, Check, ChevronDown, DoorOpen, GlassWater, Hand, HeartPulse, ListOrdered, Maximize2, MessageCircle, Ticket, Toilet, Undo2, Users, X,
} from 'lucide-react';
import { bellState } from '@/lib/bell';
import { chime } from '@/lib/chime';
import { PASS_DESTS, cancelPass, mmss, passBack, requestPass, useTick, usePassBoard, type Board, type Pass, type PassDest } from '@/lib/live';
import { soundOn } from '@/components/companion/sound';
import { lightFor } from '@/components/Living';
import { cn } from '@/lib/util';
import { useLive } from './LiveProvider';

export const DEST_ICON: Record<PassDest, typeof Toilet> = { restroom: Toilet, water: GlassWater, nurse: HeartPulse, office: Building2, other: MessageCircle };
const OPEN = new Set(['pending', 'queued', 'out']);

/** The class a student most likely means (in session now → the page they're on → first). */
function useStudentClass(prefer?: string) {
  const live = useLive();
  const path = usePathname();
  const mine = useMemo(() => (live?.classes ?? []).filter((c) => !c.teacher), [live?.classes]);
  return useMemo(() => {
    if (prefer && mine.some((c) => c.id === prefer)) return prefer;
    const onPage = path.match(/^\/classes\/([0-9a-f-]{36})/)?.[1];
    if (onPage && mine.some((c) => c.id === onPage)) return onPage;
    const now = bellState(Date.now()).current?.period;
    return mine.find((c) => c.period === now)?.id ?? mine[0]?.id ?? '';
  }, [prefer, mine, path]);
}

/**
 * "Ask your teacher" — one menu for everything a student asks the teacher for:
 * help (raise hand), a hall pass, and the pass board. Used in the assistant and on class pages.
 */
export function AskTeacherMenu({ classId, className, compact = false }: { classId?: string; className?: string; compact?: boolean }) {
  const live = useLive();
  const t = useTranslations('pass');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  if (!live || !live.classes.some((c) => !c.teacher)) return null;
  const handUp = live.myHands.some((h) => !classId || h.class_id === classId);
  const passOpen = live.myPasses.some((p) => OPEN.has(p.status) && (!classId || p.class_id === classId));
  const item = 'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-ember/10';
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        className={cn('inline-flex items-center gap-1.5 whitespace-nowrap', className, (handUp || passOpen) && 'border-ember/60 ember-text')}>
        <Hand size={compact ? 14 : 15} aria-hidden className={handUp ? 'nx-hand-wave' : undefined} />
        {t('askTeacher')}
        <ChevronDown size={13} aria-hidden className={cn('transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-[60] mt-1.5 w-64 rounded-xl border border-line p-1 shadow-2xl" style={{ background: 'rgb(var(--panel))' }}>
          <button role="menuitem" type="button" className={item} onClick={() => { setOpen(false); live.openHand(classId); }}>
            <Hand size={17} className="ember-text" aria-hidden />
            <span className="min-w-0 flex-1"><span className="block font-medium">{handUp ? t('handUp') : t('raiseHand')}</span><span className="block text-2xs text-muted">{t('raiseHandSub')}</span></span>
          </button>
          <button role="menuitem" type="button" className={item} onClick={() => { setOpen(false); live.openPass(classId, 'ask'); }}>
            <Ticket size={17} className="ember-text" aria-hidden />
            <span className="min-w-0 flex-1"><span className="block font-medium">{passOpen ? t('myPass') : t('requestPass')}</span><span className="block text-2xs text-muted">{t('requestPassSub')}</span></span>
          </button>
          <button role="menuitem" type="button" className={item} onClick={() => { setOpen(false); live.openPass(classId, 'board'); }}>
            <ListOrdered size={17} className="ember-text" aria-hidden />
            <span className="min-w-0 flex-1"><span className="block font-medium">{t('passBoard')}</span><span className="block text-2xs text-muted">{t('passBoardSub')}</span></span>
          </button>
        </div>
      )}
    </div>
  );
}

/** Minutes:seconds since `iso`, using the server's clock offset when we have it. */
function since(iso: string | undefined | null, now: number, skew: number) { return iso ? Math.max(0, Math.floor((now + skew - Date.parse(iso)) / 1000)) : 0; }

/**
 * The queue board: who is out (with a timer) and who is next. Shared by students, the teacher and
 * the projector. Classmates see names only; destinations and notes are for the teacher and the student.
 */
export function PassBoardView({ board, big = false, onBack }: { board: Board; big?: boolean; onBack?: (id: string) => void }) {
  const t = useTranslations('pass');
  const now = useTick(true, 1000);
  const skew = useMemo(() => Date.parse(board.now) - Date.now(), [board.now]);
  const limit = board.minutes * 60;
  const destLabel = (d: PassDest | null) => (d ? t(`dest.${d}`) : t('outOfRoom'));
  return (
    <div className={cn('grid gap-4', big && 'gap-8 lg:grid-cols-2')}>
      <section aria-label={t('outNow')}>
        <h3 className={cn('mb-2 flex items-center gap-2 font-semibold', big ? 'text-2xl' : 'text-sm')}>
          <DoorOpen size={big ? 26 : 15} className="ember-text" aria-hidden />{t('outNow')}
          <span className="font-normal text-muted">{board.out.length}/{board.max_out}</span>
        </h3>
        {board.out.length === 0 ? (
          <p className={cn('rounded-xl border border-dashed border-line px-4 text-muted', big ? 'py-10 text-center text-2xl' : 'py-3 text-sm')}>{t('nobodyOut')}</p>
        ) : (
          <ul className="space-y-2">
            {board.out.map((r) => {
              const s = since(r.out_at, now, skew);
              const over = s > limit;
              const Icon = r.destination ? DEST_ICON[r.destination] : DoorOpen;
              return (
                <li key={r.id} className={cn('flex items-center gap-3 rounded-xl border px-3', big ? 'py-5' : 'py-2.5', over ? 'border-bad/60 bg-bad/[0.07]' : r.mine ? 'border-ember/60 bg-ember/[0.07]' : 'border-line bg-white/[0.02]')}>
                  <span className={cn('flex shrink-0 items-center justify-center rounded-full bg-white/[0.06]', big ? 'h-14 w-14' : 'h-9 w-9')}><Icon size={big ? 26 : 16} aria-hidden /></span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate font-semibold', big && 'text-2xl')}>{r.name}{r.mine && <span className="ml-1.5 text-2xs font-normal ember-text">{t('you')}</span>}</span>
                    <span className={cn('block truncate text-muted', big ? 'text-base' : 'text-2xs')}>
                      {destLabel(r.destination)}{r.with_classmate ? ` · ${t('withClassmate')}` : ''}{r.note && (board.teacher || r.mine) ? ` · “${r.note}”` : ''}
                    </span>
                  </span>
                  <span className={cn('shrink-0 font-mono font-semibold tabular-nums', big ? 'text-4xl' : 'text-base', over && 'text-bad')}>{mmss(s)}</span>
                  {onBack && (board.teacher || r.mine) && (
                    <button type="button" className={cn(r.mine ? 'btn-primary' : 'btn', big ? 'btn-lg' : 'btn-sm')} onClick={() => onBack(r.id)}>
                      <Undo2 size={14} aria-hidden />{r.mine ? t('imBack') : t('markBack')}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section aria-label={t('inLine')}>
        <h3 className={cn('mb-2 flex items-center gap-2 font-semibold', big ? 'text-2xl' : 'text-sm')}>
          <ListOrdered size={big ? 26 : 15} className="text-muted" aria-hidden />{t('inLine')}
          <span className="font-normal text-muted">{board.queue.length}</span>
        </h3>
        {board.queue.length === 0 ? (
          <p className={cn('rounded-xl border border-dashed border-line px-4 text-muted', big ? 'py-10 text-center text-2xl' : 'py-3 text-sm')}>{t('lineEmpty')}</p>
        ) : (
          <ol className="space-y-1.5">
            {board.queue.map((r, i) => (
              <li key={r.id} className={cn('flex items-center gap-3 rounded-lg border px-3', big ? 'py-4 text-2xl' : 'py-2 text-sm', r.mine ? 'border-ember/50 bg-ember/[0.05]' : 'border-line')}>
                <span className={cn('flex shrink-0 items-center justify-center rounded-full bg-white/[0.06] font-bold tabular-nums', big ? 'h-11 w-11 text-xl' : 'h-6 w-6 text-2xs')}>{i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{r.name}{r.mine && <span className="ml-1.5 text-2xs font-normal ember-text">{t('you')}</span>}</span>
                {(board.teacher || r.mine) && r.destination && <span className={cn('shrink-0 text-muted', big ? 'text-base' : 'text-2xs')}>{t(`dest.${r.destination}`)}</span>}
                {r.with_classmate && <Users size={big ? 20 : 13} className="shrink-0 text-muted" aria-label={t('withClassmate')} />}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

/** Full-screen board for the classroom projector. */
export function BoardProjector({ classId, onClose }: { classId: string; onClose: () => void }) {
  const t = useTranslations('pass');
  const { board } = usePassBoard(classId);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.fullscreenElement) onClose(); };
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k);
  }, [onClose]);
  return createPortal(
    <div ref={ref} role="dialog" aria-modal="true" aria-label={t('passBoard')} className="fixed inset-0 z-[90] overflow-y-auto px-6 py-8 sm:px-12"
      style={{ background: `radial-gradient(70% 60% at 50% 0%, rgb(${lightFor(classId)} / 0.18), transparent 70%), rgb(var(--nx-carbon-1, 12 12 16))` }}>
      <div className="mx-auto flex max-w-6xl items-start justify-between gap-4">
        <div>
          <p className="text-lg font-semibold uppercase tracking-[0.18em] text-muted">{t('passBoard')}</p>
          <h2 className="mt-1 text-3xl font-bold sm:text-5xl">{[board?.section, board?.name].filter(Boolean).join(' · ')}</h2>
          {board && <p className="mt-2 text-lg text-muted">{t('rules', { max: board.max_out, min: board.minutes })}</p>}
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-sm" onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void ref.current?.requestFullscreen?.().catch(() => undefined); }}><Maximize2 size={15} aria-hidden />{t('fullScreen')}</button>
          <button type="button" className="btn btn-sm" onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); onClose(); }} aria-label={t('close')}><X size={15} aria-hidden /></button>
        </div>
      </div>
      <div className="mx-auto mt-10 max-w-6xl">{board ? <PassBoardView board={board} big /> : <p className="text-muted">…</p>}</div>
    </div>,
    document.body,
  );
}

/**
 * Student: ask for a pass, or see the board. Kept to one screen — pick where, (optionally) add a
 * note, ask. "Going with a classmate" is there but always flagged for the teacher to decide.
 */
export function PassSheet() {
  const live = useLive();
  const t = useTranslations('pass');
  const open = !!live?.passSheet.open;
  const preferred = useStudentClass(live?.passSheet.classId);
  const [classId, setClassId] = useState('');
  const [view, setView] = useState<'ask' | 'board'>('ask');
  const [dest, setDest] = useState<PassDest>('restroom');
  const [note, setNote] = useState('');
  const [buddy, setBuddy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { board } = usePassBoard(open && classId ? classId : null);
  const mine = (live?.classes ?? []).filter((c) => !c.teacher);
  const current = live?.myPasses.find((p) => p.class_id === classId && OPEN.has(p.status));

  useEffect(() => {
    if (!open) return;
    setClassId(preferred); setView(live?.passSheet.view ?? 'ask'); setErr(null); setBusy(false); setNote(''); setBuddy(false); setDest('restroom');
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') live?.closePass(); };
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open || !live || typeof document === 'undefined') return null;

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!classId) return;
    setBusy(true); setErr(null);
    const { error } = await requestPass(classId, dest, note.trim(), buddy);
    setBusy(false);
    if (error) setErr(/off/.test(error.message) ? t('passesOff') : /too many/.test(error.message) ? t('tooMany') : t('failed'));
    else setView('board');
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/55 backdrop-blur-[2px] sm:items-center sm:p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) live.closePass(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="pass-h" className="nx-sheet flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-line shadow-2xl sm:rounded-2xl"
        style={{ background: 'rgb(var(--panel))' }}>
        <div className="flex items-start gap-3 p-5 pb-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ember/15 ember-text"><Ticket size={21} aria-hidden /></span>
          <div className="min-w-0 flex-1">
            <h2 id="pass-h" className="text-lg font-semibold">{t('hallPass')}</h2>
            {board && <p className="text-sm text-muted">{t('summary', { out: board.out.length, max: board.max_out, line: board.queue.length })}</p>}
          </div>
          <button type="button" className="btn-ghost btn-sm" onClick={live.closePass} aria-label={t('close')}><X size={16} aria-hidden /></button>
        </div>
        <div role="tablist" className="mx-5 grid grid-cols-2 gap-1 rounded-lg bg-white/[0.04] p-1 text-sm">
          {(['ask', 'board'] as const).map((v) => (
            <button key={v} role="tab" type="button" aria-selected={view === v} onClick={() => setView(v)}
              className={cn('rounded-md py-1.5 font-medium', view === v ? 'bg-[rgb(var(--panel))] text-ink shadow' : 'text-muted')}>{v === 'ask' ? (current ? t('myPass') : t('requestPass')) : t('passBoard')}</button>
          ))}
        </div>

        <div className="overflow-y-auto p-5" style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
          {mine.length > 1 && (
            <label className="mb-4 block">
              <span className="label">{t('whichClass')}</span>
              <select className="input" value={classId} onChange={(e) => setClassId(e.target.value)}>
                {mine.map((c) => <option key={c.id} value={c.id}>{[c.section, c.name].filter(Boolean).join(' · ')}</option>)}
              </select>
            </label>
          )}

          {view === 'board' ? (
            board ? <PassBoardView board={board} onBack={(id) => void passBack(id)} /> : <p className="text-sm text-muted">…</p>
          ) : current ? (
            <MyPassCard pass={current} board={board} />
          ) : board && !board.on ? (
            <p className="rounded-lg border border-line p-4 text-sm text-muted">{t('passesOff')}</p>
          ) : (
            <form onSubmit={ask}>
              <fieldset>
                <legend className="mb-2 text-xs font-medium text-muted">{t('where')}</legend>
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
                  {PASS_DESTS.map((d) => {
                    const Icon = DEST_ICON[d];
                    return (
                      <label key={d} className={cn('flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-medium transition-colors',
                        dest === d ? 'border-ember/60 bg-ember/[0.08] text-ink' : 'border-line text-muted hover:text-ink')}>
                        <input type="radio" name="pass-dest" value={d} checked={dest === d} onChange={() => setDest(d)} className="sr-only" />
                        <Icon size={20} aria-hidden />{t(`dest.${d}`)}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              <label className="mt-4 block">
                <span className="mb-1.5 block text-xs font-medium text-muted">{t('noteLabel')}</span>
                <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder={t('notePlaceholder')} className="input" />
              </label>
              <label className="mt-3 flex items-start gap-2 text-sm text-muted">
                <input type="checkbox" checked={buddy} onChange={(e) => setBuddy(e.target.checked)} className="mt-0.5 accent-[rgb(var(--nx-ember))]" />
                <span>{t('withClassmateAsk')}<span className="block text-2xs text-faint">{t('withClassmateHint')}</span></span>
              </label>
              {err && <p role="alert" className="mt-3 text-sm text-bad">{err}</p>}
              <button type="submit" disabled={busy || !classId} className="btn-primary btn-lg mt-5 w-full justify-center"><Ticket size={17} aria-hidden />{t('askForPass')}</button>
              <p className="mt-2 text-center text-2xs text-faint">{t('approvalNote')}</p>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** The student's own pass, in whichever state it is. One button at most. */
function MyPassCard({ pass, board }: { pass: Pass; board: Board | null }) {
  const t = useTranslations('pass');
  const now = useTick(pass.status === 'out', 1000);
  const [busy, setBusy] = useState(false);
  const limit = (board?.minutes ?? pass.class?.pass_minutes ?? 8) * 60;
  const pos = board ? board.queue.findIndex((r) => r.id === pass.id) + 1 : 0;
  const s = pass.out_at ? Math.max(0, Math.floor((now - Date.parse(pass.out_at)) / 1000)) : 0;
  const Icon = DEST_ICON[pass.destination];
  const act = async (fn: () => Promise<unknown>) => { setBusy(true); await fn(); setBusy(false); };
  if (pass.status === 'out') {
    const over = s > limit;
    return (
      <div className={cn('rounded-2xl border p-5 text-center', over ? 'border-bad/60 bg-bad/[0.07]' : 'border-ember/50 bg-ember/[0.06]')}>
        <Icon size={28} className="mx-auto ember-text" aria-hidden />
        <p className="mt-2 font-semibold">{t('youreOut', { place: t(`dest.${pass.destination}`) })}</p>
        <p className={cn('mt-1 font-mono text-5xl font-semibold tabular-nums', over && 'text-bad')}>{mmss(s)}</p>
        <p className="mt-1 text-xs text-muted">{over ? t('overLimit') : t('limit', { min: Math.round(limit / 60) })}</p>
        <button type="button" disabled={busy} onClick={() => void act(() => passBack(pass.id))} className="btn-primary btn-lg mt-5 w-full justify-center"><Undo2 size={17} aria-hidden />{t('imBack')}</button>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-line p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06]"><Icon size={18} aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{pass.status === 'pending' ? t('waitingApproval') : pos ? t('approvedLine', { n: pos }) : t('approved')}</p>
          <p className="text-xs text-muted">{t(`dest.${pass.destination}`)}{pass.with_classmate ? ` · ${t('withClassmate')}` : ''}{pass.note ? ` · “${pass.note}”` : ''}</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted">{pass.status === 'pending' ? t('pendingHint') : t('queuedHint')}</p>
      <button type="button" disabled={busy} onClick={() => void act(() => cancelPass(pass.id))} className="btn mt-4 w-full justify-center"><X size={15} aria-hidden />{t('cancel')}</button>
    </div>
  );
}

/**
 * Student pill while a pass is open — waiting, in line, or out with a timer and "I'm back".
 * Chimes (if sounds are on) when the teacher approves and when it's their turn.
 */
export function MyPassPill() {
  const live = useLive();
  const t = useTranslations('pass');
  const passes = useMemo(() => (live?.myPasses ?? []).filter((p) => OPEN.has(p.status)), [live?.myPasses]);
  const out = passes.find((p) => p.status === 'out');
  const now = useTick(!!out, 1000);
  const [toast, setToast] = useState<string | null>(null);
  const prev = useRef<Map<string, string>>(new Map());
  const first = useRef(true);
  useEffect(() => {
    const all = live?.myPasses ?? [];
    if (!first.current) {
      for (const p of all) {
        const was = prev.current.get(p.id);
        if (was && was !== p.status) {
          if (p.status === 'out') { setToast(t('yourTurn')); if (soundOn()) chime('seen'); }
          else if (p.status === 'queued') { setToast(t('approvedToast')); if (soundOn()) chime('seen'); }
          else if (p.status === 'denied') setToast(t('deniedToast'));
          else if (p.status === 'expired') setToast(t('expiredToast'));
        }
      }
    }
    first.current = false;
    prev.current = new Map(all.map((p) => [p.id, p.status]));
    const tm = setTimeout(() => setToast(null), 7000);
    return () => clearTimeout(tm);
  }, [live?.myPasses, t]);

  if (!live || (!passes.length && !toast)) return null;
  return (
    <div className="fixed bottom-20 left-4 z-[45] flex max-w-[calc(100vw-2rem)] flex-col gap-2 sm:max-w-sm" style={{ marginBottom: 'env(safe-area-inset-bottom)' }} aria-live="polite">
      {toast && <div className="rounded-full border border-ember/40 bg-[rgb(var(--panel))] px-4 py-2 text-sm font-medium shadow-xl">{toast}</div>}
      {passes.map((p) => {
        const Icon = DEST_ICON[p.destination];
        const s = p.out_at ? Math.max(0, Math.floor((now - Date.parse(p.out_at)) / 1000)) : 0;
        const over = p.status === 'out' && s > (p.class?.pass_minutes ?? 8) * 60;
        return (
          <div key={p.id} className={cn('flex items-center gap-2 rounded-full border bg-[rgb(var(--panel))] py-1.5 pl-2 pr-1.5 shadow-xl', over ? 'border-bad/60' : 'border-ember/50')}>
            <button type="button" onClick={() => live.openPass(p.class_id, 'ask')} className="flex min-w-0 flex-1 items-center gap-2 text-left">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ember/15 ember-text"><Icon size={15} aria-hidden /></span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">
                  {p.status === 'out' ? <span className={cn('font-mono tabular-nums', over && 'text-bad')}>{mmss(s)}</span> : p.status === 'pending' ? t('pillWaiting') : t('pillInLine')}
                </span>
                <span className="block truncate text-2xs text-muted">{t('hallPass')} · {p.class?.section ?? p.class?.name}</span>
              </span>
            </button>
            {p.status === 'out'
              ? <button type="button" className="btn-primary btn-sm whitespace-nowrap rounded-full" onClick={() => void passBack(p.id)}><Check size={14} aria-hidden />{t('imBack')}</button>
              : <button type="button" className="btn-ghost btn-sm h-8 w-8 justify-center rounded-full p-0" aria-label={t('cancel')} title={t('cancel')} onClick={() => void cancelPass(p.id)}><X size={15} aria-hidden /></button>}
          </div>
        );
      })}
    </div>
  );
}


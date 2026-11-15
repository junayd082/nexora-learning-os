'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { Maximize2, Minimize2, Pause, Play, Plus, Square, Timer as TimerIcon, X } from 'lucide-react';
import { DEFAULT_SCHEDULE, bellState, schoolClock } from '@/lib/bell';
import { chime } from '@/lib/chime';
import { addTime, endTimer, mmss, pauseTimer, resumeTimer, secondsLeft, startTimer, useTick, type ClassTimer } from '@/lib/live';
import { hrefFor } from '@/components/companion/brain';
import { lightFor } from '@/components/Living';
import { cn } from '@/lib/util';
import { useLive, type LiveClass, type LocalTimer } from './LiveProvider';
import { RoomLine } from './RoomLine';

/** What the floating timer and projector show, whatever its source. */
export interface ShownTimer {
  key: string; source: 'class' | 'bell' | 'local';
  classId: string | null; kind: ClassTimer['kind']; label: string;
  left: number; total: number; paused: boolean; href: string | null;
  real?: ClassTimer;
}

/**
 * Bell timers: a Do Now set to "start with the bell" runs for its first N minutes of the period;
 * an exit ticket set that way runs for the last N minutes. Worked out on each device from the
 * bell schedule, so they need no one to press start.
 */
function bellTimers(classes: LiveClass[], now: number): ShownTimer[] {
  const st = bellState(now, DEFAULT_SCHEDULE);
  if (!st.day) return [];
  const { minutes } = schoolClock(now, DEFAULT_SCHEDULE.timezone);
  const out: ShownTimer[] = [];
  for (const c of classes) {
    const slot = c.period != null ? st.day.slots.find((s) => s.period === c.period) : null;
    if (!slot) continue;
    for (const i of c.items) {
      if (i.timer_mode !== 'bell' || !i.timer_minutes || (i.tag !== 'do_now' && i.tag !== 'exit_ticket')) continue;
      const len = i.timer_minutes;
      const from = i.tag === 'do_now' ? slot.start : slot.end - len;
      const to = from + len;
      if (minutes >= from && minutes < to) {
        out.push({ key: `bell-${i.id}`, source: 'bell', classId: c.id, kind: i.tag, label: i.title, left: Math.ceil((to - minutes) * 60), total: len * 60, paused: false, href: hrefFor(c.id, i) });
      }
    }
  }
  return out;
}

function localShown(lt: LocalTimer | null, now: number): ShownTimer | null {
  if (!lt) return null;
  const left = lt.status === 'paused' ? lt.remaining_s ?? 0 : Math.max(0, Math.ceil(((lt.ends_at ?? now) - now) / 1000));
  return { key: 'local', source: 'local', classId: null, kind: 'manual', label: lt.label, left, total: lt.duration_s, paused: lt.status === 'paused', href: null };
}

/** Every timer that should be on screen now: class timers first, then bell timers for classes without one. */
export function useShownTimers(now: number): ShownTimer[] {
  const live = useLive();
  return useMemo(() => {
    if (!live) return [];
    const real: ShownTimer[] = live.timers.map((tm) => {
      const cls = live.classes.find((c) => c.id === tm.class_id);
      const item = tm.item_id ? cls?.items.find((i) => i.id === tm.item_id) : null;
      return { key: tm.id, source: 'class' as const, classId: tm.class_id, kind: tm.kind, label: tm.label, left: secondsLeft(tm, now), total: tm.duration_s, paused: tm.status === 'paused', href: item && cls ? hrefFor(cls.id, item) : null, real: tm };
    });
    const busy = new Set(real.map((r) => r.classId));
    const bell = bellTimers(live.classes, now).filter((b) => !busy.has(b.classId));
    const local = localShown(live.localTimer, now);
    const current = bellState(now).current?.period;
    const periodOf = (id: string | null) => live.classes.find((c) => c.id === id)?.period;
    return [...(local ? [local] : []), ...[...real, ...bell].sort((a, b) => Number(periodOf(b.classId) === current) - Number(periodOf(a.classId) === current))];
  }, [live, now]);
}

function Ring({ value, light, size = 30 }: { value: number; light: string; size?: number }) {
  const r = size / 2 - 3, c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(255 255 255 / 0.1)" strokeWidth="3" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`rgb(${light})`} strokeWidth="3" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, value)))} style={{ transition: 'stroke-dashoffset 1s linear' }} />
    </svg>
  );
}

const kindLabel = (t: (k: string) => string, tm: ShownTimer) => tm.kind === 'do_now' ? t('doNow') : tm.kind === 'exit_ticket' ? t('exitTicket') : (tm.label || t('timer'));

/**
 * Floating countdown under the top bar, on every page. Students see their class's timer
 * (tap to open the Do Now / exit ticket); teachers also get pause, +1 min, stop and "Project".
 */
export function TimerPills() {
  const live = useLive();
  const t = useTranslations('live');
  const now = useTick(true, 500);
  const shown = useShownTimers(now);
  const [ended, setEnded] = useState<ShownTimer[]>([]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const last = useRef<Map<string, ShownTimer>>(new Map());

  // Reaching zero: show "Time's up" briefly; the teacher's screen chimes and closes the timer.
  useEffect(() => {
    const cur = new Map(shown.map((s) => [s.key, s]));
    for (const [k, s] of last.current) {
      const n = cur.get(k);
      const finished = (n && n.left === 0 && s.left > 0) || (!n && s.left <= 2 && !s.paused);
      if (finished) {
        setEnded((e) => [...e.filter((x) => x.key !== k), { ...s, left: 0 }]);
        setTimeout(() => setEnded((e) => e.filter((x) => x.key !== k)), 10_000);
        if (live?.isEducator) chime('timesUp');
        if (live?.isEducator && n?.real) void endTimer(n.real, 'done');
        if (k === 'local') live?.setLocalTimer(null);
      }
    }
    last.current = cur;
  }, [shown, live]);

  const visible = [...shown.filter((s) => s.left > 0 || s.paused), ...ended.filter((e) => !shown.some((s) => s.key === e.key && s.left > 0))];
  const projected = live?.projecting ? [...shown, ...ended].find((s) => s.key === live.projecting) : null;
  if (!mounted || !live || (!visible.length && !projected)) return null;

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-[62px] z-[44] flex flex-col items-center gap-2 px-3" aria-live="polite">
        {visible.slice(0, 3).map((s) => pill(s, live.isEducator))}
      </div>
      {projected && <Projector s={projected} teacher={live.isEducator} />}
    </>
  );

  function pill(s: ShownTimer, teacher: boolean) {
    const cls = live!.classes.find((c) => c.id === s.classId);
    const light = s.classId ? lightFor(s.classId) : 'var(--nx-ember)';
    const done = s.left === 0 && !s.paused;
    const urgent = !done && !s.paused && s.left <= 10;
    const low = !done && !s.paused && s.left <= 60;
    const body = (
      <>
        <Ring value={s.total ? s.left / s.total : 0} light={done ? 'var(--nx-ember)' : light} />
        <span className="min-w-0">
          <span className="block truncate text-2xs font-semibold uppercase tracking-[0.08em] text-muted">
            {kindLabel(t as unknown as (k: string) => string, s)}{cls?.period != null ? ` · P${cls.period}` : ''}{s.source === 'bell' ? ` · ${t('bellTimer')}` : ''}
          </span>
          <span className={cn('block font-mono text-lg font-semibold leading-tight tabular-nums', done ? 'ember-text' : urgent ? 'text-bad' : low ? 'text-[rgb(245_192_74)]' : '')}>
            {done ? t('timesUp') : mmss(s.left)}{s.paused && <span className="ml-1.5 text-2xs font-sans font-medium text-muted">{t('paused')}</span>}
          </span>
        </span>
      </>
    );
    return (
      <div key={s.key} className={cn('pointer-events-auto flex items-center gap-2.5 rounded-full border bg-[rgb(var(--panel)/0.92)] py-1.5 pl-1.5 pr-2 shadow-2xl backdrop-blur-md',
        urgent && 'nx-timer-urgent', done ? 'border-ember/60' : 'border-line')} style={{ boxShadow: `0 10px 40px -12px rgb(${light} / 0.55)` }}>
        {s.href && !teacher ? <Link href={s.href} className="flex items-center gap-2.5">{body}</Link> : <span className="flex items-center gap-2.5">{body}</span>}
        {teacher && !done && s.source !== 'bell' && <Controls s={s} />}
        <button type="button" className="btn-ghost btn-sm h-8 w-8 justify-center rounded-full p-0" aria-label={t('project')} title={t('project')} onClick={() => live!.setProjecting(s.key)}>
          <Maximize2 size={14} aria-hidden />
        </button>
      </div>
    );
  }
}

function Controls({ s, big = false }: { s: ShownTimer; big?: boolean }) {
  const live = useLive();
  const t = useTranslations('live');
  const cls = big ? 'btn btn-lg' : 'btn-ghost btn-sm h-8 w-8 justify-center rounded-full p-0';
  const lt = live?.localTimer;
  const pause = () => {
    if (s.real) void pauseTimer(s.real);
    else if (lt) live!.setLocalTimer({ ...lt, status: 'paused', remaining_s: s.left, ends_at: null });
  };
  const resume = () => {
    if (s.real) void resumeTimer(s.real);
    else if (lt) live!.setLocalTimer({ ...lt, status: 'running', ends_at: Date.now() + (lt.remaining_s ?? 0) * 1000, remaining_s: null });
  };
  const plus = () => {
    if (s.real) void addTime(s.real, 60);
    else if (lt) live!.setLocalTimer(lt.status === 'paused' ? { ...lt, remaining_s: (lt.remaining_s ?? 0) + 60, duration_s: lt.duration_s + 60 } : { ...lt, ends_at: (lt.ends_at ?? Date.now()) + 60_000, duration_s: lt.duration_s + 60 });
  };
  const stop = () => {
    if (s.real) void endTimer(s.real, 'cancelled'); else live!.setLocalTimer(null);
    if (live?.projecting === s.key) live.setProjecting(null);
  };
  return (
    <span className="flex items-center gap-0.5">
      {s.paused
        ? <button type="button" className={cls} onClick={resume} aria-label={t('resume')} title={t('resume')}><Play size={big ? 18 : 14} aria-hidden />{big && t('resume')}</button>
        : <button type="button" className={cls} onClick={pause} aria-label={t('pause')} title={t('pause')}><Pause size={big ? 18 : 14} aria-hidden />{big && t('pause')}</button>}
      <button type="button" className={cls} onClick={plus} aria-label={t('addMinute')} title={t('addMinute')}><Plus size={big ? 18 : 14} aria-hidden />{big ? t('addMinute') : <span className="sr-only">1</span>}</button>
      <button type="button" className={cls} onClick={stop} aria-label={t('stop')} title={t('stop')}><Square size={big ? 16 : 12} aria-hidden />{big && t('stop')}</button>
    </span>
  );
}

/** Full-screen countdown for the classroom board. */
function Projector({ s, teacher }: { s: ShownTimer; teacher: boolean }) {
  const live = useLive();
  const t = useTranslations('live');
  const ref = useRef<HTMLDivElement>(null);
  const [fs, setFs] = useState(false);
  const cls = live?.classes.find((c) => c.id === s.classId);
  const light = s.classId ? lightFor(s.classId) : 'var(--nx-ember)';
  const done = s.left === 0 && !s.paused;
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.fullscreenElement) live?.setProjecting(null); };
    const f = () => setFs(!!document.fullscreenElement);
    document.addEventListener('keydown', k); document.addEventListener('fullscreenchange', f);
    return () => { document.removeEventListener('keydown', k); document.removeEventListener('fullscreenchange', f); };
  }, [live]);
  const pct = s.total ? s.left / s.total : 0;
  return createPortal(
    <div ref={ref} role="dialog" aria-modal="true" aria-label={t('project')} className="fixed inset-0 z-[90] flex flex-col items-center justify-center px-6"
      style={{ background: `radial-gradient(80% 70% at 50% 40%, rgb(${light} / 0.22), transparent 70%), rgb(var(--nx-carbon-1, 12 12 16))` }}>
      <div className="absolute right-4 top-4 flex gap-2" style={{ top: 'max(16px, env(safe-area-inset-top))' }}>
        <button type="button" className="btn btn-sm" onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void ref.current?.requestFullscreen?.().catch(() => undefined); }}>
          {fs ? <Minimize2 size={15} aria-hidden /> : <Maximize2 size={15} aria-hidden />}{fs ? t('exitFull') : t('fullScreen')}
        </button>
        <button type="button" className="btn btn-sm" onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); live?.setProjecting(null); }} aria-label={t('close')}><X size={15} aria-hidden /></button>
      </div>
      <p className="text-center text-xl font-semibold uppercase tracking-[0.18em] text-muted sm:text-2xl">
        {kindLabel(t as unknown as (k: string) => string, s)}{cls ? ` · ${cls.section ?? cls.name}` : ''}
      </p>
      {s.kind !== 'manual' && s.label && <p className="mt-2 max-w-3xl text-center text-lg text-ink/80 sm:text-2xl">{s.label}</p>}
      <p className={cn('mt-4 whitespace-nowrap font-mono font-semibold leading-none tabular-nums', done && 'ember-text', !done && s.left <= 10 && !s.paused && 'text-bad nx-timer-urgent')}
        style={{ fontSize: 'clamp(80px, 22vw, 400px)' }} aria-live="off">
        {done ? t('timesUp') : mmss(s.left)}
      </p>
      <div className="mt-8 h-2 w-full max-w-4xl overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full" style={{ width: `${pct * 100}%`, background: `rgb(${light})`, transition: 'width 1s linear', boxShadow: `0 0 24px rgb(${light} / 0.7)` }} />
      </div>
      {teacher && s.classId && <RoomLine classId={s.classId} kind={s.kind} />}
      {s.paused && <p className="mt-4 text-lg text-muted">{t('paused')}</p>}
      {teacher && !done && s.source !== 'bell' && <div className="mt-10"><Controls s={s} big /></div>}
    </div>,
    document.body,
  );
}

const PRESETS = [1, 2, 3, 5, 10, 15];

/**
 * Teacher: the timer button in the top bar. Start a shared class timer (students see it on their
 * screens) or a private one, from presets or a custom time, or start today's Do Now / exit ticket
 * timer in one tap.
 */
export function TimerTool() {
  const live = useLive();
  const t = useTranslations('live');
  const tn = useTranslations('nova');
  const [open, setOpen] = useState(false);
  const now = useTick(open, 1000);
  const mine = useMemo(() => (live?.classes ?? []).filter((c) => c.teacher), [live?.classes]);
  const [target, setTarget] = useState<string>('');
  const [mins, setMins] = useState(5);
  const [secs, setSecs] = useState(0);
  const [label, setLabel] = useState('');
  const [show, setShow] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const shown = useShownTimers(now);
  const running = !!(live?.timers.length || live?.localTimer);
  useEffect(() => {
    const h = () => setOpen(true);
    window.addEventListener('nexora:open-timer', h);
    return () => window.removeEventListener('nexora:open-timer', h);
  }, []);

  useEffect(() => {
    if (!open) return;
    const cur = bellState(Date.now()).current?.period;
    setTarget((t0) => t0 || mine.find((c) => c.period === cur)?.id || mine[0]?.id || 'local');
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k);
  }, [open, mine]);

  if (!live?.isEducator) return null;
  const cls = mine.find((c) => c.id === target);
  const timed = (cls?.items ?? []).filter((i) => (i.tag === 'do_now' || i.tag === 'exit_ticket'));
  const activeHere = shown.find((s) => (target === 'local' ? s.source === 'local' : s.classId === target && s.source === 'class'));

  async function start(seconds: number, kind: ClassTimer['kind'], lbl: string, item?: { type: 'material' | 'assignment'; id: string }) {
    setErr(null);
    if (seconds < 5) return;
    if (target === 'local') {
      live!.setLocalTimer({ label: lbl || t('timer'), duration_s: seconds, ends_at: Date.now() + seconds * 1000, remaining_s: null, status: 'running' });
      setOpen(false); return;
    }
    setBusy(true);
    const { error } = await startTimer({ classId: target, kind, label: lbl, seconds, item, show });
    setBusy(false);
    if (error) setErr(t('timerFailed')); else setOpen(false);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={open} aria-label={t('timerTool')} title={t('timerTool')}
        className={cn('btn-ghost btn-sm h-9 w-9 justify-center p-0', running && 'ember-text')}>
        <TimerIcon size={18} aria-hidden />
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-[75]" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <section role="dialog" aria-labelledby="timer-h" className="absolute inset-x-2 top-16 max-h-[calc(100dvh-5rem)] overflow-y-auto rounded-2xl border border-line p-4 shadow-2xl sm:inset-x-auto sm:right-4 sm:w-[400px]"
            style={{ background: 'rgb(var(--panel))' }}>
            <div className="flex items-center gap-2">
              <TimerIcon size={18} className="ember-text" aria-hidden />
              <h2 id="timer-h" className="flex-1 font-semibold">{t('timerTool')}</h2>
              <button type="button" className="btn-ghost btn-sm h-8 w-8 justify-center p-0" onClick={() => setOpen(false)} aria-label={t('close')}><X size={15} aria-hidden /></button>
            </div>

            <label className="mt-4 block">
              <span className="label">{t('timerFor')}</span>
              <select className="input" value={target} onChange={(e) => setTarget(e.target.value)}>
                {mine.map((c) => <option key={c.id} value={c.id}>{[c.section, c.name].filter(Boolean).join(' · ')}</option>)}
                <option value="local">{t('justMe')}</option>
              </select>
            </label>

            {activeHere && (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-ember/40 bg-ember/[0.06] p-3">
                <span>
                  <span className="block text-2xs uppercase tracking-[0.08em] text-muted">{kindLabel(t as unknown as (k: string) => string, activeHere)}</span>
                  <span className="font-mono text-2xl font-semibold tabular-nums">{mmss(activeHere.left)}</span>
                  {activeHere.paused && <span className="ml-2 text-xs text-muted">{t('paused')}</span>}
                </span>
                <span className="flex items-center gap-1">
                  <Controls s={activeHere} />
                  <button type="button" className="btn-ghost btn-sm h-8 w-8 justify-center rounded-full p-0" onClick={() => { live.setProjecting(activeHere.key); setOpen(false); }} aria-label={t('project')} title={t('project')}><Maximize2 size={14} aria-hidden /></button>
                </span>
              </div>
            )}

            {timed.length > 0 && (
              <div className="mt-4">
                <span className="label">{t('todaysTimed')}</span>
                <ul className="space-y-1.5">
                  {timed.map((i) => {
                    const m = i.timer_minutes ?? (i.tag === 'do_now' ? 5 : 3);
                    return (
                      <li key={i.id} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2">
                        <span className="min-w-0 flex-1">
                          <span className="block text-2xs font-semibold uppercase tracking-[0.06em] text-muted">{tn(`tags.${i.tag!}`)} · {t('minutes', { n: m })}{i.timer_mode === 'bell' ? ` · ${t('bellTimer')}` : ''}</span>
                          <span className="block truncate text-sm">{i.title}</span>
                        </span>
                        <button type="button" className="btn btn-sm" disabled={busy}
                          onClick={() => void start(m * 60, i.tag as 'do_now' | 'exit_ticket', i.title, { type: i.type, id: i.id })}><Play size={13} aria-hidden />{t('start')}</button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <div className="mt-4">
              <span className="label">{t('quickStart')}</span>
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                {PRESETS.map((m) => (
                  <button key={m} type="button" disabled={busy} className="btn btn-sm justify-center px-0 tabular-nums" onClick={() => void start(m * 60, 'manual', label)}>{t('minutes', { n: m })}</button>
                ))}
              </div>
            </div>

            <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); void start(mins * 60 + secs, 'manual', label); }}>
              <div className="grid grid-cols-[1fr_1fr_2fr] gap-2">
                <label><span className="label">{t('min')}</span><input type="number" inputMode="numeric" min={0} max={120} value={mins} onChange={(e) => setMins(Math.max(0, Math.min(120, Number(e.target.value) || 0)))} className="input tabular-nums" /></label>
                <label><span className="label">{t('sec')}</span><input type="number" inputMode="numeric" min={0} max={59} step={5} value={secs} onChange={(e) => setSecs(Math.max(0, Math.min(59, Number(e.target.value) || 0)))} className="input tabular-nums" /></label>
                <label><span className="label">{t('labelOptional')}</span><input value={label} maxLength={60} onChange={(e) => setLabel(e.target.value)} placeholder={t('labelPlaceholder')} className="input" /></label>
              </div>
              {target !== 'local' && (
                <label className="flex items-center gap-2 text-sm text-muted">
                  <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="accent-[rgb(var(--nx-ember))]" />{t('showStudents')}
                </label>
              )}
              {activeHere && <p className="text-2xs text-faint">{t('replaces')}</p>}
              {err && <p role="alert" className="text-sm text-bad">{err}</p>}
              <button type="submit" disabled={busy || mins * 60 + secs < 5} className="btn-primary w-full justify-center"><Play size={15} aria-hidden />{t('startTimer', { time: mmss(mins * 60 + secs) })}</button>
            </form>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}

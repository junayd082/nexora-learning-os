'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowRight, Check, ChevronLeft, ChevronRight, Megaphone, Soup, Timer as TimerIcon, Undo2 } from 'lucide-react';
import { DEFAULT_SCHEDULE, bellState, clockLabel, nextMeeting, schoolClock, type DayPlan, type Slot } from '@/lib/bell';
import { lightFor } from '@/components/Living';
import { TagChip } from '@/components/TagChip';
import { hrefFor, type BriefItem } from '@/components/companion/brain';
import { cn } from '@/lib/util';

export interface HomeClass {
  id: string; name: string; section: string | null; period: number | null; teacher: string | null;
  items: BriefItem[]; due: BriefItem[]; update: { body: string; created_at: string; pinned: boolean } | null;
  students?: number; waiting?: number;
}

const SCHED = DEFAULT_SCHEDULE;
const TAG_ORDER = ['do_now', 'lecture', 'activity', 'homework', 'exit_ticket', 'resource', null];
const done = (i: BriefItem) => i.status === 'submitted' || i.status === 'returned';

/** Weekday name in the viewer's language (0 = Sunday). */
function weekdayName(wd: number, locale: string) {
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-US' : 'en-US', { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 0, 4 + wd)));
}

/** The clock, refreshed every 20 s. Starts at the server's time so the first paint matches. */
function useNow(serverNow: number) {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 20_000);
    const vis = () => { if (document.visibilityState === 'visible') setNow(Date.now()); };
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', vis); };
  }, []);
  return now;
}

type Focus =
  | { mode: 'now'; cls: HomeClass; slot: Slot }
  | { mode: 'soon'; cls: HomeClass; slot: Slot; inMin: number }
  | { mode: 'later'; cls: HomeClass; slot: Slot; inDays: number; weekday: number };

/**
 * Home's first card. Works out, from the bell schedule and the clock, which class the person is in
 * (or heading to) and puts it front and centre: period, class, teacher, time left, today's plan and
 * the latest word from the teacher. Re-evaluates itself as periods change — no refresh needed.
 */
export function ClassNow({ classes, role, serverNow, greeting }:
  { classes: HomeClass[]; role: 'student' | 'teacher'; serverNow: number; greeting: string }) {
  const t = useTranslations('now');
  const tn = useTranslations('nova');
  const locale = useLocale();
  const now = useNow(serverNow);
  const bell = useMemo(() => bellState(now, SCHED), [now]);
  const byPeriod = useMemo(() => {
    const map = new Map<number, HomeClass>();
    classes.forEach((c) => { if (c.period != null && !map.has(c.period)) map.set(c.period, c); });
    return map;
  }, [classes]);

  const focus: Focus | null = useMemo(() => {
    const today = bell.day?.slots ?? [];
    if (bell.current) {
      const cls = byPeriod.get(bell.current.period);
      if (cls) return { mode: 'now', cls, slot: bell.current };
    }
    const upcoming = today.find((s) => s.start > bell.minutes && byPeriod.has(s.period));
    if (upcoming) return { mode: 'soon', cls: byPeriod.get(upcoming.period)!, slot: upcoming, inMin: Math.max(0, Math.ceil(upcoming.start - bell.minutes)) };
    let best: Focus | null = null;
    for (const [p, cls] of byPeriod) {
      const nm = nextMeeting(p, now, SCHED);
      if (!nm || nm.inDays === 0) continue;
      if (!best || best.mode !== 'later' || nm.inDays < best.inDays || (nm.inDays === best.inDays && nm.slot.start < best.slot.start)) {
        best = { mode: 'later', cls, slot: nm.slot, inDays: nm.inDays, weekday: nm.weekday };
      }
    }
    return best;
  }, [bell, byPeriod, now]);

  // ---- Carousel: every class with a period, in bell order. It opens on the class that matters now;
  // students move left/right (arrows, keys, swipe, dots or the bell rail) to see any other class.
  const order = useMemo(() => classes.filter((c) => c.period != null).sort((a, b) => a.period! - b.period!), [classes]);
  const [sel, setSel] = useState<string | null>(null);          // null = follow "now"
  const [dir, setDir] = useState<1 | -1>(1);
  const swipe = useRef<{ x: number; y: number } | null>(null);

  if (!focus) return null;
  const otherInSession = bell.current && !byPeriod.has(bell.current.period) ? bell.current.period : null;

  // Headline always answers "where should I be right now?" — it does not move with the carousel.
  let headline: string;
  if (focus.mode === 'now') headline = role === 'teacher' ? t('teaching', { period: focus.slot.period }) : t('inClass', { period: focus.slot.period });
  else if (focus.mode === 'soon') headline = focus.inMin <= 60 ? t('startsIn', { period: focus.slot.period, min: focus.inMin }) : t('startsAt', { period: focus.slot.period, time: clockLabel(focus.slot.start, locale) });
  else headline = bell.phase === 'off' ? t('noSchool') : t('out');

  /** The card for any class: in session now, later today, or the next day it meets. */
  const slideFor = (c: HomeClass): Focus | null => {
    if (focus.cls.id === c.id) return focus;
    const p = c.period!;
    if (bell.current?.period === p) return { mode: 'now', cls: c, slot: bell.current };
    const nm = nextMeeting(p, now, SCHED);
    if (!nm) return null;
    if (nm.inDays === 0) return { mode: 'soon', cls: c, slot: nm.slot, inMin: Math.max(0, Math.ceil(nm.slot.start - bell.minutes)) };
    return { mode: 'later', cls: c, slot: nm.slot, inDays: nm.inDays, weekday: nm.weekday };
  };
  const curId = sel && order.some((c) => c.id === sel) ? sel : focus.cls.id;
  const idx = Math.max(0, order.findIndex((c) => c.id === curId));
  const view = (order[idx] && slideFor(order[idx])) || focus;
  const browsing = view.cls.id !== focus.cls.id;
  const many = order.length > 1;
  const go = (delta: 1 | -1) => {
    if (!many) return;
    const next = order[(idx + delta + order.length) % order.length];
    setDir(delta);
    setSel(next.id === focus.cls.id ? null : next.id);
  };
  const pick = (id: string) => {
    const to = order.findIndex((c) => c.id === id);
    if (to < 0) return;
    setDir(to >= idx ? 1 : -1);
    setSel(id === focus.cls.id ? null : id);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).closest('input,textarea,select')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
  };

  const { cls, slot } = view;
  const light = lightFor(cls.id);
  const range = `${clockLabel(slot.start, locale)} – ${clockLabel(slot.end, locale)}`;
  const whenLine = view.mode === 'later'
    ? `${view.inDays === 1 ? t('tomorrow') : weekdayName(view.weekday, locale)} · ${clockLabel(slot.start, locale)}`
    : view.mode === 'soon' ? `${t('today')} · ${range}` : range;

  // ---- What the card shows for this class
  const meetsToday = view.mode !== 'later';
  const plan = meetsToday ? [...cls.items].sort((a, b) => TAG_ORDER.indexOf(a.tag) - TAG_ORDER.indexOf(b.tag)) : [];
  const planIds = new Set(plan.map((i) => i.id));
  const dueNext = cls.due.filter((i) => !done(i) && !planIds.has(i.id) && i.due_at && Date.parse(i.due_at) > now - 86_400_000)
    .sort((a, b) => (a.due_at ?? '').localeCompare(b.due_at ?? '')).slice(0, 4);
  const firstOpen = plan.find((i) => !done(i));
  const elapsed = view.mode === 'now' ? (bell.minutes - slot.start) / (slot.end - slot.start) : 0;
  const left = view.mode === 'now' ? Math.max(1, Math.ceil(slot.end - bell.minutes)) : 0;
  const lunchNow = view.mode === 'now' ? bell.lunch : null;

  const itemList = (list: BriefItem[], highlight: boolean) => (
    <ol className="mt-3 space-y-2">
      {list.map((i) => {
        const isDone = done(i);
        const start = highlight && !isDone && firstOpen?.id === i.id;
        return (
          <li key={`${i.type}${i.id}`}>
            <Link href={hrefFor(cls.id, i)}
              className={cn('group flex items-center gap-3 rounded-md border px-3 py-2.5 transition-colors', start ? 'border-ember/50 bg-ember/[0.06]' : 'border-line bg-sunk/40 hover:border-ember/40', isDone && 'opacity-60')}>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  {i.tag ? <TagChip tag={i.tag} label={tn(`tags.${i.tag}`)} /> : null}
                  {i.timer_minutes && (i.tag === 'do_now' || i.tag === 'exit_ticket') && (
                    <span className="inline-flex items-center gap-1 text-2xs text-muted"><TimerIcon size={11} aria-hidden />{t('timerMin', { n: i.timer_minutes })}</span>
                  )}
                  {start && <span className="text-2xs font-semibold ember-text">{t('startHere')}</span>}
                </span>
                <span className={cn('mt-1 block truncate text-sm font-medium', isDone && 'line-through decoration-faint')}>{i.title}</span>
                {!highlight && i.due_at && <span className="block text-2xs text-muted">{t('dueWhen', { when: new Intl.DateTimeFormat(locale === 'es' ? 'es-US' : 'en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: SCHED.timezone }).format(new Date(i.due_at)) })}</span>}
              </span>
              {isDone
                ? <span className="inline-flex items-center gap-1 text-2xs text-ok"><Check size={13} aria-hidden />{t('done')}</span>
                : <ArrowRight size={15} className="shrink-0 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-ember" aria-hidden />}
            </Link>
          </li>
        );
      })}
    </ol>
  );

  const navButtons = many && (
    <div className="flex shrink-0 items-center gap-1.5">
      <span className="mr-1 text-2xs tabular-nums text-muted" aria-hidden>{t('slideOf', { i: idx + 1, n: order.length })}</span>
      <button type="button" onClick={() => go(-1)} className="btn btn-sm h-8 w-8 justify-center rounded-full p-0" aria-label={t('navPrev')} title={`${t('navPrev')} (←)`}><ChevronLeft size={16} aria-hidden /></button>
      <button type="button" onClick={() => go(1)} className="btn btn-sm h-8 w-8 justify-center rounded-full p-0" aria-label={t('navNext')} title={`${t('navNext')} (→)`}><ChevronRight size={16} aria-hidden /></button>
    </div>
  );

  return (
    <section aria-labelledby="class-now-h" className="mb-10" onKeyDown={onKey}>
      <div className="eyebrow ember-text nx-onscene">{greeting.toUpperCase()}</div>
      <h1 id="class-now-h" className="nx-onscene display mt-3 text-4xl leading-[1.05] sm:text-5xl" style={{ textWrap: 'balance' }}>{headline}</h1>
      {otherInSession && focus.mode !== 'now' && (
        <p className="nx-onscene mt-2 text-sm text-muted">{t('otherPeriod', { period: otherInSession, end: clockLabel(bell.current!.end, locale) })}</p>
      )}

      {/* Carousel: arrows, ← → keys (when focused), swipe on touch screens, dots and the bell rail. */}
      <div role="region" aria-roledescription={t('carousel')} aria-label={t('carouselLabel')} tabIndex={many ? 0 : -1}
        className="group/car relative mt-7 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ember/60"
        onPointerDown={(e) => { if (e.pointerType !== 'mouse') swipe.current = { x: e.clientX, y: e.clientY }; }}
        onPointerUp={(e) => {
          const st = swipe.current; swipe.current = null;
          if (!st) return;
          const dx = e.clientX - st.x, dy = e.clientY - st.y;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
        }}
        onPointerCancel={() => { swipe.current = null; }}
        style={{ touchAction: 'pan-y' }}>
        <p className="sr-only" aria-live="polite">{t('period', { period: slot.period })} · {cls.name}</p>

        <div className="lit-edge card overflow-hidden" style={{ ['--glow' as string]: light }}>
          <div className="h-[2px]" style={{ background: `linear-gradient(90deg, rgb(${light}), rgb(${light} / 0) 75%)` }} />
          <div key={cls.id} className="nx-slide grid gap-0 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]" style={{ ['--dir' as string]: dir }}>
            {/* ---------- Class plate ---------- */}
            <div className="relative flex gap-5 p-5 sm:p-7">
              <div className="flex h-[112px] w-[88px] shrink-0 flex-col items-center justify-center self-start rounded-lg border sm:h-[128px] sm:w-[104px]"
                style={{ borderColor: `rgb(${light} / 0.45)`, background: `radial-gradient(120% 100% at 50% 0%, rgb(${light} / 0.22), transparent 70%)` }}
                aria-label={t('period', { period: slot.period })}>
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: `rgb(${light})` }}>{t('periodWord')}</span>
                <span className="text-[56px] font-semibold leading-none tracking-[-0.04em] sm:text-[64px]" aria-hidden>{slot.period}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  {view.mode === 'now'
                    ? <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: `rgb(${light})` }}><span className="live-dot" aria-hidden />{t('inSession')}</span>
                    : <span className="font-semibold text-ink/80">{browsing ? t('meets') : t('nextClass')}</span>}
                  <span aria-hidden>·</span><span className="tabular-nums">{whenLine}</span>
                </div>
                <h2 className="mt-1.5 text-xl font-bold uppercase leading-tight tracking-[0.03em] sm:text-2xl">{cls.name}</h2>
                <p className="mt-1 text-sm text-muted">
                  {role === 'teacher'
                    ? <>{t('students', { count: cls.students ?? 0 })}{cls.waiting ? <> · <span className="ember-text">{t('waiting', { count: cls.waiting })}</span></> : null}</>
                    : cls.teacher ? t('with', { teacher: cls.teacher }) : null}
                </p>

                {view.mode === 'now' && (
                  <div className="mt-5">
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(elapsed * 100)} aria-label={t('left', { min: left })}>
                      <div className="h-full rounded-full transition-[width] duration-1000" style={{ width: `${Math.round(elapsed * 100)}%`, background: `rgb(${light})`, boxShadow: `0 0 12px rgb(${light} / 0.6)` }} />
                    </div>
                    <div className="mt-1.5 flex justify-between text-2xs tabular-nums text-muted">
                      <span>{clockLabel(slot.start, locale)}</span>
                      <span>{t('left', { min: left })}</span>
                      <span>{clockLabel(slot.end, locale)}</span>
                    </div>
                  </div>
                )}
                {view.mode === 'soon' && !browsing && view.inMin <= 10 && (
                  <p className="mt-4 text-sm" style={{ color: `rgb(${light})` }}>{t('headThere')}</p>
                )}

                {slot.lunches && (
                  <div className="mt-4 flex flex-wrap items-center gap-1.5 text-2xs text-muted">
                    <Soup size={13} aria-hidden />
                    {lunchNow
                      ? <span className="font-medium text-ink">{t('lunchNow', { letter: lunchNow.letter, end: clockLabel(lunchNow.end, locale) })}</span>
                      : <span>{t('lunches')}</span>}
                    {slot.lunches.map((l) => (
                      <span key={l.letter} className={cn('rounded border px-1.5 py-px tabular-nums', lunchNow?.letter === l.letter ? 'border-ember/50 text-ink' : 'border-line')}>
                        {l.letter} {clockLabel(l.start, locale)}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-6 flex flex-wrap items-center gap-2">
                  <Link href={`/classes/${cls.id}`} className="btn-primary inline-flex">
                    {t('openPeriod', { period: slot.period })} <ArrowRight size={15} aria-hidden />
                  </Link>
                  {browsing && (
                    <button type="button" className="btn btn-sm" onClick={() => { setDir(order.findIndex((c) => c.id === focus.cls.id) >= idx ? 1 : -1); setSel(null); }}>
                      <Undo2 size={14} aria-hidden />{t('backToNow', { period: focus.slot.period })}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* ---------- Today's plan · Due before next class · Announcement ---------- */}
            <div className="border-t border-line p-5 sm:p-7 md:border-l md:border-t-0">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">{meetsToday ? t('agendaToday') : t('beforeNext')}</h3>
                <div className="hidden md:block">{navButtons}</div>
              </div>
              {meetsToday ? (
                <>
                  {plan.length === 0 ? <p className="mt-3 text-sm text-muted">{t('agendaEmpty')}</p> : itemList(plan, true)}
                  {dueNext.length > 0 && (
                    <>
                      <h4 className="mt-5 text-xs font-semibold text-muted">{t('beforeNext')}</h4>
                      {itemList(dueNext, false)}
                    </>
                  )}
                </>
              ) : (
                dueNext.length === 0 ? <p className="mt-3 text-sm text-muted">{t('nothingDueBefore')}</p> : itemList(dueNext, false)
              )}
              {cls.update && (
                <div className="mt-5 rounded-md border border-line bg-white/[0.02] p-3">
                  <div className="flex items-center gap-1.5 text-2xs text-muted">
                    <Megaphone size={12} aria-hidden />
                    <span>{role === 'teacher' ? t('yourLatest') : t('fromTeacher', { teacher: cls.teacher ?? '' })}</span>
                  </div>
                  <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm">{cls.update.body}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Netflix-style edge arrows on computers (appear on hover / keyboard focus). */}
        {many && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label={t('navPrev')} tabIndex={-1}
              className="absolute left-0 top-1/2 z-10 hidden h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/70 text-white opacity-0 shadow-2xl backdrop-blur transition-opacity hover:bg-black/85 group-hover/car:opacity-100 group-focus-within/car:opacity-100 md:flex">
              <ChevronLeft size={28} aria-hidden />
            </button>
            <button type="button" onClick={() => go(1)} aria-label={t('navNext')} tabIndex={-1}
              className="absolute right-0 top-1/2 z-10 hidden h-14 w-14 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full border border-white/15 bg-black/70 text-white opacity-0 shadow-2xl backdrop-blur transition-opacity hover:bg-black/85 group-hover/car:opacity-100 group-focus-within/car:opacity-100 md:flex">
              <ChevronRight size={28} aria-hidden />
            </button>
          </>
        )}

        {/* Phones and tablets: arrows + dots under the card (and swipe). */}
        {many && (
          <div className="mt-3 flex items-center justify-between gap-3 md:hidden">
            <div className="flex items-center gap-1.5" role="tablist" aria-label={t('carouselLabel')}>
              {order.map((c, i) => (
                <button key={c.id} type="button" role="tab" aria-selected={i === idx} aria-label={`${t('period', { period: c.period! })} · ${c.name}`} onClick={() => pick(c.id)}
                  className={cn('h-2 rounded-full transition-all', i === idx ? 'w-6' : 'w-2 bg-[rgb(var(--muted)/0.5)]')}
                  style={i === idx ? { background: `rgb(${lightFor(c.id)})` } : undefined} />
              ))}
            </div>
            {navButtons}
          </div>
        )}
        {many && <p className="mt-2 hidden text-2xs text-muted md:block nx-onscene">{t('carouselHint')}</p>}
      </div>

      <BellRail now={now} byPeriod={byPeriod} selectedId={cls.id} onSelect={pick} />
    </section>
  );
}

/**
 * Today's bell schedule as a strip: each period sized by its length, your classes lit in their
 * class colour, lunches as notches, and a needle at the current time. After school or on a day
 * off it shows the next school day instead.
 */
function BellRail({ now, byPeriod, selectedId, onSelect }: { now: number; byPeriod: Map<number, HomeClass>; selectedId?: string; onSelect?: (id: string) => void }) {
  const t = useTranslations('now');
  const locale = useLocale();
  const { weekday, minutes } = schoolClock(now, SCHED.timezone);
  let wd = weekday, plan: DayPlan | undefined = SCHED.days[weekday], ahead = 0;
  const endOfDay = plan ? plan.slots[plan.slots.length - 1].end : 0;
  if (!plan || minutes >= endOfDay) {
    for (let i = 1; i < 8; i++) { const d = (weekday + i) % 7; if (SCHED.days[d]) { wd = d; plan = SCHED.days[d]; ahead = i; break; } }
  }
  if (!plan) return null;
  const start = plan.slots[0].start, end = plan.slots[plan.slots.length - 1].end, span = end - start;
  const pct = (v: number) => `${((v - start) / span) * 100}%`;
  const needle = ahead === 0 && minutes >= start && minutes <= end;
  const dayName = ahead === 0 ? t('today') : ahead === 1 ? t('tomorrow') : weekdayName(wd, locale);
  const typeLabel = plan.type === 'odd' ? t('dayOdd') : plan.type === 'even' ? t('dayEven') : t('dayAll');

  return (
    <div className="card mt-6 p-4 sm:p-5" aria-label={t('railLabel', { day: dayName })} role="group">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-sm font-semibold">{dayName} <span className="font-normal text-muted">· {typeLabel}</span></span>
        <span className="text-2xs text-muted">{SCHED.school} · {SCHED.year}</span>
      </div>
      <div className="relative h-[58px]">
        {plan.slots.map((s) => {
          const c = byPeriod.get(s.period);
          const light = c ? lightFor(c.id) : null;
          const live = ahead === 0 && minutes >= s.start && minutes < s.end;
          const past = ahead === 0 && minutes >= s.end;
          return (
            <button key={s.period} type="button" disabled={!c} aria-pressed={!!c && c.id === selectedId}
              title={`${t('period', { period: s.period })} · ${clockLabel(s.start, locale)} – ${clockLabel(s.end, locale)}${c ? ` · ${c.name}` : ''}`}
              onClick={() => { if (c) onSelect?.(c.id); }}
              className={cn('absolute inset-y-0 flex min-w-0 flex-col justify-between overflow-hidden rounded-md border px-2 py-1.5 text-left transition-[filter,box-shadow]',
                c ? 'cursor-pointer hover:brightness-125' : 'cursor-default', past && c?.id !== selectedId && 'opacity-60',
                c && c.id === selectedId && 'ring-2 ring-[rgb(var(--ink)/0.85)] ring-offset-1 ring-offset-transparent')}
              style={{
                left: pct(s.start), width: `calc(${((s.end - s.start) / span) * 100}% - 2px)`,
                borderColor: light ? `rgb(${light} / ${live ? 0.95 : 0.6})` : 'rgb(var(--muted) / 0.35)',
                background: light ? `linear-gradient(180deg, rgb(${light} / ${live ? 0.34 : 0.2}), rgb(${light} / 0.08))` : 'rgb(var(--muted) / 0.08)',
                boxShadow: live && light ? `0 0 24px -6px rgb(${light} / 0.7)` : undefined,
              }}>
              <span className="flex items-baseline gap-1.5 whitespace-nowrap">
                <span className={cn('text-xs font-bold tabular-nums', !c && 'text-muted')}>{t('periodShort', { period: s.period })}</span>
                {c && <span className="hidden truncate text-2xs font-medium text-ink sm:inline">{c.name}</span>}
              </span>
              <span className="hidden whitespace-nowrap text-[10px] tabular-nums text-muted md:block">{clockLabel(s.start, locale)}</span>
              {s.lunches && (
                <span className="absolute inset-x-0 bottom-0 h-[3px]" aria-hidden>
                  {s.lunches.map((l) => (
                    <span key={l.letter} className="absolute inset-y-0 rounded-full bg-[rgb(var(--muted)/0.55)]"
                      style={{ left: `${((l.start - s.start) / (s.end - s.start)) * 100}%`, width: `${((l.end - l.start) / (s.end - s.start)) * 100}%` }} />
                  ))}
                </span>
              )}
            </button>
          );
        })}
        {needle && (
          <span className="pointer-events-none absolute -bottom-1.5 -top-1.5 w-px bg-ink" style={{ left: pct(minutes), boxShadow: '0 0 8px rgb(var(--ink) / 0.8)' }} aria-hidden>
            <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-ink" />
          </span>
        )}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] tabular-nums text-muted">
        <span>{clockLabel(start, locale)}</span><span>{clockLabel(end, locale)}</span>
      </div>
    </div>
  );
}

/** Teacher Home: opens the class timer from the top bar. */
export function OpenTimerButton() {
  const t = useTranslations('live');
  return (
    <button type="button" className="btn btn-lg" onClick={() => window.dispatchEvent(new Event('nexora:open-timer'))}>
      <TimerIcon size={16} aria-hidden />{t('timerTool')}
    </button>
  );
}

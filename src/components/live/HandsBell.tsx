'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useFormatter, useTranslations } from 'next-intl';
import { Bell, BellRing, Check, ChevronDown, Footprints, Hand, MapPin, Ticket, Volume2, VolumeX, X } from 'lucide-react';
import { bellState } from '@/lib/bell';
import { alertsOn, chime, setAlerts } from '@/lib/chime';
import { clearHands, handleHand, mmss, useTick, type Hand as HandRow } from '@/lib/live';
import { lightFor } from '@/components/Living';
import { cn, initials } from '@/lib/util';
import { useLive } from './LiveProvider';
import { TeacherPasses } from './HallPassTeacher';

const OPEN = new Set(['raised', 'seen']);

/**
 * Teacher: the raised-hands bell in the top bar. The badge counts hands waiting; a new hand
 * chimes (can be muted), flashes the tab title and, if allowed, shows a desktop notification.
 * The panel lists each student with class and period, what kind of help, their note, the page
 * they were on, how long they've waited and how many times today — with "On my way" and "Done".
 */
export function HandsBell() {
  const live = useLive();
  const t = useTranslations('live');
  const [open, setOpen] = useState(false);
  const [sound, setSound] = useState(true);
  const hands = useMemo(() => live?.hands ?? [], [live?.hands]);
  const openHands = hands.filter((h) => OPEN.has(h.status));
  const passes = useMemo(() => live?.passes ?? [], [live?.passes]);
  const pendingPasses = passes.filter((p) => p.status === 'pending');
  const waiting = openHands.filter((h) => h.status === 'raised').length + pendingPasses.length;
  const badge = openHands.length + pendingPasses.length + passes.filter((p) => p.status === 'out').length;
  const tick = useTick(passes.some((p) => p.status === 'out'), 5000);
  const seenPasses = useRef<Set<string> | null>(null);
  const warnedOver = useRef<Set<string>>(new Set());
  const seenIds = useRef<Set<string> | null>(null);
  const baseTitle = useRef<string | null>(null);

  useEffect(() => setSound(alertsOn()), []);
  // The assistant can open this panel on a tab ("Hands" / "Passes").
  const [askedTab, setAskedTab] = useState<'hands' | 'passes' | null>(null);
  useEffect(() => {
    const h = (e: Event) => { setAskedTab(((e as CustomEvent).detail as 'hands' | 'passes') ?? 'hands'); setOpen(true); };
    window.addEventListener('nexora:open-bell', h);
    return () => window.removeEventListener('nexora:open-bell', h);
  }, []);

  // New hand → chime + notification. The first load just records what is already up.
  useEffect(() => {
    const ids = new Set(openHands.map((h) => h.id));
    if (seenIds.current) {
      const fresh = openHands.filter((h) => h.status === 'raised' && !seenIds.current!.has(h.id));
      if (fresh.length) {
        if (alertsOn()) chime('hand');
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
          const h = fresh[0];
          try { new Notification(t('notifyTitle', { name: h.student?.display_name ?? t('aStudent') }), { body: [h.class?.section, h.class?.name, h.note].filter(Boolean).join(' · '), tag: h.id }); } catch { /* not allowed */ }
        }
      }
    }
    seenIds.current = ids;
  }, [openHands, t]);

  // New pass request → chime. A student past the time limit → chime once.
  useEffect(() => {
    const ids = new Set(pendingPasses.map((p) => p.id));
    if (seenPasses.current && pendingPasses.some((p) => !seenPasses.current!.has(p.id))) {
      if (alertsOn()) chime('hand');
      const p = pendingPasses.find((x) => !seenPasses.current!.has(x.id))!;
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
        try { new Notification(t('passNotify', { name: p.student?.display_name ?? t('aStudent') }), { body: [p.class?.section, p.class?.name].filter(Boolean).join(' · '), tag: p.id }); } catch { /* not allowed */ }
      }
    }
    seenPasses.current = ids;
  }, [pendingPasses, t]);
  useEffect(() => {
    for (const p of passes) {
      if (p.status !== 'out' || !p.out_at || warnedOver.current.has(p.id)) continue;
      if (tick - Date.parse(p.out_at) > (p.class?.pass_minutes ?? 8) * 60_000) { warnedOver.current.add(p.id); if (alertsOn()) chime('hand'); }
    }
  }, [passes, tick]);

  // "(2) NEXORA" in the tab while hands are waiting.
  useEffect(() => {
    if (baseTitle.current == null) baseTitle.current = document.title.replace(/^\(\d+\)\s*/, '');
    const base = document.title.replace(/^\(\d+\)\s*/, '');
    document.title = waiting ? `(${waiting}) ${base}` : base;
  }, [waiting]);

  if (!live?.isEducator) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={open}
        aria-label={waiting ? t('bellLabelCount', { count: waiting }) : t('bellLabel')} title={t('bellTitle')}
        className={cn('btn-ghost btn-sm relative h-9 w-9 justify-center p-0', waiting > 0 && 'ember-text')}>
        {waiting > 0 ? <BellRing size={18} aria-hidden className="nx-bell-ring" /> : <Bell size={18} aria-hidden />}
        {badge > 0 && (
          <span className={cn('absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums text-white',
            waiting ? 'bg-[rgb(var(--nx-ember))] shadow-[0_0_10px_rgb(var(--nx-ember)/0.8)]' : 'bg-white/25')}>{badge}</span>
        )}
      </button>
      {open && <HandsPanel hands={hands} passCount={pendingPasses.length + passes.filter((p) => p.status === 'out').length}
        startTab={askedTab ?? (pendingPasses.length && !openHands.some((h) => h.status === 'raised') ? 'passes' : 'hands')}
        sound={sound} onSound={(v) => { setSound(v); setAlerts(v); }} onClose={() => { setOpen(false); setAskedTab(null); }} />}
    </>
  );
}

function HandsPanel({ hands, passCount, startTab, sound, onSound, onClose }: { hands: HandRow[]; passCount: number; startTab: 'hands' | 'passes'; sound: boolean; onSound: (v: boolean) => void; onClose: () => void }) {
  const [tab, setTab] = useState<'hands' | 'passes'>(startTab);
  const live = useLive();
  const t = useTranslations('live');
  const f = useFormatter();
  const now = useTick(true);
  const [showEarlier, setShowEarlier] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notif, setNotif] = useState<NotificationPermission | 'unsupported'>('default');
  useEffect(() => {
    setNotif(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k);
  }, [onClose]);

  const open = hands.filter((h) => OPEN.has(h.status));
  const earlier = hands.filter((h) => !OPEN.has(h.status)).sort((a, b) => (b.closed_at ?? b.created_at).localeCompare(a.closed_at ?? a.created_at));
  const todayCount = useMemo(() => {
    const m = new Map<string, number>();
    hands.forEach((h) => m.set(`${h.class_id}:${h.student_id}`, (m.get(`${h.class_id}:${h.student_id}`) ?? 0) + 1));
    return m;
  }, [hands]);

  // Group by class; the class in session right now comes first.
  const current = bellState(now).current?.period;
  const byClass = new Map<string, HandRow[]>();
  open.forEach((h) => byClass.set(h.class_id, [...(byClass.get(h.class_id) ?? []), h]));
  const periodOf = (cid: string) => live?.classes.find((c) => c.id === cid)?.period ?? null;
  const groups = [...byClass.entries()].sort(([a], [b]) => Number(periodOf(b) === current) - Number(periodOf(a) === current) || (periodOf(a) ?? 99) - (periodOf(b) ?? 99));

  async function act(id: string, status: 'seen' | 'resolved') { setBusy(id); await handleHand(id, status); setBusy(null); }
  const kindLabel = (k: string) => t(`kind.${k as 'question'}`);

  return createPortal(
    <div className="fixed inset-0 z-[75]" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="false" aria-labelledby="hands-h"
        className="absolute inset-x-2 top-16 flex max-h-[calc(100dvh-5rem)] flex-col overflow-hidden rounded-2xl border border-line shadow-2xl sm:inset-x-auto sm:right-4 sm:w-[420px]"
        style={{ background: 'rgb(var(--panel))' }}>
        <header className="flex items-center gap-2 border-b border-line px-4 py-3">
          <div role="tablist" aria-labelledby="hands-h" className="flex flex-1 gap-1">
            <h2 id="hands-h" className="sr-only">{t('bellTitle')}</h2>
            {(['hands', 'passes'] as const).map((k) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                className={cn('inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold', tab === k ? 'bg-ember/[0.12] text-ink' : 'text-muted hover:text-ink')}>
                {k === 'hands' ? <Hand size={15} className="ember-text" aria-hidden /> : <Ticket size={15} className="ember-text" aria-hidden />}
                {k === 'hands' ? t('handsTab') : t('passesTab')}
                {(k === 'hands' ? open.length : passCount) > 0 && <span className="rounded-full bg-white/[0.1] px-1.5 text-[10px] tabular-nums">{k === 'hands' ? open.length : passCount}</span>}
              </button>
            ))}
          </div>
          <button type="button" className="btn-ghost btn-sm h-8 w-8 justify-center p-0" onClick={() => onSound(!sound)} aria-pressed={sound}
            title={sound ? t('alertsOn') : t('alertsOff')} aria-label={sound ? t('alertsOn') : t('alertsOff')}>
            {sound ? <Volume2 size={15} aria-hidden /> : <VolumeX size={15} aria-hidden />}
          </button>
          <button type="button" className="btn-ghost btn-sm h-8 w-8 justify-center p-0" onClick={onClose} aria-label={t('close')}><X size={15} aria-hidden /></button>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          {tab === 'passes' ? <TeacherPasses onNavigate={onClose} /> : <>
          {open.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <Hand size={28} className="mx-auto text-faint" aria-hidden />
              <p className="mt-3 font-medium">{t('noHands')}</p>
              <p className="mt-1 text-sm text-muted">{t('noHandsHint')}</p>
            </div>
          ) : groups.map(([cid, list]) => {
            const c = list[0].class;
            const light = lightFor(cid);
            return (
              <div key={cid} className="border-b border-line last:border-b-0">
                <div className="flex items-center gap-2 px-4 pb-1 pt-3">
                  <span className="h-2 w-2 rounded-full" style={{ background: `rgb(${light})`, boxShadow: `0 0 8px rgb(${light})` }} aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-[0.06em] text-muted">
                    {[c?.section, c?.name].filter(Boolean).join(' · ')}
                    {periodOf(cid) != null && periodOf(cid) === current && <span className="ml-2 normal-case tracking-normal ember-text">{t('nowInSession')}</span>}
                  </span>
                  {list.length > 1 && (
                    <button type="button" className="text-2xs text-muted hover:text-ink" onClick={() => void clearHands(cid)}>{t('clearAll')}</button>
                  )}
                </div>
                <ol>
                  {list.map((h, i) => {
                    const waited = Math.floor((now - Date.parse(h.created_at)) / 1000);
                    const n = todayCount.get(`${h.class_id}:${h.student_id}`) ?? 1;
                    const name = h.student?.display_name || t('aStudent');
                    const seen = h.status === 'seen';
                    return (
                      <li key={h.id} className={cn('mx-2 mb-2 rounded-xl border p-3', seen ? 'border-ok/30 bg-ok/[0.04]' : 'border-ember/35 bg-ember/[0.05]')}>
                        <div className="flex items-start gap-3">
                          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                            style={{ background: `linear-gradient(135deg, rgb(${light}), rgb(var(--nx-violet)))` }} aria-hidden>
                            {initials(name)}
                            <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-line bg-[rgb(var(--panel))] text-[10px] font-bold tabular-nums">{i + 1}</span>
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline gap-x-2">
                              <span className="font-semibold">{name}</span>
                              <span className={cn('text-2xs tabular-nums', !seen && waited > 180 ? 'font-semibold text-bad' : 'text-muted')}>
                                {seen ? t('youreOnTheWay') : t('waiting', { time: mmss(waited) })}
                              </span>
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-2xs text-muted">
                              <span className="rounded border border-line px-1.5 py-px">{kindLabel(h.kind)}</span>
                              {n > 1 && <span>{t('timesToday', { count: n })}</span>}
                              <span>{f.dateTime(new Date(h.created_at), { hour: 'numeric', minute: '2-digit' })}</span>
                            </div>
                            {h.note && <p className="mt-2 whitespace-pre-line text-sm">“{h.note}”</p>}
                            {h.page_path?.startsWith('/') && (
                              <Link href={h.page_path} onClick={onClose} className="mt-1.5 inline-flex max-w-full items-center gap-1 text-2xs text-muted hover:text-ink">
                                <MapPin size={11} aria-hidden /><span className="truncate">{t('wasOn', { page: h.page_title || h.page_path })}</span>
                              </Link>
                            )}
                          </div>
                        </div>
                        <div className="mt-3 flex gap-2">
                          {!seen && (
                            <button type="button" disabled={busy === h.id} onClick={() => void act(h.id, 'seen')} className="btn btn-sm flex-1 justify-center">
                              <Footprints size={14} aria-hidden />{t('onMyWay')}
                            </button>
                          )}
                          <button type="button" disabled={busy === h.id} onClick={() => void act(h.id, 'resolved')} className="btn-primary btn-sm flex-1 justify-center">
                            <Check size={14} aria-hidden />{t('done')}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            );
          })}

          {earlier.length > 0 && (
            <div className="border-t border-line px-4 py-3">
              <button type="button" className="flex w-full items-center justify-between text-xs font-medium text-muted hover:text-ink" aria-expanded={showEarlier} onClick={() => setShowEarlier((s) => !s)}>
                {t('earlierToday', { count: earlier.length })}<ChevronDown size={14} className={cn('transition-transform', showEarlier && 'rotate-180')} aria-hidden />
              </button>
              {showEarlier && (
                <ul className="mt-2 space-y-1.5">
                  {earlier.slice(0, 30).map((h) => (
                    <li key={h.id} className="flex items-baseline gap-2 text-xs">
                      <span className="w-14 shrink-0 tabular-nums text-faint">{f.dateTime(new Date(h.created_at), { hour: 'numeric', minute: '2-digit' })}</span>
                      <span className="min-w-0 flex-1 truncate"><span className="font-medium">{h.student?.display_name}</span> <span className="text-muted">· {h.class?.section ?? h.class?.name} · {kindLabel(h.kind)}{h.note ? ` · “${h.note}”` : ''}</span></span>
                      <span className="shrink-0 text-faint">{h.status === 'lowered' ? t('lowered') : t('helped')}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          </>}
        </div>

        {notif === 'default' && (
          <footer className="border-t border-line px-4 py-2.5 text-xs text-muted">
            <button type="button" className="hover:text-ink" onClick={() => void Notification.requestPermission().then(setNotif)}>{t('enableDesktop')}</button>
          </footer>
        )}
      </section>
    </div>,
    document.body,
  );
}

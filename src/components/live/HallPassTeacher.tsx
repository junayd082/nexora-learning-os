'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { AlertTriangle, Check, ChevronDown, Download, Hand as HandIcon, ListOrdered, MonitorUp, NotebookPen, Send, Settings2, Ticket, Timer as TimerIcon, Undo2, Users, X } from 'lucide-react';
import { bellState } from '@/lib/bell';
import { cancelPass, decidePass, mmss, passBack, savePassSettings, startTimer, useTick, usePassBoard, type Pass } from '@/lib/live';
import { lightFor } from '@/components/Living';
import { cn, initials } from '@/lib/util';
import { useLive } from './LiveProvider';
import { AskTeacherMenu, BoardProjector, DEST_ICON, PassBoardView } from './HallPass';

/**
 * Teacher: the Passes tab under the bell. Requests to approve (with how often the student has gone
 * today and this week), who is out and for how long (red past the limit), who is next, and today's log.
 */
export function TeacherPasses({ onNavigate }: { onNavigate?: () => void }) {
  const live = useLive();
  const t = useTranslations('pass');
  const f = useFormatter();
  const now = useTick(true, 1000);
  const [busy, setBusy] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [projector, setProjector] = useState<string | null>(null);
  const [settingsFor, setSettingsFor] = useState<string | null>(null);
  const passes = useMemo(() => live?.passes ?? [], [live?.passes]);
  void onNavigate;

  const counts = useMemo(() => {
    const today = new Map<string, number>();
    passes.filter((p) => p.out_at).forEach((p) => today.set(`${p.class_id}:${p.student_id}`, (today.get(`${p.class_id}:${p.student_id}`) ?? 0) + 1));
    return today;
  }, [passes]);
  const open = passes.filter((p) => p.status === 'pending' || p.status === 'queued' || p.status === 'out');
  const current = bellState(now).current?.period;
  const periodOf = (cid: string) => live?.classes.find((c) => c.id === cid)?.period ?? null;
  const classIds = [...new Set(open.map((p) => p.class_id))]
    .sort((a, b) => Number(periodOf(b) === current) - Number(periodOf(a) === current) || (periodOf(a) ?? 99) - (periodOf(b) ?? 99));
  const log = passes.filter((p) => p.out_at).sort((a, b) => (b.out_at ?? '').localeCompare(a.out_at ?? ''));
  const act = async (id: string, fn: () => Promise<unknown>) => { setBusy(id); await fn(); setBusy(null); };
  const dest = (p: Pass) => t(`dest.${p.destination}`);

  function csv() {
    const rows = [['Date', 'Period', 'Class', 'Student', 'Destination', 'Note', 'With classmate', 'Out', 'Back', 'Minutes', 'Status']];
    for (const p of [...log].reverse()) {
      const out = p.out_at ? new Date(p.out_at) : null; const back = p.back_at ? new Date(p.back_at) : null;
      rows.push([out ? out.toLocaleDateString() : '', p.class?.section ?? '', p.class?.name ?? '', p.student?.display_name ?? '', p.destination, p.note ?? '', p.with_classmate ? 'yes' : '',
        out ? out.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '', back ? back.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '',
        out && back ? String(Math.round((back.getTime() - out.getTime()) / 60000)) : '', p.status]);
    }
    const blob = new Blob(['﻿' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `hall-passes-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  return (
    <div>
      {open.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <Ticket size={28} className="mx-auto text-faint" aria-hidden />
          <p className="mt-3 font-medium">{t('noPasses')}</p>
          <p className="mt-1 text-sm text-muted">{t('noPassesHint')}</p>
        </div>
      ) : classIds.map((cid) => {
        const list = open.filter((p) => p.class_id === cid);
        const c = list[0].class;
        const light = lightFor(cid);
        const limit = (c?.pass_minutes ?? 8) * 60;
        const pend = list.filter((p) => p.status === 'pending');
        const outs = list.filter((p) => p.status === 'out');
        const line = list.filter((p) => p.status === 'queued').sort((a, b) => (a.queued_at ?? '').localeCompare(b.queued_at ?? ''));
        const full = outs.length >= (c?.pass_max_out ?? 1);
        return (
          <div key={cid} className="border-b border-line pb-2 last:border-b-0">
            <div className="flex items-center gap-2 px-4 pb-1 pt-3">
              <span className="h-2 w-2 rounded-full" style={{ background: `rgb(${light})`, boxShadow: `0 0 8px rgb(${light})` }} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-[0.06em] text-muted">{[c?.section, c?.name].filter(Boolean).join(' · ')}</span>
              <button type="button" className="btn-ghost btn-sm h-7 w-7 justify-center p-0" title={t('settings')} aria-label={t('settings')} onClick={() => setSettingsFor(settingsFor === cid ? null : cid)}><Settings2 size={14} aria-hidden /></button>
              <button type="button" className="btn-ghost btn-sm h-7 w-7 justify-center p-0" title={t('showBoard')} aria-label={t('showBoard')} onClick={() => setProjector(cid)}><MonitorUp size={14} aria-hidden /></button>
            </div>
            {settingsFor === cid && <PassSettings classId={cid} on={c?.passes_on ?? true} max={c?.pass_max_out ?? 1} minutes={c?.pass_minutes ?? 8} />}

            {pend.map((p) => {
              const Icon = DEST_ICON[p.destination];
              const n = counts.get(`${p.class_id}:${p.student_id}`) ?? 0;
              const name = p.student?.display_name || t('aStudent');
              return (
                <div key={p.id} className="mx-2 mb-2 rounded-xl border border-ember/40 bg-ember/[0.05] p-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: `linear-gradient(135deg, rgb(${light}), rgb(var(--nx-violet)))` }} aria-hidden>{initials(name)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2"><span className="font-semibold">{name}</span><span className="text-2xs text-muted">{t('asked', { time: mmss(Math.floor((now - Date.parse(p.requested_at)) / 1000)) })}</span></div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                        <span className="inline-flex items-center gap-1 rounded border border-line px-1.5 py-px"><Icon size={12} aria-hidden />{dest(p)}</span>
                        <span className="text-muted">{t('timesToday', { count: n })}</span>
                        {p.with_classmate && <span className="inline-flex items-center gap-1 rounded border border-warn/50 px-1.5 py-px text-warn"><Users size={12} aria-hidden />{t('groupRequest')}</span>}
                      </div>
                      {p.note && <p className="mt-1.5 text-sm">“{p.note}”</p>}
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-1.5">
                    <button type="button" disabled={busy === p.id} onClick={() => void act(p.id, () => decidePass(p.id, 'approve'))} className="btn-primary btn-sm justify-center">
                      <Check size={14} aria-hidden />{full ? t('approveLine') : t('approve')}
                    </button>
                    <button type="button" disabled={busy === p.id} onClick={() => void act(p.id, () => decidePass(p.id, 'approve_now'))} className="btn btn-sm justify-center" title={t('sendNowHint')}>
                      <Send size={13} aria-hidden />{t('sendNow')}
                    </button>
                    <button type="button" disabled={busy === p.id} onClick={() => void act(p.id, () => decidePass(p.id, 'deny'))} className="btn btn-sm justify-center"><X size={14} aria-hidden />{t('deny')}</button>
                  </div>
                </div>
              );
            })}

            {outs.map((p) => {
              const s = Math.max(0, Math.floor((now - Date.parse(p.out_at!)) / 1000));
              const over = s > limit;
              const Icon = DEST_ICON[p.destination];
              return (
                <div key={p.id} className={cn('mx-2 mb-2 flex items-center gap-3 rounded-xl border px-3 py-2.5', over ? 'border-bad/60 bg-bad/[0.07]' : 'border-line')}>
                  <Icon size={17} className={over ? 'text-bad' : 'text-muted'} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{p.student?.display_name}</span>
                    <span className="block truncate text-2xs text-muted">{t('outFor', { place: dest(p) })}{over ? ` · ${t('overBy', { time: mmss(s - limit) })}` : ''}</span>
                  </span>
                  {over && <AlertTriangle size={15} className="text-bad" aria-hidden />}
                  <span className={cn('font-mono text-sm font-semibold tabular-nums', over && 'text-bad')}>{mmss(s)}</span>
                  <button type="button" disabled={busy === p.id} className="btn btn-sm" onClick={() => void act(p.id, () => passBack(p.id))}><Undo2 size={13} aria-hidden />{t('markBack')}</button>
                </div>
              );
            })}

            {line.length > 0 && (
              <div className="mx-2 mb-2 rounded-xl border border-line px-3 py-2">
                <div className="mb-1 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.06em] text-muted"><ListOrdered size={12} aria-hidden />{t('inLine')}</div>
                <ol className="space-y-1">
                  {line.map((p, i) => (
                    <li key={p.id} className="flex items-center gap-2 text-sm">
                      <span className="w-4 text-2xs tabular-nums text-faint">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate">{p.student?.display_name} <span className="text-2xs text-muted">· {dest(p)}</span></span>
                      <button type="button" className="btn-ghost btn-sm h-7 px-2 text-2xs" onClick={() => void act(p.id, () => decidePass(p.id, 'approve_now'))}>{t('sendNow')}</button>
                      <button type="button" className="btn-ghost btn-sm h-7 w-7 justify-center p-0" aria-label={t('remove')} title={t('remove')} onClick={() => void act(p.id, () => cancelPass(p.id))}><X size={13} aria-hidden /></button>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        );
      })}

      {log.length > 0 && (
        <div className="border-t border-line px-4 py-3">
          <div className="flex items-center gap-2">
            <button type="button" className="flex flex-1 items-center justify-between text-xs font-medium text-muted hover:text-ink" aria-expanded={showLog} onClick={() => setShowLog((s) => !s)}>
              {t('todaysLog', { count: log.length })}<ChevronDown size={14} className={cn('transition-transform', showLog && 'rotate-180')} aria-hidden />
            </button>
            <button type="button" className="btn-ghost btn-sm h-7 gap-1 px-2 text-2xs" onClick={csv}><Download size={12} aria-hidden />CSV</button>
          </div>
          {showLog && (
            <ul className="mt-2 space-y-1.5">
              {log.slice(0, 60).map((p) => {
                const mins = p.out_at && p.back_at ? Math.round((Date.parse(p.back_at) - Date.parse(p.out_at)) / 60000) : null;
                return (
                  <li key={p.id} className="flex items-baseline gap-2 text-xs">
                    <span className="w-14 shrink-0 tabular-nums text-faint">{f.dateTime(new Date(p.out_at!), { hour: 'numeric', minute: '2-digit' })}</span>
                    <span className="min-w-0 flex-1 truncate"><span className="font-medium">{p.student?.display_name}</span> <span className="text-muted">· {p.class?.section ?? p.class?.name} · {dest(p)}</span></span>
                    <span className={cn('shrink-0 tabular-nums', mins != null && mins > (p.class?.pass_minutes ?? 8) ? 'text-bad' : 'text-muted')}>{mins != null ? t('mins', { n: mins }) : p.status === 'out' ? t('outNow') : '—'}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
      {projector && <BoardProjector classId={projector} onClose={() => setProjector(null)} />}
    </div>
  );
}

/** Per-class pass rules: on/off, how many out at once, minutes before the red flag. */
export function PassSettings({ classId, on, max, minutes }: { classId: string; on: boolean; max: number; minutes: number }) {
  const t = useTranslations('pass');
  const [s, setS] = useState({ on, max, minutes });
  const [saved, setSaved] = useState(false);
  const save = async (patch: Partial<typeof s>) => {
    const next = { ...s, ...patch }; setS(next); setSaved(false);
    const { error } = await savePassSettings(classId, { passes_on: next.on, pass_max_out: next.max, pass_minutes: next.minutes });
    if (!error) { setSaved(true); setTimeout(() => setSaved(false), 1500); }
  };
  return (
    <div className="mx-2 mb-2 grid gap-2 rounded-xl border border-line bg-white/[0.02] p-3 text-sm">
      <label className="flex items-center justify-between gap-2">{t('passesOn')}
        <input type="checkbox" checked={s.on} onChange={(e) => void save({ on: e.target.checked })} className="accent-[rgb(var(--nx-ember))]" /></label>
      <label className="flex items-center justify-between gap-2">{t('maxOut')}
        <select className="input h-8 w-20 py-0" value={s.max} onChange={(e) => void save({ max: Number(e.target.value) })}>{[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
      <label className="flex items-center justify-between gap-2">{t('timeLimit')}
        <select className="input h-8 w-24 py-0" value={s.minutes} onChange={(e) => void save({ minutes: Number(e.target.value) })}>{[3, 5, 8, 10, 12, 15, 20].map((n) => <option key={n} value={n}>{t('mins', { n })}</option>)}</select></label>
      {saved && <p className="text-2xs text-ok" role="status">{t('saved')}</p>}
    </div>
  );
}

/**
 * Class page card: the live pass board for everyone in the class. Students get "Ask your teacher";
 * the teacher gets the projector button and the rules.
 */
export function ClassPassCard({ classId, isTeacher }: { classId: string; isTeacher: boolean }) {
  const t = useTranslations('pass');
  const { board } = usePassBoard(classId);
  const [projector, setProjector] = useState(false);
  const [settings, setSettings] = useState(false);
  if (!board) return null;
  return (
    <section className="card p-4" aria-labelledby={`pb-${classId}`}>
      <div className="mb-3 flex items-center gap-2">
        <Ticket size={16} className="ember-text" aria-hidden />
        <h2 id={`pb-${classId}`} className="flex-1 text-sm font-semibold">{t('passBoard')}</h2>
        {isTeacher ? (
          <>
            <button type="button" className="btn-ghost btn-sm h-7 w-7 justify-center p-0" title={t('settings')} aria-label={t('settings')} onClick={() => setSettings((s) => !s)}><Settings2 size={14} aria-hidden /></button>
            <button type="button" className="btn-ghost btn-sm h-7 w-7 justify-center p-0" title={t('showBoard')} aria-label={t('showBoard')} onClick={() => setProjector(true)}><MonitorUp size={14} aria-hidden /></button>
          </>
        ) : <AskTeacherMenu classId={classId} compact className="btn btn-sm" />}
      </div>
      {settings && isTeacher && <div className="-mx-2"><PassSettings classId={classId} on={board.on} max={board.max_out} minutes={board.minutes} /></div>}
      {!board.on ? <p className="text-sm text-muted">{t('passesOff')}</p> : <PassBoardView board={board} onBack={(id) => void passBack(id)} />}
      <p className="mt-3 text-2xs text-faint">{t('rules', { max: board.max_out, min: board.minutes })}</p>
      {projector && <BoardProjector classId={classId} onClose={() => setProjector(false)} />}
    </section>
  );
}

/**
 * Teacher, class page: one place for live classroom tools — start a timer (or today's Do Now /
 * Exit ticket timer in one tap), and jump to raised hands or pass requests.
 */
export function ClassroomTools({ classId }: { classId: string }) {
  const live = useLive();
  const t = useTranslations('live');
  const tn = useTranslations('nova');
  const ts = useTranslations('summary');
  const [busy, setBusy] = useState<string | null>(null);
  const cls = live?.classes.find((c) => c.id === classId);
  const timed = (cls?.items ?? []).filter((i) => (i.tag === 'do_now' || i.tag === 'exit_ticket') && i.timer_minutes);
  const hands = (live?.hands ?? []).filter((h) => h.class_id === classId && (h.status === 'raised' || h.status === 'seen')).length;
  const passes = (live?.passes ?? []).filter((p) => p.class_id === classId && (p.status === 'pending' || p.status === 'out')).length;
  const running = (live?.timers ?? []).find((x) => x.class_id === classId);
  return (
    <section className="card p-4" aria-labelledby={`tools-${classId}`}>
      <h2 id={`tools-${classId}`} className="mb-3 text-sm font-semibold">{t('toolsTitle')}</h2>
      <div className="grid grid-cols-3 gap-1.5">
        <button type="button" className={cn('btn btn-sm justify-center gap-1.5 px-1', running && 'border-ember/60 ember-text')} onClick={() => window.dispatchEvent(new Event('nexora:open-timer'))}>
          <TimerIcon size={14} aria-hidden />{t('timer')}
        </button>
        <button type="button" className={cn('btn btn-sm justify-center gap-1.5 px-1', hands > 0 && 'border-ember/60 ember-text')} onClick={() => window.dispatchEvent(new CustomEvent('nexora:open-bell', { detail: 'hands' }))}>
          <HandIcon size={14} aria-hidden />{t('handsTab')}{hands > 0 && <span className="tabular-nums">{hands}</span>}
        </button>
        <button type="button" className={cn('btn btn-sm justify-center gap-1.5 px-1', passes > 0 && 'border-ember/60 ember-text')} onClick={() => window.dispatchEvent(new CustomEvent('nexora:open-bell', { detail: 'passes' }))}>
          <Ticket size={14} aria-hidden />{t('passesTab')}{passes > 0 && <span className="tabular-nums">{passes}</span>}
        </button>
      </div>
      <Link href={`/classes/${classId}/summary/new`} className="btn btn-sm mt-1.5 w-full justify-center gap-1.5">
        <NotebookPen size={14} aria-hidden />{ts('menuItem')}
      </Link>
      {timed.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {timed.map((i) => (
            <li key={i.id} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block text-2xs font-semibold uppercase tracking-[0.06em] text-muted">{tn(`tags.${i.tag!}`)} · {t('minutes', { n: i.timer_minutes! })}{i.timer_mode === 'bell' ? ` · ${t('bellTimer')}` : ''}</span>
                <span className="block truncate text-sm">{i.title}</span>
              </span>
              <button type="button" disabled={busy === i.id} className="btn btn-sm"
                onClick={async () => { setBusy(i.id); await startTimer({ classId, kind: i.tag as 'do_now' | 'exit_ticket', label: i.title, seconds: i.timer_minutes! * 60, item: { type: i.type, id: i.id }, show: true }); setBusy(null); }}>
                <TimerIcon size={13} aria-hidden />{t('start')}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-2xs text-faint">{t('toolsHint')}</p>
    </section>
  );
}

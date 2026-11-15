'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { CalendarDays, CheckCheck, ChevronLeft, ChevronRight, Download, Printer } from 'lucide-react';
import {
  addDays, addMonths, calendarGrid, emptyTotals, mondayOf, nextMark, schoolDays, weekdayOf,
  type Mark, type Totals,
} from '@/lib/attendance';
import { saveMarks } from '@/lib/attendance-actions';
import { cn } from '@/lib/util';
import './attendance.css';

export interface SheetStudent { id: string; name: string }
export interface WeekStat { marked: number; absent: number }

const LETTER: Record<Mark, string> = { present: 'P', absent: 'A', tardy: 'T', excused: 'E' };
const KEYS: Record<string, Mark> = { p: 'present', a: 'absent', t: 'tardy', e: 'excused' };
const k = (sid: string, day: string) => `${sid}|${day}`;
const date = (key: string) => new Date(`${key}T12:00:00Z`);

/**
 * The attendance register: names down the side, Monday–Friday across, one box per student per day.
 * Teachers click a box (P → A → T → E → blank) or type P / A / T / E; a day's header marks everyone
 * not yet marked present. Week view shows one week; Month view shows every school week of the month,
 * side by side, like the printed sheet. The calendar button jumps to any week.
 * Students get the same sheet, read-only, with just their own row.
 */
export function AttendanceSheet({
  classId, students, weeks, view, anchor, today, meetDays, initial, totals, weekStats, editable, periodLabel, fileBase,
}: {
  classId: string; students: SheetStudent[]; weeks: string[]; view: 'week' | 'month'; anchor: string; today: string;
  meetDays: number[]; initial: Record<string, Mark>; totals: Record<string, Totals>; weekStats: Record<string, WeekStat>;
  editable: boolean; periodLabel: string | null; fileBase: string;
}) {
  const t = useTranslations('attendance');
  const f = useFormatter();
  const router = useRouter();
  const pathname = usePathname();
  const [marks, setMarks] = useState<Record<string, Mark>>(initial);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(0);
  const [, startNav] = useTransition();
  const tableRef = useRef<HTMLTableElement>(null);

  // A new week/month from the server replaces what is shown.
  useEffect(() => { setMarks(initial); }, [initial]);

  const days = useMemo(() => weeks.flatMap((w) => schoolDays(w)), [weeks]);
  const meets = (d: string) => !meetDays.length || meetDays.includes(weekdayOf(d));
  const future = (d: string) => d > today;

  const go = useCallback((week: string, v = view) => {
    startNav(() => router.push(`${pathname}?tab=attendance&week=${week}&view=${v}`, { scroll: false }));
  }, [pathname, router, view]);

  // ------------------------------------------------------------------ saving
  const apply = useCallback((changes: { studentId: string; day: string; status: Mark | null }[]) => {
    if (!editable || !changes.length) return;
    const before = { ...marks };
    setMarks((m) => {
      const n = { ...m };
      for (const c of changes) { if (c.status) n[k(c.studentId, c.day)] = c.status; else delete n[k(c.studentId, c.day)]; }
      return n;
    });
    setError(false);
    setSaving((s) => s + 1);
    saveMarks(classId, changes)
      .then((r) => { if (!r.ok) { setMarks(before); setError(true); } })
      .catch(() => { setMarks(before); setError(true); })
      .finally(() => setSaving((s) => s - 1));
  }, [classId, editable, marks]);

  const markDay = (day: string) => {
    if (!editable || future(day)) return;
    apply(students.filter((s) => !marks[k(s.id, day)]).map((s) => ({ studentId: s.id, day, status: 'present' as Mark })));
  };

  // ------------------------------------------------------------------ totals (term totals from the server, kept live as you mark)
  const liveTotals = useMemo(() => {
    const out: Record<string, Totals> = {};
    for (const s of students) {
      const tt = { ...(totals[s.id] ?? emptyTotals()) };
      for (const d of days) {
        const was = initial[k(s.id, d)], now = marks[k(s.id, d)];
        if (was === now) continue;
        if (was) tt[was] -= 1;
        if (now) tt[now] += 1;
      }
      out[s.id] = tt;
    }
    return out;
  }, [days, initial, marks, students, totals]);
  const shownAbsent = (sid: string) => days.filter((d) => marks[k(sid, d)] === 'absent').length;
  const shownTardy = (sid: string) => days.filter((d) => marks[k(sid, d)] === 'tardy').length;

  // ------------------------------------------------------------------ keyboard: arrows move, P/A/T/E mark, Delete clears
  const onKey = (e: React.KeyboardEvent<HTMLTableElement>) => {
    const el = e.target as HTMLElement;
    const r = Number(el.dataset.r), c = Number(el.dataset.c);
    if (Number.isNaN(r) || Number.isNaN(c)) return;
    const move = (dr: number, dc: number) => {
      e.preventDefault();
      tableRef.current?.querySelector<HTMLButtonElement>(`[data-r="${r + dr}"][data-c="${c + dc}"]`)?.focus();
    };
    if (e.key === 'ArrowRight') return move(0, 1);
    if (e.key === 'ArrowLeft') return move(0, -1);
    if (e.key === 'ArrowDown') return move(1, 0);
    if (e.key === 'ArrowUp') return move(-1, 0);
    const s = students[r], d = days[c];
    if (!s || !d || !editable || future(d)) return;
    const m = KEYS[e.key.toLowerCase()];
    if (m) { e.preventDefault(); apply([{ studentId: s.id, day: d, status: m }]); move(1, 0); }
    else if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); apply([{ studentId: s.id, day: d, status: null }]); }
  };

  // ------------------------------------------------------------------ CSV of what is on screen
  const download = () => {
    const head = [t('name'), ...days.map((d) => d), t('absentShown'), t('tardyShown'), t('absentTerm'), t('tardyTerm')];
    const rows = students.map((s) => [s.name, ...days.map((d) => (marks[k(s.id, d)] ? LETTER[marks[k(s.id, d)]] : '')),
      shownAbsent(s.id), shownTardy(s.id), liveTotals[s.id]?.absent ?? 0, liveTotals[s.id]?.tardy ?? 0]);
    const esc = (v: unknown) => { const x = String(v ?? ''); return /[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x; };
    const csv = [head, ...rows].map((r) => r.map(esc).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    Object.assign(document.createElement('a'), { href: url, download: `${fileBase}_attendance_${days[0]}.csv` }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Built by hand: Intl range formatting differs between server and browser (thin spaces), which breaks hydration.
  const md = (d: string) => f.dateTime(date(d), { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const weekLabel = (mon: string) => `${md(mon)} – ${md(addDays(mon, 4))}`;
  const rangeLabel = view === 'week'
    ? `${weekLabel(anchor)}, ${anchor.slice(0, 4)}`
    : f.dateTime(date(addDays(anchor, 3)), { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const step = (n: number) => {
    if (view === 'week') go(addDays(anchor, 7 * n));
    else go(mondayOf(addMonths(addDays(anchor, 3), n)));
  };
  const todayMarked = students.length > 0 && students.every((s) => marks[k(s.id, today)]);
  const todayIsClass = meets(today) && weekdayOf(today) >= 1 && weekdayOf(today) <= 5;

  return (
    <div className="space-y-3">
      {/* ---------------- toolbar ---------------- */}
      <div className="flex flex-wrap items-center gap-2 no-print">
        <div className="flex items-center gap-1">
          <button type="button" className="btn btn-sm px-2" onClick={() => step(-1)} aria-label={view === 'week' ? t('prevWeek') : t('prevMonth')}><ChevronLeft size={15} aria-hidden /></button>
          <WeekPicker anchor={anchor} today={today} weekStats={weekStats} label={rangeLabel} onPick={(mon) => go(mon)} />
          <button type="button" className="btn btn-sm px-2" onClick={() => step(1)} aria-label={view === 'week' ? t('nextWeek') : t('nextMonth')}><ChevronRight size={15} aria-hidden /></button>
        </div>
        <button type="button" className="btn btn-sm" onClick={() => go(mondayOf(today))}>{view === 'week' ? t('thisWeek') : t('thisMonth')}</button>
        <div role="group" aria-label={t('view')} className="inline-flex overflow-hidden rounded-md border border-line">
          {(['week', 'month'] as const).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => go(anchor, v)}
              className={cn('h-8 px-3 text-xs font-semibold', view === v ? 'bg-ember/15 ember-text' : 'text-muted hover:text-ink')}>{t(v)}</button>
          ))}
        </div>
        <span className="flex-1" />
        {editable && todayIsClass && days.includes(today) && (
          <button type="button" className={cn('btn btn-sm', !todayMarked && 'btn-primary')} disabled={todayMarked} onClick={() => markDay(today)}>
            <CheckCheck size={14} aria-hidden />{todayMarked ? t('todayDone') : t('allPresentToday')}
          </button>
        )}
        <button type="button" className="btn btn-sm" onClick={download}><Download size={14} aria-hidden />CSV</button>
        <button type="button" className="btn btn-sm" onClick={() => window.print()}><Printer size={14} aria-hidden />{t('print')}</button>
      </div>
      <div className="flex min-h-5 flex-wrap items-center gap-3 text-xs text-muted no-print" aria-live="polite">
        {periodLabel && <span>{periodLabel}</span>}
        {saving > 0 ? <span>{t('saving')}</span> : error ? <span className="text-bad">{t('saveFailed')}</span> : editable ? <span>{t('hint')}</span> : null}
      </div>

      {/* ---------------- the register ---------------- */}
      <div className={cn('att-paper', view === 'week' && 'att-week')}>
        <div className="att-scroll">
          <table ref={tableRef} className="att-grid" onKeyDown={onKey} aria-label={t('title')}>
            <thead>
              <tr>
                <th rowSpan={2} className="att-namehead att-name">{t('name')}</th>
                {weeks.map((w, i) => (
                  <th key={w} colSpan={5} className="att-wk">{view === 'week' ? weekLabel(w) : `${t('week')} ${i + 1}`}
                    {view === 'month' && <span className="ml-1.5 font-mono text-[10px] font-medium text-[#6b6b76]">{weekLabel(w)}</span>}</th>
                ))}
                <th rowSpan={2} className="att-sum att-wk" title={t('absentShownHint')}>{t('absentShort')}</th>
                <th rowSpan={2} className="att-sum" title={t('tardyShownHint')}>{t('tardyShort')}</th>
                <th rowSpan={2} className="att-sum" title={t('absentTermHint')}>{t('termShort')}</th>
              </tr>
              <tr>
                {days.map((d, i) => {
                  const can = editable && !future(d);
                  return (
                    <th key={d} className={cn(i % 5 === 0 && 'att-wk', d === today && 'att-today', !meets(d) && 'att-off', future(d) && 'att-future')}>
                      <button type="button" className="att-day" data-can={can ? '1' : '0'} disabled={!can}
                        title={can ? t('markDayHint', { day: f.dateTime(date(d), { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' }) }) : !meets(d) ? t('noClass') : undefined}
                        onClick={() => markDay(d)}>
                        {f.dateTime(date(d), { weekday: 'narrow', timeZone: 'UTC' })}
                        <small>{view === 'week' ? f.dateTime(date(d), { month: 'numeric', day: 'numeric', timeZone: 'UTC' }) : Number(d.slice(8))}</small>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {students.length === 0 && (
                <tr><td colSpan={days.length + 4} className="px-4 py-8 text-sm text-[#6b6b76]">{t('noStudents')}</td></tr>
              )}
              {students.map((s, r) => (
                <tr key={s.id}>
                  <td className="att-name"><span className="att-num">{r + 1}</span>{s.name}</td>
                  {days.map((d, c) => {
                    const m = marks[k(s.id, d)] ?? null;
                    const off = !meets(d), fut = future(d);
                    return (
                      <td key={d} className={cn(c % 5 === 0 && 'att-wk', d === today && 'att-today', off && !m && 'att-off', fut && 'att-future')}>
                        <button type="button" className="att-cell" data-m={m ?? undefined} data-r={r} data-c={c}
                          disabled={!editable || fut} tabIndex={r === 0 && c === 0 ? 0 : -1}
                          aria-label={`${s.name}, ${f.dateTime(date(d), { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' })}: ${m ? t(`marks.${m}`) : t('notMarked')}`}
                          onClick={() => apply([{ studentId: s.id, day: d, status: nextMark(m) }])}>
                          {m ? LETTER[m] : ''}
                        </button>
                      </td>
                    );
                  })}
                  <td className={cn('att-sum att-wk', shownAbsent(s.id) > 0 && 'text-[#c2362f] font-bold')}>{shownAbsent(s.id)}</td>
                  <td className="att-sum">{shownTardy(s.id)}</td>
                  <td className={cn('att-sum', (liveTotals[s.id]?.absent ?? 0) >= 3 && 'text-[#c2362f] font-bold')}>{liveTotals[s.id]?.absent ?? 0}</td>
                </tr>
              ))}
            </tbody>
            {editable && students.length > 1 && (
              <tfoot>
                <tr>
                  <td className="att-name">{t('present')}</td>
                  {days.map((d, i) => {
                    const marked = students.filter((s) => marks[k(s.id, d)]);
                    const here = marked.filter((s) => marks[k(s.id, d)] === 'present' || marks[k(s.id, d)] === 'tardy').length;
                    return <td key={d} className={cn(i % 5 === 0 && 'att-wk', d === today && 'att-today')}>{marked.length ? (view === 'week' ? `${here}/${students.length}` : here) : ''}</td>;
                  })}
                  <td className="att-wk" /><td /><td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <div className="att-legend">
          {(['present', 'absent', 'tardy', 'excused'] as Mark[]).map((m) => <span key={m}><span className="att-key" data-m={m}>{LETTER[m]}</span>{t(`marks.${m}`)}</span>)}
          <span className="ml-auto">{t('legendSums')}</span>
        </div>
      </div>
    </div>
  );
}

/** The week dropdown: a month calendar; pick any day and its week opens. Dots show weeks already taken. */
function WeekPicker({ anchor, today, weekStats, label, onPick }: {
  anchor: string; today: string; weekStats: Record<string, WeekStat>; label: string; onPick: (monday: string) => void;
}) {
  const t = useTranslations('attendance');
  const f = useFormatter();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => addDays(anchor, 3).slice(0, 8) + '01');
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { setMonth(addDays(anchor, 3).slice(0, 8) + '01'); }, [anchor]);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [open]);
  const grid = calendarGrid(month);
  const rows = [0, 1, 2, 3, 4, 5].map((r) => grid.slice(r * 7, r * 7 + 7)).filter((row) => row.some((d) => d.slice(0, 7) === month.slice(0, 7)));
  const dow = [0, 1, 2, 3, 4, 5, 6].map((i) => f.dateTime(date(addDays('2026-01-04', i)), { weekday: 'narrow', timeZone: 'UTC' }));
  return (
    <div className="relative" ref={box}>
      <button type="button" className="btn btn-sm min-w-[12rem] justify-between" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="flex items-center gap-2"><CalendarDays size={14} aria-hidden />{label}</span><span aria-hidden className="text-faint">▾</span>
      </button>
      {open && (
        <div role="dialog" aria-label={t('pickWeek')} className="surface-3 absolute left-0 top-10 z-40 rounded-lg shadow-xl att-cal">
          <div className="mb-1 flex items-center justify-between">
            <button type="button" className="btn-ghost btn-sm px-2" onClick={() => setMonth(addMonths(month, -1))} aria-label={t('prevMonth')}><ChevronLeft size={15} aria-hidden /></button>
            <span className="text-sm font-semibold">{f.dateTime(date(month), { month: 'long', year: 'numeric', timeZone: 'UTC' })}</span>
            <button type="button" className="btn-ghost btn-sm px-2" onClick={() => setMonth(addMonths(month, 1))} aria-label={t('nextMonth')}><ChevronRight size={15} aria-hidden /></button>
          </div>
          <div className="att-cal-grid">{dow.map((d, i) => <div key={i} className="att-cal-dow">{d}</div>)}</div>
          <div className="grid gap-0.5">
            {rows.map((row) => {
              const mon = addDays(row[0], 1);
              const st = weekStats[mon];
              return (
                <button key={mon} type="button" className="att-cal-week" aria-current={mon === anchor ? 'true' : undefined}
                  aria-label={`${t('weekOf')} ${f.dateTime(date(mon), { month: 'long', day: 'numeric', timeZone: 'UTC' })}${st ? ` · ${t('absencesCount', { count: st.absent })}` : ''}`}
                  onClick={() => { onPick(mon); setOpen(false); }}>
                  {row.map((d) => {
                    const wd = weekdayOf(d);
                    return (
                      <span key={d} className="att-cal-day" data-out={d.slice(0, 7) !== month.slice(0, 7) ? '1' : undefined} data-we={wd === 0 || wd === 6 ? '1' : undefined} data-today={d === today ? '1' : undefined}>
                        <span>{Number(d.slice(8))}</span>
                        {wd === 3 && st && <i className="att-cal-dot" data-a={st.absent ? '1' : undefined} />}
                      </span>
                    );
                  })}
                </button>
              );
            })}
          </div>
          <p className="mt-2 flex items-center gap-3 text-2xs text-muted">
            <span className="flex items-center gap-1"><i className="inline-block h-1.5 w-1.5 rounded-full bg-ok" />{t('calTaken')}</span>
            <span className="flex items-center gap-1"><i className="inline-block h-1.5 w-1.5 rounded-full bg-bad" />{t('calAbsences')}</span>
          </p>
        </div>
      )}
    </div>
  );
}

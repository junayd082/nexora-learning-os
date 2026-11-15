import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { CalendarX2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { meetsOn, periodOf } from '@/lib/bell';
import {
  addDays, emptyTotals, isDayKey, isMark, mondayOf, monthWeeks, todayIn, type Mark, type Totals,
} from '@/lib/attendance';
import { AttendanceSheet, type SheetStudent, type WeekStat } from '@/components/attendance/AttendanceSheet';
import { cn } from '@/lib/util';

/** Term totals for one student in one class (RLS: a student only ever gets their own). */
export async function attendanceTotalsFor(classId: string, studentId: string): Promise<Totals> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('attendance_totals', { p_class: classId });
  const row = ((data ?? []) as ({ student_id: string } & Totals)[]).find((r) => r.student_id === studentId);
  return row ? { present: row.present, absent: row.absent, tardy: row.tardy, excused: row.excused } : emptyTotals();
}

/** "2 absences · 1 tardy" — shown to students beside their grades and on the class card. */
export async function AbsenceChip({ classId, totals, className }: { classId: string; totals: Totals; className?: string }) {
  const t = await getTranslations('attendance');
  return (
    <Link href={`/classes/${classId}?tab=attendance`} className={cn('chip inline-flex items-center gap-1.5 text-2xs hover:text-ink', totals.absent >= 3 && 'border-bad/50 text-bad', className)}>
      <CalendarX2 size={12} aria-hidden />
      {t('absencesCount', { count: totals.absent })}{totals.tardy > 0 && ` · ${t('tardiesCount', { count: totals.tardy })}`}
    </Link>
  );
}

const WEEKDAY = (locale: string, wd: number) => new Intl.DateTimeFormat(locale === 'es' ? 'es-US' : 'en-US', { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 0, 4 + wd)));

export async function AttendanceTab({ classId, className, section, timezone, isTeacher, viewerId, viewerName, week, view }: {
  classId: string; className: string; section: string | null; timezone: string; isTeacher: boolean;
  viewerId: string; viewerName: string; week?: string; view?: string;
}) {
  const supabase = await createClient();
  const t = await getTranslations('attendance');
  const locale = await getLocale();
  const today = todayIn(timezone);
  const mode: 'week' | 'month' = view === 'month' ? 'month' : 'week';
  const anchor = mondayOf(isDayKey(week) ? week : today);
  const weeks = mode === 'week' ? [anchor] : monthWeeks(addDays(anchor, 3));
  const from = weeks[0], to = addDays(weeks[weeks.length - 1], 4);
  const period = periodOf(section);
  const meetDays = period != null ? meetsOn(period) : [];

  let students: SheetStudent[];
  if (isTeacher) {
    const { data: roster } = await supabase.from('enrollments').select('user_id,role,profiles(display_name)').eq('class_id', classId).eq('role', 'student');
    students = ((roster ?? []) as unknown as { user_id: string; profiles: { display_name: string } | null }[])
      .map((r) => ({ id: r.user_id, name: r.profiles?.display_name?.trim() || '—' }))
      .sort((a, b) => a.name.localeCompare(b.name, locale));
  } else {
    students = [{ id: viewerId, name: viewerName || t('you') }];
  }

  const [{ data: rows }, { data: tot }, { data: wk }] = await Promise.all([
    supabase.from('attendance').select('student_id,day,status').eq('class_id', classId).gte('day', from).lte('day', to).limit(5000),
    supabase.rpc('attendance_totals', { p_class: classId }),
    supabase.rpc('attendance_weeks', { p_class: classId, p_from: addDays(today, -400), p_to: addDays(today, 60) }),
  ]);
  const initial: Record<string, Mark> = {};
  for (const r of (rows ?? []) as { student_id: string; day: string; status: string }[]) if (isMark(r.status)) initial[`${r.student_id}|${r.day}`] = r.status;
  const totals: Record<string, Totals> = {};
  for (const r of (tot ?? []) as ({ student_id: string } & Totals)[]) totals[r.student_id] = { present: r.present, absent: r.absent, tardy: r.tardy, excused: r.excused };
  const weekStats: Record<string, WeekStat> = {};
  for (const r of (wk ?? []) as { week: string; marked: number; absent: number }[]) weekStats[r.week] = { marked: r.marked, absent: r.absent };

  const periodLabel = period != null && meetDays.length
    ? t('meets', { period, days: meetDays.filter((d) => d >= 1 && d <= 5).map((d) => WEEKDAY(locale, d)).join(', ') })
    : null;
  const mine = totals[viewerId] ?? emptyTotals();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="display text-xl">{isTeacher ? t('title') : t('mine')}</h2>
          <p className="mt-1 text-sm text-muted">{isTeacher ? t('teacherIntro') : t('studentIntro')}</p>
        </div>
      </div>
      {!isTeacher && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(['absent', 'tardy', 'present', 'excused'] as Mark[]).map((m) => (
            <div key={m} className="card p-4">
              <div className="eyebrow">{t(`plural.${m}`)}</div>
              <div className={cn('mt-1 font-mono text-2xl font-semibold', m === 'absent' && mine.absent > 0 && 'text-bad', m === 'tardy' && mine.tardy > 0 && 'text-warn')}>{mine[m]}</div>
            </div>
          ))}
        </div>
      )}
      <AttendanceSheet classId={classId} students={students} weeks={weeks} view={mode} anchor={anchor} today={today}
        meetDays={meetDays} initial={initial} totals={totals} weekStats={weekStats} editable={isTeacher}
        periodLabel={periodLabel} fileBase={className.replace(/[^\w-]+/g, '_')} />
      {!isTeacher && <p className="text-xs text-muted">{t('studentNote')}</p>}
    </div>
  );
}

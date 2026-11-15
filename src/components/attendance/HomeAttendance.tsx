import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { ArrowRight, CalendarX2, CheckCircle2, ClipboardCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { meetsOn, periodOf } from '@/lib/bell';
import { addDays, previousMeeting, todayIn, weekdayOf, mondayOf } from '@/lib/attendance';
import { SectionTitle } from '@/components/Living';
import { TagChip } from '@/components/TagChip';
import type { Tag } from '@/lib/types';

type C = { id: string; name: string; section: string | null };
type Row = { class_id: string; student_id: string; day: string; status: string; profiles: { display_name: string } | null };
const TZ = 'America/Chicago';
const at = (d: string) => new Date(`${d}T12:00:00Z`);

/**
 * Teacher Home: for each class, who missed the last class meeting (from the bell schedule) and
 * today's attendance — absent names, "everyone here", or a nudge to take it.
 */
export async function TeacherAttendance({ classes }: { classes: C[] }) {
  if (!classes.length) return null;
  const supabase = await createClient();
  const today = todayIn(TZ);
  const plan = classes.map((c) => {
    const period = periodOf(c.section);
    const meet = period != null ? meetsOn(period) : [];
    return { c, period, meetsToday: meet.includes(weekdayOf(today)), prev: meet.length ? previousMeeting(today, meet) : null };
  }).sort((a, b) => (a.period ?? 99) - (b.period ?? 99));
  const { data } = await supabase.from('attendance').select('class_id,student_id,day,status,profiles!attendance_student_id_fkey(display_name)')
    .in('class_id', classes.map((c) => c.id)).gte('day', addDays(today, -21)).lte('day', today).limit(5000);
  const rows = (data ?? []) as unknown as Row[];
  const { data: enr } = await supabase.from('enrollments').select('class_id').in('class_id', classes.map((c) => c.id)).eq('role', 'student');
  const roster = new Map<string, number>();
  for (const e of (enr ?? []) as { class_id: string }[]) roster.set(e.class_id, (roster.get(e.class_id) ?? 0) + 1);

  const items = plan.map((p) => {
    const mine = rows.filter((r) => r.class_id === p.c.id);
    // Classes without a period use the last day attendance was taken.
    const prev = p.prev ?? mine.map((r) => r.day).filter((d) => d < today).sort().pop() ?? null;
    const prevRows = prev ? mine.filter((r) => r.day === prev) : [];
    const todayRows = mine.filter((r) => r.day === today);
    const names = (rs: Row[]) => rs.filter((r) => r.status === 'absent').map((r) => r.profiles?.display_name?.trim() || '—').sort();
    return { ...p, prev, prevTaken: prevRows.length > 0, prevAbsent: names(prevRows), todayTaken: todayRows.length, todayAbsent: names(todayRows), n: roster.get(p.c.id) ?? 0 };
  }).filter((x) => x.n > 0 && (x.meetsToday || x.prevTaken || x.period != null));
  if (!items.length) return null;
  return <TeacherAttendanceView items={items.map(({ c, prev, prevTaken, prevAbsent, meetsToday, todayTaken, todayAbsent }) => ({ c, prev, prevTaken, prevAbsent, meetsToday, todayTaken, todayAbsent }))} today={today} />;
}

export interface TeacherAttItem { c: C; prev: string | null; prevTaken: boolean; prevAbsent: string[]; meetsToday: boolean; todayTaken: number; todayAbsent: string[] }

/** The card itself (kept apart from the data so it can be previewed). */
export async function TeacherAttendanceView({ items, today }: { items: TeacherAttItem[]; today: string }) {
  const t = await getTranslations('attendance');
  const f = await getFormatter();
  const day = (d: string) => f.dateTime(at(d), { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
  return (
    <section data-tour="attendance">
      <SectionTitle>{t('homeTitle')}</SectionTitle>
      <ul className="card divide-y divide-line">
        {items.map((x) => {
          const sheet = `/classes/${x.c.id}?tab=attendance&week=${mondayOf(today)}`;
          return (
            <li key={x.c.id} className="space-y-2 px-4 py-3.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-sm font-semibold">{x.c.section ? `${x.c.section} · ` : ''}{x.c.name}</span>
                <Link href={sheet} className="shrink-0 text-xs text-muted hover:text-ink">{t('openSheet')} →</Link>
              </div>
              {x.prev && (
                <div className="text-sm">
                  <div className="text-2xs font-mono uppercase tracking-[0.12em] text-faint">{t('missedLast', { day: day(x.prev) })}</div>
                  {!x.prevTaken ? <p className="mt-1 text-muted">{t('prevNotTaken')}</p>
                    : x.prevAbsent.length === 0 ? <p className="mt-1 text-muted">{t('noAbsences')}</p>
                    : <p className="mt-1 flex flex-wrap gap-1.5">{x.prevAbsent.map((n) => <span key={n} className="chip border-bad/40 text-xs text-bad"><CalendarX2 size={11} aria-hidden />{n}</span>)}</p>}
                </div>
              )}
              {x.meetsToday && (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {x.todayTaken === 0 ? (
                    <>
                      <span className="text-muted">{t('notTaken')}</span>
                      <Link href={sheet} className="btn btn-sm ml-auto"><ClipboardCheck size={13} aria-hidden />{t('takeIt')}</Link>
                    </>
                  ) : x.todayAbsent.length === 0 ? (
                    <span className="flex items-center gap-1.5 text-ok"><CheckCircle2 size={14} aria-hidden />{t('allHere')}</span>
                  ) : (
                    <>
                      <span className="text-2xs font-mono uppercase tracking-[0.12em] text-faint">{t('absentToday')}</span>
                      {x.todayAbsent.map((n) => <span key={n} className="chip text-xs">{n}</span>)}
                    </>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Student Home: if you were marked absent in a class and haven't been back since, here is that
 * day's lesson — the summary first — so you can catch up.
 */
export async function StudentAbsence({ classes, userId }: { classes: C[]; userId: string }) {
  if (!classes.length) return null;
  const supabase = await createClient();
  const today = todayIn(TZ);
  const { data } = await supabase.from('attendance').select('class_id,day,status').eq('student_id', userId)
    .in('class_id', classes.map((c) => c.id)).gte('day', addDays(today, -10)).lte('day', today).order('day', { ascending: false });
  const rows = (data ?? []) as { class_id: string; day: string; status: string }[];
  const misses: { c: C; day: string }[] = [];
  for (const c of classes) {
    const latest = rows.find((r) => r.class_id === c.id); // newest first
    if (latest?.status === 'absent') misses.push({ c, day: latest.day });
  }
  if (!misses.length) return null;
  const shown = misses.slice(0, 3);
  const [{ data: mats }, { data: asgs }] = await Promise.all([
    supabase.from('class_materials').select('id,class_id,kind,title,tag,quiz_id,lesson_date').in('class_id', shown.map((m) => m.c.id))
      .in('lesson_date', [...new Set(shown.map((m) => m.day))]).eq('published', true),
    supabase.from('assignments').select('id,class_id,title,tag,lesson_date').in('class_id', shown.map((m) => m.c.id))
      .in('lesson_date', [...new Set(shown.map((m) => m.day))]).eq('status', 'published'),
  ]);
  const ORDER = ['resource', 'do_now', 'lecture', 'activity', 'homework', 'exit_ticket'];
  const itemsFor = (cid: string, d: string): AbsenceItem[] => [
    ...((mats ?? []) as { id: string; class_id: string; kind: string; title: string; tag: Tag | null; quiz_id: string | null; lesson_date: string }[])
      .filter((m) => m.class_id === cid && m.lesson_date === d && m.kind !== 'folder')
      .map((m) => ({ key: m.id, title: m.title, tag: m.tag, href: m.kind === 'quiz' && m.quiz_id ? `/checks/${m.quiz_id}` : `/classes/${cid}/m/${m.id}` })),
    ...((asgs ?? []) as { id: string; class_id: string; title: string; tag: Tag | null; lesson_date: string }[])
      .filter((a) => a.class_id === cid && a.lesson_date === d)
      .map((a) => ({ key: a.id, title: a.title, tag: a.tag, href: `/assignments/${a.id}` })),
  ].sort((a, b) => (ORDER.indexOf(a.tag ?? '') + 1 || 9) - (ORDER.indexOf(b.tag ?? '') + 1 || 9));

  return <StudentAbsenceView today={today} cards={shown.map(({ c, day }) => ({ c, day, items: itemsFor(c.id, day) }))} />;
}

export interface AbsenceItem { key: string; title: string; tag: Tag | null; href: string }

export async function StudentAbsenceView({ today, cards }: { today: string; cards: { c: C; day: string; items: AbsenceItem[] }[] }) {
  const t = await getTranslations('attendance');
  const tn = await getTranslations('nova');
  const f = await getFormatter();
  return (
    <div className="mb-8 space-y-4">
      {cards.map(({ c, day, items }) => {
        const label = c.section ? `${c.name} (${c.section})` : c.name;
        return (
          <section key={c.id} className="card overflow-hidden border-bad/30" aria-labelledby={`abs-${c.id}`}>
            <div className="flex items-start gap-3 border-b border-line bg-bad/[0.07] px-5 py-4">
              <CalendarX2 size={18} className="mt-0.5 shrink-0 text-bad" aria-hidden />
              <div className="min-w-0">
                <h2 id={`abs-${c.id}`} className="font-semibold">{day === today ? t('youWereAbsentToday', { cls: label }) : t('youWereAbsent', { cls: label, day: f.dateTime(at(day), { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' }) })}</h2>
                <p className="mt-0.5 text-sm text-muted">{items.length ? t('catchUpIntro') : t('nothingPosted')}</p>
              </div>
            </div>
            {items.length > 0 && (
              <ul className="divide-y divide-line">
                {items.map((i) => (
                  <li key={i.key}>
                    <Link href={i.href} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-ember/[0.05]">
                      {i.tag ? <TagChip tag={i.tag} label={tn(`tags.${i.tag}`)} /> : <span className="chip text-2xs">·</span>}
                      <span className="min-w-0 flex-1 truncate font-medium">{i.title}</span>
                      <ArrowRight size={14} className="shrink-0 text-muted" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

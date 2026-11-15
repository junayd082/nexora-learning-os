import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { ArrowRight, CircleDot, Plus, Presentation, Radio } from 'lucide-react';
import type { Locale } from '@/lib/brand';
import { createClient } from '@/lib/supabase/server';
import { getSequence, getViewer, listExperiences } from '@/lib/data';
import { Empty, Page } from '@/components/Experience';
import { ClassCard, Progress, SectionTitle, Stat, lightFor } from '@/components/Living';
import { hrefFor, type Brief } from '@/components/companion/brain';
import { PeriodIcon } from '@/components/scene/PeriodIcon';
import { getPeriodIcons } from '@/lib/appearance';
import { defaultIconFor, periodFrom } from '@/lib/period-icons';
import { bellState, clockLabel, nextMeeting, periodOf } from '@/lib/bell';
import { ClassNow, OpenTimerButton, type HomeClass } from '@/components/home/ClassNow';
import { Upcoming, type UpCat, type UpEntry } from '@/components/home/Upcoming';
import { StudentAbsence, TeacherAttendance } from '@/components/attendance/HomeAttendance';

const TZ = 'America/Chicago';

function greetingKey() {
  const h = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: TZ }).format(new Date()));
  return h < 12 ? 'goodMorning' : h < 18 ? 'goodAfternoon' : 'goodEvening';
}

/** Start of today in the school's time zone, as an ISO string. */
function startOfToday() {
  const now = new Date();
  const local = new Date(now.toLocaleString('en-US', { timeZone: TZ }));
  const offset = now.getTime() - local.getTime();
  local.setHours(0, 0, 0, 0);
  return new Date(local.getTime() + offset).toISOString();
}

type Cls = { id: string; name: string; section: string | null; subject: string | null; join_code: string; is_demo: boolean; enrollments: { count: number }[] };
type Asg = { id: string; title: string; due_at: string | null; class_id: string; status: string; created_at: string; experience_id: string | null };
type Sub = { assignment_id: string; status: string; submitted_at: string };

export default async function Home() {
  const viewer = await getViewer();
  if (!viewer) redirect('/login?next=/home');
  const t = await getTranslations('home');
  const tc = await getTranslations('classes');
  const locale = (await getLocale()) as Locale;
  const f = await getFormatter();
  const supabase = await createClient();
  const words = (viewer.profile.display_name || '').trim().split(/\s+/);
  // "Mr. C" / "Dr. Lee" keep the title; "Alex Rivera" becomes "Alex".
  const first = /^(mr|mrs|ms|mx|dr|prof|sr|sra|srta)\.?$/i.test(words[0] ?? '') ? words.slice(0, 2).join(' ') : words[0];
  const greeting = t(greetingKey(), { name: first }).replace(/\.$/, '');

  // ------------------------------------------------------------------ Teacher
  if (viewer.isEducator) {
    const { data: clsData } = await supabase.from('classes').select('id,name,section,subject,join_code,is_demo,enrollments(count)')
      .eq('teacher_id', viewer.id).eq('archived', false).order('created_at');
    const classes = (clsData ?? []) as unknown as Cls[];
    const classIds = classes.map((c) => c.id);
    const [{ data: asgData }, { data: live }, mine, { data: pending }] = await Promise.all([
      classIds.length ? supabase.from('assignments').select('id,title,due_at,class_id,status,created_at,experience_id').in('class_id', classIds) : Promise.resolve({ data: [] }),
      supabase.from('live_sessions').select('id,code,started_at,session_participants(count),experiences(slug,experience_translations(locale,title))').eq('host_id', viewer.id).eq('status', 'live').maybeSingle(),
      listExperiences(locale, { mine: viewer.id }),
      classIds.length
        ? supabase.from('submissions').select('id,submitted_at,assignment_id,assignments!inner(title,class_id,classes(name)),profiles!submissions_student_id_fkey(display_name)')
            .eq('status', 'submitted').in('assignments.class_id', classIds).order('submitted_at').limit(6)
        : Promise.resolve({ data: [] }),
    ]);
    const asgs = ((asgData ?? []) as Asg[]).filter((a) => a.status === 'published');
    const { data: subData } = asgs.length ? await supabase.from('submissions').select('assignment_id,status,submitted_at').in('assignment_id', asgs.map((a) => a.id)) : { data: [] };
    const subs = (subData ?? []) as Sub[];
    const today = startOfToday();
    const students = classes.reduce((n, c) => n + (c.enrollments[0]?.count ?? 0), 0);
    const todayCount = subs.filter((s) => s.submitted_at >= today).length;
    const waitingAll = subs.filter((s) => s.status === 'submitted').length;
    const liveRow = live as unknown as { id: string; started_at: string; session_participants: { count: number }[]; experiences: { slug: string; experience_translations: { locale: string; title: string }[] } | null } | null;

    const now = new Date().toISOString();
    const perClass = classes.map((c) => {
      const mineA = asgs.filter((a) => a.class_id === c.id);
      const next = mineA.filter((a) => a.due_at && a.due_at >= now).sort((a, b) => a.due_at!.localeCompare(b.due_at!))[0];
      const latest = [...mineA].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      const n = c.enrollments[0]?.count ?? 0;
      const done = latest ? subs.filter((s) => s.assignment_id === latest.id).length : 0;
      const waiting = subs.filter((s) => s.status === 'submitted' && mineA.some((a) => a.id === s.assignment_id)).length;
      return { c, next, latest, n, done, waiting };
    });
    const hero = perClass.find((p) => p.next) ?? perClass[0];
    const recentWork = mine.slice(0, 3);
    type Pending = { id: string; submitted_at: string; assignment_id: string; assignments: { title: string; classes: { name: string } | null }; profiles: { display_name: string } | null };
    const liveTitle = liveRow?.experiences?.experience_translations.find((x) => x.locale === locale)?.title ?? liveRow?.experiences?.experience_translations[0]?.title;
    // Bell-schedule card: which of my classes is in session (or next), with today's plan.
    const teacherBrief = classes.some((c) => periodOf(c.section) != null) ? ((await supabase.rpc('nova_brief')).data ?? null) as Brief | null : null;
    const tBriefBy = new Map((teacherBrief?.classes ?? []).map((b) => [b.id, b]));
    const teachClasses: HomeClass[] = perClass.map(({ c, n, waiting }) => {
      const b = tBriefBy.get(c.id);
      return { id: c.id, name: c.name, section: c.section, period: periodOf(c.section), teacher: viewer.profile.display_name,
        items: b?.items ?? [], due: b?.due ?? [], update: b?.update ?? null, students: n, waiting };
    });
    const actions = (
      <div className="flex flex-wrap gap-2">
        <Link href="/classes?new=1" className="btn-primary btn-lg"><Plus size={16} aria-hidden />{t('newClass')}</Link>
        <Link href="/discover" className="btn btn-lg"><Presentation size={16} aria-hidden />{t('present')}</Link>
        <Link href="/teach/new" className="btn-ghost btn-lg">{t('addExperience')}</Link>
        <OpenTimerButton />
      </div>
    );

    return (
      <Page wide>
        {teacherBrief ? (
          <div className="glow-pool pt-2" data-tour="classnow">
            <ClassNow classes={teachClasses} role="teacher" serverNow={Date.now()} greeting={greeting} />
            <div className="-mt-2 mb-10">{actions}</div>
          </div>
        ) : (
        <section className="glow-pool grid gap-8 pb-10 pt-2 lg:grid-cols-[1.25fr_1fr] lg:items-end">
          <div>
            <div className="eyebrow ember-text">{greeting.toUpperCase()}</div>
            <h1 className="display mt-3 text-4xl leading-[1.05] sm:text-5xl">{t('teacherPrompt')}</h1>
            <div className="mt-7 flex flex-wrap gap-2">
              <Link href="/classes?new=1" className="btn-primary btn-lg"><Plus size={16} aria-hidden />{t('newClass')}</Link>
              <Link href="/discover" className="btn btn-lg"><Presentation size={16} aria-hidden />{t('present')}</Link>
              <Link href="/teach/new" className="btn-ghost btn-lg">{t('addExperience')}</Link>
            </div>
          </div>
          {hero ? (
            <Link href={`/classes/${hero.c.id}`} className="lit lit-edge card group block p-6" style={{ ['--glow' as string]: lightFor(hero.c.id) }}>
              <div className="flex items-center justify-between">
                <span className="eyebrow">{hero.c.section ?? tc('title')}</span>
                {liveRow ? <span className="flex items-center gap-2 text-xs ember-text"><span className="live-dot" />{t('pulseLive')}</span> : null}
              </div>
              <div className="mt-2 text-xl font-bold uppercase tracking-[0.03em]">{hero.c.name}</div>
              <div className="mt-1 text-sm text-muted">{tc('students', { count: hero.n })}</div>
              <div className="mt-5 text-2xs font-mono uppercase tracking-[0.14em] text-faint">{t('next')}</div>
              <div className="mt-0.5 font-medium">{hero.next?.title ?? t('nothingScheduled')}
                {hero.next?.due_at && <span className="ml-2 text-sm text-muted">· {f.dateTime(new Date(hero.next.due_at), { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</span>}</div>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold ember-text">{t('enterClass')} <ArrowRight size={15} aria-hidden className="transition-transform group-hover:translate-x-0.5" /></span>
            </Link>
          ) : (
            <Empty action={<Link href="/classes?new=1" className="btn btn-sm">{t('newClass')}</Link>}>{t('noClassesTeacher')}</Empty>
          )}
        </section>
        )}

        {liveRow && (
          <Link href={`/present/${liveRow.experiences?.slug}?s=${liveRow.id}`} className="mb-8 flex flex-wrap items-center gap-4 rounded-lg border border-ember/30 bg-ember/[0.07] px-5 py-3.5 hover:bg-ember/10">
            <Radio className="ember-text" size={18} aria-hidden />
            <span className="flex-1 text-sm"><span className="font-semibold">{liveTitle}</span> · {liveRow.session_participants[0]?.count ?? 0} {t('pulseLive').toLowerCase()} · {f.relativeTime(new Date(liveRow.started_at))}</span>
            <ArrowRight size={16} aria-hidden />
          </Link>
        )}

        <SectionTitle>{t('pulse')}</SectionTitle>
        <div className="card mb-10 grid grid-cols-2 divide-x divide-y divide-line overflow-hidden sm:grid-cols-4 sm:divide-y-0">
          <Stat label={t('pulseStudents')} value={students} />
          <Stat label={t('pulseToday')} value={todayCount} live={todayCount > 0} />
          <Stat label={t('pulseWaiting')} value={waitingAll} />
          <Stat label={t('pulseLive')} value={liveRow ? (liveRow.session_participants[0]?.count ?? 0) : '—'} live={!!liveRow} hint={liveRow ? undefined : t('pulseLiveNone')} />
        </div>

        <div className="grid gap-10 xl:grid-cols-[1.6fr_1fr]">
          <section>
            <SectionTitle action={<Link href="/classes" className="text-xs text-muted hover:text-ink">{tc('title')} →</Link>}>{t('yourClasses')}</SectionTitle>
            {perClass.length === 0 ? <Empty>{t('noClassesTeacher')}</Empty> : (
              <div className="grid gap-4 sm:grid-cols-2">
                {perClass.map(({ c, next, latest, n, done, waiting }) => (
                  <ClassCard key={c.id} id={c.id} href={`/classes/${c.id}`} name={c.name} demo={c.is_demo}
                    meta={[c.section, c.subject].filter(Boolean).join(' · ') || undefined}
                    students={tc('students', { count: n })} waiting={waiting ? t('waitingCount', { count: waiting }) : undefined}
                    next={{ label: t('next'), title: next?.title ?? t('nothingScheduled') }}
                    progress={latest && n ? done / n : null} progressLabel={latest && n ? `${latest.title} — ${t('latestDone', { done, total: n })}` : undefined}
                    cta={t('enterClass')} />
                ))}
              </div>
            )}
          </section>

          <div className="space-y-10">
            <TeacherAttendance classes={classes.map((c) => ({ id: c.id, name: c.name, section: c.section }))} />
            <section>
              <SectionTitle action={waitingAll > 6 ? <span className="font-mono text-2xs ember-text">{t('waitingCount', { count: waitingAll })}</span> : undefined}>{t('toReview')}</SectionTitle>
              {(pending ?? []).length === 0 ? <Empty>{t('toReviewEmpty')}</Empty> : (
                <ul className="card divide-y divide-line">
                  {((pending ?? []) as unknown as Pending[]).map((s) => (
                    <li key={s.id}>
                      <Link href={`/assignments/${s.assignment_id}#s-${s.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-ember/[0.05]">
                        <CircleDot size={14} className="shrink-0 ember-text" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{s.profiles?.display_name ?? '—'} · {s.assignments.title}</span>
                          <span className="block text-xs text-muted">{s.assignments.classes?.name} · {f.relativeTime(new Date(s.submitted_at))}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section>
              <SectionTitle action={<Link href="/teach" className="text-xs text-muted hover:text-ink">→</Link>}>{t('continueBuilding')}</SectionTitle>
              {recentWork.length === 0 ? (
                <Empty action={<Link href="/teach/new" className="btn btn-sm"><Plus size={13} aria-hidden />{t('addExperience')}</Link>}>{t('addExperience')}</Empty>
              ) : (
                <ul className="card divide-y divide-line">
                  {recentWork.map((e) => (
                    <li key={e.id}><Link href={`/teach/${e.slug}`} className="flex items-center gap-3 px-4 py-3 hover:bg-violet/[0.06]">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: 'rgb(var(--nx-violet))', boxShadow: '0 0 8px rgb(var(--nx-violet))' }} />
                      <span className="min-w-0 flex-1 truncate text-sm">{e.t.title}</span>
                      <span className="font-mono text-2xs text-faint">v{e.version}</span>
                    </Link></li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </Page>
    );
  }

  // ------------------------------------------------------------------ Student
  const nowMs = Date.now();
  const [enr, liveRes, subsRes, portfolio, seq, path] = await Promise.all([
    supabase.from('enrollments').select('class_id, classes(id,name,section,subject,is_demo,archived,profiles!classes_teacher_id_fkey(display_name))').eq('user_id', viewer.id),
    supabase.from('live_sessions').select('id,code,experience_id,experiences(slug,experience_translations(locale,title))').eq('status', 'live').limit(3),
    supabase.from('submissions').select('assignment_id,status,score,feedback,assignments(title,points,experience_id,class_id,experiences(skills))').eq('student_id', viewer.id),
    supabase.from('portfolio_items').select('id', { count: 'exact', head: true }).eq('user_id', viewer.id),
    getSequence('autocad-for-beginners'),
    listExperiences(locale),
  ]);
  type C = { id: string; name: string; section: string | null; subject: string | null; is_demo: boolean; archived: boolean; profiles: { display_name: string } | null };
  const myClasses = (enr.data ?? []).map((e) => e.classes as unknown as C | null).filter((c): c is C => !!c && !c.archived)
    .sort((a, b) => (periodOf(a.section) ?? 99) - (periodOf(b.section) ?? 99) || a.name.localeCompare(b.name));
  const classIds = myClasses.map((c) => c.id);
  const [icons, { data: assignments }, { data: updates }, briefRes] = await Promise.all([
    getPeriodIcons(classIds).catch(() => ({} as Awaited<ReturnType<typeof getPeriodIcons>>)),
    classIds.length
      ? supabase.from('assignments').select('id,title,due_at,points,class_id,experience_id,classes(name)').in('class_id', classIds).eq('status', 'published').order('due_at', { ascending: true, nullsFirst: false })
      : Promise.resolve({ data: [] }),
    classIds.length
      ? supabase.from('class_updates').select('id,class_id,body,pinned,created_at').in('class_id', classIds)
          .gte('created_at', new Date(nowMs - 14 * 86_400_000).toISOString()).order('created_at', { ascending: false }).limit(12)
      : Promise.resolve({ data: [] }),
    supabase.rpc('nova_brief'),
  ]);
  type A = { id: string; title: string; due_at: string | null; points: number | null; class_id: string; experience_id: string | null; classes: { name: string } | null };
  type S = { assignment_id: string; status: string; score: number | null; feedback: string | null; assignments: { title: string; points: number | null; experience_id: string | null; class_id: string; experiences: { skills: string[] } | null } | null };
  const subList = (subsRes.data ?? []) as unknown as S[];
  const done = new Set(subList.map((s) => s.assignment_id));
  const allA = (assignments ?? []) as unknown as A[];
  const due = allA.filter((a) => !done.has(a.id)).slice(0, 6);
  const returned = subList.filter((s) => s.status === 'returned').slice(0, 4);
  const skillCounts = new Map<string, number>();
  subList.filter((s) => s.status === 'returned')
    .forEach((s) => s.assignments?.experiences?.skills.forEach((k) => skillCounts.set(k, (skillCounts.get(k) ?? 0) + 1)));
  const completedExp = new Set(subList.map((s) => s.assignments?.experience_id).filter(Boolean));
  const order = new Map(seq?.collection_items.map((i) => [i.experience_id, i.position]) ?? []);
  const lessons = path.filter((e) => order.has(e.id) && e.type === 'lesson').sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  const nextUp = lessons.find((e) => !completedExp.has(e.id));
  const pathProgress = lessons.length ? lessons.filter((e) => completedExp.has(e.id)).length / lessons.length : 0;
  const heroTask = due[0];
  const tw = await getTranslations('now');
  const brief = (briefRes.data ?? null) as Brief | null;
  const briefBy = new Map((brief?.classes ?? []).map((b) => [b.id, b]));
  type Live = { id: string; code: string; experiences: { slug: string; experience_translations: { locale: string; title: string }[] } | null };

  // One record per class: who teaches it, which period, and what the brief says about today.
  const homeClasses: HomeClass[] = myClasses.map((c) => {
    const b = briefBy.get(c.id);
    return { id: c.id, name: c.name, section: c.section, period: periodOf(c.section), teacher: c.profiles?.display_name ?? null,
      items: b?.items ?? [], due: b?.due ?? [], update: b?.update ?? null };
  });
  const hasPeriods = homeClasses.some((c) => c.period != null);

  // ---- Upcoming: today's plan, work due, teacher announcements, and catch-up from last class.
  const TAGS = ['do_now', 'lecture', 'activity', 'homework', 'exit_ticket', 'resource'];
  const isDone = (st?: string | null) => st === 'submitted' || st === 'returned';
  const pad = (n: number | null) => String(n ?? 99).padStart(2, '0');
  const entries: UpEntry[] = [];
  for (const c of homeClasses) {
    const b = briefBy.get(c.id);
    if (!b) continue;
    const base = { classId: c.id, className: c.name, period: c.period, teacher: c.teacher };
    const seen = new Set<string>();
    for (const i of b.items) {
      seen.add(i.id);
      const cats: UpCat[] = [i.tag === 'do_now' ? 'do_now' : 'lesson'];
      if (i.due_at) cats.push('due');
      entries.push({ ...base, key: `t${i.id}`, cats, group: 'today', title: i.title, href: hrefFor(c.id, i), tag: i.tag, dueAt: i.due_at, status: i.status ?? null,
        sort: `${pad(c.period)}${TAGS.indexOf(i.tag ?? '') + 1 || 9}${i.title}` });
    }
    for (const i of b.due) {
      if (seen.has(i.id) || isDone(i.status)) continue;
      seen.add(i.id);
      entries.push({ ...base, key: `d${i.id}`, cats: i.tag === 'do_now' ? ['due', 'do_now'] : ['due'], group: 'due', title: i.title, href: hrefFor(c.id, i), tag: i.tag, dueAt: i.due_at, status: null,
        sort: i.due_at ?? '9' });
    }
    for (const i of b.missed) {
      if (seen.has(i.id) || isDone(i.status)) continue;
      entries.push({ ...base, key: `m${i.id}`, cats: ['catch_up'], group: 'missed', title: i.title, href: hrefFor(c.id, i), tag: i.tag, dueAt: i.due_at, status: null,
        sort: `${pad(c.period)}${i.title}` });
    }
  }
  const classById = new Map(homeClasses.map((c) => [c.id, c]));
  for (const u of (updates ?? []) as { id: string; class_id: string; body: string; pinned: boolean; created_at: string }[]) {
    const c = classById.get(u.class_id);
    if (!c) continue;
    entries.push({ key: `u${u.id}`, cats: ['announcement'], group: 'news', title: '', body: u.body, createdAt: u.created_at, pinned: u.pinned,
      href: `/classes/${c.id}?tab=updates`, classId: c.id, className: c.name, period: c.period, teacher: c.teacher,
      sort: `${u.pinned ? 0 : 1}${String(9e12 - Date.parse(u.created_at)).padStart(14, '0')}` });
  }

  // ---- Class cards: "In session now", "Today 8:45 AM", or the next day it meets.
  const bell = bellState(nowMs);
  const meetLine = (period: number | null) => {
    if (period == null) return tw('noPeriodSet');
    const nm = nextMeeting(period, nowMs);
    if (!nm) return tw('notOnSchedule');
    if (nm.inDays === 0) return bell.current?.period === period
      ? tw('untilTime', { time: clockLabel(nm.slot.end, locale) })
      : tw('todayAt', { time: clockLabel(nm.slot.start, locale) });
    const day = nm.inDays === 1 ? tw('tomorrow') : new Intl.DateTimeFormat(locale === 'es' ? 'es-US' : 'en-US', { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 0, 4 + nm.weekday)));
    return tw('dayAt', { day, time: clockLabel(nm.slot.start, locale) });
  };

  return (
    <Page wide>
      {((liveRes.data ?? []) as unknown as Live[]).map((s) => {
        const tr = s.experiences?.experience_translations ?? [];
        const title = (tr.find((x) => x.locale === locale) ?? tr[0])?.title ?? '';
        return (
          <div key={s.id} className="mb-6 flex flex-wrap items-center gap-4 rounded-lg border border-ember/40 bg-ember/[0.08] px-5 py-4 shadow-[0_0_40px_-12px_rgb(var(--nx-ember)/0.6)]">
            <span className="live-dot" aria-hidden />
            <p className="flex-1 font-medium">{t('liveNow', { title })}</p>
            <Link href={`/join/${s.code}`} className="btn-primary">{t('joinNow').toUpperCase()}</Link>
          </div>
        );
      })}

      {hasPeriods ? (
        <div className="glow-pool pt-2" data-tour="classnow"><ClassNow classes={homeClasses} role="student" serverNow={nowMs} greeting={greeting} /></div>
      ) : (
        <section className="glow-pool grid gap-8 pb-10 pt-2 lg:grid-cols-[1.2fr_1fr] lg:items-end">
          <div>
            <div className="eyebrow ember-text">{greeting.toUpperCase()}</div>
            <h1 className="display mt-3 text-4xl leading-[1.05] sm:text-5xl">{t('studentPrompt')}</h1>
          </div>
          {(heroTask || nextUp) && (
            <Link href={heroTask ? `/assignments/${heroTask.id}` : `/x/${nextUp!.slug}`} className="lit lit-edge card group block p-6">
              <div className="eyebrow">{heroTask ? t('due') : t('upNext')}</div>
              <div className="mt-2 text-lg font-semibold leading-snug">{heroTask ? heroTask.title : nextUp!.t.title}</div>
              <div className="mt-1 text-sm text-muted">
                {heroTask ? <>{heroTask.classes?.name}{heroTask.due_at && <> · {f.dateTime(new Date(heroTask.due_at), { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</>}</>
                  : seq && (locale === 'es' && seq.title_es ? seq.title_es : seq.title)}
              </div>
              {!heroTask && <div className="mt-4"><Progress value={pathProgress} /></div>}
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold ember-text">{t('continueAction')} <ArrowRight size={15} aria-hidden className="transition-transform group-hover:translate-x-0.5" /></span>
            </Link>
          )}
        </section>
      )}

      {/* ---- Your classes, in bell order ---- */}
      <section className="mb-10" aria-labelledby="your-classes">
        <SectionTitle id="your-classes" action={<Link href="/join" className="btn btn-sm">{t('joinClass')}</Link>}>{t('yourClasses')}</SectionTitle>
        {myClasses.length === 0 ? <Empty action={<Link href="/join" className="btn btn-sm">{t('joinClass')}</Link>}>{t('noClasses')}</Empty> : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {homeClasses.map((hc) => {
              const c = myClasses.find((x) => x.id === hc.id)!;
              const ca = allA.filter((a) => a.class_id === c.id);
              const nextA = ca.find((a) => !done.has(a.id));
              const inSession = hc.period != null && bell.current?.period === hc.period;
              return (
                <ClassCard key={c.id} id={c.id} href={`/classes/${c.id}`} name={c.name} demo={c.is_demo}
                  meta={[c.section, hc.teacher].filter(Boolean).join(' · ') || undefined}
                  students={meetLine(hc.period)} waiting={inSession ? tw('inSession') : undefined}
                  next={{ label: t('next'), title: nextA?.title ?? t('nothingDue') }}
                  progress={ca.length ? ca.filter((a) => done.has(a.id)).length / ca.length : null}
                  cta={t('enterClass')}
                  icon={<PeriodIcon classId={c.id} className={c.name} period={periodFrom(c.section)} icon={icons[c.id]} fallback={defaultIconFor(c.id, c.subject, c.name)} />} />
              );
            })}
          </div>
        )}
      </section>

      <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr]">
        <div className="min-w-0" data-tour="upcoming">
          <StudentAbsence classes={myClasses.map((c) => ({ id: c.id, name: c.name, section: c.section }))} userId={viewer.id} />
          <Upcoming entries={entries} serverNow={nowMs} />
        </div>
        <div className="space-y-10">
          {returned.length > 0 && (
            <section>
              <SectionTitle>{t('returned')}</SectionTitle>
              <ul className="card divide-y divide-line">
                {returned.map((s) => (
                  <li key={s.assignment_id}>
                    <Link href={`/assignments/${s.assignment_id}`} className="block px-4 py-3.5 hover:bg-violet/[0.05]">
                      <div className="flex justify-between gap-3 text-sm"><span className="font-semibold">{s.assignments?.title}</span>
                        {s.score !== null && <span className="font-mono ember-text">{s.score}{s.assignments?.points ? <span className="text-muted"> / {s.assignments.points}</span> : ''}</span>}</div>
                      {s.feedback && <p className="mt-1 line-clamp-2 text-sm text-muted">“{s.feedback}”</p>}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {nextUp && (
            <section>
              <SectionTitle>{t('recommended')}</SectionTitle>
              <Link href={`/x/${nextUp.slug}`} className="lit lit-edge card flex items-center gap-4 p-4" style={{ ['--glow' as string]: 'var(--nx-violet)' }}>
                <span className="min-w-0 flex-1">
                  <span className="block text-2xs font-mono uppercase tracking-wider text-muted">{seq && (locale === 'es' && seq.title_es ? seq.title_es : seq.title)}</span>
                  <span className="block font-semibold">{nextUp.t.title}</span>
                  <span className="mt-2 block"><Progress value={pathProgress} light="var(--nx-violet)" /></span>
                </span>
                <ArrowRight size={16} aria-hidden />
              </Link>
            </section>
          )}
          <section>
            <SectionTitle>{t('skills')}</SectionTitle>
            {skillCounts.size === 0 ? <p className="text-sm text-muted">{t('skillsEmpty')}</p> : (
              <ul className="card space-y-3 p-4">
                {Array.from(skillCounts.entries()).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
                  <li key={k} className="text-sm">
                    <div className="mb-1.5 flex justify-between"><span>{k}</span><span className="font-mono text-xs text-muted">{n}</span></div>
                    <Progress value={Math.min(1, n / 5)} light="var(--nx-violet)" />
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <Link href="/portfolio" className="lit lit-edge card flex items-center justify-between p-5" style={{ ['--glow' as string]: 'var(--nx-magenta)' }}>
              <span><span className="block font-semibold">{t('portfolio')}</span><span className="text-sm text-muted">{t('portfolioCount', { count: portfolio.count ?? 0 })}</span></span>
              <ArrowRight size={16} aria-hidden />
            </Link>
          </section>
        </div>
      </div>
    </Page>
  );
}

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { RegisterClassMenu } from '@/components/Nav';
import { AskTeacherMenu } from '@/components/live/HallPass';
import { ClassPassCard, ClassroomTools } from '@/components/live/HallPassTeacher';
import { CornellTile } from '@/components/cornell/CornellTile';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import {
  AppWindow, BookOpen, ClipboardCheck, ChevronRight, ClipboardList, ExternalLink, FileText, Folder, GraduationCap, Link2, Megaphone,
  Paperclip, Pin, Users, Timer as TimerIcon,
} from 'lucide-react';
import type { Locale } from '@/lib/brand';
import { createClient } from '@/lib/supabase/server';
import { appInitials, getApps, getClassApps, getViewer, listExperiences } from '@/lib/data';
import { regenerateCode, removeFromClass, setClassArchived } from '@/lib/actions';
import type { Material, Tag } from '@/lib/types';
import { TagChip } from '@/components/TagChip';
import { CalendarClock, ListChecks, Sun } from 'lucide-react';
import { Empty, Page } from '@/components/Experience';
import { ActionButton, CopyButton, DownloadButton, PrintButton } from '@/components/forms';
import { lightFor } from '@/components/Living';
import { humanSize } from '@/lib/files';
import { cn, csv } from '@/lib/util';
import { getClassAppearance } from '@/lib/appearance';
import { SceneLock } from '@/components/scene/SceneLock';
import { ClassAppearanceForm } from '@/components/scene/ClassAppearanceForm';
import { AttendanceTab, AbsenceChip, attendanceTotalsFor } from './attendance';
import { AddMaterials, DeleteUpdateButton, MaterialMenu, PinAppForm, UnpinButton, UpdateForm } from './course';

type A = { id: string; title: string; due_at: string | null; points: number | null; status: string; submission_type: string; lesson_date: string | null; tag: Tag | null; timer_minutes?: number | null; timer_mode?: string | null };
type S = { assignment_id: string; student_id: string; status: string; score: number | null; graded_at: string | null };
const TABS = ['materials', 'updates', 'gradebook', 'attendance', 'members', 'apps'] as const;
type Tab = (typeof TABS)[number];

export default async function ClassPage({ params, searchParams }:
  { params: Promise<{ id: string }>; searchParams: Promise<{ joined?: string; tab?: string; folder?: string; week?: string; view?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=/classes/${id}`);
  const supabase = await createClient();
  const { data: cls } = await supabase.from('classes').select('*, profiles!classes_teacher_id_fkey(display_name)').eq('id', id).maybeSingle();
  if (!cls) notFound();
  const t = await getTranslations('classes');
  const tco = await getTranslations('course');
  const tat = await getTranslations('attendance');
  const f = await getFormatter();
  const locale = (await getLocale()) as Locale;
  const isTeacher = cls.teacher_id === viewer.id;
  const tab: Tab = (TABS as readonly string[]).includes(sp.tab ?? '') ? (sp.tab as Tab) : 'materials';
  const light = lightFor(id);

  const [{ data: aData }, classApps, { count: studentCount }] = await Promise.all([
    supabase.from('assignments').select('id,title,due_at,points,status,submission_type,lesson_date,tag,timer_minutes,timer_mode').eq('class_id', id).order('due_at', { ascending: true, nullsFirst: false }),
    getClassApps(id),
    supabase.from('enrollments').select('user_id', { count: 'exact', head: true }).eq('class_id', id).eq('role', 'student'),
  ]);
  const assignments = (aData ?? []) as A[];
  const now = Date.now();
  const upcoming = assignments.filter((a) => a.status === 'published' && a.due_at && new Date(a.due_at).getTime() > now && new Date(a.due_at).getTime() < now + 14 * 864e5);
  const look = await getClassAppearance(id);
  const ta = await getTranslations('appearance');
  const myTotals = !isTeacher ? await attendanceTotalsFor(id, viewer.id) : null;
  const reminders = isTeacher ? ((await supabase.rpc('class_reminders', { p_class_id: id })).data as { ungraded: number; resubmitted: number } | null) : null;

  const navItem = (k: Tab, icon: React.ReactNode, label: string) => (
    <Link href={`/classes/${id}?tab=${k}`} aria-current={tab === k ? 'page' : undefined}
      className={cn('nav-item flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[13.5px]', tab === k ? 'font-semibold' : 'text-muted hover:text-ink')}>
      {icon}{label}
    </Link>
  );

  return (
    <Page wide>
      {!isTeacher && <SceneLock scene={look.lockScene} />}
      {sp.joined && <p role="status" className="mb-4 rounded border border-ok/30 bg-ok/5 px-3 py-2 text-sm text-ok">{t('joined', { name: cls.name })}</p>}
      <div className="grid gap-8 lg:grid-cols-[230px_minmax(0,1fr)] xl:grid-cols-[230px_minmax(0,1fr)_270px]">
        {/* ---------------- Course menu ---------------- */}
        <aside className="space-y-5">
          <div className="card overflow-hidden">
            <div className="relative h-24" style={{ background: `radial-gradient(120% 140% at 0% 100%, rgb(${light} / 0.55), transparent 60%), radial-gradient(90% 120% at 100% 0%, rgb(var(--nx-violet) / 0.35), transparent 60%), rgb(var(--nx-carbon-1))` }}>
              <div className="absolute inset-0 grid-paper opacity-60" />
              {cls.section && <div className="absolute left-3 top-3 font-mono text-2xs uppercase tracking-[0.16em] text-white/80">{cls.section}</div>}
            </div>
            <div className="p-3">
              <h1 className="text-sm font-bold uppercase leading-snug tracking-[0.03em]">{cls.name}</h1>
              <div className="mt-0.5 text-xs text-muted">{isTeacher ? t('students', { count: studentCount ?? 0 }) : (cls.profiles as { display_name: string } | null)?.display_name}</div>
              {myTotals && <AbsenceChip classId={id} totals={myTotals} className="mt-2" />}
              {cls.archived && <span className="chip mt-2">{t('archived')}</span>}
            </div>
          </div>
          <RegisterClassMenu menu={{
            title: cls.name, section: cls.section ?? null, appsLabel: tco('apps'),
            items: ([
              ['materials', tco('materials')], ['updates', tco('updates')], ['gradebook', isTeacher ? t('gradebook') : tco('grades')],
              ['attendance', tat('title')], ['members', tco('members')], ['apps', tco('apps')],
            ] as const).map(([k, label]) => ({ key: k, label, href: `/classes/${id}?tab=${k}`, active: tab === k })),
            apps: classApps.map((a) => ({ id: a.id, name: a.name, url: a.url, color: a.color, initials: appInitials(a.name) })),
          }} />
          {!isTeacher && <AskTeacherMenu classId={id} className="btn w-full justify-center" />}
          {/* Phones/tablets: these tabs live in the ☰ menu (top left). */}
          <nav aria-label={tco('courseMenu')} className="hidden flex-col gap-px pl-3 lg:flex">
            {navItem('materials', <BookOpen size={15} aria-hidden />, tco('materials'))}
            {navItem('updates', <Megaphone size={15} aria-hidden />, tco('updates'))}
            {navItem('gradebook', <GraduationCap size={15} aria-hidden />, isTeacher ? t('gradebook') : tco('grades'))}
            {navItem('attendance', <ClipboardCheck size={15} aria-hidden />, tat('title'))}
            {navItem('members', <Users size={15} aria-hidden />, tco('members'))}
            {navItem('apps', <AppWindow size={15} aria-hidden />, tco('apps'))}
          </nav>
          {classApps.length > 0 && (
            <div className="hidden pl-3 lg:block">
              <div className="eyebrow px-2.5 pb-1.5 text-faint">{tco('apps')}</div>
              <ul className="flex flex-col gap-px">
                {classApps.map((a) => (
                  <li key={a.id}>
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="nav-item flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] text-muted hover:text-ink">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[9px] font-bold text-white" style={{ background: a.color }}>{appInitials(a.name)}</span>
                      <span className="truncate">{a.name}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>

        {/* ---------------- Main ---------------- */}
        <section className="min-w-0">
          <CornellTile classId={id} userId={viewer.id} compact className="mb-5 xl:hidden" />
          {tab === 'materials' && <MaterialsTab classId={id} folderId={sp.folder ?? null} isTeacher={isTeacher} userId={viewer.id} assignments={assignments} locale={locale} timezone={cls.timezone ?? 'America/Chicago'} />}
          {tab === 'updates' && <UpdatesTab classId={id} isTeacher={isTeacher} />}
          {tab === 'gradebook' && <GradebookTab classId={id} className={cls.name} isTeacher={isTeacher} userId={viewer.id} assignments={assignments} />}
          {tab === 'attendance' && <AttendanceTab classId={id} className={cls.name} section={cls.section ?? null} timezone={cls.timezone ?? 'America/Chicago'} isTeacher={isTeacher} viewerId={viewer.id} viewerName={viewer.profile.display_name} week={sp.week} view={sp.view} />}
          {tab === 'members' && <MembersTab classId={id} isTeacher={isTeacher} teacherName={(cls.profiles as { display_name: string } | null)?.display_name ?? ''} count={studentCount ?? 0} />}
          {tab === 'apps' && <AppsTab classId={id} isTeacher={isTeacher} pinned={classApps} />}
        </section>

        {/* ---------------- Right column ---------------- */}
        <aside className="space-y-6 lg:col-start-2 xl:col-start-auto">
          <CornellTile classId={id} userId={viewer.id} className="hidden xl:block" />
          {isTeacher && <ClassroomTools classId={id} />}
          <ClassPassCard classId={id} isTeacher={isTeacher} />
          {isTeacher && (
            <section className="card p-4 text-center">
              <div className="eyebrow">{t('joinCode')}</div>
              <div className="mt-1 font-mono text-3xl font-semibold tracking-wider">{cls.join_code}</div>
              <div className="mt-3 flex flex-wrap justify-center gap-2 no-print">
                <CopyButton text={cls.join_code} />
                <ActionButton action={regenerateCode.bind(null, id)} confirmText={`${t('regenerate')}?`}>{t('regenerate')}</ActionButton>
              </div>
            </section>
          )}
          {isTeacher && (
            <section className="card p-4">
              <h2 className="eyebrow mb-3">{ta('teacher.title')}</h2>
              <ClassAppearanceForm classId={id} allowCustomIcons={look.allowCustomIcons} lockScene={look.lockScene} />
            </section>
          )}
          {isTeacher && reminders && (
            <section>
              <h2 className="eyebrow mb-2">{tco('reminders')}</h2>
              <ul className="space-y-1 text-sm">
                <li><Link href={`/classes/${id}?tab=gradebook`} className="ember-text hover:underline">{tco('ungraded', { count: reminders.ungraded })}</Link></li>
                {reminders.resubmitted > 0 && <li><Link href={`/classes/${id}?tab=gradebook`} className="ember-text hover:underline">{tco('resubmitted', { count: reminders.resubmitted })}</Link></li>}
              </ul>
            </section>
          )}
          <section>
            <h2 className="eyebrow mb-2">{tco('upcoming')}</h2>
            {upcoming.length === 0 ? <p className="text-sm text-muted">{tco('noUpcoming')}</p> : (
              <ul className="space-y-2">
                {upcoming.map((a) => (
                  <li key={a.id}><Link href={`/assignments/${a.id}`} className="flex gap-3 text-sm hover:text-ember">
                    <span className="w-12 shrink-0 rounded border border-line py-1 text-center font-mono text-2xs leading-tight">
                      {f.dateTime(new Date(a.due_at!), { month: 'short' }).toUpperCase()}<br /><span className="text-base font-semibold">{f.dateTime(new Date(a.due_at!), { day: 'numeric' })}</span>
                    </span>
                    <span className="min-w-0"><span className="block truncate font-medium">{a.title}</span>
                      <span className="text-xs text-muted">{f.dateTime(new Date(a.due_at!), { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</span></span>
                  </Link></li>
                ))}
              </ul>
            )}
          </section>
          <div className="flex flex-wrap gap-2 no-print">
            {isTeacher
              ? <ActionButton action={setClassArchived.bind(null, id, !cls.archived)}>{cls.archived ? t('unarchive') : t('archive')}</ActionButton>
              : <ActionButton action={removeFromClass.bind(null, id, viewer.id)} confirmText={`${t('leave')}?`}>{t('leave')}</ActionButton>}
          </div>
        </aside>
      </div>
    </Page>
  );
}

// ============================================================================ Materials
/** The class's calendar day, in the class's own time zone. */
function dayIn(tz: string, d = new Date()) {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d); }
  catch { return d.toISOString().slice(0, 10); }
}

async function MaterialsTab({ classId, folderId, isTeacher, userId, assignments, locale, timezone }:
  { classId: string; folderId: string | null; isTeacher: boolean; userId: string; assignments: A[]; locale: Locale; timezone: string }) {
  const supabase = await createClient();
  const tco = await getTranslations('course');
  const today = dayIn(timezone);
  const { data } = await supabase.from('class_materials').select('*').eq('class_id', classId).order('position');
  const all = (data ?? []) as Material[];
  const folder = folderId ? all.find((m) => m.id === folderId && m.kind === 'folder') ?? null : null;
  const items = all.filter((m) => (m.parent_id ?? null) === (folder?.id ?? null));
  const folders = all.filter((m) => m.kind === 'folder').map((m) => ({ id: m.id, title: m.title }));
  // Breadcrumb trail
  const trail: Material[] = [];
  for (let cur = folder; cur; cur = all.find((m) => m.id === cur!.parent_id) ?? null) trail.unshift(cur);
  // Assignments not placed in a folder appear at the top level, like Schoology.
  const linked = new Set(all.map((m) => m.assignment_id).filter(Boolean));
  const loose = folder ? [] : assignments.filter((a) => !linked.has(a.id) && (isTeacher || a.status === 'published'));
  const counts = new Map<string, number>();
  all.forEach((m) => m.parent_id && counts.set(m.parent_id, (counts.get(m.parent_id) ?? 0) + 1));

  let library: { id: string; title: string }[] = [];
  let apps: { id: string; name: string }[] = [];
  if (isTeacher) {
    const [pub, mine, appList] = await Promise.all([listExperiences(locale), listExperiences(locale, { mine: userId }), getApps()]);
    const seen = new Set<string>();
    library = [...mine, ...pub].filter((e) => !seen.has(e.id) && seen.add(e.id)).map((e) => ({ id: e.id, title: e.t.title }));
    apps = appList.map((a) => ({ id: a.id, name: a.name }));
  }

  const icon = (m: Material) => {
    const c = m.color ?? '#4E7FE0';
    switch (m.kind) {
      case 'folder': return <Folder size={22} fill={c} color={c} aria-hidden />;
      case 'assignment': return <ClipboardList size={20} className="ember-text" aria-hidden />;
      case 'experience': return <BookOpen size={20} className="violet-text" aria-hidden />;
      case 'link': return <Link2 size={20} className="text-[#5AA2FF]" aria-hidden />;
      case 'file': return <Paperclip size={20} className="text-muted" aria-hidden />;
      case 'page': return <FileText size={20} className="text-muted" aria-hidden />;
      case 'quiz': return <ListChecks size={20} className="ember-text" aria-hidden />;
      default: return <AppWindow size={20} className="text-muted" aria-hidden />;
    }
  };
  const hrefFor = (m: Material) => m.kind === 'folder' ? `/classes/${classId}?tab=materials&folder=${m.id}` : m.kind === 'quiz' && m.quiz_id ? `/checks/${m.quiz_id}` : `/classes/${classId}/m/${m.id}`;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 flex-wrap items-center gap-1 text-sm">
          <Link href={`/classes/${classId}?tab=materials`} className={cn('display text-xl', trail.length ? 'text-muted hover:text-ink' : '')}>{tco('materials')}</Link>
          {trail.map((m) => (
            <span key={m.id} className="flex items-center gap-1"><ChevronRight size={14} className="text-faint" aria-hidden />
              <Link href={hrefFor(m)} className="display text-xl hover:text-ember">{m.title}</Link></span>
          ))}
        </nav>
      </div>
      {!folder && <TodayCard classId={classId} today={today} isTeacher={isTeacher}
        items={[
          ...all.filter((m) => m.lesson_date === today && m.kind !== 'folder' && (isTeacher || m.published))
            .map((m) => ({ id: m.id, title: m.title, tag: m.tag, href: hrefFor(m), due: m.due_at })),
          ...assignments.filter((a) => a.lesson_date === today && (isTeacher || a.status === 'published'))
            .map((a) => ({ id: a.id, title: a.title, tag: a.tag, href: `/assignments/${a.id}`, due: a.due_at })),
        ]} />}
      {isTeacher && <div className="mb-5"><AddMaterials classId={classId} folderId={folder?.id ?? null} userId={userId} experiences={library} apps={apps} /></div>}
      {items.length === 0 && loose.length === 0 ? <Empty>{folder ? tco('emptyFolder') : tco('emptyMaterials')}</Empty> : (
        <ul className="card divide-y divide-line">
          {items.map((m) => (
            <li key={m.id} className={cn('group flex items-start gap-3 px-4 py-3.5', !m.published && 'opacity-60')}>
              <span className="mt-0.5 shrink-0">{icon(m)}</span>
              <div className="min-w-0 flex-1">
                <Link href={hrefFor(m)} className="font-semibold hover:text-ember">{m.title}</Link>
                {!m.published && <span className="chip ml-2">{tco('hidden')}</span>}
                <Meta tag={m.tag} day={m.lesson_date} due={m.due_at} today={today} timer={m.timer_minutes} timerMode={m.timer_mode} />
                <div className="mt-0.5 text-xs text-muted">
                  {m.kind === 'folder' ? tco('itemCount', { count: counts.get(m.id) ?? 0 })
                    : m.kind === 'file' ? [m.file_name, humanSize(m.file_size)].filter(Boolean).join(' · ')
                    : m.kind === 'link' && m.url ? new URL(m.url).hostname.replace(/^www\./, '') : tco(`kind.${m.kind}`)}
                </div>
                {m.body && m.kind !== 'page' && <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm text-muted">{m.body}</p>}
              </div>
              {isTeacher && <MaterialMenu id={m.id} classId={classId} title={m.title} published={m.published} folders={folders}
                lessonDate={m.lesson_date} tag={m.tag} dueAt={m.due_at} canGenerate={['file', 'link', 'page', 'experience'].includes(m.kind)}
                timerMinutes={m.timer_minutes ?? null} timerMode={m.timer_mode ?? null} />}
            </li>
          ))}
          {loose.map((a) => (
            <li key={a.id} className="flex items-start gap-3 px-4 py-3.5">
              <span className="mt-0.5 shrink-0"><ClipboardList size={20} className="ember-text" aria-hidden /></span>
              <div className="min-w-0 flex-1">
                <Link href={`/assignments/${a.id}`} className="font-semibold hover:text-ember">{a.title}</Link>
                {a.status === 'draft' && <span className="chip ml-2 text-warn">{tco('draft')}</span>}
                <Meta tag={a.tag} day={a.lesson_date} due={a.due_at} today={today} timer={a.timer_minutes} timerMode={a.timer_mode} />
                <div className="mt-0.5 text-xs text-muted">{tco('kind.assignment')}{a.points != null ? ` · ${a.points} pts` : ''}</div>
              </div>
              {isTeacher && <MaterialMenu id={a.id} classId={classId} title={a.title} published folders={[]} type="assignment"
                lessonDate={a.lesson_date} tag={a.tag} dueAt={a.due_at} timerMinutes={a.timer_minutes ?? null} timerMode={a.timer_mode ?? null} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Tag · day · due, shown under an item's title. */
async function Meta({ tag, day, due, today, timer, timerMode }: { tag: Tag | null; day: string | null; due: string | null; today: string; timer?: number | null; timerMode?: string | null }) {
  if (!tag && !day && !due) return null;
  const tn = await getTranslations('nova');
  const tl = await getTranslations('live');
  const f = await getFormatter();
  const late = due && new Date(due) < new Date();
  return (
    <span className="ml-2 inline-flex flex-wrap items-center gap-1.5 align-middle">
      {tag && <TagChip tag={tag} label={tn(`tags.${tag}`)} />}
      {timer && (tag === 'do_now' || tag === 'exit_ticket') && <span className="chip text-2xs" title={timerMode === 'bell' ? tl('timerBell') : tl('timerManual')}>
        <TimerIcon size={11} aria-hidden />{tl('timerChip', { n: timer })}{timerMode === 'bell' ? ` · ${tl('bellTimer')}` : ''}</span>}
      {day && <span className={cn('chip text-2xs', day === today && 'border-ember/50 ember-text')}>
        <Sun size={11} aria-hidden />{day === today ? tn('today') : f.dateTime(new Date(`${day}T12:00:00`), { weekday: 'short', month: 'short', day: 'numeric' })}</span>}
      {due && <span className={cn('chip text-2xs', late && 'text-bad')}><CalendarClock size={11} aria-hidden />
        {tn('dueShort', { when: f.dateTime(new Date(due), { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) })}</span>}
    </span>
  );
}

/** "Today in class": what Nova tells students first. */
async function TodayCard({ items, today, isTeacher }:
  { classId: string; today: string; isTeacher: boolean; items: { id: string; title: string; tag: Tag | null; href: string; due: string | null }[] }) {
  const tn = await getTranslations('nova');
  const f = await getFormatter();
  const order: (Tag | null)[] = ['do_now', 'lecture', 'activity', 'homework', 'exit_ticket', 'resource', null];
  const sorted = [...items].sort((a, b) => order.indexOf(a.tag) - order.indexOf(b.tag));
  if (!sorted.length && !isTeacher) return null;
  return (
    <section className="card relative mb-5 overflow-hidden p-4" aria-labelledby="today-h">
      <div className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-ember/15 blur-3xl" aria-hidden />
      <div className="mb-3 flex items-baseline gap-2">
        <h2 id="today-h" className="flex items-center gap-2 font-semibold"><Sun size={16} className="ember-text" aria-hidden />{tn('todayInClass')}</h2>
        <span className="text-xs text-muted">{f.dateTime(new Date(`${today}T12:00:00`), { weekday: 'long', month: 'long', day: 'numeric' })}</span>
      </div>
      {sorted.length === 0 ? <p className="text-sm text-muted">{tn('teacherEmptyToday')}</p> : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {sorted.map((i) => (
            <li key={i.id}>
              <Link href={i.href} className="flex h-full flex-col gap-1.5 rounded-lg border border-line bg-sunk/50 px-3 py-2.5 transition hover:border-ember/50">
                <span>{i.tag ? <TagChip tag={i.tag} label={tn(`tags.${i.tag}`)} /> : <span className="text-2xs uppercase tracking-wide text-faint">{tn('alsoToday')}</span>}</span>
                <span className="font-medium leading-snug">{i.title}</span>
                {i.due && <span className="text-xs text-muted">{tn('dueShort', { when: f.dateTime(new Date(i.due), { weekday: 'short', hour: 'numeric', minute: '2-digit' }) })}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ============================================================================ Updates
async function UpdatesTab({ classId, isTeacher }: { classId: string; isTeacher: boolean }) {
  const supabase = await createClient();
  const tco = await getTranslations('course');
  const f = await getFormatter();
  const { data } = await supabase.from('class_updates').select('id,body,pinned,created_at,profiles(display_name)')
    .eq('class_id', classId).order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(50);
  type U = { id: string; body: string; pinned: boolean; created_at: string; profiles: { display_name: string } | null };
  const list = (data ?? []) as unknown as U[];
  return (
    <div className="space-y-4">
      <h2 className="display text-xl">{tco('updates')}</h2>
      {isTeacher && <UpdateForm classId={classId} />}
      {list.length === 0 ? <Empty>{tco('noUpdates')}</Empty> : list.map((u) => (
        <article key={u.id} className={cn('card p-4', u.pinned && 'border-ember/40')}>
          <div className="flex items-center gap-2 text-xs text-muted">
            {u.pinned && <Pin size={12} className="ember-text" aria-hidden />}
            <span className="font-semibold text-ink">{u.profiles?.display_name}</span>
            <span>· {f.relativeTime(new Date(u.created_at))}</span>
            <span className="ml-auto">{isTeacher && <DeleteUpdateButton id={u.id} classId={classId} />}</span>
          </div>
          <p className="mt-2 whitespace-pre-line text-[15px]">{u.body}</p>
        </article>
      ))}
    </div>
  );
}

// ============================================================================ Gradebook
async function GradebookTab({ classId, className, isTeacher, userId, assignments }:
  { classId: string; className: string; isTeacher: boolean; userId: string; assignments: A[] }) {
  const supabase = await createClient();
  const t = await getTranslations('classes');
  const ta = await getTranslations('assignment');
  const tc = await getTranslations('common');
  const f = await getFormatter();
  const aIds = assignments.map((a) => a.id);
  const { data: subs } = aIds.length ? await supabase.from('submissions').select('assignment_id,student_id,status,score,graded_at').in('assignment_id', aIds) : { data: [] };
  const sList = (subs ?? []) as S[];
  const graded = assignments.filter((a) => a.status === 'published');

  if (!isTeacher) {
    const mine = new Map(sList.filter((s) => s.student_id === userId).map((s) => [s.assignment_id, s]));
    return (
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="display text-xl">{(await getTranslations('course'))('grades')}</h2>
          <AbsenceChip classId={classId} totals={await attendanceTotalsFor(classId, userId)} />
        </div>
        {graded.length === 0 ? <Empty>{t('assignmentsEmpty')}</Empty> : (
          <div className="card overflow-x-auto"><table className="table">
            <thead><tr><th>{ta('title')}</th><th>{ta('due')}</th><th>{ta('status')}</th><th className="text-right">{ta('score')}</th></tr></thead>
            <tbody>{graded.map((a) => {
              const s = mine.get(a.id);
              const late = !s && a.due_at && new Date(a.due_at) < new Date();
              return (
                <tr key={a.id}>
                  <td><Link href={`/assignments/${a.id}`} className="font-medium hover:text-ember">{a.title}</Link></td>
                  <td className="whitespace-nowrap text-muted">{a.due_at ? f.dateTime(new Date(a.due_at), { month: 'short', day: 'numeric' }) : '—'}</td>
                  <td>{s ? <span className={s.status === 'returned' ? 'chip text-ok' : 'chip'}>{s.status === 'returned' ? ta('returned') : ta('submitted', { when: '' }).trim()}</span>
                    : <span className={late ? 'chip text-bad' : 'chip'}>{late ? ta('late') : ta('notSubmitted')}</span>}</td>
                  <td className="text-right font-mono text-xs">{s?.status === 'returned' && s.score !== null ? `${s.score}${a.points ? `/${a.points}` : ''}` : ''}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
        <ChecksTable classId={classId} isTeacher={false} userId={userId} />
      </div>
    );
  }

  const { data: roster } = await supabase.from('enrollments').select('user_id,role,profiles(display_name)').eq('class_id', classId).order('joined_at');
  type R = { user_id: string; role: string; profiles: { display_name: string } | null };
  const students = ((roster ?? []) as unknown as R[]).filter((r) => r.role === 'student');
  const grade = (sid: string, aid: string) => sList.find((s) => s.student_id === sid && s.assignment_id === aid);
  const rows = [
    [t('roster'), ...graded.map((a) => `${a.title}${a.points ? ` (${a.points})` : ''}`)],
    ...students.map((s) => [s.profiles?.display_name ?? '', ...graded.map((a) => { const g = grade(s.user_id, a.id); return g?.status === 'returned' ? g.score ?? '' : g ? 'submitted' : ''; })]),
  ];
  return (
    <div className="space-y-8">
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="display text-xl">{t('gradebook')}</h2>
          <div className="flex gap-2">
            <DownloadButton filename={`${className.replace(/[^\w-]+/g, '_')}_grades.csv`} mime="text/csv" data={csv(rows)}>{t('exportGrades')}</DownloadButton>
            <PrintButton label={tc('print')} />
          </div>
        </div>
        {students.length === 0 || graded.length === 0 ? <Empty>{t('gradebookEmpty')}</Empty> : (
          <div className="card overflow-x-auto"><table className="table">
            <thead><tr><th>{ta('student')}</th>{graded.map((a) => <th key={a.id} className="text-right"><Link href={`/assignments/${a.id}`} className="hover:text-ink">{a.title.slice(0, 22)}</Link></th>)}<th className="text-right">{t('average')}</th></tr></thead>
            <tbody>{students.map((s) => {
              const pct = graded.map((a) => { const g = grade(s.user_id, a.id); return g?.status === 'returned' && g.score !== null && a.points ? (Number(g.score) / a.points) * 100 : null; }).filter((x): x is number => x !== null);
              return (
                <tr key={s.user_id}>
                  <td className="whitespace-nowrap">{s.profiles?.display_name}</td>
                  {graded.map((a) => { const g = grade(s.user_id, a.id); return <td key={a.id} className="text-right font-mono text-xs">{g ? (g.status === 'returned' ? g.score ?? '✓' : <Link href={`/assignments/${a.id}`} className="ember-text">●</Link>) : <span className="text-faint">—</span>}</td>; })}
                  <td className="text-right font-mono text-xs">{pct.length ? `${Math.round(pct.reduce((x, y) => x + y, 0) / pct.length)}%` : '—'}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
      </div>
      <div>
        <h3 className="eyebrow mb-2">{t('assignments')}</h3>
        {assignments.length === 0 ? <Empty>{t('assignmentsEmpty')}</Empty> : (
          <div className="card overflow-x-auto"><table className="table">
            <thead><tr><th>{ta('title')}</th><th>{ta('due')}</th><th>{ta('submissions')}</th></tr></thead>
            <tbody>{assignments.map((a) => {
              const n = sList.filter((s) => s.assignment_id === a.id).length;
              const waiting = sList.filter((s) => s.assignment_id === a.id && s.status === 'submitted').length;
              return (
                <tr key={a.id}>
                  <td><Link href={`/assignments/${a.id}`} className="font-medium hover:text-ember">{a.title}</Link>{a.status === 'draft' && <span className="chip ml-2 text-warn">{ta('draft')}</span>}</td>
                  <td className="whitespace-nowrap text-muted">{a.due_at ? f.dateTime(new Date(a.due_at), { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}</td>
                  <td className="font-mono text-xs">{n}/{students.length}{waiting > 0 && <span className="ml-2 ember-text">● {waiting}</span>}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
      </div>
      <ChecksTable classId={classId} isTeacher userId={userId} studentCount={students.length} />
    </div>
  );
}

/** Do Nows, Exit Tickets and quizzes with response counts (teacher) or your scores (student). */
async function ChecksTable({ classId, isTeacher, userId, studentCount = 0 }: { classId: string; isTeacher: boolean; userId: string; studentCount?: number }) {
  const supabase = await createClient();
  const t = await getTranslations('checks');
  const f = await getFormatter();
  const { data: qs } = await supabase.from('quizzes').select('id,title,kind,status,lesson_date,created_at,results_mode,released').eq('class_id', classId).order('created_at', { ascending: false }).limit(200);
  const list = (qs ?? []) as { id: string; title: string; kind: string; status: string; lesson_date: string | null; created_at: string; results_mode: string; released: boolean }[];
  const ids = list.map((q) => q.id);
  const { data: at } = ids.length ? await supabase.from('quiz_attempts').select('quiz_id,student_id,score,max_score,status').in('quiz_id', ids) : { data: [] };
  const atts = (at ?? []) as { quiz_id: string; student_id: string; score: number | null; max_score: number | null; status: string }[];
  return (
    <div className="mt-8">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="eyebrow">{t('gradebookTitle')}</h3>
        {isTeacher && <Link href={`/classes/${classId}/checks/new`} className="btn btn-sm">{t('newCheck')}</Link>}
      </div>
      {list.length === 0 ? <Empty>{t('noChecks')}</Empty> : (
        <div className="card overflow-x-auto"><table className="table">
          <thead><tr><th>{t('chooseCheck')}</th><th>{t('lessonDay')}</th><th>{isTeacher ? t('responses') : t('colStatus')}</th><th className="text-right">{isTeacher ? t('average') : t('colScore')}</th></tr></thead>
          <tbody>{list.filter((q) => isTeacher || q.status !== 'draft').map((q) => {
            const mine = atts.filter((a) => a.quiz_id === q.id);
            const me = mine.find((a) => a.student_id === userId);
            const scored = mine.filter((a) => a.score != null && a.max_score);
            const avg = scored.length ? Math.round(scored.reduce((s, a) => s + Number(a.score) / Number(a.max_score), 0) / scored.length * 100) : null;
            const waiting = mine.filter((a) => a.status === 'submitted').length;
            return (
              <tr key={q.id}>
                <td><Link href={isTeacher ? `/checks/${q.id}?tab=results` : `/checks/${q.id}`} className="font-medium hover:text-ember">{q.title}</Link>
                  <span className="chip ml-2 text-2xs">{t(`kinds.${q.kind as 'do_now'}`)}</span>{q.status === 'draft' && <span className="chip ml-1 text-2xs text-warn">{t('status.draft').split(' ')[0]}</span>}</td>
                <td className="whitespace-nowrap text-muted">{q.lesson_date ? f.dateTime(new Date(`${q.lesson_date}T12:00:00`), { month: 'short', day: 'numeric' }) : '—'}</td>
                <td className="font-mono text-xs">{isTeacher
                  ? <>{mine.length}/{studentCount}{waiting > 0 && <span className="ml-2 ember-text">● {waiting}</span>}</>
                  : me ? t(`attemptStatus.${me.status as 'graded'}`) : t('notYet')}</td>
                <td className="text-right font-mono text-xs">{isTeacher ? (avg != null ? `${avg}%` : '—') : me?.score != null && (q.results_mode !== 'none' || q.released) ? `${me.score}/${me.max_score}` : '—'}</td>
              </tr>
            );
          })}</tbody>
        </table></div>
      )}
    </div>
  );
}

// ============================================================================ Members
async function MembersTab({ classId, isTeacher, teacherName, count }: { classId: string; isTeacher: boolean; teacherName: string; count: number }) {
  const t = await getTranslations('classes');
  const tco = await getTranslations('course');
  const tc = await getTranslations('common');
  const f = await getFormatter();
  if (!isTeacher) {
    return (
      <div className="space-y-4">
        <h2 className="display text-xl">{tco('members')}</h2>
        <div className="card p-4"><div className="eyebrow">{t('teacher')}</div><div className="mt-1 font-semibold">{teacherName}</div></div>
        <p className="text-sm text-muted">{t('students', { count })}. {tco('privacyNote')}</p>
      </div>
    );
  }
  const supabase = await createClient();
  const { data: roster } = await supabase.from('enrollments').select('user_id,joined_at,role,profiles(display_name)').eq('class_id', classId).order('joined_at');
  type R = { user_id: string; joined_at: string; role: string; profiles: { display_name: string } | null };
  const students = ((roster ?? []) as unknown as R[]).filter((r) => r.role === 'student');
  return (
    <div>
      <div className="mb-3 flex items-center justify-between"><h2 className="display text-xl">{tco('members')} <span className="font-mono text-sm text-muted">{students.length}</span></h2>
        <PrintButton label={t('printRoster')} /></div>
      {students.length === 0 ? <Empty>{t('rosterEmpty')}</Empty> : (
        <div className="card overflow-x-auto"><table className="table">
          <thead><tr><th>{tco('name')}</th><th>{t('joinedOn')}</th><th className="no-print"></th></tr></thead>
          <tbody>{students.map((s) => (
            <tr key={s.user_id}>
              <td>{s.profiles?.display_name || '—'}</td>
              <td className="text-muted">{f.dateTime(new Date(s.joined_at), { dateStyle: 'medium' })}</td>
              <td className="text-right no-print"><ActionButton action={removeFromClass.bind(null, classId, s.user_id)} confirmText={`${t('removeStudent')}: ${s.profiles?.display_name}?`} className="btn-ghost btn-sm text-bad">{tc('remove')}</ActionButton></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </div>
  );
}

// ============================================================================ Apps
async function AppsTab({ classId, isTeacher, pinned }:
  { classId: string; isTeacher: boolean; pinned: Awaited<ReturnType<typeof getClassApps>> }) {
  const tco = await getTranslations('course');
  const catalog = isTeacher ? (await getApps()).filter((a) => !pinned.some((p) => p.id === a.id)).map((a) => ({ id: a.id, name: a.name })) : [];
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between"><h2 className="display text-xl">{tco('apps')}</h2>
        <Link href="/apps" className="text-sm text-muted hover:text-ink">{tco('appCenter')} →</Link></div>
      {isTeacher && <PinAppForm classId={classId} apps={catalog} />}
      {pinned.length === 0 ? <Empty>{tco('noApps')}</Empty> : (
        <div className="grid gap-3 sm:grid-cols-2">
          {pinned.map((a) => (
            <div key={a.id} className="lit lit-edge card flex items-center gap-3 p-4" style={{ ['--glow' as string]: 'var(--nx-violet)' }}>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white" style={{ background: a.color }}>{appInitials(a.name)}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{a.name}</div>
                <div className="truncate text-xs text-muted">{new URL(a.url).hostname.replace(/^www\./, '')}</div>
              </div>
              <a href={a.url} target="_blank" rel="noopener noreferrer" className="btn btn-sm"><ExternalLink size={13} aria-hidden />{tco('open')}</a>
              {isTeacher && <UnpinButton classId={classId} appId={a.id} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

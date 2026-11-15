import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { ArrowLeft, ExternalLink, Play } from 'lucide-react';
import type { Locale } from '@/lib/brand';
import { createClient } from '@/lib/supabase/server';
import { EXPERIENCE_SELECT, getViewer, resolveExperience } from '@/lib/data';
import { deleteAssignment, publishAssignment, reopenSubmission } from '@/lib/actions';
import type { ExperienceRow, SubmissionFile } from '@/lib/types';
import { signSubmissionFiles } from '@/lib/actions';
import { humanSize } from '@/lib/files';
import { Paperclip } from 'lucide-react';
import { Page } from '@/components/Experience';
import { ActionButton } from '@/components/forms';
import { getClassAppearance } from '@/lib/appearance';
import { SceneLock } from '@/components/scene/SceneLock';
import { AddToPortfolio, GradeForm, SubmitForm } from './forms';

type Sub = { id: string; student_id: string; body: string | null; url: string | null; status: string; submitted_at: string; score: number | null; feedback: string | null; files: SubmissionFile[] | null };

export default async function AssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=/assignments/${id}`);
  const supabase = await createClient();
  const { data: a } = await supabase.from('assignments').select('*, classes(id,name,teacher_id)').eq('id', id).maybeSingle();
  if (!a) notFound();
  const t = await getTranslations('assignment');
  const tc = await getTranslations('common');
  const f = await getFormatter();
  const locale = (await getLocale()) as Locale;
  const cls = a.classes as { id: string; name: string; teacher_id: string };
  const isTeacher = cls.teacher_id === viewer.id;
  const exp = a.experience_id
    ? await supabase.from('experiences').select(EXPERIENCE_SELECT).eq('id', a.experience_id).maybeSingle<ExperienceRow>().then((r) => (r.data ? resolveExperience(r.data, locale) : null))
    : null;
  const { data: subs } = await supabase.from('submissions').select('*').eq('assignment_id', id);
  const sList = (subs ?? []) as Sub[];
  const signed = await signSubmissionFiles(sList.flatMap((s) => (s.files ?? []).map((f) => f.path)));
  const fileList = (s: Sub) => (s.files ?? []).length > 0 && (
    <ul className="mt-3 flex flex-wrap gap-2">
      {(s.files ?? []).map((fl) => signed[fl.path] && (
        <li key={fl.path}>
          <a href={`/files/view?src=${encodeURIComponent(signed[fl.path])}&name=${encodeURIComponent(fl.name)}&mime=${encodeURIComponent(fl.mime ?? '')}`}
            target="_blank" rel="noopener noreferrer" className="chip h-7 gap-1.5 px-2.5 text-xs text-ink hover:border-ember/50">
            <Paperclip size={12} aria-hidden />{fl.name}<span className="text-faint">{humanSize(fl.size)}</span>
          </a>
        </li>
      ))}
    </ul>
  );
  const due = a.due_at ? new Date(a.due_at) : null;

  const head = (
    <>
      <Link href={`/classes/${cls.id}`} className="mb-3 inline-flex items-center gap-1 text-xs text-muted hover:text-ink"><ArrowLeft size={12} aria-hidden />{cls.name}</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="h1">{a.title}</h1>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
            <span>{t('due')}: {due ? f.dateTime(due, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : t('noDue')}</span>
            {a.points !== null && <span>{t('points')}: {a.points}</span>}
            {a.status === 'draft' && <span className="chip text-warn">{t('draft')}</span>}
          </div>
        </div>
        {isTeacher && (
          <div className="flex gap-2">
            {a.status === 'draft' && <ActionButton action={publishAssignment.bind(null, id)} className="btn-primary btn-sm">{t('publish')}</ActionButton>}
            <ActionButton action={deleteAssignment.bind(null, id, cls.id)} confirmText={t('deleteConfirm')} className="btn btn-sm text-bad">{tc('delete')}</ActionButton>
          </div>
        )}
      </div>
      {a.instructions && <p className="mt-5 max-w-3xl whitespace-pre-line">{a.instructions}</p>}
      {exp && (
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-md border border-line p-4">
          <div className="min-w-0 flex-1"><div className="eyebrow">{t('experience')}</div><div className="truncate font-medium">{exp.t.title}</div></div>
          {exp.embed_url && <Link href={`/x/${exp.slug}/play`} className="btn-primary btn-sm"><Play size={13} aria-hidden />{t('openExperience')}</Link>}
          <Link href={`/x/${exp.slug}`} className="btn btn-sm"><ExternalLink size={13} aria-hidden /></Link>
        </div>
      )}
    </>
  );

  if (!isTeacher) {
    const look = await getClassAppearance(cls.id);
    const mine = sList.find((s) => s.student_id === viewer.id);
    const returned = mine?.status === 'returned';
    return (
      <Page>
        <SceneLock scene={look.lockScene} />
        {head}
        <section className="mt-8 max-w-3xl card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="h2">{t('yourWork')}</h2>
            {mine ? <span className={returned ? 'chip text-ok' : 'chip'}>{returned ? t('returned') : t('submitted', { when: f.relativeTime(new Date(mine.submitted_at)) })}</span>
              : <span className={due && due < new Date() ? 'chip text-bad' : 'chip'}>{due && due < new Date() ? t('late') : t('notSubmitted')}</span>}
          </div>
          {returned && (
            <div className="mb-5 rounded border border-ok/30 bg-ok/5 p-4">
              {mine!.score !== null && <div className="font-mono text-2xl">{mine!.score}{a.points ? <span className="text-base text-muted"> / {a.points}</span> : null}</div>}
              {mine!.feedback && <p className="mt-1 whitespace-pre-line text-sm"><span className="font-medium">{t('feedback')}: </span>{mine!.feedback}</p>}
            </div>
          )}
          {mine && fileList(mine)}
          <SubmitForm assignmentId={id} classId={cls.id} userId={viewer.id} type={a.submission_type} body={mine?.body ?? ''} url={mine?.url ?? ''} files={(mine?.files ?? []) as SubmissionFile[]} already={!!mine} locked={returned} />
          {returned && <div className="mt-5 border-t border-line pt-4"><AddToPortfolio title={a.title} submissionId={mine!.id} experienceId={a.experience_id} url={mine!.url} skills={exp?.skills ?? []} /></div>}
        </section>
      </Page>
    );
  }

  const { data: roster } = await supabase.from('enrollments').select('user_id,profiles(display_name)').eq('class_id', cls.id).eq('role', 'student');
  type R = { user_id: string; profiles: { display_name: string } | null };
  const students = (roster ?? []) as unknown as R[];
  const byStudent = new Map(sList.map((s) => [s.student_id, s]));
  return (
    <Page>
      {head}
      <section className="mt-8">
        <div className="mb-3 flex items-baseline justify-between"><h2 className="h2">{t('submissions')}</h2>
          <span className="text-sm text-muted">{t('submissionsCount', { done: sList.length, total: students.length })}</span></div>
        <ul className="space-y-3">
          {students.map((st) => {
            const s = byStudent.get(st.user_id);
            return (
              <li key={st.user_id} id={s ? `s-${s.id}` : undefined} className="card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{st.profiles?.display_name || '—'}</span>
                  {s ? <span className={s.status === 'returned' ? 'chip text-ok' : 'chip text-accent'}>{s.status === 'returned' ? t('returned') : t('submitted', { when: f.relativeTime(new Date(s.submitted_at)) })}
                    {due && new Date(s.submitted_at) > due ? ` · ${t('late')}` : ''}</span> : <span className="chip">{t('noSubmission')}</span>}
                </div>
                {s && (
                  <>
                    {s.body && <p className="mt-3 whitespace-pre-line rounded bg-sunk p-3 text-sm">{s.body}</p>}
                    {s.url && <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="mt-2 inline-block break-all text-sm text-accent hover:underline">{s.url}</a>}
                    {fileList(s)}
                    <GradeForm submissionId={s.id} assignmentId={id} score={s.score} feedback={s.feedback ?? ''} points={a.points} />
                    {s.status === 'returned' && <div className="mt-2"><ActionButton action={reopenSubmission.bind(null, s.id, id)} className="btn-ghost btn-sm">{t('reopen')}</ActionButton></div>}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </Page>
  );
}

'use client';

import { useActionState, useEffect, useState } from 'react';
import { Uploader, type Uploaded } from '@/components/files/Uploader';

function useCelebrate(ok: boolean | undefined, state: unknown) {
  useEffect(() => { if (ok) window.dispatchEvent(new Event('nexora:celebrate')); }, [ok, state]);
}
import { useTranslations } from 'next-intl';
import { addPortfolioItem, gradeSubmission, submitAssignment } from '@/lib/actions';
import { FormMessage, SubmitButton } from '@/components/forms';

export function SubmitForm({ assignmentId, classId, userId, type, body, url, files: initialFiles, already, locked }:
  { assignmentId: string; classId: string; userId: string; type: string; body: string; url: string; files: Uploaded[]; already: boolean; locked: boolean }) {
  const t = useTranslations('assignment');
  const [state, action] = useActionState(submitAssignment, null);
  const [files, setFiles] = useState<Uploaded[]>(initialFiles);
  useCelebrate(state?.ok, state);
  const wantsText = ['text', 'text_or_url', 'any'].includes(type);
  const wantsUrl = ['url', 'text_or_url', 'any'].includes(type);
  const wantsFiles = ['file', 'any', 'text_or_url'].includes(type);
  return (
    <form action={action} className={state?.ok ? 'ember-sweep space-y-3 rounded-md' : 'space-y-3'}>
      <input type="hidden" name="assignment_id" value={assignmentId} />
      <input type="hidden" name="files" value={JSON.stringify(files)} />
      {wantsFiles && !locked && (
        <div><span className="label">{t('files')}</span>
          <Uploader bucket="submission-files" folder={`${classId}/${assignmentId}/${userId}`} multiple initial={files} onChange={setFiles} /></div>
      )}
      {wantsText && (
        <div><label className="label" htmlFor="s-body">{t('response')}</label>
          <textarea id="s-body" name="body" defaultValue={body} disabled={locked} className="textarea min-h-[140px]" maxLength={20000} /></div>
      )}
      {wantsUrl && (
        <div><label className="label" htmlFor="s-url">{t('link')}</label>
          <input id="s-url" name="url" type="url" defaultValue={url} disabled={locked} placeholder="https://" className="input" /></div>
      )}
      {locked ? <p className="text-sm text-muted">{t('viewOnly')}</p> : (
        <div className="flex items-center gap-3">
          <SubmitButton>{type === 'none' ? t('markDone') : already ? t('resubmit') : t('submit')}</SubmitButton>
          <FormMessage state={state} />
        </div>
      )}
    </form>
  );
}

export function GradeForm({ submissionId, assignmentId, score, feedback, points }:
  { submissionId: string; assignmentId: string; score: number | null; feedback: string; points: number | null }) {
  const t = useTranslations('assignment');
  const [state, action] = useActionState(gradeSubmission, null);
  return (
    <form action={action} className="mt-3 grid gap-2 sm:grid-cols-[120px_1fr_auto] sm:items-end">
      <input type="hidden" name="submission_id" value={submissionId} />
      <input type="hidden" name="assignment_id" value={assignmentId} />
      <div><label className="label" htmlFor={`g-${submissionId}`}>{t('score')}{points ? ` / ${points}` : ''}</label>
        <input id={`g-${submissionId}`} name="score" type="number" step="0.5" min={0} defaultValue={score ?? ''} className="input" /></div>
      <div><label className="label" htmlFor={`f-${submissionId}`}>{t('feedback')}</label>
        <textarea id={`f-${submissionId}`} name="feedback" defaultValue={feedback} rows={1} className="textarea min-h-[36px]" maxLength={5000} /></div>
      <SubmitButton>{t('returnWork')}</SubmitButton>
      <div className="sm:col-span-3"><FormMessage state={state} /></div>
    </form>
  );
}

export function AddToPortfolio({ title, submissionId, experienceId, url, skills }:
  { title: string; submissionId: string; experienceId: string | null; url: string | null; skills: string[] }) {
  const t = useTranslations('assignment');
  const tp = useTranslations('portfolio');
  const [state, action] = useActionState(addPortfolioItem, null);
  useCelebrate(state?.ok, state);
  if (state?.ok) return <p role="status" className="text-sm text-ok">{state.message}</p>;
  return (
    <details>
      <summary className="btn cursor-pointer list-none">{t('addToPortfolio')}</summary>
      <form action={action} className="mt-3 space-y-3">
        <input type="hidden" name="title" value={title} />
        <input type="hidden" name="submission_id" value={submissionId} />
        <input type="hidden" name="experience_id" value={experienceId ?? ''} />
        <input type="hidden" name="url" value={url ?? ''} />
        <input type="hidden" name="skills" value={skills.join(', ')} />
        <input type="hidden" name="completed_on" value={new Date().toISOString().slice(0, 10)} />
        <div><label className="label" htmlFor="p-ref">{tp('reflection')}</label><textarea id="p-ref" name="reflection" className="textarea" /></div>
        <div><label className="label" htmlFor="p-vis">{tp('visibility')}</label>
          <select id="p-vis" name="visibility" className="input" defaultValue="teachers">
            {(['private', 'teachers', 'public'] as const).map((v) => <option key={v} value={v}>{tp(`vis.${v}`)}</option>)}
          </select></div>
        <SubmitButton>{tp('add')}</SubmitButton>
        <FormMessage state={state} />
      </form>
    </details>
  );
}

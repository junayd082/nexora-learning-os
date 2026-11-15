'use client';

import { ScheduleFields } from '@/components/ScheduleFields';
import { useActionState, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { createAssignment, createClass, joinByCode } from '@/lib/actions';
import { FormMessage, SubmitButton } from '@/components/forms';

export function CreateClassForm() {
  const t = useTranslations('classes');
  const [state, action] = useActionState(createClass, null);
  return (
    <form action={action} className="card grid gap-3 p-5 sm:grid-cols-2">
      <div className="sm:col-span-2"><label className="label" htmlFor="c-name">{t('name')}</label><input id="c-name" name="name" required maxLength={120} className="input" placeholder="Architecture & Construction" /></div>
      <div><label className="label" htmlFor="c-sec">{t('section')}</label><input id="c-sec" name="section" className="input" placeholder="Period 2" /></div>
      <div><label className="label" htmlFor="c-sub">{t('subject')}</label><input id="c-sub" name="subject" className="input" /></div>
      <div className="sm:col-span-2"><label className="label" htmlFor="c-desc">{t('description')}</label><textarea id="c-desc" name="description" className="textarea min-h-[64px]" /></div>
      <div className="flex items-center gap-3 sm:col-span-2"><SubmitButton>{t('create')}</SubmitButton><FormMessage state={state} /></div>
    </form>
  );
}

export function JoinForm({ initial = '' }: { initial?: string }) {
  const t = useTranslations('classes');
  const tj = useTranslations('join');
  const [state, action] = useActionState(joinByCode, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="sr-only" htmlFor="j-code">{t('joinCode')}</label>
      <div className="flex gap-2">
        <input id="j-code" name="code" defaultValue={initial} required placeholder={t('codePlaceholder')} autoComplete="off" autoCapitalize="characters"
          className="input h-12 flex-1 font-mono text-xl uppercase tracking-widest" />
        <SubmitButton className="btn-primary h-12 px-6" pendingText={tj('joining')}>{t('join')}</SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function NewAssignmentForm({ classId, experiences }: { classId: string; experiences: { id: string; title: string }[] }) {
  const t = useTranslations('assignment');
  const [state, action] = useActionState(createAssignment, null);
  const [tz, setTz] = useState('0');
  useEffect(() => setTz(String(new Date().getTimezoneOffset())), []);
  return (
    <form action={action} className="card grid gap-3 p-5 sm:grid-cols-2">
      <input type="hidden" name="class_id" value={classId} />
      <input type="hidden" name="tz_offset" value={tz} />
      <div className="sm:col-span-2"><label className="label" htmlFor="a-title">{t('title')}</label><input id="a-title" name="title" required maxLength={200} className="input" /></div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="a-exp">{t('experience')}</label>
        <select id="a-exp" name="experience_id" className="input">
          <option value="">{t('noExperience')}</option>
          {experiences.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
        </select>
      </div>
      <div className="sm:col-span-2"><label className="label" htmlFor="a-ins">{t('instructions')}</label><textarea id="a-ins" name="instructions" className="textarea" /></div>
      <div className="sm:col-span-2"><ScheduleFields showDue={false} idPrefix="a" defaultTag="activity" /></div>
      <div><label className="label" htmlFor="a-due">{t('due')}</label><input id="a-due" name="due_at" type="datetime-local" className="input" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label" htmlFor="a-pts">{t('points')}</label><input id="a-pts" name="points" type="number" min={0} max={10000} defaultValue={100} className="input" /></div>
        <div><label className="label" htmlFor="a-type">{t('submissionType')}</label>
          <select id="a-type" name="submission_type" className="input" defaultValue="any">
            {(['any', 'file', 'text_or_url', 'text', 'url', 'none'] as const).map((k) => <option key={k} value={k}>{t(`types.${k}`)}</option>)}
          </select>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
        <SubmitButton name="intent" value="publish">{t('publish')}</SubmitButton>
        <SubmitButton name="intent" value="draft" className="btn">{t('draft')}</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

'use client';

import { useActionState, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { createAssignment } from '@/lib/actions';
import { FormMessage, SubmitButton } from '@/components/forms';

export function AssignForm({ experienceId, slug, defaultTitle, classes }:
  { experienceId: string; slug: string; defaultTitle: string; classes: { id: string; name: string; section: string | null }[] }) {
  const t = useTranslations('experience');
  const ta = useTranslations('assignment');
  const [state, action] = useActionState(createAssignment, null);
  const [tz, setTz] = useState('0');
  useEffect(() => setTz(String(new Date().getTimezoneOffset())), []);
  return (
    <form action={action} className="mt-3 space-y-3">
      <input type="hidden" name="experience_id" value={experienceId} />
      <input type="hidden" name="return_to" value={`/x/${slug}`} />
      <input type="hidden" name="tz_offset" value={tz} />
      <div>
        <label className="label" htmlFor="as-class">{ta('class')}</label>
        <select id="as-class" name="class_id" className="input" required>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}{c.section ? ` — ${c.section}` : ''}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="as-title">{ta('title')}</label>
        <input id="as-title" name="title" defaultValue={defaultTitle} className="input" required maxLength={200} />
      </div>
      <div className="grid grid-cols-[1fr_80px] gap-2">
        <div>
          <label className="label" htmlFor="as-due">{t('dueDate')}</label>
          <input id="as-due" name="due_at" type="datetime-local" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="as-pts">{t('points')}</label>
          <input id="as-pts" name="points" type="number" min={0} max={10000} defaultValue={100} className="input" />
        </div>
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full">{t('assign')}</SubmitButton>
    </form>
  );
}

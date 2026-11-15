'use client';

import { useActionState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { addPortfolioItem, setPortfolioVisibility } from '@/lib/actions';
import { FormMessage, SubmitButton } from '@/components/forms';

export function AddItemForm() {
  const t = useTranslations('portfolio');
  const [state, action] = useActionState(addPortfolioItem, null);
  return (
    <form action={action} className="card grid gap-3 p-5 sm:grid-cols-2">
      <div className="sm:col-span-2"><label className="label" htmlFor="pi-t">{t('titleField')}</label><input id="pi-t" name="title" required maxLength={200} className="input" /></div>
      <div className="sm:col-span-2"><label className="label" htmlFor="pi-d">{t('description')}</label><textarea id="pi-d" name="description" className="textarea min-h-[64px]" /></div>
      <div><label className="label" htmlFor="pi-u">{t('url')}</label><input id="pi-u" name="url" type="url" placeholder="https://" className="input" /></div>
      <div><label className="label" htmlFor="pi-c">{t('completedOn')}</label><input id="pi-c" name="completed_on" type="date" className="input" /></div>
      <div><label className="label" htmlFor="pi-s">{t('skills')}</label><input id="pi-s" name="skills" className="input" placeholder="CAD Drafting, Problem Solving" /></div>
      <div><label className="label" htmlFor="pi-to">{t('tools')}</label><input id="pi-to" name="tools" className="input" placeholder="AutoCAD 2026" /></div>
      <div className="sm:col-span-2"><label className="label" htmlFor="pi-r">{t('reflection')}</label><textarea id="pi-r" name="reflection" className="textarea" /></div>
      <div><label className="label" htmlFor="pi-v">{t('visibility')}</label>
        <select id="pi-v" name="visibility" className="input" defaultValue="private">
          {(['private', 'teachers', 'public'] as const).map((v) => <option key={v} value={v}>{t(`vis.${v}`)}</option>)}
        </select></div>
      <div className="flex items-end gap-3"><SubmitButton>{t('add')}</SubmitButton><FormMessage state={state} /></div>
    </form>
  );
}

export function VisibilitySelect({ id, value }: { id: string; value: string }) {
  const t = useTranslations('portfolio');
  const [pending, start] = useTransition();
  return (
    <select aria-label={t('visibility')} defaultValue={value} disabled={pending} className="input h-7 w-auto py-0 text-xs"
      onChange={(e) => { const v = e.target.value; start(async () => { await setPortfolioVisibility(id, v); }); }}>
      {(['private', 'teachers', 'public'] as const).map((v) => <option key={v} value={v}>{t(`vis.${v}`)}</option>)}
    </select>
  );
}

'use client';

import { useActionState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Trash2 } from 'lucide-react';
import { createApp, deleteApp, pinApp } from '@/lib/actions';
import { FormMessage, SubmitButton } from '@/components/forms';

const CATS = ['other', 'games', 'lms', 'cad', 'google', 'productivity', 'create', 'media', 'engage', 'math', 'science', 'learn', 'cte', 'research'] as const;

export function NewAppForm() {
  const t = useTranslations('apps');
  const [state, action] = useActionState(createApp, null);
  return (
    <form action={action} className="card grid gap-3 p-5 sm:grid-cols-2">
      <div><label className="label" htmlFor="ap-name">{t('name')}</label><input id="ap-name" name="name" required maxLength={80} className="input" placeholder={t('namePlaceholder')} /></div>
      <div><label className="label" htmlFor="ap-url">{t('url')}</label><input id="ap-url" name="url" type="url" required className="input" placeholder="https://" /></div>
      <div><label className="label" htmlFor="ap-cat">{t('category')}</label>
        <select id="ap-cat" name="category" className="input" defaultValue="games">{CATS.map((c) => <option key={c} value={c}>{t(`cat.${c}`)}</option>)}</select></div>
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <div><label className="label" htmlFor="ap-mode">{t('launch')}</label>
          <select id="ap-mode" name="launch_mode" className="input" defaultValue="embed">
            <option value="embed">{t('modeEmbed')}</option><option value="newtab">{t('modeNewTab')}</option>
          </select></div>
        <div><label className="label" htmlFor="ap-color">{t('color')}</label><input id="ap-color" name="color" type="color" defaultValue="#E8634A" className="h-9 w-14 cursor-pointer rounded border border-line bg-transparent" /></div>
      </div>
      <div className="sm:col-span-2"><label className="label" htmlFor="ap-desc">{t('description')}</label><input id="ap-desc" name="description" maxLength={300} className="input" /></div>
      <label className="flex items-center gap-2 text-sm text-muted sm:col-span-2"><input type="checkbox" name="visibility" value="public" className="accent-[rgb(var(--nx-ember))]" />{t('sharePublic')}</label>
      <div className="flex items-center gap-3 sm:col-span-2"><SubmitButton>{t('add')}</SubmitButton><FormMessage state={state} /></div>
      <p className="text-xs text-faint sm:col-span-2">{t('embedNote')}</p>
    </form>
  );
}

export function PinToClass({ appId, classes }: { appId: string; classes: { id: string; name: string }[] }) {
  const t = useTranslations('apps');
  const [state, action] = useActionState(pinApp, null);
  if (!classes.length) return null;
  return (
    <form action={action} className="flex items-center gap-1">
      <input type="hidden" name="app_id" value={appId} />
      <label className="sr-only" htmlFor={`pin-${appId}`}>{t('pinTo')}</label>
      <select id={`pin-${appId}`} name="class_id" className="input h-7 w-32 py-0 text-xs" defaultValue={classes[0].id}>
        {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <SubmitButton className="btn btn-sm" pendingText="…">{state?.ok ? '✓' : t('pin')}</SubmitButton>
    </form>
  );
}

export function DeleteAppButton({ id }: { id: string }) {
  const t = useTranslations('apps');
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} className="btn-ghost btn-sm text-faint hover:text-bad" aria-label={t('delete')}
      onClick={() => { if (window.confirm(t('deleteConfirm'))) start(async () => { await deleteApp(id); }); }}>
      <Trash2 size={13} aria-hidden />
    </button>
  );
}

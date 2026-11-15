'use client';

import { useActionState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { setLiving, setTheme, updateProfile } from '@/lib/actions';
import { FormMessage, SubmitButton } from '@/components/forms';
import { cn } from '@/lib/util';

export function ProfileForm({ name, bio }: { name: string; bio: string }) {
  const t = useTranslations('profile');
  const tc = useTranslations('common');
  const [state, action] = useActionState(updateProfile, null);
  return (
    <form action={action} className="space-y-3">
      <div><label className="label" htmlFor="pf-n">{t('displayName')}</label><input id="pf-n" name="display_name" defaultValue={name} maxLength={80} className="input" /></div>
      <div><label className="label" htmlFor="pf-b">{t('bio')}</label><textarea id="pf-b" name="bio" defaultValue={bio} maxLength={600} className="textarea min-h-[72px]" />
        <p className="mt-1 text-2xs text-faint">{t('bioHint')}</p></div>
      <div className="flex items-center gap-3"><SubmitButton>{tc('save')}</SubmitButton><FormMessage state={state} /></div>
    </form>
  );
}

export function ThemeButtons({ current }: { current: string }) {
  const t = useTranslations('profile');
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="inline-flex rounded border border-line p-0.5" role="group" aria-label={t('theme')}>
      {([['dark', t('themeDark')], ['light', t('themeLight')]] as const).map(([k, label]) => (
        <button key={k} type="button" disabled={pending} aria-pressed={current === k}
          onClick={() => start(async () => { await setTheme(k); router.refresh(); })}
          className={cn('h-7 rounded-sm px-3 text-xs font-medium', current === k ? 'bg-ember/15 text-ink shadow-[inset_0_0_0_1px_rgb(var(--nx-ember)/0.35)]' : 'text-muted hover:text-ink')}>{label}</button>
      ))}
    </div>
  );
}

export function LivingControls({ motion, companion, name }: { motion: string; companion: boolean; name: string }) {
  const t = useTranslations('living');
  const router = useRouter();
  const [pending, start] = useTransition();
  const set = (o: { motion?: string; companion?: boolean }) => start(async () => { await setLiving(o); router.refresh(); });
  return (
    <div className="space-y-6">
      <div role="radiogroup" aria-label={t('title')} className="grid gap-2 sm:grid-cols-3">
        {(['full', 'reduced', 'static'] as const).map((m) => (
          <button key={m} type="button" role="radio" aria-checked={motion === m} disabled={pending} onClick={() => set({ motion: m })}
            className={cn('rounded-lg border p-3 text-left transition-colors',
              motion === m ? 'border-ember/50 bg-ember/10 shadow-[0_0_30px_-12px_rgb(var(--nx-ember)/0.7)]' : 'border-line hover:border-white/20')}>
            <div className="text-sm font-semibold">{t(m)}</div>
            <div className="mt-1 text-xs text-muted">{t(`${m}Hint`)}</div>
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between gap-4 rounded-lg border border-line p-3">
        <div>
          <div className="text-sm font-semibold">{t('companion')} · {name}</div>
          <div className="text-xs text-muted">{t('companionHint', { name })}</div>
        </div>
        <button type="button" role="switch" aria-checked={companion} disabled={pending} onClick={() => set({ companion: !companion })}
          className={cn('relative h-6 w-11 shrink-0 rounded-full border transition-colors', companion ? 'border-ember/60 bg-ember/70' : 'border-line bg-white/10')}>
          <span className={cn('absolute left-0 top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow transition-transform', companion ? 'translate-x-[22px]' : 'translate-x-0.5')} />
          <span className="sr-only">{companion ? t('on') : t('off')}</span>
        </button>
      </div>
      <p className="text-xs text-faint">{t('hint')}</p>
    </div>
  );
}

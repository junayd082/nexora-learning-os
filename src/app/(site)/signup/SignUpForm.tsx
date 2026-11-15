'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { MailCheck } from 'lucide-react';
import { signUpInBrowser } from '@/lib/auth-client';
import { FormMessage, QueueNotice, SubmitButton } from '@/components/forms';
import { useQueuedAction } from '@/lib/useQueuedAction';
import { cn } from '@/lib/util';

export function SignUpForm({ next, role: initialRole }: { next: string; role: 'student' | 'teacher' }) {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  // Signs up from the student's own browser so each student has their own sign-up allowance.
  const { state, action, wait } = useQueuedAction(async (_prev, fd) => signUpInBrowser(fd, t as never, tc as never));
  const [role, setRole] = useState(initialRole);
  if (state?.ok && state.data !== 'signed-in') {
    return (
      <div className="card p-5">
        <MailCheck className="text-ok" aria-hidden />
        <h2 className="mt-2 h2">{t('checkEmail')}</h2>
        <p className="mt-1 text-sm text-muted">{state.message}</p>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <fieldset>
        <legend className="label">{t('iAm')}</legend>
        <div className="grid grid-cols-2 gap-2">
          {(['student', 'teacher'] as const).map((r) => (
            <label key={r} className={cn('flex h-10 cursor-pointer items-center justify-center rounded border text-sm',
              role === r ? 'border-accent bg-accent/5 font-medium text-ink' : 'border-line text-muted')}>
              <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="sr-only" />
              {r === 'student' ? t('roleStudent') : t('roleTeacher')}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label className="label" htmlFor="display_name">{t('displayName')}</label>
        <input id="display_name" name="display_name" required maxLength={80} autoComplete="given-name" className="input h-10" />
        <p className="mt-1 text-2xs text-faint">{t('displayNameHint')}</p>
      </div>
      <div>
        <label className="label" htmlFor="email">{t('email')}</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="input h-10" />
      </div>
      <div>
        <label className="label" htmlFor="password">{t('password')}</label>
        <input id="password" name="password" type="password" minLength={8} autoComplete="new-password" required className="input h-10" />
        <p className="mt-1 text-2xs text-faint">{t('passwordShort')}</p>
      </div>
      <QueueNotice wait={wait} />
      {!wait && <FormMessage state={state} />}
      {state?.data === 'exists' && (
        <div className="-mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link href="/login" className="text-accent hover:underline">{t('signInInstead')}</Link>
          <Link href="/forgot-password" className="text-accent hover:underline">{t('forgot')}</Link>
        </div>
      )}
      <SubmitButton className="btn-primary h-10 w-full" pendingText="…">{t('signUp')}</SubmitButton>
    </form>
  );
}

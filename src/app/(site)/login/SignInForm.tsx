'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { FormMessage, QueueNotice, SubmitButton } from '@/components/forms';
import { useQueuedAction } from '@/lib/useQueuedAction';
import { signInInBrowser } from '@/lib/auth-client';

export function SignInForm({ next }: { next: string }) {
  const t = useTranslations('auth');
  // Signs in from the student's own browser so each student has their own sign-in allowance.
  const { state, action, wait } = useQueuedAction(async (_prev, fd) => signInInBrowser(fd, t as never));
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label className="label" htmlFor="email">{t('email')}</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="input h-10" />
      </div>
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <label className="label" htmlFor="password">{t('password')}</label>
          <Link href="/forgot-password" className="text-xs text-accent hover:underline">{t('forgot')}</Link>
        </div>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input h-10" />
      </div>
      <QueueNotice wait={wait} />
      {!wait && <FormMessage state={state} />}
      {state?.error === t('badCredentials') && <p className="-mt-2 text-sm"><Link href="/forgot-password" className="text-accent hover:underline">{t('badCredentialsHelp')}</Link></p>}
      <SubmitButton className="btn-primary h-10 w-full" pendingText="…">{t('signIn')}</SubmitButton>
    </form>
  );
}

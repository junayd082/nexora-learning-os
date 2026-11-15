'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { MailCheck } from 'lucide-react';
import { requestPasswordReset } from '@/lib/actions';
import { FormMessage, SubmitButton } from '@/components/forms';

export function ForgotForm({ email }: { email: string }) {
  const t = useTranslations('auth');
  const [state, action] = useActionState(requestPasswordReset, null);
  if (state?.ok) {
    return (
      <div role="status">
        <MailCheck className="text-ok" aria-hidden />
        <h2 className="mt-2 h2">{t('checkEmail')}</h2>
        <p className="mt-1 text-sm text-muted">{state.message}</p>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">{t('email')}</label>
        <input id="email" name="email" type="email" autoComplete="email" required defaultValue={email} className="input h-10" />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn-primary h-10 w-full" pendingText="…">{t('sendReset')}</SubmitButton>
    </form>
  );
}

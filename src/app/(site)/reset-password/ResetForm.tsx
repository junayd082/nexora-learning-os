'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { updatePassword } from '@/lib/actions';
import { FormMessage, SubmitButton } from '@/components/forms';

export function ResetForm() {
  const t = useTranslations('auth');
  const [state, action] = useActionState(updatePassword, null);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="password">{t('newPassword')}</label>
        <input id="password" name="password" type="password" minLength={8} autoComplete="new-password" required className="input h-10" />
        <p className="mt-1 text-2xs text-faint">{t('passwordShort')}</p>
      </div>
      <div>
        <label className="label" htmlFor="confirm">{t('confirmPassword')}</label>
        <input id="confirm" name="confirm" type="password" minLength={8} autoComplete="new-password" required className="input h-10" />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn-primary h-10 w-full" pendingText="…">{t('savePassword')}</SubmitButton>
    </form>
  );
}

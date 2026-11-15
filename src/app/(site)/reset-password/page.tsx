import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { AuthFrame } from '@/components/AuthFrame';
import { ResetForm } from './ResetForm';

export const metadata = { title: 'New password' };

/** Reached from the reset email: /auth/callback signs the person in, then sends them here. */
export default async function ResetPassword() {
  const t = await getTranslations('auth');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <AuthFrame title={t('resetTitle')}>
      {user
        ? <><p className="mb-4 text-sm text-muted">{user.email}</p><ResetForm /></>
        : <p role="alert" className="text-sm text-bad">{t('resetExpired')} <Link href="/forgot-password" className="text-accent hover:underline">{t('forgot')}</Link></p>}
    </AuthFrame>
  );
}

import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AuthFrame } from '@/components/AuthFrame';
import { ForgotForm } from './ForgotForm';

export const metadata = { title: 'Reset password' };

export default async function ForgotPassword({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const sp = await searchParams;
  const t = await getTranslations('auth');
  return (
    <AuthFrame title={t('forgotTitle')}>
      <p className="mb-4 text-sm text-muted">{t('forgotBody')}</p>
      <ForgotForm email={sp.email ?? ''} />
      <p className="mt-6 text-sm"><Link href="/login" className="text-accent hover:underline">{t('backToSignIn')}</Link></p>
    </AuthFrame>
  );
}

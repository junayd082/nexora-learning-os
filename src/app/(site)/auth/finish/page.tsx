import { getTranslations } from 'next-intl/server';
import { AuthFrame } from '@/components/AuthFrame';
import { Finish } from './Finish';

export const metadata = { title: 'Signing you in' };

/** Landing page for every email link (confirm account, reset password). Works in any browser. */
export default async function AuthFinish() {
  const t = await getTranslations('auth');
  return <AuthFrame title={t('finishTitle')}><Finish /></AuthFrame>;
}

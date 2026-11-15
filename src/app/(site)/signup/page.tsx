import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getViewer } from '@/lib/data';
import { AuthFrame } from '@/components/AuthFrame';
import { SignUpForm } from './SignUpForm';

export const metadata = { title: 'Create account' };

export default async function SignUp({ searchParams }: { searchParams: Promise<{ next?: string; role?: string }> }) {
  if (await getViewer()) redirect('/home');
  const sp = await searchParams;
  const t = await getTranslations('auth');
  return (
    <AuthFrame title={t('signUpTitle')}>
      <SignUpForm next={sp.next ?? ''} role={sp.role === 'teacher' ? 'teacher' : 'student'} />
      <p className="mt-6 text-sm text-muted">
        {t('haveAccount')} <Link href={`/login${sp.next ? `?next=${encodeURIComponent(sp.next)}` : ''}`} className="text-accent hover:underline">{t('signInInstead')}</Link>
      </p>
      <p className="mt-4 text-xs text-faint">{t('founderNote')}</p>
    </AuthFrame>
  );
}

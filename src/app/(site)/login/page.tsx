import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getFlags, getViewer } from '@/lib/data';
import { demoSignIn } from '@/lib/actions';
import { AuthFrame } from '@/components/AuthFrame';
import { SignInForm } from './SignInForm';

export const metadata = { title: 'Sign in' };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  if (await getViewer()) redirect(sp.next?.startsWith('/') ? sp.next : '/home');
  const t = await getTranslations('auth');
  const flags = await getFlags();
  return (
    <AuthFrame title={t('signInTitle')}>
      {sp.error === 'callback' && <p role="alert" className="mb-4 text-sm text-bad">{t('callbackError')}</p>}
      {sp.error === 'demo' && <p role="alert" className="mb-4 text-sm text-bad">{t('demoUnavailable')}</p>}
      <SignInForm next={sp.next ?? ''} />
      <p className="mt-6 text-sm text-muted">
        {t('noAccount')}{' '}
        <Link href={`/signup${sp.next ? `?next=${encodeURIComponent(sp.next)}` : ''}`} className="text-accent hover:underline">{t('createOne')}</Link>
      </p>
      {flags.demo_accounts && (
        <div className="mt-8 rounded-md border border-dashed border-line p-4">
          <div className="text-sm font-medium">{t('demoTitle')}</div>
          <p className="mt-1 text-xs text-muted">{t('demoBody')}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <form action={demoSignIn.bind(null, 'teacher')}><button className="btn btn-sm">{t('demoTeacher')}</button></form>
            <form action={demoSignIn.bind(null, 'student')}><button className="btn btn-sm">{t('demoStudent')}</button></form>
          </div>
        </div>
      )}
    </AuthFrame>
  );
}


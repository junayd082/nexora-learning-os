import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getViewer } from '@/lib/data';
import { JoinForm } from '../classes/forms';

export async function JoinPanel({ title, body, code = '' }: { title: string; body: string; code?: string }) {
  const viewer = await getViewer();
  const t = await getTranslations('join');
  const tn = await getTranslations('nav');
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="h1">{title}</h1>
      <p className="mt-1 text-muted">{body}</p>
      <div className="mt-6">
        {viewer ? <JoinForm initial={code} /> : (
          <div className="card p-5">
            {code && <div className="mb-3 font-mono text-3xl font-semibold tracking-wider">{code}</div>}
            <p className="text-sm text-muted">{t('signInFirst')}</p>
            <div className="mt-4 flex gap-2">
              <Link href={`/login?next=${encodeURIComponent(`/join/${code}`)}`} className="btn-primary">{tn('signIn')}</Link>
              <Link href={`/signup?next=${encodeURIComponent(`/join/${code}`)}`} className="btn">{(await getTranslations('auth'))('createOne')}</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

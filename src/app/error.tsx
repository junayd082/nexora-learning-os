'use client';

import { useTranslations } from 'next-intl';

export default function ErrorPage({ reset, error }: { reset: () => void; error: Error & { digest?: string } }) {
  const t = useTranslations('common');
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center gap-4 px-4">
      <h1 className="h1">{t('somethingWrong')}</h1>
      {error.digest && <p className="font-mono text-xs text-muted">ref {error.digest}</p>}
      <button onClick={reset} className="btn w-fit">{t('tryAgain')}</button>
    </div>
  );
}

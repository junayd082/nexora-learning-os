import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Logo } from '@/components/Logo';
import { AmbientField } from '@/components/AmbientField';
import { Fox } from '@/components/companion/Fox';

export default async function NotFound() {
  const t = await getTranslations('common');
  return (
    <div className="relative min-h-screen">
      <AmbientField />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-4">
        <Logo />
        <div className="mt-6 h-24 w-24"><Fox pose="stand" look={[-0.8, -0.5]} /></div>
        <div className="font-mono text-sm text-muted">404</div>
        <h1 className="display text-3xl">{t('notFound')}</h1>
        <p className="text-muted">{t('notFoundBody')}</p>
        <Link href="/" className="btn w-fit">{t('goHome')}</Link>
      </div>
    </div>
  );
}

import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { brand } from '@/lib/brand';
import { Page } from '@/components/Experience';

export const metadata = { title: 'The NEXORA Story' };

export default async function About() {
  const t = await getTranslations('about');
  const tp = await getTranslations('profile');
  return (
    <Page>
      <article className="mx-auto max-w-2xl">
        <div className="eyebrow pb-2">{t('eyebrow')}</div>
        <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
        <div className="mt-8 space-y-5 text-[17px] leading-relaxed">
          <p className="text-xl font-medium">{t('p1')}</p>
          <p>{t('p2')}</p>
          <p>{t('p3')}</p>
          <p>{t('p4')}</p>
          <p>{t('p5', { founder: brand.founder })}</p>
        </div>
        <div className="mt-10 border-l-2 border-accent pl-5">
          <div className="eyebrow">{t('missionLabel')}</div>
          <p className="mt-1 text-2xl font-semibold tracking-tight">{brand.tagline}</p>
          <p className="mt-1 text-sm text-muted">{brand.signature}</p>
        </div>
        <h2 className="mt-12 h2">{t('principlesTitle')}</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-5">
          {t('principles').split('|').map((p) => <li key={p} className="rounded border border-line px-3 py-2 text-sm">{p}</li>)}
        </ul>
        <section id="privacy" className="mt-12">
          <h2 className="h2">{t('privacyTitle')}</h2>
          <p className="mt-2 text-sm text-muted">{t('privacyBody')}</p>
        </section>
        <section id="accessibility" className="mt-8">
          <h2 className="h2">{t('a11yTitle')}</h2>
          <p className="mt-2 text-sm text-muted">{t('a11yBody')}</p>
        </section>
        <div className="mt-12 flex flex-wrap items-center gap-3 border-t border-line pt-6 text-sm">
          <Link href="/founder" className="btn">{t('founderLink')}</Link>
          <span className="text-muted">{brand.productName} {brand.version} — {tp('build')} {brand.build}</span>
        </div>
      </article>
    </Page>
  );
}

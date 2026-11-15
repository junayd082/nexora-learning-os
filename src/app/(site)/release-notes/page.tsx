import { getTranslations } from 'next-intl/server';
import { Page, PageHeader } from '@/components/Experience';
import { brand } from '@/lib/brand';

export const metadata = { title: 'Release notes' };

export default async function ReleaseNotes() {
  const t = await getTranslations('releases');
  return (
    <Page>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <article className="card mb-6 max-w-3xl p-6" style={{ boxShadow: 'var(--shadow-smoke), var(--shadow-violet)' }}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">{t('v153')}</h2>
          <span className="font-mono text-xs text-muted">1.5.3 · {t('v150date')}</span>
        </div>
        <h3 className="mt-4 eyebrow">{t('improved')}</h3>
        <ul className="mt-2 space-y-1.5 text-sm">
          {t('v153items').split('|').map((i) => <li key={i} className="flex gap-2"><span className="violet-text">+</span>{i}</li>)}
        </ul>
      </article>
      <article className="card mb-6 max-w-3xl p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">{t('v152')}</h2>
          <span className="font-mono text-xs text-muted">1.5.2 · {t('v150date')}</span>
        </div>
        <h3 className="mt-4 eyebrow">{t('improved')}</h3>
        <ul className="mt-2 space-y-1.5 text-sm">
          {t('v152items').split('|').map((i) => <li key={i} className="flex gap-2"><span className="violet-text">+</span>{i}</li>)}
        </ul>
      </article>
      <article className="card mb-6 max-w-3xl p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">{t('v151')}</h2>
          <span className="font-mono text-xs text-muted">1.5.1 · {t('v150date')}</span>
        </div>
        <h3 className="mt-4 eyebrow">{t('improved')}</h3>
        <ul className="mt-2 space-y-1.5 text-sm">
          {t('v151items').split('|').map((i) => <li key={i} className="flex gap-2"><span className="violet-text">+</span>{i}</li>)}
        </ul>
      </article>
      <article className="card mb-6 max-w-3xl p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">{t('v150')}</h2>
          <span className="font-mono text-xs text-muted">1.5.0 · {t('v150date')}</span>
        </div>
        <h3 className="mt-4 eyebrow">{t('added')}</h3>
        <ul className="mt-2 space-y-1.5 text-sm">
          {t('v150items').split('|').map((i) => <li key={i} className="flex gap-2"><span className="violet-text">+</span>{i}</li>)}
        </ul>
      </article>
      <article className="card mb-6 max-w-3xl p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">{t('v140')}</h2>
          <span className="font-mono text-xs text-muted">1.4.0 · {t('v140date')}</span>
        </div>
        <h3 className="mt-4 eyebrow">{t('added')}</h3>
        <ul className="mt-2 space-y-1.5 text-sm">
          {t('v140items').split('|').map((i) => <li key={i} className="flex gap-2"><span className="violet-text">+</span>{i}</li>)}
        </ul>
        <a href="/demo" className="btn btn-sm mt-5">▶ NEXORA Live</a>
      </article>
      <article className="card mb-6 max-w-3xl p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">{t('v130')}</h2>
          <span className="font-mono text-xs text-muted">1.3.0 · {t('v130date')}</span>
        </div>
        <h3 className="mt-4 eyebrow">{t('added')}</h3>
        <ul className="mt-2 space-y-1.5 text-sm">
          {t('v130items').split('|').map((i) => <li key={i} className="flex gap-2"><span className="violet-text">+</span>{i}</li>)}
        </ul>
      </article>
      <article className="card mb-6 max-w-3xl p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">{t('v120')}</h2>
          <span className="font-mono text-xs text-muted">1.2.0 · {t('v120date')}</span>
        </div>
        <h3 className="mt-4 eyebrow">{t('added')}</h3>
        <ul className="mt-2 space-y-1.5 text-sm">
          {t('v120items').split('|').map((i) => <li key={i} className="flex gap-2"><span className="violet-text">+</span>{i}</li>)}
        </ul>
        <a href="/keynote" className="btn btn-sm mt-5">▶ Keynote</a>
      </article>
      <article className="card mb-6 max-w-3xl p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">{t('v110')}</h2>
          <span className="font-mono text-xs text-muted">1.1.1 · {t('v110date')}</span>
        </div>
        <h3 className="mt-4 eyebrow">{t('added')}</h3>
        <ul className="mt-2 space-y-1.5 text-sm">
          {t('v110items').split('|').map((i) => <li key={i} className="flex gap-2"><span className="violet-text">+</span>{i}</li>)}
        </ul>
      </article>
      <article className="card mb-6 max-w-3xl p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">{t('v100')}</h2>
          <span className="font-mono text-xs text-muted">1.0.0 · {t('v100date')}</span>
        </div>
        <h3 className="mt-4 eyebrow">{t('added')}</h3>
        <ul className="mt-2 space-y-1.5 text-sm">
          {t('v100items').split('|').map((i) => <li key={i} className="flex gap-2"><span className="violet-text">+</span>{i}</li>)}
        </ul>
      </article>
      <article className="card mb-6 max-w-3xl p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">{t('v090')}</h2>
          <span className="font-mono text-xs text-muted">0.9.0 · {t('v090date')}</span>
        </div>
        <h3 className="mt-4 eyebrow">{t('added')}</h3>
        <ul className="mt-2 space-y-1.5 text-sm">
          {t('v090items').split('|').map((i) => <li key={i} className="flex gap-2"><span className="violet-text">+</span>{i}</li>)}
        </ul>
      </article>
      <article className="card mb-6 max-w-3xl p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">{t('v080')}</h2>
          <span className="font-mono text-xs text-muted">0.8.0 · {t('v080date')}</span>
        </div>
        <h3 className="mt-4 eyebrow">{t('added')}</h3>
        <ul className="mt-2 space-y-1.5 text-sm">
          {t('v080items').split('|').map((i) => <li key={i} className="flex gap-2"><span className="violet-text">+</span>{i}</li>)}
        </ul>
      </article>
      <article className="card mb-6 max-w-3xl p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">{t('v070')}</h2>
          <span className="font-mono text-xs text-muted">0.7.0 · {t('v070date')}</span>
        </div>
        <h3 className="mt-4 eyebrow">{t('added')}</h3>
        <ul className="mt-2 space-y-1.5 text-sm">
          {t('v070items').split('|').map((i) => <li key={i} className="flex gap-2"><span className="violet-text">+</span>{i}</li>)}
        </ul>
      </article>
      <article className="card mb-6 max-w-3xl p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">{t('v060')}</h2>
          <span className="font-mono text-xs text-muted">0.6.0 · {t('v060date')}</span>
        </div>
        <h3 className="mt-4 eyebrow">{t('added')}</h3>
        <ul className="mt-2 space-y-1.5 text-sm">
          {t('v060items').split('|').map((i) => <li key={i} className="flex gap-2"><span className="violet-text">+</span>{i}</li>)}
        </ul>
      </article>
      <article className="card mb-6 max-w-3xl p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">{t('v050')}</h2>
          <span className="font-mono text-xs text-muted">0.5.0 · {t('v050date')}</span>
        </div>
        <h3 className="mt-4 eyebrow">{t('added')}</h3>
        <ul className="mt-2 space-y-1.5 text-sm">
          {t('v050items').split('|').map((i) => <li key={i} className="flex gap-2"><span className="violet-text">+</span>{i}</li>)}
        </ul>
      </article>
      <article className="card mb-6 max-w-3xl p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">{t('v040')}</h2>
          <span className="font-mono text-xs text-muted">0.4.0 · {t('v040date')}</span>
        </div>
        <h3 className="mt-4 eyebrow">{t('added')}</h3>
        <ul className="mt-2 space-y-1.5 text-sm">
          {t('v040items').split('|').map((i) => <li key={i} className="flex gap-2"><span className="violet-text">+</span>{i}</li>)}
        </ul>
      </article>
      <article className="card mb-6 max-w-3xl p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">{t('v030')}</h2>
          <span className="font-mono text-xs text-muted">0.3.0 · {t('v030date')}</span>
        </div>
        <h3 className="mt-4 eyebrow">{t('added')}</h3>
        <ul className="mt-2 space-y-1.5 text-sm">
          {t('v030items').split('|').map((i) => <li key={i} className="flex gap-2"><span className="violet-text">+</span>{i}</li>)}
        </ul>
      </article>
      <article className="card mb-6 max-w-3xl p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">{t('v020')}</h2>
          <span className="font-mono text-xs text-muted">0.2.0 · {t('v020date')}</span>
        </div>
        <h3 className="mt-4 eyebrow">{t('added')}</h3>
        <ul className="mt-2 space-y-1.5 text-sm">
          {t('v020items').split('|').map((i) => <li key={i} className="flex gap-2"><span className="ember-text">+</span>{i}</li>)}
        </ul>
      </article>
      <article className="card max-w-3xl p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">{t('v010')}</h2>
          <span className="font-mono text-xs text-muted">0.1.0 · {t('v010date')}</span>
        </div>
        <h3 className="mt-4 eyebrow">{t('added')}</h3>
        <ul className="mt-2 space-y-1.5 text-sm">
          {t('v010items').split('|').map((i) => <li key={i} className="flex gap-2"><span className="text-ok">+</span>{i}</li>)}
        </ul>
        <h3 className="mt-6 eyebrow">{t('next')}</h3>
        <ul className="mt-2 space-y-1.5 text-sm text-muted">
          {t('nextItems').split('|').map((i) => <li key={i} className="flex gap-2"><span>·</span>{i}</li>)}
        </ul>
      </article>
    </Page>
  );
}

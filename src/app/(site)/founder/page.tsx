import { getLocale, getTranslations } from 'next-intl/server';
import { brand, type Locale } from '@/lib/brand';
import { listExperiences } from '@/lib/data';
import { ExperienceGrid, Page } from '@/components/Experience';

export const metadata = { title: brand.founder };

export default async function Founder() {
  const t = await getTranslations('founder');
  const locale = (await getLocale()) as Locale;
  const featured = (await listExperiences(locale, { limit: 50 }))
    .filter((e) => e.creator_name === brand.founder && e.type === 'lesson').reverse().slice(0, 3);
  return (
    <Page>
      <div className="grid gap-12 md:grid-cols-[260px_1fr]">
        <aside>
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-ink font-mono text-2xl text-bg" aria-hidden>MC</div>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">{brand.founder.toUpperCase()}</h1>
          <div className="mt-1 eyebrow">{t('eyebrow')}</div>
          <p className="mt-3 text-sm text-muted">{t('roles')}</p>
        </aside>
        <div className="space-y-10">
          {(['story', 'teaching', 'product'] as const).map((k) => (
            <section key={k}>
              <h2 className="h2">{t(`${k}Title`)}</h2>
              <p className="mt-2 max-w-2xl text-muted">{t(k)}</p>
            </section>
          ))}
          {featured.length > 0 && (
            <section>
              <h2 className="h2 pb-3">{t('featuredTitle')}</h2>
              <ExperienceGrid items={featured} />
            </section>
          )}
          <section>
            <h2 className="h2">{t('milestonesTitle')}</h2>
            <ol className="mt-3 border-l border-line">
              {(['milestone1', 'milestone2', 'milestone3'] as const).map((m, i) => (
                <li key={m} className="relative pb-4 pl-5 text-sm">
                  <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full border border-line bg-bg" style={i === 2 ? { background: 'rgb(var(--accent))', borderColor: 'rgb(var(--accent))' } : undefined} />
                  {t(m)}
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </Page>
  );
}

import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import type { Locale } from '@/lib/brand';
import { getWorlds, listExperiences, worldName } from '@/lib/data';
import { Page, PageHeader } from '@/components/Experience';
import { hexToRgb } from '@/components/Living';

export const metadata = { title: 'Worlds' };

export default async function Worlds() {
  const t = await getTranslations('worlds');
  const locale = (await getLocale()) as Locale;
  const [worlds, all] = await Promise.all([getWorlds(), listExperiences(locale)]);
  return (
    <Page>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <div className="grid gap-4 md:grid-cols-2">
        {worlds.map((w) => {
          const items = all.filter((e) => e.world_id === w.id);
          const skills = Array.from(new Set(items.flatMap((e) => e.skills))).slice(0, 5);
          return (
            <Link key={w.id} href={`/worlds/${w.slug}`} className="lit lit-edge group card relative flex min-h-[200px] overflow-hidden"
              style={{ ['--glow' as string]: hexToRgb(w.accent) }}>
              <div className="pointer-events-none absolute inset-0 opacity-70 transition-opacity duration-500 group-hover:opacity-100"
                style={{ background: `radial-gradient(90% 120% at 100% 100%, rgb(${hexToRgb(w.accent)} / 0.45), transparent 60%), radial-gradient(60% 80% at 0% 0%, rgb(var(--nx-violet) / 0.12), transparent 70%)` }} />
              <div className="relative flex flex-1 flex-col p-6">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="display text-2xl uppercase tracking-[0.02em]">{worldName(w, locale)}</h2>
                  <span className="font-mono text-2xs text-muted">{t('experiences', { count: items.length })}</span>
                </div>
                <p className="mt-1 text-sm text-muted">{locale === 'es' && w.description_es ? w.description_es : w.description}</p>
                <div className="mt-auto flex flex-wrap gap-1.5 pt-5">
                  {skills.length ? skills.map((s) => <span key={s} className="chip">{s}</span>) : <span className="text-xs text-faint">{t('comingSoon')}</span>}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </Page>
  );
}

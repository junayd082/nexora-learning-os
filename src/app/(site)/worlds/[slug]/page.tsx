import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import type { Locale } from '@/lib/brand';
import { getSequence, getWorlds, listExperiences, worldName } from '@/lib/data';
import { Empty, ExperienceGrid, Page, SequenceList } from '@/components/Experience';
import { WorldTint } from '@/components/AmbientField';
import { hexToRgb } from '@/components/Living';

export default async function WorldPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations('worlds');
  const td = await getTranslations('discover');
  const world = (await getWorlds()).find((w) => w.slug === slug);
  if (!world) notFound();
  const items = await listExperiences(locale, { worldId: world.id });
  const seq = await getSequence('autocad-for-beginners');
  const order = new Map(seq?.collection_items.map((i) => [i.experience_id, i.position]) ?? []);
  const path = items.filter((e) => order.has(e.id)).sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  const rest = items.filter((e) => !order.has(e.id));
  const skills = Array.from(new Set(items.flatMap((e) => e.skills)));

  return (
    <>
      <WorldTint rgb={hexToRgb(world.accent)} />
      <div className="glow-pool border-b border-line">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <span className="block h-1 w-12 rounded-full" style={{ background: world.accent }} />
          <h1 className="display mt-4 text-5xl uppercase">{worldName(world, locale)}</h1>
          <p className="mt-2 max-w-2xl text-muted">{locale === 'es' && world.description_es ? world.description_es : world.description}</p>
          {skills.length > 0 && (
            <div className="mt-5">
              <div className="eyebrow pb-1.5">{t('skillsInWorld')}</div>
              <div className="flex flex-wrap gap-1.5">{skills.map((s) => <span key={s} className="chip">{s}</span>)}</div>
            </div>
          )}
        </div>
      </div>
      <Page>
        {items.length === 0 && <Empty>{t('comingSoon')}</Empty>}
        {path.length > 0 && seq && (
          <section className="mb-10">
            <div className="eyebrow">{td('sequenceTitle')}</div>
            <h2 className="mb-3 text-lg font-semibold">{locale === 'es' && seq.title_es ? seq.title_es : seq.title}</h2>
            <SequenceList items={path} />
          </section>
        )}
        {rest.length > 0 && <ExperienceGrid items={rest} />}
      </Page>
    </>
  );
}

import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { Search } from 'lucide-react';
import type { Locale } from '@/lib/brand';
import { createClient } from '@/lib/supabase/server';
import { getSequence, getWorlds, listExperiences, worldName } from '@/lib/data';
import { Cover, Empty, ExperienceGrid, Page, PageHeader, SequenceList } from '@/components/Experience';
import { Play } from 'lucide-react';
import { cn } from '@/lib/util';

export const metadata = { title: 'Discover' };

export default async function Discover({ searchParams }: { searchParams: Promise<{ q?: string; type?: string; world?: string }> }) {
  const sp = await searchParams;
  const t = await getTranslations('discover');
  const te = await getTranslations('experience');
  const locale = (await getLocale()) as Locale;
  const q = (sp.q ?? '').trim().slice(0, 100);
  const worlds = await getWorlds();
  const world = worlds.find((w) => w.slug === sp.world);

  let items;
  if (q) {
    const supabase = await createClient();
    const { data } = await supabase.rpc('search_experiences', { q, max_results: 60 });
    const ids = ((data ?? []) as { experience_id: string }[]).map((r) => r.experience_id);
    const found = await listExperiences(locale, { ids });
    const rank = new Map(ids.map((id, i) => [id, i]));
    items = found.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
  } else {
    items = await listExperiences(locale, { worldId: world?.id });
  }
  const types = Array.from(new Set(items.map((e) => e.type)));
  if (sp.type) items = items.filter((e) => e.type === sp.type);

  const showPath = !q && !sp.type && (!world || world.slug === 'autocad');
  const seq = showPath ? await getSequence('autocad-for-beginners') : null;
  const order = new Map(seq?.collection_items.map((i) => [i.experience_id, i.position]) ?? []);
  const path = items.filter((e) => order.has(e.id)).sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  const rest = items.filter((e) => !order.has(e.id));

  const featured = !q && !sp.type && !sp.world
    ? [...items].filter((e) => e.type === 'lesson').sort((a, b) => b.launch_count - a.launch_count || (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99))[0]
    : undefined;

  const href = (p: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    const merged = { q: q || undefined, world: sp.world, type: sp.type, ...p };
    Object.entries(merged).forEach(([k, v]) => v && u.set(k, v));
    const s = u.toString();
    return `/discover${s ? `?${s}` : ''}`;
  };

  return (
    <Page>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <form action="/discover" className="relative mb-5 max-w-xl" role="search">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" aria-hidden />
        <input name="q" defaultValue={q} placeholder={t('searchPlaceholder')} aria-label={t('searchPlaceholder')} className="input h-10 pl-9" />
        {sp.world && <input type="hidden" name="world" value={sp.world} />}
      </form>

      <div className="mb-8 flex flex-wrap items-center gap-1.5" aria-label={t('byWorld')}>
        <Link href={href({ world: undefined })} className={cn('chip h-7 px-2.5 text-xs', !sp.world && 'border-ember/50 text-ink bg-ember/10')}>{t('all')}</Link>
        {worlds.map((w) => (
          <Link key={w.id} href={href({ world: w.slug })} className={cn('chip h-7 px-2.5 text-xs', sp.world === w.slug && 'border-ember/50 text-ink bg-ember/10')}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: w.accent }} />{worldName(w, locale)}
          </Link>
        ))}
        {types.length > 1 && <span className="mx-2 h-4 w-px bg-line" aria-hidden />}
        {types.length > 1 && types.map((ty) => (
          <Link key={ty} href={href({ type: sp.type === ty ? undefined : ty })} className={cn('chip h-7 px-2.5 text-xs', sp.type === ty && 'border-violet/50 text-ink bg-violet/10')}>
            {te(`types.${ty}` as 'types.lesson')}
          </Link>
        ))}
      </div>

      {featured && (
        <section className="mb-10">
          <div className="eyebrow mb-3">{t('featured')}</div>
          <Link href={`/x/${featured.slug}`} className="lit lit-edge card group grid overflow-hidden md:grid-cols-[1.1fr_1fr]" style={{ ['--glow' as string]: 'var(--nx-magenta)' }}>
            <Cover exp={featured} typeLabel={te(`types.${featured.type}` as 'types.lesson')} className="h-48 rounded-none border-b md:h-full md:min-h-[260px] md:border-b-0 md:border-r" />
            <div className="flex flex-col gap-3 p-6 md:p-8">
              {featured.worlds && <span className="chip w-fit"><span className="h-1.5 w-1.5 rounded-full" style={{ background: featured.worlds.accent }} />{worldName(featured.worlds, locale)}</span>}
              <h2 className="display text-2xl leading-tight md:text-3xl">{featured.t.title}</h2>
              {featured.t.short_description && <p className="text-muted">{featured.t.short_description}</p>}
              {featured.t.learning_objective && <p className="border-l-2 border-ember/60 pl-3 text-sm text-muted">{featured.t.learning_objective}</p>}
              <span className="btn-primary mt-auto w-fit"><Play size={15} aria-hidden />{t('open')}</span>
            </div>
          </Link>
        </section>
      )}

      {q && <p className="mb-4 text-sm text-muted">{t('results', { count: items.length })}</p>}

      {items.length === 0 ? (
        <Empty>{q ? t('emptySearch', { q }) : t('empty')}</Empty>
      ) : (
        <div className="space-y-10">
          {path.length > 0 && seq && (
            <section>
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <div>
                  <div className="eyebrow">{t('sequenceTitle')}</div>
                  <h2 className="text-lg font-semibold">{locale === 'es' && seq.title_es ? seq.title_es : seq.title}</h2>
                  <p className="text-sm text-muted">{locale === 'es' && seq.description_es ? seq.description_es : seq.description}</p>
                </div>
              </div>
              <SequenceList items={path} />
            </section>
          )}
          {(path.length === 0 ? items : rest).length > 0 && (
            <section>
              {path.length > 0 && <h2 className="mb-3 h2">{t('recentlyAdded')}</h2>}
              <ExperienceGrid items={path.length === 0 ? items : rest} />
            </section>
          )}
        </div>
      )}
    </Page>
  );
}

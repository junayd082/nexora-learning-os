import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { ArrowRight, QrCode } from 'lucide-react';
import { brand, type Locale } from '@/lib/brand';
import { getSequence, getViewer, getWorlds, listExperiences, worldName } from '@/lib/data';
import { SequenceList } from '@/components/Experience';

export default async function Landing() {
  if (await getViewer()) redirect('/home');
  const t = await getTranslations('landing');
  const tw = await getTranslations('worlds');
  const locale = (await getLocale()) as Locale;
  const [worlds, all, seq] = await Promise.all([getWorlds(), listExperiences(locale), getSequence('autocad-for-beginners')]);
  const order = new Map(seq?.collection_items.map((i) => [i.experience_id, i.position]) ?? []);
  const path = all.filter((e) => order.has(e.id)).sort((a, b) => order.get(a.id)! - order.get(b.id)!)
    .filter((e) => e.type === 'lesson').slice(0, 6);
  const counts = new Map<string, number>();
  all.forEach((e) => e.world_id && counts.set(e.world_id, (counts.get(e.world_id) ?? 0) + 1));
  const points = t('educatorsPoints').split('|');

  return (
    <>
      <section className="glow-pool border-b border-line grid-paper">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-[1.2fr_1fr] md:py-24">
          <div>
            <div className="eyebrow pb-5">{t('positioning')}</div>
            <h1 className="display max-w-xl text-4xl leading-[1.04] sm:text-[56px]">{t('heroTitle')}</h1>
            <p className="mt-5 max-w-lg text-[17px] text-muted">{t('heroBody')}</p>
            <div className="mt-8 flex flex-wrap gap-2">
              <Link href="/signup" className="btn-primary btn-lg">{t('startLearning')}</Link>
              <Link href="/signup?role=teacher" className="btn btn-lg">{t('imEducator')}</Link>
              <Link href="/discover" className="btn-ghost btn-lg">{t('explore')} <ArrowRight size={16} aria-hidden /></Link>
            </div>
            <p className="mt-10 font-mono text-xs tracking-[0.18em] text-muted">{brand.tagline.toUpperCase()}</p>
          </div>
          {/* Illustration of Presentation Mode — what the class sees on the board. */}
          <figure className="self-center">
            <div className="card overflow-hidden shadow-sm">
              <div className="flex items-center justify-between border-b border-line px-4 py-2">
                <span className="eyebrow">{t('stepTitle')}</span>
                <span className="font-mono text-2xs uppercase text-faint">{t('example')}</span>
              </div>
              <ol className="divide-y divide-line">
                {[t('step1'), t('step2'), t('step3'), t('step4')].map((s, i) => (
                  <li key={s} className="flex items-center gap-4 px-4 py-3.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line font-mono text-xs">{i + 1}</span>
                    <span className="text-sm">{s}</span>
                    {i === 1 && <span className="ml-auto flex shrink-0 items-center gap-1.5 whitespace-nowrap font-mono text-sm font-medium"><QrCode size={16} aria-hidden />NXR-4821</span>}
                  </li>
                ))}
              </ol>
            </div>
          </figure>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1fr_1.4fr]">
          <div>
            <div className="eyebrow pb-2">{t('nowIn')}</div>
            <h2 className="text-2xl font-semibold tracking-tight">AutoCAD</h2>
            <p className="mt-2 text-muted">{t('nowInBody')}</p>
            <Link href="/worlds/autocad" className="btn mt-5">{t('explore')} <ArrowRight size={14} aria-hidden /></Link>
          </div>
          {path.length > 0 && <SequenceList items={path} />}
        </div>
      </section>

      <section className="border-y border-line bg-white/[0.015]">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight">{t('worldsTitle')}</h2>
          <p className="mt-1 text-muted">{t('worldsBody')}</p>
          {worlds.length > 0 && <div className="mt-6 grid gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {worlds.map((w) => (
              <Link key={w.id} href={`/worlds/${w.slug}`} className="group flex flex-col gap-2 bg-panel p-5 hover:bg-white/[0.03]">
                <span className="h-1 w-8 rounded-full" style={{ background: w.accent }} />
                <span className="font-medium group-hover:text-accent">{worldName(w, locale)}</span>
                <span className="font-mono text-2xs text-muted">{tw('experiences', { count: counts.get(w.id) ?? 0 })}</span>
              </Link>
            ))}
          </div>}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-x-10 gap-y-10 px-4 py-14 sm:px-6 md:grid-cols-2">
        {([['buildTitle', 'buildBody'], ['skillsTitle', 'skillsBody'], ['classTitle', 'classBody'], ['portfolioTitle', 'portfolioBody']] as const).map(([h, b], i) => (
          <div key={h} className="flex gap-4">
            <span className="font-mono text-xs text-faint">0{i + 1}</span>
            <div>
              <h3 className="font-semibold">{t(h)}</h3>
              <p className="mt-1 text-muted">{t(b)}</p>
            </div>
          </div>
        ))}
      </section>

      <section id="educators" className="border-t border-line">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">{t('educatorsTitle')}</h2>
            <p className="mt-2 text-muted">{t('educatorsBody')}</p>
            <ul className="mt-5 space-y-2 text-sm">
              {points.map((p) => <li key={p} className="flex gap-2"><span className="text-accent">—</span>{p}</li>)}
            </ul>
            <Link href="/signup?role=teacher" className="btn-primary mt-6">{t('imEducator')}</Link>
          </div>
          <div id="schools">
            <h2 className="text-2xl font-semibold tracking-tight">{t('schoolsTitle')}</h2>
            <p className="mt-2 text-muted">{t('schoolsBody')}</p>
            <div className="mt-8 rounded-md border border-line p-5">
              <h3 className="font-semibold">{t('storyTitle')}</h3>
              <p className="mt-1 text-sm text-muted">{t('storyBody')}</p>
              <Link href="/about" className="mt-3 inline-flex items-center gap-1 text-sm text-accent hover:underline">{t('readStory')} <ArrowRight size={14} aria-hidden /></Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

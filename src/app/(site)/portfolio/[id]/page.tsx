import { notFound } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { Page } from '@/components/Experience';

export default async function PortfolioItem({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await createClient();
  const { data: i } = await supabase.from('portfolio_items').select('title,description,url,reflection,skills,tools,completed_on').eq('id', id).maybeSingle();
  if (!i) notFound();
  const t = await getTranslations('portfolio');
  const f = await getFormatter();
  return (
    <Page>
      <article className="mx-auto max-w-2xl card p-6">
        <div className="eyebrow">{t('title')}</div>
        <h1 className="mt-1 h1">{i.title}</h1>
        {i.completed_on && <div className="mt-1 font-mono text-xs text-muted">{f.dateTime(new Date(`${i.completed_on}T12:00:00`), { dateStyle: 'long' })}</div>}
        {i.description && <p className="mt-4">{i.description}</p>}
        {i.url && <a href={i.url} target="_blank" rel="noopener noreferrer nofollow" className="mt-3 inline-block break-all text-accent hover:underline">{i.url}</a>}
        {i.reflection && <blockquote className="mt-4 border-l-2 border-line pl-3 text-muted">{i.reflection}</blockquote>}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {(i.skills as string[]).map((s) => <span key={s} className="chip">{s}</span>)}
          {(i.tools as string[]).map((s) => <span key={s} className="chip border-dashed">{s}</span>)}
        </div>
      </article>
    </Page>
  );
}

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { ExternalLink, FileUser, Link2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/data';
import { deletePortfolioItem } from '@/lib/actions';
import { Empty, Page, PageHeader } from '@/components/Experience';
import { ActionButton, DownloadButton, PrintButton } from '@/components/forms';
import { AddItemForm, VisibilitySelect } from './forms';

export const metadata = { title: 'Portfolio' };

type Item = { id: string; title: string; description: string | null; url: string | null; reflection: string | null; skills: string[]; tools: string[];
  visibility: string; completed_on: string | null; created_at: string; submissions: { feedback: string | null; score: number | null } | null };

export default async function Portfolio({ searchParams }: { searchParams: Promise<{ add?: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect('/login?next=/portfolio');
  const sp = await searchParams;
  const t = await getTranslations('portfolio');
  const tc = await getTranslations('common');
  const f = await getFormatter();
  const supabase = await createClient();
  const { data } = await supabase.from('portfolio_items').select('*, submissions(feedback,score)').eq('user_id', viewer.id).order('completed_on', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });
  const items = (data ?? []) as unknown as Item[];
  const skills = Array.from(new Set(items.flatMap((i) => i.skills)));

  return (
    <Page>
      <PageHeader title={t('title')} subtitle={t('subtitle')} actions={<>
        <Link href="/portfolio/cv" className="btn-primary"><FileUser size={16} aria-hidden />{t('myCv')}</Link>
        <DownloadButton filename="nexora-portfolio.json" mime="application/json" data={JSON.stringify(items, null, 2)}>{t('exportJson')}</DownloadButton>
        <PrintButton label={t('printSummary')} />
      </>} />
      <div className="hidden print:block print:pb-4"><div className="text-lg font-semibold">{viewer.profile.display_name}</div></div>
      {skills.length > 0 && <div className="mb-6 flex flex-wrap gap-1.5">{skills.map((s) => <span key={s} className="chip">{s}</span>)}</div>}
      {items.length === 0 ? <Empty>{t('empty')}</Empty> : (
        <ol className="space-y-4">
          {items.map((i) => (
            <li key={i.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{i.title}</h2>
                  {i.completed_on && <div className="font-mono text-2xs text-muted">{f.dateTime(new Date(`${i.completed_on}T12:00:00`), { dateStyle: 'medium' })}</div>}
                </div>
                <div className="flex items-center gap-2 no-print">
                  <VisibilitySelect id={i.id} value={i.visibility} />
                  {i.visibility === 'public' && <Link href={`/portfolio/${i.id}`} className="btn-ghost btn-sm" aria-label="Public link"><Link2 size={14} aria-hidden /></Link>}
                  <ActionButton action={deletePortfolioItem.bind(null, i.id)} confirmText={`${tc('delete')}?`} className="btn-ghost btn-sm text-bad">{tc('delete')}</ActionButton>
                </div>
              </div>
              {i.description && <p className="mt-2 text-sm">{i.description}</p>}
              {i.url && <a href={i.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 break-all text-sm text-accent hover:underline">{i.url}<ExternalLink size={12} aria-hidden /></a>}
              {i.reflection && <blockquote className="mt-3 border-l-2 border-line pl-3 text-sm text-muted">{i.reflection}</blockquote>}
              {i.submissions?.feedback && <p className="mt-3 text-sm"><span className="eyebrow mr-2">{t('teacherFeedback')}</span>{i.submissions.feedback}</p>}
              {(i.skills.length > 0 || i.tools.length > 0) && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {i.skills.map((s) => <span key={s} className="chip">{s}</span>)}
                  {i.tools.map((s) => <span key={s} className="chip border-dashed">{s}</span>)}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
      <details className="mt-8 no-print" open={sp.add === '1'}>
        <summary className="btn-primary cursor-pointer list-none">{t('add')}</summary>
        <div className="mt-3 max-w-2xl"><AddItemForm /></div>
      </details>
    </Page>
  );
}

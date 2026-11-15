import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { Plus } from 'lucide-react';
import type { Locale } from '@/lib/brand';
import { getViewer, listExperiences } from '@/lib/data';
import { Empty, Page, PageHeader } from '@/components/Experience';

export const metadata = { title: 'Teach' };

export default async function Teach() {
  const viewer = await getViewer();
  if (!viewer) redirect('/login?next=/teach');
  if (!viewer.isEducator) redirect('/home');
  const t = await getTranslations('studio');
  const te = await getTranslations('experience');
  const f = await getFormatter();
  const tc = await getTranslations('common');
  const items = await listExperiences((await getLocale()) as Locale, { mine: viewer.id });
  return (
    <Page>
      <PageHeader title={t('title')} subtitle={t('subtitle')} actions={<Link href="/teach/new" className="btn-primary"><Plus size={15} aria-hidden />{t('new')}</Link>} />
      {items.length === 0 ? <Empty action={<Link href="/teach/new" className="btn btn-sm">{t('new')}</Link>}>{t('empty')}</Empty> : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>{t('titleEn').replace(/ \(.*\)/, '')}</th><th>{te('type')}</th><th>{te('details')}</th><th className="text-right">{te('launches')}</th><th className="text-right">v</th><th></th></tr></thead>
            <tbody>
              {items.map((e) => (
                <tr key={e.id}>
                  <td><Link href={`/x/${e.slug}`} className="font-medium hover:text-accent">{e.t.title}</Link>
                    <div className="text-2xs text-muted">{e.available.map((l) => l.toUpperCase()).join(' · ')} · {f.relativeTime(new Date(e.updated_at))}</div></td>
                  <td className="whitespace-nowrap text-muted">{te(`types.${e.type}` as 'types.lesson')}</td>
                  <td className="whitespace-nowrap"><span className={e.status === 'published' ? 'chip text-ok' : 'chip'}>{te(`status.${e.status}`)}</span> <span className="chip">{te(`visibility.${e.visibility}`)}</span></td>
                  <td className="text-right font-mono text-xs">{e.launch_count}</td>
                  <td className="text-right font-mono text-xs">{e.version}</td>
                  <td className="text-right"><Link href={`/teach/${e.slug}`} className="btn btn-sm">{tc('edit')}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Page>
  );
}

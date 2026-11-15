import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import type { Locale } from '@/lib/brand';
import { getFavoriteIds, getViewer, listExperiences } from '@/lib/data';
import { Empty, ExperienceGrid, Page, PageHeader } from '@/components/Experience';

export const metadata = { title: 'Library' };

export default async function Library() {
  const viewer = await getViewer();
  if (!viewer) redirect('/login?next=/library');
  const t = await getTranslations('library');
  const ids = Array.from(await getFavoriteIds(viewer.id));
  const items = await listExperiences((await getLocale()) as Locale, { ids });
  return (
    <Page>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      {items.length === 0 ? <Empty>{t('empty')}</Empty> : <ExperienceGrid items={items} />}
    </Page>
  );
}

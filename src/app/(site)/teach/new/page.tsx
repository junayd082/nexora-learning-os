import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import type { Locale } from '@/lib/brand';
import { getApps, getViewer, getWorlds, worldName } from '@/lib/data';
import { Page, PageHeader } from '@/components/Experience';
import { ExperienceForm } from '../ExperienceForm';

export const metadata = { title: 'New experience' };

export default async function NewExperience() {
  const viewer = await getViewer();
  if (!viewer) redirect('/login?next=/teach/new');
  if (!viewer.isEducator) redirect('/home');
  const t = await getTranslations('studio');
  const locale = (await getLocale()) as Locale;
  const worlds = (await getWorlds()).map((w) => ({ id: w.id, name: worldName(w, locale) }));
  const apps = (await getApps()).map((a) => ({ id: a.id, name: a.name, category: a.category }));
  const blank = { title: '', short: '', objective: '', instructions: '' };
  return (
    <Page>
      <PageHeader title={t('newTitle')} subtitle={t('subtitle')} />
      <div className="max-w-4xl">
        <ExperienceForm worlds={worlds} userId={viewer.id} apps={apps} values={{ type: 'website', visibility: 'private', status: 'draft', difficulty: '', subject: '', grade_range: '9–12',
          duration_minutes: '', resource_url: '', worksheet_url: '', world_id: '', tags: '', skills: '', notes: '', en: blank, es: blank,
          source: 'file', file: null, app_id: null }} />
      </div>
    </Page>
  );
}

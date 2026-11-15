import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import type { Locale } from '@/lib/brand';
import { createClient } from '@/lib/supabase/server';
import { EXPERIENCE_SELECT, getApps, getViewer, getWorlds, worldName } from '@/lib/data';
import { deleteExperience, snapshotExperience } from '@/lib/actions';
import type { ExperienceRow } from '@/lib/types';
import { Page, PageHeader } from '@/components/Experience';
import { ActionButton } from '@/components/forms';
import { ExperienceForm } from '../ExperienceForm';

export default async function EditExperience({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ remixed?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=/teach/${slug}`);
  const supabase = await createClient();
  const { data: row } = await supabase.from('experiences').select(EXPERIENCE_SELECT).eq('slug', slug).maybeSingle<ExperienceRow>();
  if (!row || (row.creator_id !== viewer.id && !viewer.profile.is_platform_admin)) notFound();
  const [{ data: notes }, { data: versions }] = await Promise.all([
    supabase.from('experience_teacher_notes').select('notes').eq('experience_id', row.id).eq('locale', 'en').maybeSingle(),
    supabase.from('experience_versions').select('id,version,created_at,note').eq('experience_id', row.id).order('created_at', { ascending: false }).limit(20),
  ]);
  const t = await getTranslations('studio');
  const te = await getTranslations('experience');
  const tc = await getTranslations('common');
  const f = await getFormatter();
  const locale = (await getLocale()) as Locale;
  const worlds = (await getWorlds()).map((w) => ({ id: w.id, name: worldName(w, locale) }));
  const apps = (await getApps()).map((a) => ({ id: a.id, name: a.name, category: a.category }));
  const tr = (l: string) => {
    const x = row.experience_translations.find((r) => r.locale === l);
    return { title: x?.title ?? '', short: x?.short_description ?? '', objective: x?.learning_objective ?? '', instructions: x?.student_instructions ?? '' };
  };
  return (
    <Page>
      {sp.remixed && <p role="status" className="mb-4 rounded border border-ok/30 bg-ok/5 px-3 py-2 text-sm text-ok">{te('remixed')}</p>}
      <PageHeader eyebrow={`v${row.version}`} title={t('editTitle')} actions={<>
        <Link href={`/x/${row.slug}`} className="btn btn-sm">{tc('open')}</Link>
        <ActionButton action={snapshotExperience.bind(null, row.id, row.slug)}>{t('snapshot')}</ActionButton>
        <ActionButton action={deleteExperience.bind(null, row.id)} confirmText={t('deleteConfirm')} className="btn btn-sm text-bad">{tc('delete')}</ActionButton>
      </>} />
      <div className="grid gap-8 xl:grid-cols-[1fr_260px]">
        <ExperienceForm worlds={worlds} userId={viewer.id} apps={apps} values={{
          id: row.id, slug: row.slug, type: row.type, visibility: row.visibility, status: row.status, difficulty: row.difficulty ?? '',
          subject: row.subject ?? '', grade_range: row.grade_range ?? '', duration_minutes: row.duration_minutes ? String(row.duration_minutes) : '',
          resource_url: row.resource_url ?? '', worksheet_url: row.worksheet_url ?? '', world_id: row.world_id ?? '',
          tags: row.tags.join(', '), skills: row.skills.join(', '), notes: notes?.notes ?? '', en: tr('en'), es: tr('es'),
          source: row.source ?? 'link', app_id: row.app_id ?? null,
          file: row.file_path ? { path: row.file_path, name: row.file_name ?? 'file', mime: row.file_mime ?? '', size: row.file_size ?? 0 } : null,
        }} />
        <aside>
          <h2 className="mb-2 h2">{t('history')}</h2>
          {(versions ?? []).length === 0 ? <p className="text-sm text-muted">{t('noHistory')}</p> : (
            <ol className="card divide-y divide-line text-sm">
              {(versions ?? []).map((v) => (
                <li key={v.id} className="flex justify-between px-3 py-2"><span className="font-mono">v{v.version}</span><span className="text-xs text-muted">{f.dateTime(new Date(v.created_at), { dateStyle: 'medium', timeStyle: 'short' })}</span></li>
              ))}
            </ol>
          )}
        </aside>
      </div>
    </Page>
  );
}

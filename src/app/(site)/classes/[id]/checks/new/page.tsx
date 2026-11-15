import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';
import type { Locale } from '@/lib/brand';
import { createClient } from '@/lib/supabase/server';
import { getViewer, listExperiences } from '@/lib/data';
import { aiEnabled } from '@/lib/engine/ai';
import { Page } from '@/components/Experience';
import { GenerateForm } from './GenerateForm';

// Reading a lesson and writing questions can take a while.
export const maxDuration = 120;

export default async function NewCheckPage({ params, searchParams }:
  { params: Promise<{ id: string }>; searchParams: Promise<{ kind?: string; source?: string; focus?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=/classes/${id}/checks/new`);
  const supabase = await createClient();
  const { data: cls } = await supabase.from('classes').select('id,name,teacher_id').eq('id', id).maybeSingle();
  if (!cls || cls.teacher_id !== viewer.id) notFound();
  const t = await getTranslations('checks');
  const locale = (await getLocale()) as Locale;
  const [{ data: mats }, lib] = await Promise.all([
    supabase.from('class_materials').select('id,kind,title,file_name,lesson_date').eq('class_id', id).in('kind', ['file', 'link', 'page', 'experience']).order('created_at', { ascending: false }),
    listExperiences(locale),
  ]);
  const materials = (mats ?? []).map((m) => ({ id: m.id as string, label: `${m.title}${m.file_name && m.file_name !== m.title ? ` (${m.file_name})` : ''}`, kind: m.kind as string }));
  const experiences = lib.map((e) => ({ id: e.id, label: e.t.title }));
  const kind = ['do_now', 'exit_ticket', 'quiz'].includes(sp.kind ?? '') ? sp.kind! : 'do_now';

  return (
    <Page>
      <Link href={`/classes/${id}?tab=materials`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft size={14} aria-hidden />{cls.name}</Link>
      <h1 className="display text-3xl">{t('newTitle')}</h1>
      <p className="mt-2 max-w-2xl text-muted">{t('newSub')}</p>
      <GenerateForm classId={id} userId={viewer.id} kind={kind} materials={materials} experiences={experiences}
        source={sp.source && materials.some((m) => m.id === sp.source) ? sp.source : null} ai={aiEnabled()} demo={!!viewer.profile.is_demo} focus={(sp.focus ?? '').slice(0, 300)} />
    </Page>
  );
}

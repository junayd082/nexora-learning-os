import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';
import type { Locale } from '@/lib/brand';
import { createClient } from '@/lib/supabase/server';
import { getViewer, listExperiences } from '@/lib/data';
import { aiEnabled } from '@/lib/engine/ai';
import { Page } from '@/components/Experience';
import { SummaryStudio } from '@/components/summary/SummaryStudio';

// Reading a lecture / PDF and writing the summary can take a while.
export const maxDuration = 120;

export default async function NewSummaryPage({ params, searchParams }:
  { params: Promise<{ id: string }>; searchParams: Promise<{ source?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=/classes/${id}/summary/new`);
  const supabase = await createClient();
  const { data: cls } = await supabase.from('classes').select('id,name,teacher_id').eq('id', id).maybeSingle();
  if (!cls || cls.teacher_id !== viewer.id) notFound();
  const t = await getTranslations('summary');
  const locale = (await getLocale()) as Locale;
  const [{ data: mats }, lib] = await Promise.all([
    supabase.from('class_materials').select('id,kind,title,file_name,lesson_date,tag').eq('class_id', id).in('kind', ['file', 'link', 'page', 'experience'])
      .order('lesson_date', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }),
    listExperiences(locale),
  ]);
  const materials = (mats ?? []).map((m) => ({
    id: m.id as string, kind: m.kind as string, lessonDate: (m.lesson_date as string | null) ?? null, tag: (m.tag as string | null) ?? null,
    label: `${m.title}${m.file_name && m.file_name !== m.title ? ` (${m.file_name})` : ''}${m.lesson_date ? ` · ${m.lesson_date}` : ''}`,
  }));
  const experiences = lib.map((e) => ({ id: e.id, label: e.t.title }));

  return (
    <Page>
      <Link href={`/classes/${id}?tab=materials`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft size={14} aria-hidden />{cls.name}</Link>
      <h1 className="display text-3xl">{t('title')}</h1>
      <p className="mt-2 max-w-2xl text-muted">{t('sub')}</p>
      <SummaryStudio classId={id} userId={viewer.id} className={cls.name as string} materials={materials} experiences={experiences}
        source={sp.source && materials.some((m) => m.id === sp.source) ? sp.source : null} ai={aiEnabled()} demo={!!viewer.profile.is_demo} />
    </Page>
  );
}

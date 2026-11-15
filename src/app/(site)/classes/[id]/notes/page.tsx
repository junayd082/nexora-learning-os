import { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/data';
import { periodOf } from '@/lib/bell';
import { Page } from '@/components/Experience';
import { CornellNotebook } from '@/components/cornell/CornellNotebook';

export async function generateMetadata() {
  return { title: (await getTranslations('cornell'))('title') };
}

/** Today in the school's time zone, for picking today's lesson as the default topic. */
function today(tz: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export default async function NotesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=/classes/${id}/notes`);
  const supabase = await createClient();
  // RLS only returns classes the viewer teaches or is enrolled in.
  const { data: cls } = await supabase.from('classes').select('id,name,section,timezone').eq('id', id).maybeSingle();
  if (!cls) notFound();
  const tz = (cls.timezone as string | null) ?? 'America/Chicago';
  const { data: lesson } = await supabase.from('class_materials').select('title,tag').eq('class_id', id).eq('lesson_date', today(tz))
    .neq('kind', 'folder').order('position').limit(10);
  const lessonTitle = (lesson ?? []).find((m) => m.tag === 'lecture')?.title ?? (lesson ?? []).find((m) => m.tag !== 'do_now' && m.tag !== 'exit_ticket')?.title ?? '';
  const p = periodOf(cls.section as string | null);
  const t = await getTranslations('cornell');
  return (
    <Page wide>
      <Suspense>
        <CornellNotebook classId={id} userId={viewer.id} className={cls.name as string} period={p ? String(p) : ((cls.section as string | null) ?? '')}
          name={viewer.profile.display_name || ''} lessonTitle={lessonTitle} locale={(await getLocale()) === 'es' ? 'es-MX' : 'en-US'} />
      </Suspense>
      <span className="sr-only">{t('title')}</span>
    </Page>
  );
}

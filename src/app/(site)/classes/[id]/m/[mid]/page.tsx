import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/data';
import { publicFileUrl } from '@/lib/files';
import type { Material } from '@/lib/types';
import { Page } from '@/components/Experience';
import { FileViewer } from '@/components/files/FileViewer';
import { LinkFrame } from '@/components/files/LinkFrame';
import { Markdown } from '@/components/files/markdown';

/** One course material, shown inside NEXORA (file viewer, embedded link, page, or app launcher). */
export default async function MaterialPage({ params }: { params: Promise<{ id: string; mid: string }> }) {
  const { id, mid } = await params;
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=/classes/${id}/m/${mid}`);
  const supabase = await createClient();
  const { data } = await supabase.from('class_materials').select('*, experiences(slug), apps(name,url,launch_mode,color)').eq('id', mid).eq('class_id', id).maybeSingle();
  if (!data) notFound();
  const m = data as Material & { experiences: { slug: string } | null; apps: { name: string; url: string; launch_mode: string; color: string } | null };
  if (m.kind === 'folder') redirect(`/classes/${id}?tab=materials&folder=${m.id}`);
  if (m.kind === 'experience' && m.experiences) redirect(`/x/${m.experiences.slug}`);
  if (m.kind === 'assignment' && m.assignment_id) redirect(`/assignments/${m.assignment_id}`);
  if (m.kind === 'quiz' && m.quiz_id) redirect(`/checks/${m.quiz_id}`);
  const tco = await getTranslations('course');
  const back = `/classes/${id}?tab=materials${m.parent_id ? `&folder=${m.parent_id}` : ''}`;
  return (
    <Page wide>
      <Link href={back} className="mb-3 inline-flex items-center gap-1 text-xs text-muted hover:text-ink"><ArrowLeft size={12} aria-hidden />{tco('materials')}</Link>
      <h1 className="display mb-1 text-2xl">{m.title}</h1>
      {m.body && m.kind !== 'page' && <p className="mb-4 max-w-3xl whitespace-pre-line text-muted">{m.body}</p>}
      <div className="mt-4">
        {m.kind === 'file' && m.file_path && <FileViewer url={publicFileUrl(m.file_path)} name={m.file_name ?? m.title} mime={m.file_mime} size={m.file_size} />}
        {m.kind === 'link' && m.url && <LinkFrame url={m.url} title={m.title} />}
        {m.kind === 'app' && m.apps && <LinkFrame url={m.url ?? m.apps.url} title={m.apps.name} forceNewTab={m.apps.launch_mode !== 'embed'} color={m.apps.color} />}
        {m.kind === 'page' && <article className="card max-w-3xl p-6"><Markdown text={m.body ?? ''} /></article>}
      </div>
    </Page>
  );
}

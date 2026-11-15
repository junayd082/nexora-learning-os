import { notFound } from 'next/navigation';
import { SUPABASE_URL } from '@/lib/supabase/env';
import { Page } from '@/components/Experience';
import { FileViewer } from '@/components/files/FileViewer';

/** Viewer for short-lived links to private files (student submissions). Only NEXORA storage links are accepted. */
export default async function ViewFile({ searchParams }: { searchParams: Promise<{ src?: string; name?: string; mime?: string }> }) {
  const sp = await searchParams;
  if (!sp.src || !sp.src.startsWith(`${SUPABASE_URL}/storage/v1/object/`)) notFound();
  return (
    <Page wide>
      <FileViewer url={sp.src} name={sp.name ?? 'file'} mime={sp.mime || null} />
    </Page>
  );
}

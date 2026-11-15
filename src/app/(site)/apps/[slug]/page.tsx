import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Page } from '@/components/Experience';
import { LinkFrame } from '@/components/files/LinkFrame';

export default async function AppLaunch({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: a } = await supabase.from('apps').select('name,url,launch_mode,color').eq('slug', slug).maybeSingle();
  if (!a) notFound();
  return (
    <Page wide>
      <LinkFrame url={a.url} title={a.name} forceNewTab={a.launch_mode !== 'embed'} color={a.color} height="80vh" />
    </Page>
  );
}

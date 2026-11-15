import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/data';
import { JoinPanel } from '../JoinPanel';

export const metadata = { title: 'Join' };

/** QR target: signed-in students join in one step; others sign in and come back here. */
export default async function JoinCode({ params }: { params: Promise<{ code: string }> }) {
  const code = decodeURIComponent((await params).code).toUpperCase().slice(0, 20);
  const t = await getTranslations('join');
  const tc = await getTranslations('classes');
  const viewer = await getViewer();
  if (viewer && code) {
    const supabase = await createClient();
    const { data } = await supabase.rpc('join_by_code', { p_code: code });
    const r = data as { kind: string; id?: string; experience_slug?: string } | null;
    if (r?.kind === 'session' && r.experience_slug) redirect(`/x/${r.experience_slug}/play?session=${r.id}`);
    if (r?.kind === 'class' && r.id) redirect(`/classes/${r.id}?joined=1`);
    return <JoinPanel title={t('title')} body={tc('badCode')} code={code} />;
  }
  return <JoinPanel title={t('title')} body={t('body')} code={code} />;
}

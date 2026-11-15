import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import type { Locale } from '@/lib/brand';
import { getExperience } from '@/lib/data';
import { publicFileUrl } from '@/lib/files';
import { Player } from './Player';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const exp = await getExperience((await params).slug, (await getLocale()) as Locale);
  return { title: exp?.t.title ?? 'Player' };
}

export default async function Play({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const exp = await getExperience(slug, (await getLocale()) as Locale);
  if (!exp) notFound();
  const t = await getTranslations('experience');
  let content: Parameters<typeof Player>[0]['content'];
  if (exp.source === 'file' && exp.file_path) {
    content = { kind: 'file', url: publicFileUrl(exp.file_path), name: exp.file_name ?? 'file', mime: exp.file_mime ?? null, size: exp.file_size ?? null };
  } else if (exp.source === 'app' && exp.resource_url) {
    content = { kind: 'link', url: exp.resource_url, newTab: exp.launch_mode !== 'embed' };
  } else if (exp.embed_url) {
    content = exp.embed_url.startsWith('/') ? { kind: 'frame', url: exp.embed_url } : { kind: 'link', url: exp.embed_url, newTab: exp.launch_mode === 'newtab' };
  } else notFound();
  return (
    <Player id={exp.id} slug={exp.slug} title={exp.t.title} content={content} worksheet={exp.worksheet_url}
      labels={{ exit: t('exitPlayer'), newTab: t('newTab'), worksheet: t('worksheet'), player: t('playerTitle') }} />
  );
}

'use client';

import { useTranslations } from 'next-intl';
import { ExternalLink, Rocket } from 'lucide-react';
import { toEmbed } from '@/lib/embed';

/** Shows a link inline when the site allows it; otherwise a launch card that opens it in a new tab. */
export function LinkFrame({ url, title, height = '78vh', forceNewTab = false, color }:
  { url: string; title: string; height?: string; forceNewTab?: boolean; color?: string }) {
  const t = useTranslations('files');
  const info = toEmbed(url);
  if (forceNewTab || !info.embeddable) {
    return (
      <div className="relative flex flex-col items-center gap-4 overflow-hidden rounded-lg border border-line px-6 py-16 text-center"
        style={{ background: `radial-gradient(70% 90% at 50% 120%, ${color ?? 'rgb(var(--nx-ember))'}33, transparent 70%)` }}>
        <Rocket size={34} className="ember-text" aria-hidden />
        <div className="display text-2xl">{title}</div>
        <p className="max-w-md text-sm text-muted">{t('opensSeparately', { site: info.provider })}</p>
        <a href={url} target="_blank" rel="noopener noreferrer" className="btn-primary btn-lg"><ExternalLink size={16} aria-hidden />{t('launch')}</a>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-sunk/60">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2 text-xs">
        <span className="chip">{info.provider}</span>
        <span className="min-w-0 flex-1 truncate">{title}</span>
        <a href={url} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm"><ExternalLink size={13} aria-hidden />{t('newTab')}</a>
      </div>
      <iframe src={info.src} title={title} className="w-full border-0 bg-white" style={{ height }}
        allow="autoplay; fullscreen; clipboard-write; encrypted-media; picture-in-picture" allowFullScreen
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-downloads" />
    </div>
  );
}

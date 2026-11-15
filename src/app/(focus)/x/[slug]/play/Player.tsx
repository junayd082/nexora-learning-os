'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { ArrowLeft, ExternalLink, FileDown } from 'lucide-react';
import { recordLaunch } from '@/lib/actions';
import { Mark } from '@/components/Logo';
import { FileViewer } from '@/components/files/FileViewer';
import { LinkFrame } from '@/components/files/LinkFrame';

type Content =
  | { kind: 'frame'; url: string }
  | { kind: 'link'; url: string; newTab: boolean }
  | { kind: 'file'; url: string; name: string; mime: string | null; size: number | null };

export function Player({ id, slug, title, content, worksheet, labels }:
  { id: string; slug: string; title: string; content: Content; worksheet: string | null; labels: { exit: string; newTab: string; worksheet: string; player: string } }) {
  useEffect(() => { recordLaunch(id).catch(() => {}); }, [id]);
  return (
    <div className="flex h-screen flex-col bg-sunk">
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-line bg-bg px-3">
        <Link href={`/x/${slug}`} className="btn-ghost btn-sm"><ArrowLeft size={14} aria-hidden />{labels.exit}</Link>
        <Mark size={18} />
        <h1 className="min-w-0 flex-1 truncate text-sm font-medium">{title}</h1>
        {worksheet && <a href={worksheet} download className="btn-ghost btn-sm hidden sm:inline-flex"><FileDown size={14} aria-hidden />{labels.worksheet}</a>}
        {content.kind === 'frame' && <a href={content.url} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm"><ExternalLink size={14} aria-hidden /><span className="hidden sm:inline">{labels.newTab}</span></a>}
      </header>
      {content.kind === 'frame' && (
        <iframe src={content.url} title={`${labels.player}: ${title}`} className="w-full flex-1 border-0 bg-white"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals"
          allow="fullscreen; clipboard-write" referrerPolicy="strict-origin-when-cross-origin" />
      )}
      {content.kind === 'link' && <div className="flex-1 overflow-auto p-3"><LinkFrame url={content.url} title={title} forceNewTab={content.newTab} height="calc(100vh - 7rem)" /></div>}
      {content.kind === 'file' && <div className="flex-1 overflow-auto p-3"><FileViewer url={content.url} name={content.name} mime={content.mime} size={content.size} height="calc(100vh - 8rem)" /></div>}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Box, Download, ExternalLink, FileArchive, FileQuestion, PenTool } from 'lucide-react';
import { ext, fileKind, humanSize, type FileKind } from '@/lib/files';
import { Markdown } from './markdown';

const MODEL_VIEWER = 'https://cdn.jsdelivr.net/npm/@google/model-viewer@4.3.1/dist/model-viewer.min.js';

/** Shows any uploaded file inside NEXORA when the browser can; otherwise a clear download card. */
export function FileViewer({ url, name, mime, size, height = '78vh' }:
  { url: string; name: string; mime?: string | null; size?: number | null; height?: string }) {
  const t = useTranslations('files');
  const kind: FileKind = fileKind(name, mime);
  const e = ext(name);
  const box = { height };

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2 text-xs">
      <span className="chip uppercase">{e || kind}</span>
      <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
      {size ? <span className="text-faint">{humanSize(size)}</span> : null}
      <a href={url} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm"><ExternalLink size={13} aria-hidden />{t('newTab')}</a>
      <a href={url} download={name} className="btn btn-sm"><Download size={13} aria-hidden />{t('download')}</a>
    </div>
  );

  let body: React.ReactNode;
  switch (kind) {
    case 'pdf':
      body = <iframe src={url} title={name} className="w-full border-0 bg-white" style={box} />; break;
    case 'image':
      body = <div className="flex items-center justify-center overflow-auto bg-black/30 p-4" style={{ maxHeight: height }}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={url} alt={name} className="max-h-full max-w-full object-contain" /></div>; break;
    case 'video':
      body = <video src={url} controls playsInline className="w-full bg-black" style={{ maxHeight: height }} />; break;
    case 'audio':
      body = <div className="p-8"><audio src={url} controls className="w-full" /></div>; break;
    case 'office':
      body = <iframe src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`} title={name} className="w-full border-0 bg-white" style={box} />; break;
    case 'text': case 'code': case 'csv': case 'markdown': case 'html':
      body = <TextFile url={url} kind={kind} name={name} height={height} />; break;
    case 'model3d':
      body = ['glb', 'gltf'].includes(e) ? <Model url={url} name={name} height={height} /> : <Card name={name} kind={kind} url={url} />; break;
    default:
      body = <Card name={name} kind={kind} url={url} />;
  }
  return <div className="overflow-hidden rounded-lg border border-line bg-sunk/60">{toolbar}{body}</div>;
}

function TextFile({ url, kind, name, height }: { url: string; kind: FileKind; name: string; height: string }) {
  const t = useTranslations('files');
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch(url).then(async (r) => {
      if (!r.ok) throw new Error();
      const len = Number(r.headers.get('content-length') ?? 0);
      if (len > 2_000_000) throw new Error();
      const s = await r.text();
      if (alive) setText(s.slice(0, 2_000_000));
    }).catch(() => alive && setError(true));
    return () => { alive = false; };
  }, [url]);
  if (error) return <Card name={name} kind={kind} url={url} />;
  if (text === null) return <div className="p-6 text-sm text-muted">{t('loading')}</div>;
  if (kind === 'html') {
    // Uploaded web pages run in an isolated sandbox: scripts work, but they cannot reach NEXORA.
    return <iframe srcDoc={text} sandbox="allow-scripts allow-forms allow-popups allow-modals allow-downloads" title={name} className="w-full border-0 bg-white" style={{ height }} />;
  }
  if (kind === 'markdown') return <div className="overflow-auto p-6" style={{ maxHeight: height }}><Markdown text={text} /></div>;
  if (kind === 'csv') {
    const sep = name.toLowerCase().endsWith('.tsv') ? '\t' : ',';
    const rows = parseCsv(text, sep).slice(0, 1000);
    return (
      <div className="overflow-auto" style={{ maxHeight: height }}>
        <table className="table">
          <thead><tr>{(rows[0] ?? []).map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
          <tbody>{rows.slice(1).map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="whitespace-nowrap">{c}</td>)}</tr>)}</tbody>
        </table>
      </div>
    );
  }
  const lines = text.split('\n');
  return (
    <pre className="overflow-auto p-4 font-mono text-xs leading-relaxed" style={{ maxHeight: height }}>
      {lines.map((l, i) => <div key={i} className="flex"><span className="w-10 shrink-0 select-none pr-3 text-right text-faint">{i + 1}</span><span className="whitespace-pre-wrap break-all">{l}</span></div>)}
    </pre>
  );
}

function parseCsv(text: string, sep: string) {
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; continue; }
    if (c === '"') q = true; else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function Model({ url, name, height }: { url: string; name: string; height: string }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (customElements.get('model-viewer')) { setReady(true); return; }
    const s = document.createElement('script');
    s.type = 'module'; s.src = MODEL_VIEWER; s.onload = () => setReady(true);
    document.head.appendChild(s);
  }, []);
  if (!ready) return <div className="p-6 text-sm text-muted">…</div>;
  return (
    // @ts-expect-error — custom element from @google/model-viewer
    <model-viewer src={url} alt={name} camera-controls auto-rotate shadow-intensity="1" style={{ width: '100%', height, background: 'radial-gradient(circle at 50% 40%, #2a2030, #0d0f13)' }} />
  );
}

function Card({ name, kind, url }: { name: string; kind: FileKind; url: string }) {
  const t = useTranslations('files');
  const e = ext(name);
  const Icon = kind === 'cad' ? PenTool : kind === 'archive' ? FileArchive : kind === 'model3d' ? Box : FileQuestion;
  const tool = kind === 'cad' && ['dwg', 'dxf', 'dwf'].includes(e) ? { href: 'https://web.autocad.com', label: 'AutoCAD Web' }
    : kind === 'cad' && e === 'skp' ? { href: 'https://app.sketchup.com', label: 'SketchUp' }
    : kind === 'model3d' && ['stl', 'obj'].includes(e) ? { href: 'https://www.tinkercad.com', label: 'Tinkercad' }
    : kind === 'cad' && ['step', 'stp', 'iges', 'igs'].includes(e) ? { href: 'https://cad.onshape.com', label: 'Onshape' } : null;
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <Icon size={36} className="ember-text" aria-hidden />
      <div className="font-semibold">{name}</div>
      <p className="max-w-sm text-sm text-muted">{tool ? t('openWith', { tool: tool.label }) : t('noPreview')}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <a href={url} download={name} className="btn-primary"><Download size={15} aria-hidden />{t('download')}</a>
        {tool && <a href={tool.href} target="_blank" rel="noopener noreferrer" className="btn"><ExternalLink size={15} aria-hidden />{tool.label}</a>}
      </div>
    </div>
  );
}

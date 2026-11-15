'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, Loader2, UploadCloud, X } from 'lucide-react';
import { browserClient } from '@/lib/supabase/browser';
import { ACCEPT, MAX_BYTES, humanSize, safeName } from '@/lib/files';
import { cn } from '@/lib/util';

export interface Uploaded { path: string; name: string; mime: string; size: number }

/**
 * Drag-and-drop upload straight to NEXORA storage (Supabase), from the browser.
 * `folder` is the storage prefix the database policies allow for this user.
 */
export function Uploader({ bucket, folder, multiple = false, onChange, initial = [] }:
  { bucket: 'experience-files' | 'submission-files'; folder: string; multiple?: boolean; onChange: (files: Uploaded[]) => void; initial?: Uploaded[] }) {
  const t = useTranslations('files');
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<Uploaded[]>(initial);
  const [busy, setBusy] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [over, setOver] = useState(false);

  const add = async (list: FileList | null) => {
    if (!list?.length) return;
    setError('');
    const picked = Array.from(list).slice(0, multiple ? 10 : 1);
    for (const f of picked) {
      if (f.size > MAX_BYTES) { setError(t('tooBig', { name: f.name })); continue; }
      setBusy((b) => [...b, f.name]);
      const path = `${folder}/${crypto.randomUUID().slice(0, 8)}-${safeName(f.name)}`;
      const { error: err } = await browserClient().storage.from(bucket).upload(path, f, { contentType: f.type || undefined, upsert: false });
      setBusy((b) => b.filter((n) => n !== f.name));
      if (err) {
        // Storage refuses demo accounts (and non-educators) by policy: say so instead of "try again".
        const msg = `${err.message ?? ''} ${(err as { statusCode?: string }).statusCode ?? ''}`;
        setError(/row-level security|unauthori[sz]ed|403|policy/i.test(msg) ? t('blocked', { name: f.name }) : t('failed', { name: f.name }));
        continue;
      }
      const item = { path, name: f.name, mime: f.type || 'application/octet-stream', size: f.size };
      setFiles((cur) => { const next = multiple ? [...cur, item] : [item]; onChange(next); return next; });
    }
    if (input.current) input.current.value = '';
  };

  const remove = (path: string) => setFiles((cur) => { const next = cur.filter((f) => f.path !== path); onChange(next); return next; });

  return (
    <div className="space-y-2">
      <button type="button" onClick={() => input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}
        className={cn('flex w-full flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-7 text-sm transition-colors',
          over ? 'border-ember bg-ember/10' : 'border-line hover:border-ember/50 hover:bg-ember/[0.04]')}>
        <UploadCloud size={26} className="ember-text" aria-hidden />
        <span className="font-semibold">{t('drop')}</span>
        <span className="text-xs text-muted">{t('types')}</span>
      </button>
      <input ref={input} type="file" accept={ACCEPT} multiple={multiple} className="sr-only" onChange={(e) => add(e.target.files)} />
      {busy.map((n) => <div key={n} className="flex items-center gap-2 text-xs text-muted"><Loader2 size={13} className="animate-spin" aria-hidden />{n}</div>)}
      {files.map((f) => (
        <div key={f.path} className="flex items-center gap-2 rounded-md border border-line px-3 py-2 text-xs">
          <CheckCircle2 size={14} className="text-ok" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{f.name}</span>
          <span className="text-faint">{humanSize(f.size)}</span>
          <button type="button" onClick={() => remove(f.path)} className="btn-ghost btn-sm" aria-label={t('remove')}><X size={13} aria-hidden /></button>
        </div>
      ))}
      {error && <p role="alert" className="text-xs text-bad">{error}</p>}
    </div>
  );
}

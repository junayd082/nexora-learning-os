'use client';

import { useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/util';
import type { ActionState } from '@/lib/actions';
import type { QueueWait } from '@/lib/useQueuedAction';

export function SubmitButton({ children, className = 'btn-primary', name, value, pendingText }:
  { children: React.ReactNode; className?: string; name?: string; value?: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  const t = useTranslations('common');
  return (
    <button type="submit" name={name} value={value} className={className} disabled={pending} aria-busy={pending}>
      {pending ? pendingText ?? t('saving') : children}
    </button>
  );
}

/** "You're in line": shown while a busy sign-in or sign-up waits its turn (see useQueuedAction). */
export function QueueNotice({ wait }: { wait: QueueWait }) {
  const t = useTranslations('auth');
  if (!wait) return null;
  return <p role="status" aria-live="polite" className="text-sm text-muted">{t('busyLine', { secs: wait.secs, attempt: wait.attempt })}</p>;
}

export function FormMessage({ state }: { state: ActionState }) {
  if (!state) return null;
  if (state.error) return <p role="alert" className="text-sm text-bad">{state.error}</p>;
  if (state.message) return <p role="status" className="text-sm text-ok">{state.message}</p>;
  return null;
}

export function CopyButton({ text, label }: { text: string; label?: string }) {
  const t = useTranslations('common');
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="btn btn-sm" onClick={async () => {
      try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* clipboard blocked */ }
    }}>
      {done ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
      {done ? t('copied') : label ?? t('copy')}
    </button>
  );
}

/** A button that runs a server action after an optional confirm(). */
export function ActionButton({ action, children, confirmText, className = 'btn btn-sm' }:
  { action: () => Promise<unknown>; children: React.ReactNode; confirmText?: string; className?: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} className={cn(className, pending && 'opacity-60')}
      onClick={() => { if (confirmText && !window.confirm(confirmText)) return; start(async () => { await action(); }); }}>
      {children}
    </button>
  );
}

export function DownloadButton({ filename, mime, data, getData, children, className = 'btn btn-sm' }:
  { filename: string; mime: string; data?: string; getData?: () => Promise<string>; children: React.ReactNode; className?: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" className={className} disabled={pending} onClick={() => start(async () => {
      const content = getData ? await getData() : data ?? '';
      const url = URL.createObjectURL(new Blob([content], { type: mime }));
      const a = Object.assign(document.createElement('a'), { href: url, download: filename });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    })}>
      {children}
    </button>
  );
}

export function PrintButton({ label }: { label: string }) {
  return <button type="button" className="btn btn-sm no-print" onClick={() => window.print()}>{label}</button>;
}

export function ExportMyDataButton({ label, action }: { label: string; action: () => Promise<unknown> }) {
  return (
    <DownloadButton filename="nexora-my-data.json" mime="application/json" className="btn"
      getData={async () => JSON.stringify(await action(), null, 2)}>
      {label}
    </DownloadButton>
  );
}

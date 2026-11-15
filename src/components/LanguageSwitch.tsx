'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Check, Globe } from 'lucide-react';
import { setLocale } from '@/lib/actions';
import { cn } from '@/lib/util';

export function LanguageSwitch({ compact = false }: { compact?: boolean }) {
  const locale = useLocale();
  const t = useTranslations('common');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const choose = (l: 'en' | 'es') => {
    setOpen(false);
    if (l === locale) return;
    start(async () => { await setLocale(l); router.refresh(); });
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className={cn('btn-ghost btn-sm font-mono', pending && 'opacity-60')}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('language')}
        onClick={() => setOpen((o) => !o)}
      >
        <Globe size={14} aria-hidden /> {compact ? null : locale.toUpperCase()}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-1 w-40 surface-3 p-1">
          {(['en', 'es'] as const).map((l) => (
            <button key={l} role="menuitemradio" aria-checked={l === locale} onClick={() => choose(l)}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-ember/10">
              <span className="w-4">{l === locale && <Check size={14} aria-hidden />}</span>
              {l === 'en' ? t('english') : t('spanish')}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Two large buttons for the login screen and mobile drawer. */
export function LanguageButtons() {
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="inline-flex rounded border border-line p-0.5" role="group" aria-label="Language / Idioma">
      {(['en', 'es'] as const).map((l) => (
        <button key={l} type="button" disabled={pending} aria-pressed={l === locale}
          onClick={() => start(async () => { await setLocale(l); router.refresh(); })}
          className={cn('h-7 rounded-sm px-3 text-xs font-medium', l === locale ? 'bg-ember/15 text-ink shadow-[inset_0_0_0_1px_rgb(var(--nx-ember)/0.35)]' : 'text-muted hover:text-ink')}>
          {l === 'en' ? 'English' : 'Español'}
        </button>
      ))}
    </div>
  );
}

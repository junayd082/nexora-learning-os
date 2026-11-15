'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Search, CornerDownLeft } from 'lucide-react';
import { searchAll, type SearchHit } from '@/lib/actions';
import { cn } from '@/lib/util';

interface PageLink { title: string; href: string }

export function CommandPalette({ pages }: { pages: PageLink[] }) {
  const t = useTranslations('search');
  const tn = useTranslations('nav');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  // Global shortcuts: Ctrl/⌘+K opens search, "g h" Home, "g d" Discover, "/" search.
  useEffect(() => {
    let g = 0;
    const onKey = (e: KeyboardEvent) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName) || (e.target as HTMLElement)?.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((o) => !o); return; }
      if (typing) return;
      if (e.key === '/') { e.preventDefault(); setOpen(true); return; }
      if (e.key === 'g') { g = Date.now(); return; }
      if (Date.now() - g < 800) {
        if (e.key === 'h') router.push('/home');
        if (e.key === 'd') router.push('/discover');
        if (e.key === 'c') router.push('/classes');
        g = 0;
      }
    };
    const onOpen = (e: Event) => {
      setOpen(true);
      const q = (e as CustomEvent<{ q?: string }>).detail?.q;
      if (q) setTimeout(() => setQ(q), 10);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('nexora:search', onOpen);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('nexora:search', onOpen); };
  }, [router]);

  useEffect(() => {
    if (open) { setTimeout(() => inputRef.current?.focus(), 0); } else { setQ(''); setHits([]); setSel(0); }
  }, [open]);

  useEffect(() => {
    const term = q.trim();
    if (!term) { setHits([]); return; }
    const id = ++seq.current;
    const timer = setTimeout(async () => {
      const r = await searchAll(term).catch(() => []);
      if (id === seq.current) { setHits(r); setSel(0); }
    }, 160);
    return () => clearTimeout(timer);
  }, [q]);

  const pageHits = useMemo(() => {
    const term = q.trim().toLowerCase();
    return pages.filter((p) => !term || p.title.toLowerCase().includes(term)).slice(0, term ? 4 : 8);
  }, [q, pages]);

  const items = useMemo(() => [
    ...hits.map((h) => ({ ...h, group: h.kind === 'experience' ? t('experiences') : h.kind === 'world' ? t('worlds') : t('classes') })),
    ...pageHits.map((p) => ({ kind: 'page' as const, title: p.title, href: p.href, sub: undefined, group: t('pages') })),
  ], [hits, pageHits, t]);

  const go = useCallback((href: string) => { setOpen(false); router.push(href); }, [router]);

  if (!open) return null;
  let lastGroup = '';
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[12vh] backdrop-blur-[2px]" onMouseDown={() => setOpen(false)}>
      <div role="dialog" aria-modal="true" aria-label={tn('search')} className="w-full max-w-xl surface-3" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-line px-3">
          <Search size={16} className="text-muted" aria-hidden />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('placeholder')}
            role="combobox" aria-expanded="true" aria-controls="nx-search-list" aria-activedescendant={items[sel] ? `nx-hit-${sel}` : undefined}
            className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint"
            onKeyDown={(e) => {
              if (e.key === 'Escape') setOpen(false);
              if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, items.length - 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
              if (e.key === 'Enter' && items[sel]) go(items[sel].href);
            }} />
          <span className="kbd">Esc</span>
        </div>
        <ul id="nx-search-list" role="listbox" className="max-h-[50vh] overflow-y-auto p-1">
          {items.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">{t('empty')}</li>}
          {items.map((it, i) => {
            const header = it.group !== lastGroup ? (lastGroup = it.group) : null;
            return (
              <li key={`${it.href}-${i}`} role="presentation">
                {header && <div className="eyebrow px-3 pb-1 pt-3">{header}</div>}
                <button id={`nx-hit-${i}`} role="option" aria-selected={i === sel} onMouseEnter={() => setSel(i)} onClick={() => go(it.href)}
                  className={cn('flex w-full items-center gap-3 rounded px-3 py-2 text-left text-sm', i === sel && 'bg-ember/10')}>
                  <span className="flex-1 truncate">{it.title}</span>
                  {it.sub && <span className="chip">{it.sub}</span>}
                  {i === sel && <CornerDownLeft size={13} className="text-muted" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="border-t border-line px-3 py-2 text-2xs text-muted">{t('hint')}</div>
      </div>
    </div>
  );
}

export function SearchTrigger({ label, className }: { label: string; className?: string }) {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event('nexora:search'))}
      className={cn('flex h-9 items-center gap-2 rounded-lg border border-line bg-sunk/60 px-3 text-sm text-faint transition-colors hover:border-ember/30 hover:text-muted', className)}>
      <Search size={14} aria-hidden />
      <span className="flex-1 truncate text-left">{label}</span>
      <span className="kbd">⌘K</span>
    </button>
  );
}

export function SearchIconButton({ label }: { label: string }) {
  return (
    <button type="button" className="btn-ghost btn-sm md:hidden" aria-label={label}
      onClick={() => window.dispatchEvent(new Event('nexora:search'))}>
      <Search size={16} aria-hidden />
    </button>
  );
}

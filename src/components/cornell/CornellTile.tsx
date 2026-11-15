'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight, NotebookPen } from 'lucide-react';
import { cn } from '@/lib/util';

/** The classroom's Cornell Notes card: a little Cornell sheet you tap to open your notebook. */
export function CornellTile({ classId, userId, compact = false, className }: { classId: string; userId: string; compact?: boolean; className?: string }) {
  const t = useTranslations('cornell');
  const [last, setLast] = useState<{ id: string; title: string } | null>(null);
  useEffect(() => {
    try {
      const list = JSON.parse(localStorage.getItem(`nexora-cornell:${userId}:${classId}`) ?? '[]') as { id: string; title: string; updatedAt: number }[];
      const n = [...list].sort((a, b) => b.updatedAt - a.updatedAt)[0];
      if (n) setLast({ id: n.id, title: n.title });
    } catch { /* */ }
  }, [classId, userId]);
  const href = `/classes/${classId}/notes`;

  return (
    <section data-tour="cornell" className={cn('card group relative overflow-hidden p-0 transition hover:border-ember/50', className)} aria-labelledby={`cn-tile-${classId}`}>
      <Link href={href} className={cn('flex gap-4 p-4', compact ? 'items-center' : 'flex-col')}>
        <Sheet small={compact} />
        <span className="min-w-0 flex-1">
          <span id={`cn-tile-${classId}`} className="flex items-center gap-2 text-base font-semibold"><NotebookPen size={16} className="ember-text" aria-hidden />{t('tile')}</span>
          <span className="mt-1 block text-xs leading-relaxed text-muted">{t('tileSub')}</span>
          {!compact && <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold ember-text">{t('tileOpen')}<ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" aria-hidden /></span>}
        </span>
        {compact && <ArrowRight size={16} className="shrink-0 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-ember" aria-hidden />}
      </Link>
      {last && (
        <Link href={`${href}?n=${last.id}`} className="block truncate border-t border-line px-4 py-2.5 text-xs text-muted hover:bg-ember/[0.06] hover:text-ink">
          {t('tileContinue', { title: last.title || t('untitled') })} →
        </Link>
      )}
    </section>
  );
}

function Sheet({ small }: { small: boolean }) {
  return (
    <svg viewBox="0 0 120 92" className={cn('shrink-0 rounded-md shadow-lg ring-1 ring-black/10 transition-transform group-hover:-rotate-1 group-hover:scale-[1.02]', small ? 'h-16 w-[84px]' : 'h-auto w-full')} aria-hidden>
      <rect width="120" height="92" rx="4" fill="#fffdf7" />
      {Array.from({ length: 9 }, (_, i) => <line key={i} x1="0" x2="120" y1={20 + i * 8} y2={20 + i * 8} stroke="#bcd3e6" strokeWidth="0.7" />)}
      <line x1="9" x2="9" y1="0" y2="92" stroke="#e58b8b" strokeWidth="1" />
      <rect x="30" y="4" width="58" height="10" rx="5" fill="#f6e3a1" />
      <text x="59" y="11.6" textAnchor="middle" fontSize="6.4" fontFamily="Caveat, cursive" fontWeight="600" fill="#1c1c21">Cornell Notes</text>
      <line x1="5" x2="118" y1="18" y2="18" stroke="#17171b" strokeWidth="1.6" />
      <line x1="40" x2="40" y1="18" y2="72" stroke="#17171b" strokeWidth="1.4" />
      <line x1="5" x2="118" y1="72" y2="72" stroke="#17171b" strokeWidth="1.6" />
      <g fill="#3a3a42" fontFamily="Caveat, cursive" fontSize="5.6">
        <text x="13" y="34">Questions</text><text x="17" y="42">or</text><text x="12" y="50">Keywords</text>
        <text x="62" y="42">Notes</text>
        <text x="58" y="83">Summary</text>
      </g>
      <g stroke="#7c7c88" strokeWidth="0.9" strokeLinecap="round" opacity=".55">
        <line x1="46" x2="104" y1="51" y2="51" /><line x1="46" x2="96" y1="59" y2="59" /><line x1="46" x2="100" y1="67" y2="67" />
      </g>
    </svg>
  );
}

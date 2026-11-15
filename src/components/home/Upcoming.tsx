'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { ArrowRight, Check, Megaphone, Pin, RotateCcw } from 'lucide-react';
import type { Tag } from '@/lib/types';
import { lightFor } from '@/components/Living';
import { TagChip } from '@/components/TagChip';
import { cn } from '@/lib/util';

export type UpCat = 'do_now' | 'lesson' | 'due' | 'announcement' | 'catch_up';
export interface UpEntry {
  key: string;
  cats: UpCat[];
  /** Which group it lists under in "All". */
  group: 'today' | 'due' | 'news' | 'missed';
  title: string; href: string;
  classId: string; className: string; period: number | null; teacher: string | null;
  tag?: Tag | null; dueAt?: string | null; status?: string | null;
  body?: string; createdAt?: string; pinned?: boolean;
  /** Sort within its group (period order for today, due time for due, newest first for news). */
  sort: string;
}

const FILTERS: ('all' | UpCat)[] = ['all', 'do_now', 'lesson', 'due', 'announcement', 'catch_up'];
const GROUPS: UpEntry['group'][] = ['today', 'due', 'news', 'missed'];

/**
 * Home → Upcoming. Everything a student needs to act on, across all classes, in one list:
 * today's Do Now and lesson, work due this week (late work flagged), teacher announcements,
 * and what they missed last class. Chips filter by kind; counts show what is waiting.
 */
export function Upcoming({ entries, serverNow }: { entries: UpEntry[]; serverNow: number }) {
  const t = useTranslations('now');
  const tn = useTranslations('nova');
  const f = useFormatter();
  const [filter, setFilter] = useState<'all' | UpCat>('all');
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0 };
    entries.forEach((e) => {
      const open = !(e.status === 'submitted' || e.status === 'returned');
      if (open) c.all++;
      e.cats.forEach((k) => { if (open || k === 'announcement') c[k] = (c[k] ?? 0) + 1; });
    });
    return c;
  }, [entries]);
  const shown = filter === 'all' ? entries : entries.filter((e) => e.cats.includes(filter));
  const visibleFilters = FILTERS.filter((k) => k === 'all' || k === filter || (counts[k] ?? 0) > 0 || k !== 'catch_up');
  const label = (k: 'all' | UpCat) => ({ all: t('fAll'), do_now: t('fDoNow'), lesson: t('fLessons'), due: t('fDue'), announcement: t('fNews'), catch_up: t('fCatchUp') })[k];
  const groupTitle = { today: t('gToday'), due: t('gDue'), news: t('gNews'), missed: t('gMissed') };

  return (
    <section aria-labelledby="upcoming-h">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <h2 id="upcoming-h" className="nx-onscene text-[11px] font-mono uppercase tracking-[0.2em] text-muted">{t('upcoming')}</h2>
      </div>
      <div role="tablist" aria-label={t('upcoming')} className="-mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {visibleFilters.map((k) => (
          <button key={k} type="button" role="tab" aria-selected={filter === k} onClick={() => setFilter(k)}
            className={cn('nx-glass inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors',
              filter === k ? 'border-ember/70 text-ink' : 'border-line text-ink/80 hover:text-ink')}>
            {label(k)}
            {(counts[k] ?? 0) > 0 && <span className={cn('rounded-full px-1.5 text-[10px] tabular-nums', filter === k ? 'bg-ember/30' : 'bg-white/[0.08]')}>{counts[k]}</span>}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="card px-5 py-8 text-center text-sm text-muted">{filter === 'all' ? t('emptyAll') : t('emptyFilter')}</div>
      ) : (
        <div className="space-y-6">
          {GROUPS.map((g) => {
            const list = shown.filter((e) => e.group === g).sort((a, b) => a.sort.localeCompare(b.sort));
            if (!list.length) return null;
            return (
              <div key={g}>
                {filter === 'all' && <h3 className="nx-onscene mb-2 text-xs font-semibold text-muted">{groupTitle[g]}</h3>}
                <ul className="card divide-y divide-line overflow-hidden">
                  {list.map((e) => row(e, serverNow))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );

  function row(e: UpEntry, now: number) {
    const light = lightFor(e.classId);
    const isDone = e.status === 'submitted' || e.status === 'returned';
    const late = !isDone && e.dueAt && Date.parse(e.dueAt) < now;
    const where = [e.period != null ? t('period', { period: e.period }) : null, e.className].filter(Boolean).join(' · ');
    if (e.group === 'news') {
      return (
        <li key={e.key}>
          <Link href={e.href} className="flex gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.03]">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border" style={{ borderColor: `rgb(${light} / 0.5)`, color: `rgb(${light})` }}>
              <Megaphone size={13} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
                <span className="font-semibold text-ink">{e.teacher ?? where}</span>
                <span>{where}</span>
                {e.createdAt && <span className="text-faint">{f.relativeTime(new Date(e.createdAt), now)}</span>}
                {e.pinned && <span className="inline-flex items-center gap-0.5 ember-text"><Pin size={11} aria-hidden />{t('pinned')}</span>}
              </span>
              <span className="mt-1 line-clamp-3 block whitespace-pre-line text-sm">{e.body}</span>
            </span>
          </Link>
        </li>
      );
    }
    return (
      <li key={e.key}>
        <Link href={e.href} className={cn('group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03]', isDone && 'opacity-60')}>
          <span className="h-9 w-1 shrink-0 rounded-full" style={{ background: `rgb(${light})`, boxShadow: `0 0 10px rgb(${light} / 0.5)` }} aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-1.5">
              {e.tag && <TagChip tag={e.tag} label={tn(`tags.${e.tag}`)} />}
              {e.group === 'missed' && <span className="inline-flex items-center gap-1 text-2xs text-muted"><RotateCcw size={11} aria-hidden />{t('missedTag')}</span>}
            </span>
            <span className={cn('mt-0.5 block truncate text-sm font-semibold', isDone && 'line-through decoration-faint')}>{e.title}</span>
            <span className="block truncate text-xs text-muted">{where}</span>
          </span>
          {isDone ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-2xs text-ok"><Check size={13} aria-hidden />{e.status === 'returned' ? t('returned') : t('turnedIn')}</span>
          ) : e.dueAt ? (
            <span className={cn('shrink-0 text-right text-2xs tabular-nums', late ? 'font-semibold text-bad' : 'text-muted')}>
              {late ? t('late') : t('dueShort')}<br />
              <span className={late ? 'font-normal' : 'text-ink/80'}>{f.dateTime(new Date(e.dueAt), Math.abs(Date.parse(e.dueAt) - now) > 6 * 86_400_000 || late
                ? { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' }
                : { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' })}</span>
            </span>
          ) : (
            <ArrowRight size={15} className="shrink-0 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-ember" aria-hidden />
          )}
        </Link>
      </li>
    );
  }
}

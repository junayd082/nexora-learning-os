import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { BadgeCheck, Clock } from 'lucide-react';
import type { Experience } from '@/lib/types';
import { worldName } from '@/lib/data';
import { cn } from '@/lib/util';
import { getLiving } from '@/lib/living';
import { Fox } from './companion/Fox';
import { hexToRgb } from './Living';

/** A drafted "title block" cover: world colour band, type and code. No stock imagery. */
export function Cover({ exp, typeLabel, className }: { exp: Experience; typeLabel: string; className?: string }) {
  const accent = hexToRgb(exp.worlds?.accent ?? '#FF7A1A');
  const code = exp.slug.match(/l(\d+)/i)?.[1];
  const warm = exp.type === 'lecture' ? 'var(--nx-violet)' : 'var(--nx-ember)';
  return (
    <div className={cn('relative overflow-hidden rounded-t-lg border-b border-line', className)} aria-hidden
      style={{ background: `radial-gradient(120% 160% at 0% 100%, rgb(${warm} / 0.42), transparent 55%), radial-gradient(90% 120% at 100% 0%, rgb(${accent} / 0.5), transparent 60%), rgb(var(--nx-carbon-1))` }}>
      <div className="absolute inset-0 grid-paper opacity-60" />
      <div className="absolute left-4 top-3 font-mono text-2xs uppercase tracking-[0.18em] text-white/70">{typeLabel}</div>
      {code && <div className="absolute bottom-0 right-3 font-mono text-[52px] font-medium leading-none text-white/[0.12]">L{code}</div>}
      <svg className="absolute bottom-3 left-4 h-8 w-24 text-white/30" viewBox="0 0 96 32" fill="none" stroke="currentColor" strokeWidth="1.2">
        <path d="M1 31V9h30v22M31 17h24v14M55 31V1h40v30" /><path d="M1 31h94" strokeWidth="1.6" />
      </svg>
    </div>
  );
}

export async function ExperienceCard({ exp, href }: { exp: Experience; href?: string }) {
  const t = await getTranslations('experience');
  const locale = await getLocale();
  const typeLabel = t(`types.${exp.type}` as 'types.lesson');
  return (
    <Link href={href ?? `/x/${exp.slug}`} className="lit lit-edge group card flex flex-col"
      style={{ ['--glow' as string]: exp.type === 'lecture' ? 'var(--nx-violet)' : 'var(--nx-ember)' }}>
      <Cover exp={exp} typeLabel={typeLabel} className="h-24" />
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <h3 className="text-[15px] font-medium leading-snug group-hover:text-white">{exp.t.title}</h3>
        {exp.t.short_description && <p className="line-clamp-2 text-sm text-muted">{exp.t.short_description}</p>}
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
          {exp.worlds && <span className="chip"><span className="h-1.5 w-1.5 rounded-full" style={{ background: exp.worlds.accent }} />{worldName(exp.worlds, locale)}</span>}
          {exp.duration_minutes && <span className="chip"><Clock size={10} aria-hidden />{exp.duration_minutes}′</span>}
          {exp.quality === 'teacher_verified' && <span className="chip text-ok"><BadgeCheck size={11} aria-hidden />{t('quality.teacher_verified')}</span>}
          {exp.status !== 'published' && <span className="chip text-warn">{t(`status.${exp.status}`)}</span>}
          {exp.is_demo && <span className="chip text-warn">Demo</span>}
        </div>
      </div>
    </Link>
  );
}

export async function ExperienceGrid({ items }: { items: Experience[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((e) => <ExperienceCard key={e.id} exp={e} />)}
    </div>
  );
}

/** Numbered learning-path list: the right shape for a sequence, rather than another card grid. */
export async function SequenceList({ items }: { items: Experience[] }) {
  const t = await getTranslations('experience');
  return (
    <ol className="card divide-y divide-line overflow-hidden">
      {items.map((e, i) => (
        <li key={e.id}>
          <Link href={`/x/${e.slug}`} className="group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-ember/[0.06]">
            <span className="w-7 shrink-0 font-mono text-xs text-faint transition-colors group-hover:text-ember">{String(i + 1).padStart(2, '0')}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{e.t.title}</span>
              {e.t.short_description && <span className="block truncate text-xs text-muted">{e.t.short_description}</span>}
            </span>
            <span className="chip hidden sm:inline-flex">{t(`types.${e.type}` as 'types.lesson')}</span>
            {e.duration_minutes && <span className="hidden w-14 text-right font-mono text-xs text-muted sm:block">{e.duration_minutes} min</span>}
          </Link>
        </li>
      ))}
    </ol>
  );
}

/** Empty states: Nova sits beside the space waiting to be filled (unless the companion is off). */
export async function Empty({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  const { companion } = await getLiving();
  return (
    <div className="flex items-center gap-4 rounded-lg border border-dashed border-line bg-white/[0.015] px-5 py-6 text-sm text-muted">
      {companion && <div className="h-14 w-14 shrink-0 opacity-90"><Fox pose="sit" /></div>}
      <div className="flex flex-col items-start gap-3">
        <p>{children}</p>
        {action}
      </div>
    </div>
  );
}

export function PageHeader({ eyebrow, title, subtitle, actions }:
  { eyebrow?: string; title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <div className="eyebrow pb-1">{eyebrow}</div>}
        <h1 className="display text-[30px] leading-tight">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 no-print">{actions}</div>}
    </div>
  );
}

export function Page({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return <div className={cn('mx-auto w-full px-4 py-8 sm:px-6', wide ? 'max-w-7xl' : 'max-w-6xl')}>{children}</div>;
}

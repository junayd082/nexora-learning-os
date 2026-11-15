import Link from 'next/link';
import { cn } from '@/lib/util';

/** Each class/world gets one of the four light sources, stable per id. */
const LIGHTS = ['var(--nx-ember)', 'var(--nx-violet)', 'var(--nx-signal)', 'var(--nx-magenta)'];
export function lightFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return LIGHTS[h % LIGHTS.length];
}

/** "#1E4F8F" → "30 79 143" for CSS rgb() tokens. */
export function hexToRgb(hex: string) {
  const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  return m ? `${parseInt(m[1], 16)} ${parseInt(m[2], 16)} ${parseInt(m[3], 16)}` : '255 122 26';
}

export function Progress({ value, light }: { value: number; light?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, rgb(${light ?? 'var(--nx-ember)'} / 0.55), rgb(${light ?? 'var(--nx-ember)'}))`, boxShadow: `0 0 12px rgb(${light ?? 'var(--nx-ember)'} / 0.5)` }} />
    </div>
  );
}

export function Stat({ label, value, live, hint }: { label: string; value: React.ReactNode; live?: boolean; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 px-5 py-4">
      <span className="flex items-center gap-2 text-2xs font-mono uppercase tracking-[0.14em] text-muted">
        {live && <span className="live-dot" aria-hidden />}{label}
      </span>
      <span className="font-mono text-[26px] leading-none tracking-tight">{value}</span>
      {hint && <span className="text-2xs text-faint">{hint}</span>}
    </div>
  );
}

/** A section label in the editorial style used across the living interface. */
export function SectionTitle({ children, action, id }: { children: React.ReactNode; action?: React.ReactNode; id?: string }) {
  return (
    <div id={id} className="mb-3 flex scroll-mt-20 items-end justify-between gap-3">
      <h2 className="nx-onscene text-[11px] font-mono uppercase tracking-[0.2em] text-muted">{children}</h2>
      {action}
    </div>
  );
}

export function ClassCard({ href, id, name, meta, students, waiting, next, progress, progressLabel, cta, demo, icon }: {
  href: string; id: string; name: string; meta?: string; students: string; waiting?: string; next?: { label: string; title: string } | null;
  progress?: number | null; progressLabel?: string; cta: string; demo?: boolean;
  /** The student's own class icon (a button, so it sits beside the link rather than inside it). */
  icon?: React.ReactNode;
}) {
  const light = lightFor(id);
  if (icon) {
    return (
      <div className="relative">
        <ClassCardLink href={href} id={id} name={name} meta={meta} students={students} waiting={waiting} next={next}
          progress={progress} progressLabel={progressLabel} cta={cta} demo={demo} light={light} iconSpace />
        <div className="absolute left-5 top-[21px] z-10">{icon}</div>
      </div>
    );
  }
  return <ClassCardLink href={href} id={id} name={name} meta={meta} students={students} waiting={waiting} next={next}
    progress={progress} progressLabel={progressLabel} cta={cta} demo={demo} light={light} />;
}

function ClassCardLink({ href, id, name, meta, students, waiting, next, progress, progressLabel, cta, demo, light, iconSpace }: {
  href: string; id: string; name: string; meta?: string; students: string; waiting?: string; next?: { label: string; title: string } | null;
  progress?: number | null; progressLabel?: string; cta: string; demo?: boolean; light: string; iconSpace?: boolean;
}) {
  void id;
  return (
    <Link href={href} className="lit lit-edge card group flex flex-col overflow-hidden" style={{ ['--glow' as string]: light }}>
      <div className="h-px w-full" style={{ background: `linear-gradient(90deg, rgb(${light} / 0.9), rgb(${light} / 0) 70%)` }} />
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className={iconSpace ? 'min-h-[52px] pl-[68px]' : undefined}>
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-[15px] font-bold uppercase tracking-[0.04em] leading-snug">{name}</h3>
            {demo && <span className="chip ember-text">Demo</span>}
          </div>
          {meta && <div className="mt-0.5 text-xs text-muted">{meta}</div>}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <span>{students}</span>
          {waiting && <span className="ember-text">{waiting}</span>}
        </div>
        {next && (
          <div className="text-sm">
            <div className="text-2xs font-mono uppercase tracking-[0.14em] text-faint">{next.label}</div>
            <div className="truncate font-medium">{next.title}</div>
          </div>
        )}
        {progress != null && (
          <div className="space-y-1.5">
            <Progress value={progress} light={light} />
            {progressLabel && <div className="text-2xs text-faint">{progressLabel}</div>}
          </div>
        )}
        <span className={cn('mt-auto inline-flex items-center gap-1.5 text-sm font-semibold transition-transform duration-300 group-hover:translate-x-0.5')} style={{ color: `rgb(${light})` }}>
          {cta} →
        </span>
      </div>
    </Link>
  );
}

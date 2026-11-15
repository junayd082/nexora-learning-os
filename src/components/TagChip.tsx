import type { Tag } from '@/lib/types';
import { cn } from '@/lib/util';

/** Colour per lesson role, shared by course lists, the Today card and Nova. */
export const TAG_COLOR: Record<Tag, string> = {
  do_now: '255 122 48',     // ember
  lecture: '154 114 255',   // violet
  activity: '90 162 255',   // blue
  homework: '232 76 168',   // magenta
  exit_ticket: '62 196 138',// green
  resource: '150 150 165',  // grey
};

export function TagChip({ tag, label, className }: { tag: Tag; label: string; className?: string }) {
  const c = TAG_COLOR[tag] ?? TAG_COLOR.resource;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-[1px] text-2xs font-semibold uppercase tracking-wide', className)}
      style={{ color: `rgb(${c})`, borderColor: `rgb(${c} / 0.45)`, background: `rgb(${c} / 0.1)` }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: `rgb(${c})` }} aria-hidden />{label}
    </span>
  );
}

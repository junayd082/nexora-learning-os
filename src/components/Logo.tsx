import Link from 'next/link';
import { brand } from '@/lib/brand';

/** `gid` keeps gradient ids unique: a gradient defined inside a hidden (display:none) copy would not paint. */
export function Mark({ size = 22, gid = 'm' }: { size?: number; gid?: string }) {
  const id = `nx-mark-${gid}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="shrink-0">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FF8A3D" /><stop offset=".55" stopColor="#C044B7" /><stop offset="1" stopColor="#8758FF" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="#14151B" />
      <rect x=".75" y=".75" width="62.5" height="62.5" rx="13.25" fill="none" stroke={`url(#${id})`} strokeOpacity=".55" strokeWidth="1.5" />
      <path d="M19 46V18l26 28V18" fill="none" stroke={`url(#${id})`} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The wordmark resolves from darkness once on load; a faint ember light sits behind the mark. */
export function Logo({ href = '/', gid = 'logo' }: { href?: string; gid?: string }) {
  return (
    <Link href={href} className="nx-resolve group relative inline-flex items-center gap-2.5 font-mono text-[13px] font-medium tracking-[0.28em] text-ink">
      <span className="relative">
        <span className="absolute -inset-2 rounded-full bg-ember/25 blur-md transition-opacity duration-500 group-hover:opacity-100 opacity-60" aria-hidden />
        <span className="relative"><Mark size={24} gid={gid} /></span>
      </span>
      {brand.productName}
    </Link>
  );
}

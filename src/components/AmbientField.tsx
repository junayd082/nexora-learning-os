'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

export function moodFor(path: string) {
  if (path.startsWith('/assignments/') || path.startsWith('/checks/')) return 'focus';
  if (path.startsWith('/discover') || path.startsWith('/x/') || path === '/worlds') return 'discover';
  if (path.startsWith('/worlds/')) return 'world';
  if (path.startsWith('/classes') || path.startsWith('/join')) return 'classes';
  if (path.startsWith('/portfolio') || path.startsWith('/library')) return 'portfolio';
  if (path.startsWith('/teach') || path.startsWith('/admin') || path.startsWith('/profile') || path.startsWith('/release-notes')) return 'quiet';
  return 'home';
}

/**
 * The living background: three pools of smoked light drifting on 30–50 s cycles,
 * film grain, a vignette, and a faint light that follows the pointer.
 * One rAF-throttled pointer listener also drives the per-card light (.lit).
 * Everything pauses while the tab is hidden.
 */
export function AmbientField() {
  const path = usePathname();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    const onVis = () => root.classList.toggle('nx-paused', document.hidden);
    document.addEventListener('visibilitychange', onVis);

    const fine = window.matchMedia('(pointer: fine)').matches;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    let last: PointerEvent | null = null;
    const apply = () => {
      frame = 0;
      const e = last; if (!e) return;
      const field = ref.current;
      if (field && root.dataset.motion === 'full' && !reduce) {
        field.classList.add('has-cursor');
        field.style.setProperty('--cx', `${e.clientX}px`);
        field.style.setProperty('--cy', `${e.clientY}px`);
      }
      const card = (e.target as Element | null)?.closest?.('.lit') as HTMLElement | null;
      if (card && root.dataset.motion !== 'static') {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${e.clientX - r.left}px`);
        card.style.setProperty('--my', `${e.clientY - r.top}px`);
      }
    };
    const onMove = (e: PointerEvent) => { last = e; if (!frame) frame = requestAnimationFrame(apply); };
    if (fine) window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pointermove', onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={ref} className="nx-field" data-mood={moodFor(path)} aria-hidden="true">
      <div className="blob b1" />
      <div className="blob b2" />
      <div className="blob b3" />
      <div className="cursor" />
      <div className="grain" />
      <div className="vignette" />
    </div>
  );
}

/** Lets a page (e.g. a World) tint the atmosphere with its own colour: pass "r g b". */
export function WorldTint({ rgb }: { rgb: string }) {
  useEffect(() => {
    document.documentElement.style.setProperty('--world', rgb);
    return () => { document.documentElement.style.removeProperty('--world'); };
  }, [rgb]);
  return null;
}

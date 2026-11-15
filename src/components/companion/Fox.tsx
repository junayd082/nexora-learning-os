'use client';

import { useId } from 'react';

export type FoxPose = 'sit' | 'lie' | 'walk' | 'stand';
export type FoxMood = 'normal' | 'happy' | 'love' | 'dizzy' | 'angry' | 'surprised' | 'howl' | 'eat';

/**
 * Nova — a small, stylised fox drawn in SVG (no images, ~3 KB).
 * Poses share one 120×120 box with the ground at y≈112 so they can swap in place.
 * Idle life (tail sway, blink, ear twitch, breathing, walk cycle) is pure CSS, see companion.css.
 */
export function Fox({ pose, look = [0, 0], sleeping = false, mood = 'normal', className }:
  { pose: FoxPose; look?: [number, number]; sleeping?: boolean; mood?: FoxMood; className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const fur = `nxfur${uid}`;
  const glow = `nxglow${uid}`;
  const [lx, ly] = look;
  const Defs = (
    <defs>
      <linearGradient id={fur} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#FF8A3D" />
        <stop offset=".55" stopColor="#D2561B" />
        <stop offset="1" stopColor="#7E2F10" />
      </linearGradient>
      <filter id={glow} x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="1.3" result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
    </defs>
  );
  const F = `url(#${fur})`;
  const G = `url(#${glow})`;
  const CREAM = '#F1E2D3';
  const DARK = '#1A1113';
  const VIOLET = '#9A72FF';

  if (pose === 'lie') {
    return (
      <svg viewBox="0 0 120 120" className={`nx-fox pose-lie ${className ?? ''}`} aria-hidden="true">
        {Defs}
        <ellipse cx="62" cy="112.5" rx="46" ry="3.2" fill="#000" opacity=".45" />
        <g className="fx-breathe">
          <path d="M22 112 C 20 98, 36 88, 60 88 C 80 88, 92 96, 94 108 L 94 112 Z" fill={F} />
          <path d="M30 92 C 44 86, 66 86, 80 92" fill="none" stroke={VIOLET} strokeWidth="1.1" opacity=".8" filter={G} strokeLinecap="round" />
        </g>
        <path className="fx-ear" d="M84 91 L 72 80 L 92 89 Z" fill="#B44814" />
        <path d="M78 100 C 78 92, 86 88, 94 88 L 110 96 C 113 98, 112 101, 108 101 L 96 104 C 88 107, 80 106, 78 100 Z" fill={F} />
        <path d="M90 101 L 109 100 C 104 104, 96 106, 88 106 Z" fill={CREAM} />
        {sleeping
          ? <path d="M90 94.5 q 3 2.2 6.5 0" stroke={DARK} strokeWidth="1.2" fill="none" strokeLinecap="round" />
          : <g className="fx-blink" style={{ transformOrigin: '93px 94px' }}>
              <ellipse cx="93" cy="94" rx="2.2" ry="1.6" fill="#FFE2B8" filter={G} />
              <circle cx={93.5 + lx * 0.6} cy={94 + ly * 0.4} r=".9" fill={DARK} />
            </g>}
        <circle cx="110" cy="98" r="1.6" fill={DARK} />
        <rect x="86" y="106" width="20" height="5" rx="2.5" fill={DARK} />
        <path className="fx-tail-lie" d="M26 108 C 12 108, 6 98, 14 92 C 18 89, 22 92, 20 96 C 20 102, 30 106, 50 107 L 80 107 C 84 108, 84 112, 78 113 L 40 113 C 32 113, 28 111, 26 108 Z" fill={F} />
        <path d="M70 107 L 80 107 C 84 108, 84 112, 78 113 L 68 113 C 70 111, 71 109, 70 107 Z" fill={CREAM} />
        {sleeping && <text className="fx-z" x="100" y="80" fontSize="8" fill={VIOLET} opacity=".7" fontFamily="monospace">z</text>}
      </svg>
    );
  }

  if (pose === 'walk' || pose === 'stand') {
    const legs = (cls: string, x: number, w: number, fill: string) => (
      <g className={pose === 'walk' ? cls : ''}>
        <rect x={x} y="88" width={w} height="22" rx="2" fill={fill} />
        <rect x={x} y="104" width={w} height="6" rx="1.5" fill={DARK} />
      </g>
    );
    return (
      <svg viewBox="0 0 120 120" className={`nx-fox pose-${pose} ${className ?? ''}`} aria-hidden="true">
        {Defs}
        <ellipse cx="60" cy="112.5" rx="42" ry="3.2" fill="#000" opacity=".45" />
        {legs('fx-leg-a', 38, 5, '#A9441A')}
        {legs('fx-leg-b', 78, 5, '#A9441A')}
        <g className="fx-bob">
          <g className="fx-tail-walk" style={{ transformOrigin: '34px 78px' }}>
            <path d="M34 82 C 20 84, 6 76, 4 62 C 4 58, 8 57, 10 61 C 14 68, 24 72, 36 74 Z" fill={F} />
            <path d="M4 62 C 4 58, 8 57, 10 61 C 10 64, 8 66, 5 66 Z" fill={CREAM} />
          </g>
          <path d="M30 82 C 32 72, 52 68, 76 70 C 86 71, 92 76, 92 84 C 92 92, 84 95, 74 95 L 40 95 C 32 94, 28 88, 30 82 Z" fill={F} />
          <path d="M36 74 C 50 69, 66 69, 80 72" fill="none" stroke={VIOLET} strokeWidth="1.1" opacity=".85" filter={G} strokeLinecap="round" />
          <path d="M78 82 C 86 80, 92 84, 90 92 C 84 93, 78 90, 78 82 Z" fill={CREAM} />
          <path d="M87 63 L 84 49 L 93 60 Z" fill="#B44814" />
          <path d="M82 72 C 82 62, 90 56, 98 56 L 114 63 C 116 65, 115 67, 112 67 L 102 69 C 96 74, 88 76, 82 72 Z" fill={F} />
          <path d="M98 66 L 113 66 C 108 70, 100 73, 92 73 Z" fill={CREAM} />
          <g className="fx-ear" style={{ transformOrigin: '96px 59px' }}>
            <path d="M92 59 L 94 44 L 101 58 Z" fill="#E06A24" /><path d="M94 56 L 95 47.5 L 98.5 57 Z" fill={DARK} />
          </g>
          <g className="fx-blink" style={{ transformOrigin: '101px 61px' }}>
            <ellipse cx="101" cy="61" rx="2.2" ry="1.7" fill="#FFE2B8" filter={G} />
            <circle cx={101.6 + lx * 0.6} cy={61 + ly * 0.4} r="1" fill={DARK} />
          </g>
          <circle cx="114" cy="64" r="1.6" fill={DARK} />
        </g>
        {legs('fx-leg-b', 44, 5.5, '#D2561B')}
        {legs('fx-leg-a', 84, 5.5, '#D2561B')}
      </svg>
    );
  }

  // sit
  return (
    <svg viewBox="0 0 120 120" className={`nx-fox pose-sit ${className ?? ''}`} aria-hidden="true">
      {Defs}
      <ellipse cx="62" cy="112.5" rx="40" ry="3.2" fill="#000" opacity=".45" />
      <g className="fx-tail-sit" style={{ transformOrigin: '44px 104px' }}>
        <path d="M40 98 C 26 98, 18 108, 30 113 C 44 118, 76 116, 90 110 C 96 107, 94 102, 88 103 C 74 106, 56 106, 46 102 Z" fill={F} />
        <path d="M80 105 C 86 103, 94 102, 92 108 C 90 112, 84 113, 78 112 C 80 110, 80 107, 80 105 Z" fill={CREAM} />
      </g>
      <g className="fx-breathe" style={{ transformOrigin: '54px 104px' }}>
        <path d="M38 104 C 30 86, 34 62, 50 52 C 60 46, 70 50, 72 62 C 74 76, 72 92, 70 104 Z" fill={F} />
        <path d="M38 104 C 34 92, 40 80, 50 80 C 58 82, 60 96, 56 104 Z" fill="#7E2F10" opacity=".35" />
        <path d="M62 54 C 70 58, 74 70, 72 84 C 66 78, 62 66, 58 58 Z" fill={CREAM} />
        <path d="M54 38 C 44 50, 36 66, 36 86" fill="none" stroke={VIOLET} strokeWidth="1.1" strokeLinecap="round" opacity=".85" filter={G} />
      </g>
      <path d="M56 84 L 56 106 L 61 106 L 61 84 Z" fill="#B44814" /><rect x="56" y="99" width="5" height="7" rx="1.5" fill={DARK} />
      <path d="M63 80 L 63 106 L 68 106 L 68 80 Z" fill="#D2561B" /><rect x="63" y="99" width="5.5" height="7" rx="1.5" fill={DARK} />
      <g className="fx-head" style={{ transformOrigin: '62px 50px', transform: `rotate(${mood === 'howl' ? -26 : mood === 'eat' ? 12 : lx * 2.5}deg)` }}>
        <path d="M54 35 L 50 17 L 62 31 Z" fill="#B44814" />
        <path d="M50 46 C 50 34, 58 28, 68 28 C 74 28, 80 31, 86 36 L 98 42 C 100 44, 99 46, 96 46 L 84 48 C 78 54, 70 56, 62 54 C 56 53, 51 51, 50 46 Z" fill={F} />
        <path d="M74 44 L 96 45 C 90 50, 82 54, 72 54 C 70 51, 71 47, 74 44 Z" fill={CREAM} />
        <g className="fx-ear" style={{ transformOrigin: '66px 30px' }}>
          <path d="M62 31 L 64 12 L 74 30 Z" fill="#E06A24" /><path d="M64.5 27 L 65.5 17 L 70 28 Z" fill={DARK} />
        </g>
        {mood === 'happy' || mood === 'love' || mood === 'eat'
          ? <path d="M75.2 39 q 2.8 -3.2 5.6 0" stroke={DARK} strokeWidth="1.5" fill="none" strokeLinecap="round" />
          : mood === 'dizzy'
            ? <g stroke={DARK} strokeWidth="1.2" strokeLinecap="round"><path d="M76 36 l 4 4 M80 36 l -4 4" /></g>
            : mood === 'howl'
              ? <path d="M75.5 38.5 q 2.5 1.6 5 0" stroke={DARK} strokeWidth="1.4" fill="none" strokeLinecap="round" />
              : <g className="fx-blink" style={{ transformOrigin: '78px 38px' }}>
                  <ellipse cx="78" cy="38" rx={mood === 'surprised' ? 3.4 : 2.6} ry={mood === 'surprised' ? 3 : mood === 'angry' ? 1.3 : 2} fill="#FFE2B8" filter={G} />
                  <circle cx={78.6 + lx} cy={38 + ly * 0.6} r={mood === 'surprised' ? 0.9 : 1.1} fill={DARK} />
                </g>}
        {mood === 'angry' && <path d="M73.5 33.2 L 82 35.6" stroke={DARK} strokeWidth="1.6" strokeLinecap="round" />}
        {mood === 'love' && <ellipse cx="76" cy="45.5" rx="3.2" ry="1.6" fill="#FF6FA8" opacity=".55" />}
        {(mood === 'howl' || mood === 'surprised') && <ellipse cx="90" cy="49" rx={mood === 'howl' ? 2.8 : 1.6} ry={mood === 'howl' ? 2.4 : 1.3} fill={DARK} />}
        {mood === 'eat' && <path d="M86 48.5 q 3 2.2 6 0" stroke={DARK} strokeWidth="1.2" fill="none" strokeLinecap="round" />}
        <circle cx="97" cy="43.6" r="1.8" fill={DARK} />
      </g>
    </svg>
  );
}

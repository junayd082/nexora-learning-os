'use client';

import { Defs, FrontEyes, Joint, Shadow, Zzz, svgClass, useIds, type FormProps } from './parts';

/**
 * CORA — the crab of Sand & Sea. Faces the viewer and walks sideways (never flips).
 * Coral shell plating, aqua visor seam, eyes on stalks, two big claws (.fm-claw-l / .fm-claw-r)
 * that wave, snap and pinch; three jointed legs a side (.fx-leg-a / .fx-leg-b) for the scuttle.
 */
const C = { shell: ['#FF8A6E', '#E8573F', '#9E2E22'] as [string, string, string], dark: '#5E1A12', leg: '#C9452F', aqua: '#3FE0E0', coral: '#FF6F59', iris: '#3FE0E0' };

function Claw({ side, raised }: { side: 'l' | 'r'; raised: boolean }) {
  const m = side === 'r' ? 'translate(120 0) scale(-1 1)' : undefined;
  return (
    <g transform={m}>
      <g className={`fm-claw fm-claw-${side}`} style={{ transformOrigin: '34px 84px', transform: raised ? 'rotate(28deg)' : undefined }}>
        <path d="M34 84 L 24 76" stroke={C.leg} strokeWidth="4" strokeLinecap="round" />
        <circle cx="24" cy="76" r="2.2" fill={C.dark} />
        <path d="M24 76 L 18 66" stroke={C.leg} strokeWidth="4" strokeLinecap="round" />
        <g className="fm-pincer" style={{ transformOrigin: '18px 64px' }}>
          <path d="M9 62 C 6 52, 14 45, 21 49 C 24 51, 24 55, 21 57 L 17 56 C 17 60, 21 62, 24 61 C 22 67, 13 68, 9 62 Z" fill={C.coral} stroke={C.dark} strokeWidth=".8" />
          <path d="M12 54 C 14 51, 18 50, 20 52" stroke={C.aqua} strokeWidth=".9" fill="none" opacity=".85" />
        </g>
      </g>
    </g>
  );
}

function Legs({ walk, lie }: { walk: boolean; lie: boolean }) {
  const set = (side: 1 | -1) => {
    const mx = (x: number) => (side === 1 ? x : 120 - x);
    const legs = lie
      ? [[36, 98, 24, 106, 16, 112], [40, 100, 30, 108, 26, 112], [46, 101, 40, 108, 38, 112]]
      : [[34, 92, 22, 100, 18, 111], [38, 96, 30, 104, 28, 111], [44, 98, 40, 105, 38, 111]];
    return legs.map((l, i) => (
      <g key={`${side}${i}`} className={walk ? (i % 2 === (side === 1 ? 0 : 1) ? 'fx-leg-a' : 'fx-leg-b') : ''} style={{ transformOrigin: `${mx(l[0])}px ${l[1]}px` }}>
        <path d={`M${mx(l[0])} ${l[1]} L ${mx(l[2])} ${l[3]} L ${mx(l[4])} ${l[5]}`} stroke={C.leg} strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={mx(l[2])} cy={l[3]} r="1.1" fill={C.aqua} opacity=".8" />
      </g>
    ));
  };
  return <g>{set(1)}{set(-1)}</g>;
}

export function Crab({ pose, look = [0, 0], sleeping = false, mood = 'normal', className }: FormProps) {
  const ids = useIds();
  const F = `url(#${ids.body})`;
  const G = `url(#${ids.glow})`;
  const lie = pose === 'lie';
  const walk = pose === 'walk';
  const up = pose === 'stand' || mood === 'surprised' || mood === 'happy';
  const dy = lie ? 8 : 0;
  const eyeY = lie ? 64 : 52;
  return (
    <svg viewBox="0 0 120 120" className={svgClass('crab', pose, className)} aria-hidden="true">
      <Defs ids={ids} body={C.shell} core={[C.aqua, '#0E7F8F']} />
      <Shadow rx={lie ? 40 : 36} />
      <Legs walk={walk} lie={lie} />
      <g className={walk ? 'fx-bob' : 'fx-breathe'} transform={`translate(0 ${dy})`} style={{ transformOrigin: '60px 100px' }}>
        {/* eye stalks */}
        <g className="fm-stalks" style={{ transformOrigin: '60px 68px' }}>
          <path d={`M53 68 L 50 ${eyeY + 3}`} stroke={C.dark} strokeWidth="2.4" strokeLinecap="round" />
          <path d={`M67 68 L 70 ${eyeY + 3}`} stroke={C.dark} strokeWidth="2.4" strokeLinecap="round" />
          <FrontEyes x1={50} x2={70} y={eyeY} r={4.4} mood={mood} look={look} sleeping={sleeping} iris={C.iris} glow={ids.glow} ring={C.aqua} white="#FFF6EE" />
        </g>
        <path d="M30 88 C 30 72, 44 64, 60 64 C 76 64, 90 72, 90 88 C 90 96, 78 100, 60 100 C 42 100, 30 96, 30 88 Z" fill={F} />
        <path d="M38 79 C 48 71, 72 71, 82 79" stroke={C.dark} strokeWidth=".9" fill="none" opacity=".55" />
        <path d="M50 66 L 48 74 M70 66 L 72 74 M60 64 L 60 72" stroke={C.dark} strokeWidth=".7" opacity=".45" />
        <path className="fm-core" d="M42 86 C 50 90.5, 70 90.5, 78 86" stroke={C.aqua} strokeWidth="2.2" fill="none" filter={G} strokeLinecap="round" />
        <Joint x={36} y={86} c={C.aqua} g={ids.glow} /><Joint x={84} y={86} c={C.aqua} g={ids.glow} />
        {mood === 'howl' || mood === 'surprised'
          ? <ellipse cx="60" cy="95" rx="2.6" ry="2" fill={C.dark} />
          : mood === 'happy' || mood === 'love' || mood === 'eat'
            ? <path d="M55 94 q 5 4 10 0" stroke={C.dark} strokeWidth="1.4" fill="none" strokeLinecap="round" />
            : mood === 'angry' ? <path d="M55 96 q 5 -3 10 0" stroke={C.dark} strokeWidth="1.4" fill="none" strokeLinecap="round" />
              : <path d="M56 95 L 64 95" stroke={C.dark} strokeWidth="1.3" strokeLinecap="round" />}
        {mood === 'love' && <><ellipse cx="44" cy="92" rx="3.2" ry="1.6" fill="#FF6FA8" opacity=".6" /><ellipse cx="76" cy="92" rx="3.2" ry="1.6" fill="#FF6FA8" opacity=".6" /></>}
      </g>
      <g transform={`translate(0 ${dy})`}>
        <Claw side="l" raised={up && !lie} />
        <Claw side="r" raised={up && !lie} />
      </g>
      <Zzz x={80} y={50} c={C.aqua} show={sleeping} />
    </svg>
  );
}

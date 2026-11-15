'use client';

import { Defs, FrontEyes, Joint, Shadow, Zzz, svgClass, useIds, type FormProps } from './parts';

/**
 * MAPLE — the owl of Autumn Drift. Perches facing the viewer; flies (glides) between perches.
 * Big amber eyes in a cream face disc, ear tufts (.fx-ear), wings (.fm-wing-a / .fm-wing-b),
 * chevron chest plating, amber core. Signature gestures: hoot (chest puffs), head swivel.
 */
const O = { body: ['#B07A4A', '#8A5A33', '#4E3019'] as [string, string, string], disc: '#EFD3A6', dark: '#2A170B', beak: '#F0A43C', amber: '#FFB347', rust: '#C8642B', iris: '#FFB347' };

function Wing({ side, pose }: { side: 'a' | 'b'; pose: FormProps['pose'] }) {
  const m = side === 'b' ? 'translate(120 0) scale(-1 1)' : undefined;
  const open = pose === 'walk';
  const half = pose === 'stand';
  return (
    <g transform={m}>
      <g className={`fm-wing-${side}`} style={{ transformOrigin: '40px 70px' }}>
        {open
          ? <path d="M40 66 C 26 52, 10 50, 0 58 C 8 60, 10 64, 4 68 C 12 68, 14 72, 9 76 C 20 76, 30 78, 40 82 Z" fill={`url(#owlwing)`} stroke={O.dark} strokeWidth=".7" />
          : <path d="M38 70 C 28 80, 30 98, 41 106 C 43 94, 43 82, 41 70 Z" fill={O.rust} stroke={O.dark} strokeWidth=".7" transform={half ? 'rotate(32 40 70)' : undefined} />}
        <path d={open ? 'M30 62 C 22 60, 14 60, 8 62 M32 70 C 24 68, 16 68, 10 70' : 'M35 82 C 33 88, 34 96, 38 102'} stroke={O.amber} strokeWidth=".8" fill="none" opacity=".75" transform={!open && half ? 'rotate(32 40 70)' : undefined} />
      </g>
    </g>
  );
}

export function Owl({ pose, look = [0, 0], sleeping = false, mood = 'normal', className }: FormProps) {
  const ids = useIds();
  const F = `url(#${ids.body})`;
  const G = `url(#${ids.glow})`;
  const fly = pose === 'walk';
  const lie = pose === 'lie';
  const dy = fly ? -22 : 0;
  const puff = mood === 'howl';
  return (
    <svg viewBox="0 0 120 120" className={svgClass('owl', pose, className)} aria-hidden="true">
      <Defs ids={ids} body={O.body} core={[O.amber, O.rust]} />
      <defs><linearGradient id="owlwing" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#7A4522" /><stop offset="1" stopColor={O.rust} /></linearGradient></defs>
      <Shadow rx={fly ? 18 : 30} o={fly ? 0.25 : 0.45} />
      <g className={fly ? 'fm-glide' : 'fx-breathe'} style={{ transformOrigin: '60px 108px' }}>
        <g transform={`translate(0 ${dy}) ${lie ? 'translate(60 110) scale(1.08 .9) translate(-60 -110)' : ''}`}>
          <Wing side="a" pose={pose} />
          <Wing side="b" pose={pose} />
          {/* talons */}
          {!fly && <path d="M50 106 L 50 111 M47 111 L 53 111 M70 106 L 70 111 M67 111 L 73 111" stroke={O.beak} strokeWidth="2" strokeLinecap="round" />}
          {fly && <path d="M54 104 L 54 108 M66 104 L 66 108" stroke={O.beak} strokeWidth="2" strokeLinecap="round" />}
          {/* body */}
          <path className="fm-chest" style={{ transformOrigin: '60px 96px', transform: puff ? 'scale(1.06)' : undefined }}
            d="M60 50 C 80 50, 88 68, 86 86 C 84 102, 74 108, 60 108 C 46 108, 36 102, 34 86 C 32 68, 40 50, 60 50 Z" fill={F} />
          <path d="M50 88 l 4 3 l 4 -3 M62 88 l 4 3 l 4 -3 M56 96 l 4 3 l 4 -3" stroke={O.disc} strokeWidth="1" fill="none" opacity=".7" />
          <path d="M44 62 C 50 56, 70 56, 76 62" stroke={O.amber} strokeWidth="1" fill="none" opacity=".8" filter={G} />
          <path className="fm-core" d="M60 99 l 3 3 l -3 3 l -3 -3 Z" fill={`url(#${ids.core})`} filter={G} />
          {/* head: tufts, face disc, eyes, beak */}
          <g className="fx-head fm-owl-head" style={{ transformOrigin: '60px 72px' }}>
            <g className="fx-ear" style={{ transformOrigin: '46px 54px' }}><path d={lie ? 'M44 58 L 36 52 L 50 54 Z' : 'M44 56 L 37 41 L 51 51 Z'} fill={O.rust} /></g>
            <g className="fx-ear" style={{ transformOrigin: '74px 54px' }}><path d={lie ? 'M76 58 L 84 52 L 70 54 Z' : 'M76 56 L 83 41 L 69 51 Z'} fill={O.rust} /></g>
            <circle cx="51" cy="68" r="11.5" fill={O.disc} /><circle cx="69" cy="68" r="11.5" fill={O.disc} />
            <path d="M40 68 C 42 60, 48 57, 51 57 M80 68 C 78 60, 72 57, 69 57" stroke={O.rust} strokeWidth="1" fill="none" opacity=".6" />
            <FrontEyes x1={51} x2={69} y={68} r={6.2} mood={mood} look={look} sleeping={sleeping} iris={O.iris} glow={ids.glow} white="#FFF3DC" ring={O.amber} />
            <path d={puff || mood === 'surprised' || mood === 'eat' ? 'M56.5 74 L 63.5 74 L 60 81 Z M58 78 L 62 78' : 'M57 74 L 63 74 L 60 80 Z'} fill={O.beak} stroke={O.dark} strokeWidth=".5" />
            {mood === 'love' && <><ellipse cx="44" cy="76" rx="3" ry="1.5" fill="#FF6FA8" opacity=".55" /><ellipse cx="76" cy="76" rx="3" ry="1.5" fill="#FF6FA8" opacity=".55" /></>}
            <Joint x={60} y={60} r={1.2} c={O.amber} g={ids.glow} />
          </g>
        </g>
      </g>
      <Zzz x={84} y={48} c={O.amber} show={sleeping} />
    </svg>
  );
}

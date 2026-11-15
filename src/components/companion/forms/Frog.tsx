'use client';

import { Defs, FrontEyes, Joint, Shadow, Zzz, svgClass, useIds, type FormProps } from './parts';

/**
 * RAIN — the frog of Rain on Glass. Squats facing the viewer and travels in hops.
 * Eye domes with teal rings, a throat sac (.fm-sac) that inflates to croak,
 * a tongue (.fm-tongue) that flicks out for flies and treats, folded spring legs.
 */
const R = { body: ['#5BD6B0', '#2FA58A', '#16624F'] as [string, string, string], belly: '#C9F2E2', dark: '#0B2E26', teal: '#35E0B8', iris: '#E9FF8A', tongue: '#FF6F8A' };

export function Frog({ pose, look = [0, 0], sleeping = false, mood = 'normal', className }: FormProps) {
  const ids = useIds();
  const F = `url(#${ids.body})`;
  const G = `url(#${ids.glow})`;
  const jump = pose === 'walk';
  const lie = pose === 'lie';
  const tall = pose === 'stand';
  const t = lie ? 'translate(60 112) scale(1.1 .8) translate(-60 -112)' : jump ? 'translate(0 -10) translate(60 100) scale(.94 1.08) translate(-60 -100)' : tall ? 'translate(60 112) scale(.97 1.06) translate(-60 -112)' : '';
  const croak = mood === 'howl';
  return (
    <svg viewBox="0 0 120 120" className={svgClass('frog', pose, className)} aria-hidden="true">
      <Defs ids={ids} body={R.body} core={[R.teal, '#0E7F6A']} />
      <Shadow rx={jump ? 28 : 36} o={jump ? 0.3 : 0.45} />
      <g className={jump ? '' : 'fx-breathe'} style={{ transformOrigin: '60px 110px' }}>
        <g transform={t}>
          {/* back legs */}
          {jump
            ? <g fill={F} stroke={R.dark} strokeWidth=".7">
                <path d="M38 96 C 30 102, 22 108, 14 112 L 22 112 C 30 108, 38 104, 44 100 Z" /><path d="M82 96 C 90 102, 98 108, 106 112 L 98 112 C 90 108, 82 104, 76 100 Z" />
              </g>
            : <g>
                <path d="M32 104 C 20 100, 20 86, 32 84 C 38 90, 40 100, 42 108 Z" fill={F} stroke={R.dark} strokeWidth=".7" />
                <path d="M88 104 C 100 100, 100 86, 88 84 C 82 90, 80 100, 78 108 Z" fill={F} stroke={R.dark} strokeWidth=".7" />
                <path d="M18 111 L 36 111 M84 111 L 102 111" stroke={R.dark} strokeWidth="2.4" strokeLinecap="round" />
                <Joint x={29} y={94} r={1.2} c={R.teal} g={ids.glow} /><Joint x={91} y={94} r={1.2} c={R.teal} g={ids.glow} />
              </g>}
          {/* body */}
          <path d="M34 104 C 30 88, 40 74, 60 74 C 80 74, 90 88, 86 104 C 80 110, 40 110, 34 104 Z" fill={F} />
          <ellipse cx="60" cy="100" rx="17" ry="8" fill={R.belly} opacity=".85" />
          <ellipse className="fm-sac" cx="60" cy="97" rx={croak ? 12 : 8} ry={croak ? 8 : 4.5} fill={R.belly} stroke={R.teal} strokeWidth=".8" style={{ transformOrigin: '60px 97px' }} />
          <circle cx="44" cy="96" r="1.6" fill={R.teal} filter={G} opacity=".9" /><circle cx="76" cy="96" r="1.6" fill={R.teal} filter={G} opacity=".9" />
          <path d="M42 84 C 50 80, 70 80, 78 84" stroke={R.teal} strokeWidth="1" fill="none" opacity=".75" filter={G} />
          {/* front legs */}
          <path d={jump ? 'M48 104 L 44 112 M72 104 L 76 112' : 'M48 102 L 47 111 M72 102 L 73 111'} stroke={R.dark} strokeWidth="2.8" strokeLinecap="round" />
          {/* eye domes */}
          <g className="fx-head" style={{ transformOrigin: '60px 80px' }}>
            <circle cx="46" cy="74" r="9.5" fill={F} /><circle cx="74" cy="74" r="9.5" fill={F} />
            <FrontEyes x1={46} x2={74} y={73} r={5.6} mood={mood} look={look} sleeping={sleeping} iris={R.iris} glow={ids.glow} ring={R.teal} white="#F2FFF8" />
            {/* mouth */}
            {mood === 'eat'
              ? <><path d="M48 89 C 54 93, 66 93, 72 89" stroke={R.dark} strokeWidth="1.3" fill="none" strokeLinecap="round" /><path className="fm-tongue" d="M60 91 C 60 96, 66 100, 72 98" stroke={R.tongue} strokeWidth="2.4" fill="none" strokeLinecap="round" /></>
              : mood === 'surprised' || croak
                ? <ellipse cx="60" cy="90" rx="3.6" ry="2.4" fill={R.dark} />
                : mood === 'angry'
                  ? <path d="M50 91 C 56 88, 64 88, 70 91" stroke={R.dark} strokeWidth="1.4" fill="none" strokeLinecap="round" />
                  : <path d="M46 88 C 54 93, 66 93, 74 88" stroke={R.dark} strokeWidth="1.4" fill="none" strokeLinecap="round" />}
            <path className="fm-tongue-flick" d="M60 90 C 64 78, 74 66, 88 60" stroke={R.tongue} strokeWidth="2.6" fill="none" strokeLinecap="round" pathLength={100} strokeDasharray="100" strokeDashoffset="100" />
            {mood === 'love' && <><ellipse cx="42" cy="86" rx="3.2" ry="1.6" fill="#FF6FA8" opacity=".6" /><ellipse cx="78" cy="86" rx="3.2" ry="1.6" fill="#FF6FA8" opacity=".6" /></>}
          </g>
        </g>
      </g>
      <Zzz x={84} y={66} c={R.teal} show={sleeping} />
    </svg>
  );
}

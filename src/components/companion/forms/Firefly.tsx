'use client';

import { Defs, Joint, Shadow, SideEye, Zzz, svgClass, useIds, type FormProps } from './parts';

/**
 * LUMI — the firefly of Firefly Meadow. Hovers above the dock (never walks); the lantern
 * abdomen (.fm-lantern) pulses yellow→lime, wings (.fm-wing-a / .fm-wing-b) beat, antennae
 * (.fm-antenna) twitch. Lands to sleep with wings folded and the lantern dimmed.
 */
const L = { body: ['#3E4566', '#262B45', '#151829'] as [string, string, string], yellow: '#FFE45C', lime: '#B8F04A', dark: '#0E1020', wing: 'rgba(214,240,255,.38)', wingEdge: 'rgba(255,255,255,.75)', iris: '#D8FF7A' };

export function Firefly({ pose, look = [0, 0], sleeping = false, mood = 'normal', className }: FormProps) {
  const ids = useIds();
  const F = `url(#${ids.body})`;
  const G = `url(#${ids.glow})`;
  const lie = pose === 'lie';
  const tilt = pose === 'walk' ? -10 : pose === 'stand' ? -4 : 0;
  const y = lie ? 36 : pose === 'stand' ? -6 : 0; // landed vs hovering
  const bright = mood === 'howl' || mood === 'happy' || mood === 'love' || pose === 'stand';
  return (
    <svg viewBox="0 0 120 120" className={svgClass('firefly', pose, className)} aria-hidden="true">
      <Defs ids={ids} body={L.body} core={[L.yellow, L.lime]} />
      <Shadow rx={lie ? 22 : 14} o={lie ? 0.4 : 0.22} />
      <g className={lie ? 'fx-breathe' : 'fm-hover'} style={{ transformOrigin: '60px 60px' }}>
        <g transform={`translate(0 ${y}) rotate(${tilt} 58 60) translate(58 64) scale(1.3) translate(-58 -64)`}>
          {/* far wing */}
          {lie
            ? <ellipse cx="52" cy="54" rx="16" ry="4" fill={L.wing} stroke={L.wingEdge} strokeWidth=".6" transform="rotate(8 52 54)" />
            : <g className="fm-wing-b" style={{ transformOrigin: '58px 52px' }}><ellipse cx="50" cy="44" rx="13" ry="6" fill={L.wing} stroke={L.wingEdge} strokeWidth=".6" transform="rotate(-28 50 44)" /></g>}
          {/* lantern abdomen */}
          <g className="fm-lantern" style={{ transformOrigin: '40px 62px', opacity: sleeping ? 0.5 : 1 }}>
            <ellipse cx="40" cy="62" rx={bright ? 17.5 : 16} ry={bright ? 13 : 12} fill={`url(#${ids.core})`} filter={G} />
            <path d="M33 51 C 30 58, 30 66, 33 73 M42 50 C 39 58, 39 66, 42 74" stroke={L.dark} strokeWidth="1.3" fill="none" opacity=".55" />
          </g>
          {/* thorax + head */}
          <ellipse cx="58" cy="58" rx="10.5" ry="9" fill={F} />
          <path d="M51 54 C 55 51, 61 51, 65 54" stroke={L.lime} strokeWidth=".9" fill="none" opacity=".8" filter={G} />
          <Joint x={58} y={63} r={1.2} c={L.lime} g={ids.glow} />
          <g className="fx-head" style={{ transformOrigin: '66px 56px' }}>
            <g className="fm-antenna" style={{ transformOrigin: '72px 48px' }}>
              <path d="M72 48 C 74 42, 78 38, 82 35 M69 48 C 69 42, 71 37, 73 34" stroke={L.dark} strokeWidth="1.3" fill="none" strokeLinecap="round" />
              <circle cx="82" cy="35" r="1.6" fill={L.lime} filter={G} /><circle cx="73" cy="34" r="1.4" fill={L.lime} filter={G} />
            </g>
            <circle cx="72" cy="55" r="8.2" fill={F} />
            <SideEye x={75.5} y={54} r={2.9} mood={mood} look={look} sleeping={sleeping} iris={L.iris} glow={ids.glow} />
            {(mood === 'surprised' || mood === 'eat') && <ellipse cx="79" cy="59.5" rx={mood === 'eat' ? 1.6 : 1.2} ry="1" fill={L.dark} />}
            {mood === 'love' && <ellipse cx="74" cy="59" rx="2.6" ry="1.3" fill="#FF6FA8" opacity=".6" />}
          </g>
          {/* legs */}
          <path d={lie ? 'M54 66 L 50 72 M58 67 L 58 73 M62 66 L 66 72' : 'M54 66 L 51 72 L 48 74 M58 67 L 57 73 M62 66 L 64 72 L 67 74'} stroke={L.dark} strokeWidth="1.2" fill="none" strokeLinecap="round" />
          {/* near wing */}
          {lie
            ? <ellipse cx="50" cy="52" rx="18" ry="4.5" fill={L.wing} stroke={L.wingEdge} strokeWidth=".7" transform="rotate(4 50 52)" />
            : <g className="fm-wing-a" style={{ transformOrigin: '60px 52px' }}><ellipse cx="54" cy="42" rx="15" ry="7" fill={L.wing} stroke={L.wingEdge} strokeWidth=".7" transform="rotate(-18 54 42)" /></g>}
        </g>
      </g>
      <Zzz x={78} y={84} c={L.lime} show={sleeping} />
    </svg>
  );
}

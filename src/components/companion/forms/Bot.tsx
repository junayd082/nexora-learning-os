'use client';

import { Defs, Joint, Shadow, svgClass, useIds, type FormProps } from './parts';

/**
 * GRID — the bot of Blueprint. Boxy, friendly, drafting-paper body. Its face is a screen:
 * expressions are drawn as glowing pixels. Arms (.fm-arm-l / .fm-arm-r) wave and measure,
 * an antenna (.fm-antenna) blinks, legs (.fx-leg-a / .fx-leg-b) march. Call = a beep;
 * trick = a robot dance; idle = it pulls out a tape measure (.fm-tape).
 */
const B = { body: ['#F4EEDF', '#DCD2BC', '#A99E86'] as [string, string, string], screen: '#0D2747', blue: '#5FB0FF', pale: '#BFE0FF', dark: '#2A2A2A', grid: 'rgba(95,176,255,.45)' };

function Face({ mood, look, sleeping, glow }: { mood: FormProps['mood']; look: [number, number]; sleeping?: boolean; glow: string }) {
  const [lx, ly] = look;
  const g = `url(#${glow})`;
  const px = 51 + lx * 1.6, py = 50 + ly * 1.4;
  const c = mood === 'angry' ? '#FF6A6A' : mood === 'love' ? '#FF8AC8' : B.blue;
  if (sleeping) return <g stroke={B.blue} strokeWidth="1.6" strokeLinecap="round" opacity=".7"><path d="M50 53 h 6 M64 53 h 6" /><text x="66" y="48" fontSize="6" fill={B.blue} stroke="none" fontFamily="monospace" className="fx-z">z</text></g>;
  if (mood === 'happy' || mood === 'eat') return <g stroke={c} strokeWidth="1.8" fill="none" strokeLinecap="round" filter={g}><path d="M50 54 l 3 -3 l 3 3 M64 54 l 3 -3 l 3 3" />{mood === 'eat' && <path d="M57 58 h 6" />}</g>;
  if (mood === 'love') return <g fill={c} filter={g}><path d="M53 55 l -3 -3 a 1.6 1.6 0 0 1 3 -2 a 1.6 1.6 0 0 1 3 2 Z" /><path d="M67 55 l -3 -3 a 1.6 1.6 0 0 1 3 -2 a 1.6 1.6 0 0 1 3 2 Z" /></g>;
  if (mood === 'dizzy') return <g stroke={c} strokeWidth="1.6" strokeLinecap="round" filter={g}><path d="M50 49 l 6 6 M56 49 l -6 6 M64 49 l 6 6 M70 49 l -6 6" /></g>;
  if (mood === 'howl') return <g fill={c} filter={g}><rect x="49" y="48" width="8" height="6" rx="1" /><rect x="63" y="48" width="8" height="6" rx="1" /><rect x="55" y="57" width="10" height="2.4" rx="1" /></g>;
  const big = mood === 'surprised';
  return (
    <g filter={g}>
      <g className="fx-blink" style={{ transformOrigin: '60px 52px' }}>
        <rect x={px - (big ? 1 : 0)} y={py - (big ? 1 : 0) + (mood === 'angry' ? 2 : 0)} width={big ? 7 : 5} height={mood === 'angry' ? 3 : big ? 7 : 5} rx="1" fill={c} />
        <rect x={px + 13 - (big ? 1 : 0)} y={py - (big ? 1 : 0) + (mood === 'angry' ? 2 : 0)} width={big ? 7 : 5} height={mood === 'angry' ? 3 : big ? 7 : 5} rx="1" fill={c} />
      </g>
      {mood === 'angry' && <path d="M49 48 l 7 2 M71 48 l -7 2" stroke={c} strokeWidth="1.3" strokeLinecap="round" />}
      {big && <rect x="58" y="58" width="4" height="2.6" rx="1" fill={c} />}
    </g>
  );
}

export function Bot({ pose, look = [0, 0], sleeping = false, mood = 'normal', className }: FormProps) {
  const ids = useIds();
  const F = `url(#${ids.body})`;
  const G = `url(#${ids.glow})`;
  const walk = pose === 'walk';
  const lie = pose === 'lie';
  const armsUp = pose === 'stand' || mood === 'happy';
  const dy = lie ? 10 : 0;
  const arm = (side: 'l' | 'r') => {
    const m = side === 'r' ? 'translate(120 0) scale(-1 1)' : undefined;
    return (
      <g transform={m}>
        <g className={`fm-arm fm-arm-${side} ${walk ? (side === 'l' ? 'fx-leg-b' : 'fx-leg-a') : ''}`} style={{ transformOrigin: '43px 74px', transform: armsUp ? 'rotate(150deg)' : undefined }}>
          <rect x="38" y="73" width="5" height="16" rx="2.5" fill={B.body[1]} stroke={B.dark} strokeWidth=".6" />
          <circle cx="40.5" cy="91" r="3" fill={B.body[0]} stroke={B.dark} strokeWidth=".6" />
          <circle cx="40.5" cy="81" r="1" fill={B.blue} filter={G} />
        </g>
      </g>
    );
  };
  return (
    <svg viewBox="0 0 120 120" className={svgClass('bot', pose, className)} aria-hidden="true">
      <Defs ids={ids} body={B.body} core={[B.blue, '#1E5FA8']} />
      <Shadow rx={30} />
      {/* legs */}
      {lie
        ? <g fill={B.body[2]} stroke={B.dark} strokeWidth=".6"><rect x="44" y="104" width="13" height="6" rx="2" /><rect x="63" y="104" width="13" height="6" rx="2" /></g>
        : <g>
            <g className={walk ? 'fx-leg-a' : ''} style={{ transformOrigin: '51px 96px' }}><rect x="48" y="95" width="6" height="12" rx="1.5" fill={B.body[2]} stroke={B.dark} strokeWidth=".6" /><rect x="46" y="106" width="10" height="5" rx="2" fill={B.dark} /></g>
            <g className={walk ? 'fx-leg-b' : ''} style={{ transformOrigin: '69px 96px' }}><rect x="66" y="95" width="6" height="12" rx="1.5" fill={B.body[2]} stroke={B.dark} strokeWidth=".6" /><rect x="64" y="106" width="10" height="5" rx="2" fill={B.dark} /></g>
          </g>}
      <g className={walk ? 'fx-bob' : 'fx-breathe'} style={{ transformOrigin: '60px 100px' }}>
        <g transform={`translate(0 ${dy})`}>
          {arm('l')}{arm('r')}
          {/* torso with blueprint grid */}
          <rect x="44" y="70" width="32" height="26" rx="5" fill={F} stroke={B.dark} strokeWidth=".7" />
          <g stroke={B.grid} strokeWidth=".5"><path d="M50 70 V 96 M56 70 V 96 M64 70 V 96 M70 70 V 96 M44 76 H 76 M44 82 H 76 M44 88 H 76" /></g>
          <rect className="fm-core" x="56" y="78" width="8" height="8" rx="1.5" fill={`url(#${ids.core})`} filter={G} />
          {/* tape measure (idle gesture) */}
          <g className="fm-tape" opacity="0">
            <rect x="74" y="84" width="7" height="7" rx="1.5" fill="#F0C040" stroke={B.dark} strokeWidth=".5" />
            <path d="M81 88 H 104" stroke="#F0C040" strokeWidth="2" /><path d="M86 87 v 2 M91 87 v 2 M96 87 v 2 M101 87 v 2" stroke={B.dark} strokeWidth=".5" />
          </g>
          {/* head */}
          <g className="fx-head" style={{ transformOrigin: '60px 68px' }}>
            <rect x="57" y="65" width="6" height="6" fill={B.body[2]} />
            <rect x="40" y="38" width="40" height="29" rx="6" fill={F} stroke={B.dark} strokeWidth=".7" />
            <rect x="45" y="43" width="30" height="19" rx="4" fill={B.screen} />
            <path d="M45 48 H 75 M45 53 H 75 M45 58 H 75 M52 43 V 62 M60 43 V 62 M68 43 V 62" stroke={B.blue} strokeWidth=".3" opacity=".25" />
            <Face mood={mood} look={look} sleeping={sleeping} glow={ids.glow} />
            <Joint x={42.5} y={52} r={1.3} c={B.blue} g={ids.glow} /><Joint x={77.5} y={52} r={1.3} c={B.blue} g={ids.glow} />
            <g className="fm-antenna" style={{ transformOrigin: '60px 38px' }}>
              <path d="M60 38 L 60 30" stroke={B.dark} strokeWidth="1.4" />
              <circle className="fm-beacon" cx="60" cy="29" r="2.2" fill={B.blue} filter={G} opacity={sleeping ? 0.4 : 1} />
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}

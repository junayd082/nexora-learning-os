'use client';

import { Defs, Joint, Shadow, Zzz, svgClass, useIds, type FormProps } from './parts';

/**
 * ORBIT — the drone of Deep Space. A hovering sphere with one lens "eye" (.fm-lens) that
 * tracks the pointer, two fins (.fm-fin-l / .fm-fin-r), an antenna beacon and a thruster
 * (.fm-thrust). Its call is a radar ping; its trick a barrel roll. Lands and powers down to sleep.
 */
const D = { body: ['#6A5BA8', '#3A3065', '#1A1433'] as [string, string, string], purple: '#8F6BFF', magenta: '#E04BFF', dark: '#0C0818', fin: '#4B3F86' };

function Lens({ mood, look, sleeping, glow }: { mood: FormProps['mood']; look: [number, number]; sleeping?: boolean; glow: string }) {
  const [lx, ly] = look;
  const cx = 60, cy = 56;
  if (sleeping) return <path d="M53 56 q 7 4 14 0" stroke={D.magenta} strokeWidth="1.6" fill="none" strokeLinecap="round" opacity=".6" />;
  if (mood === 'happy' || mood === 'love' || mood === 'eat')
    return <path d="M52.5 58 q 7.5 -8 15 0" stroke={mood === 'love' ? '#FF7AC8' : D.magenta} strokeWidth="2.4" fill="none" strokeLinecap="round" filter={`url(#${glow})`} />;
  if (mood === 'dizzy') return <path d="M56 52 a 4 4 0 1 1 -1 6 a 2.5 2.5 0 1 1 3 -3" stroke={D.magenta} strokeWidth="1.6" fill="none" strokeLinecap="round" />;
  const r = mood === 'surprised' || mood === 'howl' ? 8.5 : mood === 'angry' ? 7 : 7.5;
  return (
    <g className="fm-lens">
      <circle cx={cx} cy={cy} r={r} fill="#14082A" stroke={mood === 'angry' ? '#FF4A6A' : D.magenta} strokeWidth="1.4" filter={`url(#${glow})`} />
      <g className="fx-blink" style={{ transformOrigin: `${cx}px ${cy}px` }}>
        <circle cx={cx + lx * 2.4} cy={cy + ly * 2} r={mood === 'surprised' ? 2.2 : 3.2} fill={mood === 'angry' ? '#FF4A6A' : D.magenta} filter={`url(#${glow})`} />
        <circle cx={cx - 2.5 + lx * 2.4} cy={cy - 2.5 + ly * 2} r="1" fill="#fff" />
      </g>
      {mood === 'angry' && <path d="M51 47 L 69 50" stroke={D.dark} strokeWidth="2" strokeLinecap="round" />}
    </g>
  );
}

export function Drone({ pose, look = [0, 0], sleeping = false, mood = 'normal', className }: FormProps) {
  const ids = useIds();
  const F = `url(#${ids.body})`;
  const G = `url(#${ids.glow})`;
  const lie = pose === 'lie';
  const fly = pose === 'walk';
  const y = lie ? 40 : pose === 'stand' ? -6 : 0;
  const finRot = lie ? 34 : pose === 'stand' ? -18 : 0;
  return (
    <svg viewBox="0 0 120 120" className={svgClass('drone', pose, className)} aria-hidden="true">
      <Defs ids={ids} body={D.body} core={[D.magenta, D.purple]} />
      <Shadow rx={lie ? 26 : 16} o={lie ? 0.45 : 0.22} />
      <g className={lie ? '' : 'fm-hover'} style={{ transformOrigin: '60px 56px' }}>
        <g transform={`translate(0 ${y}) rotate(${fly ? 10 : 0} 60 56)`}>
          {/* thruster */}
          {!lie && <g className="fm-thrust" style={{ transformOrigin: '60px 74px' }}>
            <path d={`M55 72 L 65 72 L 60 ${fly ? 92 : 84} Z`} fill={D.magenta} opacity=".55" filter={G} />
            <path d="M57 72 L 63 72 L 60 80 Z" fill="#fff" opacity=".7" />
          </g>}
          {/* fins */}
          <g className="fm-fin-l" style={{ transformOrigin: '44px 58px', transform: `rotate(${-finRot}deg)` }}>
            <path d="M45 54 L 24 46 L 20 58 L 45 62 Z" fill={D.fin} stroke={D.purple} strokeWidth="1" />
            <path d="M24 47 L 21 57" stroke={D.magenta} strokeWidth="1.6" filter={G} />
          </g>
          <g className="fm-fin-r" style={{ transformOrigin: '76px 58px', transform: `rotate(${finRot}deg)` }}>
            <path d="M75 54 L 96 46 L 100 58 L 75 62 Z" fill={D.fin} stroke={D.purple} strokeWidth="1" />
            <path d="M96 47 L 99 57" stroke={D.magenta} strokeWidth="1.6" filter={G} />
          </g>
          {/* antenna beacon */}
          <g className="fm-antenna" style={{ transformOrigin: '60px 40px' }}>
            <path d="M60 41 L 60 32" stroke={D.purple} strokeWidth="1.6" strokeLinecap="round" />
            <circle className="fm-beacon" cx="60" cy="31" r="2" fill={D.magenta} filter={G} opacity={sleeping ? 0.35 : 1} />
          </g>
          {/* sphere */}
          <circle cx="60" cy="56" r="16" fill={F} />
          <path d="M44.5 52 C 50 49, 70 49, 75.5 52" stroke={D.purple} strokeWidth="1" fill="none" opacity=".8" />
          <path d="M45 62 C 52 66, 68 66, 75 62" stroke={D.dark} strokeWidth=".8" fill="none" opacity=".6" />
          <Joint x={46.5} y={58} r={1.2} c={D.magenta} g={ids.glow} /><Joint x={73.5} y={58} r={1.2} c={D.magenta} g={ids.glow} />
          <Lens mood={mood} look={look} sleeping={sleeping} glow={ids.glow} />
          {/* ping ring (shown during the call) */}
          <circle className="fm-ping" cx="60" cy="56" r="20" fill="none" stroke={D.magenta} strokeWidth="1.2" opacity="0" />
          {lie && <path d="M48 70 L 44 76 M72 70 L 76 76" stroke={D.purple} strokeWidth="2" strokeLinecap="round" />}
        </g>
      </g>
      <Zzz x={80} y={86} c={D.magenta} show={sleeping} />
    </svg>
  );
}

'use client';

import { Defs, Joint, Shadow, SideEye, Zzz, svgClass, useIds, type FormProps } from './parts';

/**
 * NEMO — the sea turtle of Under the Sea. Side view, facing right. Hex-plated shell with
 * ocean-blue seams and a glowing core, paddling flippers (.fm-flip-a / .fm-flip-b),
 * a neck that stretches or pulls into the shell (.fm-neck). Swims slowly; sleeps tucked in.
 */
const T = { shell: ['#3AA0D8', '#1E7FB8', '#0E4A70'] as [string, string, string], skin: '#5BC8E8', skinDark: '#2E8DB0', plate: '#BFE9F7', dark: '#06283D', blue: '#49C2FF', iris: '#E6FBFF' };

export function Turtle({ pose, look = [0, 0], sleeping = false, mood = 'normal', className }: FormProps) {
  const ids = useIds();
  const F = `url(#${ids.body})`;
  const G = `url(#${ids.glow})`;
  const swim = pose === 'walk';
  const lie = pose === 'lie';
  const up = pose === 'stand' || mood === 'howl';
  const lift = swim ? -8 : lie ? 2 : -2;
  const hex = (x: number, y: number, s = 6) => `M${x - s} ${y} l ${s / 2} ${-s * 0.85} h ${s} l ${s / 2} ${s * 0.85} l ${-s / 2} ${s * 0.85} h ${-s} Z`;
  return (
    <svg viewBox="0 0 120 120" className={svgClass('turtle', pose, className)} aria-hidden="true">
      <Defs ids={ids} body={T.shell} core={[T.blue, '#1257A0']} />
      <Shadow rx={swim ? 34 : 40} o={swim ? 0.3 : 0.45} />
      <g className={swim ? 'fm-swim' : 'fx-breathe'} style={{ transformOrigin: '60px 104px' }}>
        <g transform={`translate(0 ${lift})`}>
          {/* back flipper + tail */}
          <g className="fm-flip-b" style={{ transformOrigin: '40px 100px' }}>
            <path d="M40 100 C 32 104, 24 110, 28 112 C 36 113, 42 108, 44 103 Z" fill={T.skinDark} />
          </g>
          <path d="M28 98 L 20 101 L 28 102 Z" fill={T.skinDark} />
          {/* neck + head */}
          <g className="fm-neck fx-head" style={{ transformOrigin: '92px 94px', transform: lie ? 'translateX(-10px) scale(.85)' : up ? 'rotate(-14deg)' : swim ? 'translateX(3px)' : undefined }}>
            <path d="M88 96 C 94 94, 98 88, 102 84 L 108 90 C 104 94, 98 100, 92 101 Z" fill={T.skin} />
            <ellipse cx="108" cy="83" rx="9.5" ry="7.2" fill={T.skin} />
            <path d="M102 79 C 106 76, 112 76, 115 79" stroke={T.blue} strokeWidth=".9" fill="none" opacity=".8" filter={G} />
            <SideEye x={110.5} y={81} r={2.3} mood={mood} look={look} sleeping={sleeping || lie} iris={T.iris} glow={ids.glow} />
            {mood === 'howl' || mood === 'surprised'
              ? <ellipse cx="114.5" cy="86.5" rx="1.6" ry="1.3" fill={T.dark} />
              : mood === 'eat' ? <path d="M110 86 q 2.5 1.8 5 0" stroke={T.dark} strokeWidth="1.1" fill="none" />
                : <path d="M110 86.5 L 116 85.5" stroke={T.dark} strokeWidth="1" strokeLinecap="round" />}
            {mood === 'love' && <ellipse cx="107" cy="87" rx="2.6" ry="1.3" fill="#FF6FA8" opacity=".6" />}
          </g>
          {/* plastron + shell */}
          <path d="M26 96 L 98 96 C 96 102, 88 104, 80 104 L 40 104 C 32 104, 28 101, 26 96 Z" fill={T.plate} />
          <path d="M26 97 C 28 74, 44 63, 62 63 C 80 63, 94 74, 98 97 Z" fill={F} />
          <g stroke={T.blue} strokeWidth="1" fill="none" opacity=".8" filter={G}>
            <path d={hex(62, 78, 7)} /><path d={hex(46, 86, 6)} /><path d={hex(78, 86, 6)} />
          </g>
          <path d="M30 92 C 44 90, 80 90, 94 92" stroke={T.dark} strokeWidth=".7" fill="none" opacity=".5" />
          <circle className="fm-core" cx="62" cy="78" r="2.6" fill={`url(#${ids.core})`} filter={G} />
          <Joint x={40} y={95} r={1.1} c={T.blue} g={ids.glow} /><Joint x={84} y={95} r={1.1} c={T.blue} g={ids.glow} />
          {/* front flipper */}
          <g className="fm-flip-a" style={{ transformOrigin: '80px 100px' }}>
            <path d={lie ? 'M78 100 C 86 103, 92 106, 88 108 C 82 108, 78 105, 76 102 Z' : 'M78 99 C 90 103, 100 110, 94 112.5 C 84 113, 78 107, 75 102 Z'} fill={T.skin} />
            <path d="M84 104 C 88 106, 92 109, 94 111" stroke={T.blue} strokeWidth=".7" opacity=".7" fill="none" />
          </g>
        </g>
      </g>
      <Zzz x={92} y={66} c={T.blue} show={sleeping} />
    </svg>
  );
}

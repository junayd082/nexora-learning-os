'use client';

import { Defs, Joint, Shadow, SideEye, Blush, Zzz, svgClass, useIds, type FormProps } from './parts';

/**
 * Four-legged assistants that share Nova's skeleton but not her look:
 *  YUKI (husky)  — white/steel plating, curled tail carried over the back, dark cap, icy-blue seams.
 *  AURORA (wolf) — slate armour, long muzzle, heavy brush tail, cyan core and violet seam.
 *  ASH (cat)     — charcoal, round head, upright ears, long S-curve tail, ember-red eyes and seams.
 * The head is drawn once in "sit" space and placed in the other poses with a transform, so every
 * pose keeps the same face, eyes and moods.
 */
export type QuadKind = 'husky' | 'wolf' | 'cat';

const PAL = {
  husky: { body: ['#F4F7FB', '#C3CEDA', '#7F8C9C'] as [string, string, string], dark: '#3E4756', leg: '#AFBBC9', legFar: '#8794A4', belly: '#FFFFFF', ear: '#D5DDE7', inner: '#3E4756', seam: '#8FD8FF', seam2: '#E8F6FF', iris: '#BFF1FF', core: ['#8FD8FF', '#2C7FB8'] as [string, string] },
  wolf: { body: ['#5A6579', '#3A4354', '#1F2531'] as [string, string, string], dark: '#141922', leg: '#3A4354', legFar: '#2A313E', belly: '#8792A6', ear: '#4A5468', inner: '#141922', seam: '#4CE6F0', seam2: '#A06BFF', iris: '#9FF6FF', core: ['#4CE6F0', '#5B3FD0'] as [string, string] },
  cat: { body: ['#4A4242', '#2C2626', '#151212'] as [string, string, string], dark: '#0E0B0B', leg: '#2C2626', legFar: '#1E1A1A', belly: '#5A5050', ear: '#3A3333', inner: '#FF4A3D', seam: '#FF4A3D', seam2: '#FF8A3D', iris: '#FFB15C', core: ['#FF6A3D', '#B3140A'] as [string, string] },
};

function Head({ kind, mood, look, sleeping, ids }: { kind: QuadKind; mood: FormProps['mood']; look: [number, number]; sleeping?: boolean; ids: ReturnType<typeof useIds> }) {
  const p = PAL[kind];
  const F = `url(#${ids.body})`;
  const calling = mood === 'howl';
  if (kind === 'cat') {
    return (
      <g>
        <g className="fx-ear" style={{ transformOrigin: '58px 30px' }}><path d="M53 32 L 52 14 L 64 27 Z" fill={p.ear} /><path d="M55 28 L 55 19 L 61 26 Z" fill={p.inner} opacity=".8" /></g>
        <path d="M50 44 C 50 33, 57 27, 67 27 C 77 27, 85 33, 87 41 C 88 47, 84 52, 77 54 C 68 56, 58 55, 53 51 C 51 49, 50 47, 50 44 Z" fill={F} />
        <path d="M60 30 C 66 28, 74 29, 80 33" stroke={p.seam} strokeWidth="1" fill="none" opacity=".85" filter={`url(#${ids.glow})`} strokeLinecap="round" />
        <path d="M72 46 C 78 44, 85 44, 87 43 C 86 49, 81 52, 75 53 C 72 51, 71 48, 72 46 Z" fill={p.belly} opacity=".9" />
        <g className="fx-ear" style={{ transformOrigin: '72px 29px' }}><path d="M66 30 L 72 12 L 79 30 Z" fill={p.ear} /><path d="M69 27 L 72 17 L 76 28 Z" fill={p.inner} opacity=".9" /></g>
        <SideEye x={75} y={39} r={2.9} mood={mood} look={look} sleeping={sleeping} iris={p.iris} glow={ids.glow} />
        {!sleeping && mood !== 'happy' && mood !== 'love' && mood !== 'eat' && mood !== 'dizzy' && mood !== 'howl' &&
          <ellipse cx={75.4 + look[0] * 0.7} cy={39 + look[1] * 0.5} rx=".55" ry="1.6" fill="#0E0B0B" />}
        <path d="M86 42.5 l 1.6 1.2 l -1.8 .8 Z" fill={p.dark} />
        <path d="M84 46 l 9 -1.5 M84 47.5 l 9 1 M84 49 l 8 3" stroke={p.seam2} strokeWidth=".6" opacity=".55" />
        {calling ? <ellipse cx="84" cy="50" rx="1.8" ry="1.6" fill={p.dark} /> : mood === 'eat' ? <path d="M81 50 q 2.5 1.8 5 0" stroke={p.dark} strokeWidth="1.1" fill="none" /> : null}
        <Blush x={73} y={46} show={mood === 'love'} />
        <Joint x={56} y={46} r={1.3} c={p.seam} g={ids.glow} />
      </g>
    );
  }
  const wolf = kind === 'wolf';
  const head = wolf
    ? 'M50 46 C 50 33, 58 27, 68 27 C 75 27, 81 30, 87 35 L 101 41 C 103 43, 102 46, 99 46 L 86 49 C 79 55, 70 57, 62 55 C 56 54, 51 51, 50 46 Z'
    : 'M50 46 C 50 34, 58 28, 68 28 C 74 28, 80 31, 85 36 L 95 41 C 97 43, 97 46, 94 46 L 83 48 C 77 54, 70 56, 62 54 C 56 53, 51 51, 50 46 Z';
  const nose = wolf ? [100, 43.4] : [94.5, 43.6];
  return (
    <g>
      <path d={wolf ? 'M54 35 L 51 15 L 63 30 Z' : 'M54 35 L 51 17 L 62 31 Z'} fill={p.ear} />
      <path d={head} fill={F} />
      {kind === 'husky' && <path d="M51 42 C 53 32, 61 28, 69 28 C 76 28, 82 31, 86 36 L 79 38 C 73 34, 66 35, 61 41 C 58 44, 54 45, 51 42 Z" fill={p.dark} />}
      {wolf && <path d="M52 40 C 56 32, 64 29, 72 29 L 86 35 C 78 35, 70 36, 64 40 Z" fill={p.dark} opacity=".8" />}
      <path d={wolf ? 'M74 44 L 99 45.5 C 92 50, 83 54, 72 54 C 70 51, 71 47, 74 44 Z' : 'M74 44 L 93 45 C 88 50, 81 53, 72 53 C 70 51, 71 47, 74 44 Z'} fill={p.belly} />
      <path d="M58 33 C 66 30, 76 31, 84 36" stroke={p.seam} strokeWidth="1" fill="none" opacity=".85" filter={`url(#${ids.glow})`} strokeLinecap="round" />
      <g className="fx-ear" style={{ transformOrigin: '66px 30px' }}>
        <path d={wolf ? 'M61 31 L 64 10 L 75 30 Z' : 'M62 31 L 65 13 L 74 30 Z'} fill={p.ear} />
        <path d={wolf ? 'M64 27 L 65.5 15 L 71 28 Z' : 'M64.5 27 L 66 18 L 70.5 28 Z'} fill={p.inner} />
      </g>
      <SideEye x={77.5} y={38.5} r={2.5} mood={mood} look={look} sleeping={sleeping} iris={p.iris} glow={ids.glow} />
      <circle cx={nose[0]} cy={nose[1]} r="1.9" fill={p.dark} />
      {(calling || mood === 'surprised') && <ellipse cx={wolf ? 92 : 88} cy="49.5" rx={calling ? 2.8 : 1.6} ry={calling ? 2.4 : 1.3} fill={p.dark} />}
      {mood === 'eat' && <path d={`M${wolf ? 88 : 84} 49 q 3 2.2 6 0`} stroke={p.dark} strokeWidth="1.2" fill="none" strokeLinecap="round" />}
      <Blush x={76} y={45.5} show={mood === 'love'} />
      <Joint x={56} y={47} r={1.3} c={p.seam} g={ids.glow} />
    </g>
  );
}

function Tail({ kind, pose, F, p, glow }: { kind: QuadKind; pose: 'sit' | 'walk' | 'lie'; F: string; p: typeof PAL.husky; glow: string }) {
  if (kind === 'husky') {
    if (pose === 'sit') return <g className="fx-tail-sit fm-tail" style={{ transformOrigin: '40px 98px' }}>
      <path d="M40 100 C 26 100, 20 88, 26 80 C 30 74, 38 76, 36 82 C 34 88, 38 92, 44 94 Z" fill={F} /><path d="M26 80 C 30 74, 38 76, 36 82 C 33 82, 29 81, 26 80 Z" fill={p.belly} /></g>;
    if (pose === 'walk') return <g className="fx-tail-walk fm-tail" style={{ transformOrigin: '34px 76px' }}>
      <path d="M34 78 C 26 72, 26 58, 36 56 C 44 55, 46 63, 40 64 C 36 64, 36 70, 40 74 Z" fill={F} /><path d="M36 56 C 44 55, 46 63, 40 64 C 39 61, 38 58, 36 56 Z" fill={p.belly} /></g>;
    return <path className="fx-tail-lie" d="M26 104 C 18 102, 16 94, 22 90 C 28 87, 32 92, 28 96 C 30 100, 40 104, 54 106 L 52 110 C 40 110, 30 108, 26 104 Z" fill={F} />;
  }
  if (kind === 'wolf') {
    if (pose === 'sit') return <g className="fx-tail-sit fm-tail" style={{ transformOrigin: '42px 102px' }}>
      <path d="M42 100 C 28 102, 18 108, 24 113 C 36 117, 66 116, 84 112 C 90 110, 88 104, 82 105 C 68 108, 54 106, 46 103 Z" fill={F} /><path d="M24 113 C 20 110, 22 106, 28 105 C 28 108, 28 111, 30 113 Z" fill={p.belly} /></g>;
    if (pose === 'walk') return <g className="fx-tail-walk fm-tail" style={{ transformOrigin: '32px 78px' }}>
      <path d="M33 78 C 22 80, 10 86, 6 96 C 5 99, 9 100, 11 97 C 16 90, 24 86, 34 84 Z" fill={F} /><path d="M6 96 C 5 99, 9 100, 11 97 C 10 95, 8 94, 6 96 Z" fill={p.seam} opacity=".8" filter={`url(#${glow})`} /></g>;
    return <path className="fx-tail-lie" d="M24 108 C 10 108, 4 100, 12 94 C 16 92, 20 95, 18 98 C 18 103, 30 106, 50 107 L 78 107 C 82 108, 82 112, 76 113 L 38 113 C 30 113, 26 111, 24 108 Z" fill={F} />;
  }
  // cat
  if (pose === 'sit') return <g className="fx-tail-sit fm-tail" style={{ transformOrigin: '40px 104px' }}>
    <path d="M40 104 C 30 106, 24 100, 26 92 C 28 84, 22 78, 18 80" stroke={F} strokeWidth="4.5" fill="none" strokeLinecap="round" />
    <circle cx="18" cy="80" r="2" fill={p.seam} filter={`url(#${glow})`} /></g>;
  if (pose === 'walk') return <g className="fx-tail-walk fm-tail" style={{ transformOrigin: '32px 78px' }}>
    <path d="M32 78 C 22 74, 18 62, 22 52 C 24 46, 30 44, 32 48" stroke={F} strokeWidth="4.2" fill="none" strokeLinecap="round" />
    <circle cx="32" cy="48" r="1.9" fill={p.seam} filter={`url(#${glow})`} /></g>;
  return <path className="fx-tail-lie" d="M30 108 C 18 108, 12 104, 14 98 C 15 95, 19 95, 19 98 C 19 102, 26 104, 40 105" stroke={F} strokeWidth="4" fill="none" strokeLinecap="round" />;
}

export function Quad({ kind, pose, look = [0, 0], sleeping = false, mood = 'normal', className }: FormProps & { kind: QuadKind }) {
  const ids = useIds();
  const p = PAL[kind];
  const F = `url(#${ids.body})`;
  const G = `url(#${ids.glow})`;
  const [lx] = look;
  const defs = <Defs ids={ids} body={p.body} core={p.core} />;
  const head = <Head kind={kind} mood={mood} look={look} sleeping={sleeping} ids={ids} />;
  const core = (x: number, y: number, r = 2.4) => <circle className="fm-core" cx={x} cy={y} r={r} fill={`url(#${ids.core})`} filter={G} />;

  if (pose === 'lie') {
    return (
      <svg viewBox="0 0 120 120" className={svgClass(kind, 'lie', className)} aria-hidden="true">
        {defs}<Shadow cx={62} rx={46} />
        <Tail kind={kind} pose="lie" F={F} p={p} glow={ids.glow} />
        <g className="fx-breathe">
          <path d="M22 112 C 20 98, 36 88, 60 88 C 80 88, 92 96, 94 108 L 94 112 Z" fill={F} />
          <path d="M30 92 C 44 86, 66 86, 80 92" fill="none" stroke={p.seam} strokeWidth="1.1" opacity=".85" filter={G} strokeLinecap="round" />
          {core(52, 100, 2)}
        </g>
        <rect x="76" y="106" width="22" height="5" rx="2.5" fill={p.leg} />
        <g transform="translate(40 59) scale(.8)">{head}</g>
        <Zzz x={96} y={74} c={p.seam} show={sleeping} />
      </svg>
    );
  }

  if (pose === 'walk' || pose === 'stand') {
    const leg = (cls: string, x: number, w: number, fill: string) => (
      <g className={pose === 'walk' ? cls : ''}>
        <rect x={x} y="88" width={w} height="22" rx="2" fill={fill} />
        <circle cx={x + w / 2} cy="98" r="1.1" fill={p.seam} opacity=".8" />
        <rect x={x - 0.5} y="105" width={w + 1} height="5" rx="1.5" fill={p.dark} />
      </g>
    );
    const lean = kind === 'wolf' ? 'translate(0 2)' : kind === 'cat' ? 'translate(0 1)' : '';
    return (
      <svg viewBox="0 0 120 120" className={svgClass(kind, pose, className)} aria-hidden="true">
        {defs}<Shadow rx={42} />
        {leg('fx-leg-a', 38, 5, p.legFar)}
        {leg('fx-leg-b', 78, 5, p.legFar)}
        <g className="fx-bob" transform={lean}>
          <Tail kind={kind} pose="walk" F={F} p={p} glow={ids.glow} />
          <path d={kind === 'cat' ? 'M30 84 C 30 74, 50 70, 74 72 C 86 73, 90 78, 90 85 C 90 92, 82 95, 72 95 L 40 95 C 32 94, 29 89, 30 84 Z' : 'M30 82 C 32 72, 52 68, 76 70 C 86 71, 92 76, 92 84 C 92 92, 84 95, 74 95 L 40 95 C 32 94, 28 88, 30 82 Z'} fill={F} />
          <path d="M36 74 C 50 69, 66 69, 80 72" fill="none" stroke={p.seam} strokeWidth="1.1" opacity=".85" filter={G} strokeLinecap="round" />
          <path d="M48 76 L 48 92 M64 75 L 64 93" stroke={p.dark} strokeWidth=".6" opacity=".45" />
          <path d="M78 82 C 86 80, 92 84, 90 92 C 84 93, 78 90, 78 82 Z" fill={p.belly} />
          {core(84, 86, 2.2)}
          <g transform={`translate(38 25) scale(.8) ${pose === 'stand' ? 'rotate(-4 70 40)' : ''}`}>
            <g className="fx-head" style={{ transformOrigin: '56px 50px', transform: `rotate(${mood === 'howl' ? (kind === 'cat' ? -10 : -24) : 0}deg)` }}>{head}</g>
          </g>
        </g>
        {leg('fx-leg-b', 44, 5.5, p.leg)}
        {leg('fx-leg-a', 84, 5.5, p.leg)}
      </svg>
    );
  }

  // sit
  return (
    <svg viewBox="0 0 120 120" className={svgClass(kind, 'sit', className)} aria-hidden="true">
      {defs}<Shadow cx={62} rx={40} />
      <Tail kind={kind} pose="sit" F={F} p={p} glow={ids.glow} />
      <g className="fx-breathe" style={{ transformOrigin: '54px 104px' }}>
        <path d={kind === 'cat' ? 'M40 104 C 32 88, 36 64, 50 55 C 59 49, 69 53, 70 64 C 72 78, 70 92, 68 104 Z' : 'M38 104 C 30 86, 34 62, 50 52 C 60 46, 70 50, 72 62 C 74 76, 72 92, 70 104 Z'} fill={F} />
        <path d="M38 104 C 34 92, 40 80, 50 80 C 58 82, 60 96, 56 104 Z" fill={p.dark} opacity=".3" />
        <path d="M62 54 C 70 58, 74 70, 72 84 C 66 78, 62 66, 58 58 Z" fill={p.belly} />
        <path d="M54 40 C 44 52, 36 66, 36 86" fill="none" stroke={p.seam} strokeWidth="1.1" strokeLinecap="round" opacity=".85" filter={G} />
        <path d="M46 70 C 50 72, 54 72, 58 70" stroke={p.dark} strokeWidth=".6" opacity=".45" fill="none" />
        {core(66, 72, 2.4)}
      </g>
      <path d="M56 84 L 56 106 L 61 106 L 61 84 Z" fill={p.legFar} /><rect x="55.5" y="100" width="6" height="6" rx="1.5" fill={p.dark} />
      <path d="M63 80 L 63 106 L 68 106 L 68 80 Z" fill={p.leg} /><rect x="62.5" y="100" width="6.5" height="6" rx="1.5" fill={p.dark} />
      <Joint x={65.5} y={92} r={1.1} c={p.seam} g={ids.glow} />
      <g className="fx-head" style={{ transformOrigin: '62px 50px', transform: `rotate(${mood === 'howl' ? (kind === 'cat' ? -10 : -26) : mood === 'eat' ? 12 : lx * 2.5}deg)` }}>{head}</g>
      <Zzz x={80} y={22} c={p.seam} show={sleeping} />
    </svg>
  );
}

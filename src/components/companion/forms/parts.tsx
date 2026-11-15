'use client';

import { useId } from 'react';
import type { FoxMood, FoxPose } from '../Fox';

export type FormPose = FoxPose;
export type FormMood = FoxMood;
export interface FormProps { pose: FormPose; look?: [number, number]; sleeping?: boolean; mood?: FormMood; className?: string }

/** Unique ids for gradients/filters (several assistants can be on screen, e.g. in Settings). */
export function useIds() {
  const u = useId().replace(/[^a-zA-Z0-9]/g, '');
  return { body: `fb${u}`, glow: `fg${u}`, core: `fc${u}`, alt: `fa${u}` };
}

/** Shared <defs>: body gradient, soft glow filter, core radial gradient. */
export function Defs({ ids, body, core }: { ids: ReturnType<typeof useIds>; body: [string, string, string]; core: [string, string] }) {
  return (
    <defs>
      <linearGradient id={ids.body} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={body[0]} /><stop offset=".55" stopColor={body[1]} /><stop offset="1" stopColor={body[2]} />
      </linearGradient>
      <radialGradient id={ids.core} cx=".5" cy=".45" r=".6">
        <stop offset="0" stopColor="#FFFFFF" stopOpacity=".95" /><stop offset=".35" stopColor={core[0]} /><stop offset="1" stopColor={core[1]} />
      </radialGradient>
      <filter id={ids.glow} x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur stdDeviation="1.4" result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
    </defs>
  );
}

export const Shadow = ({ cx = 60, rx = 38, o = 0.45 }: { cx?: number; rx?: number; o?: number }) =>
  <ellipse className="fm-shadow" cx={cx} cy="112.5" rx={rx} ry="3.2" fill="#000" opacity={o} />;

/** A glowing joint / bolt: the "mechanical" detail every assistant shares. */
export const Joint = ({ x, y, r = 1.6, c, g }: { x: number; y: number; r?: number; c: string; g: string }) =>
  <circle cx={x} cy={y} r={r} fill={c} filter={`url(#${g})`} opacity=".9" />;

const DARK = '#14110F';

/**
 * One eye seen from the side (fox, husky, wolf, cat, firefly, turtle).
 * Moods: happy/love/eat = smiling arc, dizzy = ×, howl (the species call) = content closed arc,
 * surprised = wide, angry = squint + brow, sleeping = closed.
 */
export function SideEye({ x, y, r = 2.4, mood = 'normal', look = [0, 0], sleeping, iris, glow, brow = true }:
  { x: number; y: number; r?: number; mood?: FormMood; look?: [number, number]; sleeping?: boolean; iris: string; glow: string; brow?: boolean }) {
  const [lx, ly] = look;
  if (sleeping) return <path d={`M${x - r} ${y} q ${r} ${r * 0.9} ${r * 2} 0`} stroke={DARK} strokeWidth="1.3" fill="none" strokeLinecap="round" />;
  if (mood === 'happy' || mood === 'love' || mood === 'eat')
    return <path d={`M${x - r * 1.1} ${y + 0.6} q ${r * 1.1} ${-r * 1.4} ${r * 2.2} 0`} stroke={DARK} strokeWidth="1.5" fill="none" strokeLinecap="round" />;
  if (mood === 'dizzy') return <g stroke={DARK} strokeWidth="1.2" strokeLinecap="round"><path d={`M${x - r} ${y - r} l ${r * 2} ${r * 2} M${x + r} ${y - r} l ${-r * 2} ${r * 2}`} /></g>;
  if (mood === 'howl') return <path d={`M${x - r} ${y} q ${r} ${r * 0.7} ${r * 2} 0`} stroke={DARK} strokeWidth="1.4" fill="none" strokeLinecap="round" />;
  const big = mood === 'surprised';
  return (
    <g>
      <g className="fx-blink" style={{ transformOrigin: `${x}px ${y}px` }}>
        <ellipse cx={x} cy={y} rx={big ? r * 1.35 : r} ry={big ? r * 1.2 : mood === 'angry' ? r * 0.5 : r * 0.8} fill={iris} filter={`url(#${glow})`} />
        <circle cx={x + 0.5 + lx * 0.7} cy={y + ly * 0.5} r={big ? r * 0.36 : r * 0.42} fill={DARK} />
      </g>
      {brow && mood === 'angry' && <path d={`M${x - r * 1.6} ${y - r * 1.9} L ${x + r * 1.6} ${y - r * 1.1}`} stroke={DARK} strokeWidth="1.5" strokeLinecap="round" />}
    </g>
  );
}

/** Two eyes facing the viewer (crab, owl, frog). Same mood vocabulary as SideEye. */
export function FrontEyes({ x1, x2, y, r, mood = 'normal', look = [0, 0], sleeping, iris, glow, white = '#F4F7FB', ring }:
  { x1: number; x2: number; y: number; r: number; mood?: FormMood; look?: [number, number]; sleeping?: boolean; iris: string; glow: string; white?: string; ring?: string }) {
  const [lx, ly] = look;
  const one = (x: number, side: number) => {
    if (sleeping) return <path key={x} d={`M${x - r * 0.8} ${y} q ${r * 0.8} ${r * 0.7} ${r * 1.6} 0`} stroke={DARK} strokeWidth="1.5" fill="none" strokeLinecap="round" />;
    if (mood === 'happy' || mood === 'love' || mood === 'eat')
      return <path key={x} d={`M${x - r * 0.85} ${y + r * 0.2} q ${r * 0.85} ${-r * 1.1} ${r * 1.7} 0`} stroke={DARK} strokeWidth="1.7" fill="none" strokeLinecap="round" />;
    if (mood === 'dizzy') return <path key={x} d={`M${x - r * 0.6} ${y - r * 0.6} l ${r * 1.2} ${r * 1.2} M${x + r * 0.6} ${y - r * 0.6} l ${-r * 1.2} ${r * 1.2}`} stroke={DARK} strokeWidth="1.5" strokeLinecap="round" />;
    if (mood === 'howl') return <path key={x} d={`M${x - r * 0.75} ${y} q ${r * 0.75} ${r * 0.6} ${r * 1.5} 0`} stroke={DARK} strokeWidth="1.6" fill="none" strokeLinecap="round" />;
    const big = mood === 'surprised';
    const squint = mood === 'angry';
    return (
      <g key={x}>
        {ring && <circle cx={x} cy={y} r={r * 1.18} fill="none" stroke={ring} strokeWidth="1.1" filter={`url(#${glow})`} opacity=".9" />}
        <g className="fx-blink" style={{ transformOrigin: `${x}px ${y}px` }}>
          <ellipse cx={x} cy={y} rx={r} ry={squint ? r * 0.55 : r} fill={white} />
          <circle cx={x + lx * r * 0.35} cy={y + ly * r * 0.3} r={big ? r * 0.38 : r * 0.55} fill={iris} filter={`url(#${glow})`} />
          <circle cx={x + lx * r * 0.35} cy={y + ly * r * 0.3} r={big ? r * 0.18 : r * 0.26} fill={DARK} />
          <circle cx={x - r * 0.3} cy={y - r * 0.35} r={r * 0.16} fill="#fff" opacity=".9" />
        </g>
        {squint && <path d={side < 0 ? `M${x - r * 1.1} ${y - r * 1.2} L ${x + r} ${y - r * 0.6}` : `M${x + r * 1.1} ${y - r * 1.2} L ${x - r} ${y - r * 0.6}`} stroke={DARK} strokeWidth="1.6" strokeLinecap="round" />}
      </g>
    );
  };
  return <g>{one(x1, -1)}{one(x2, 1)}</g>;
}

/** Love blush + floating "z" are shared. */
export const Blush = ({ x, y, show }: { x: number; y: number; show: boolean }) =>
  show ? <ellipse cx={x} cy={y} rx="3.2" ry="1.6" fill="#FF6FA8" opacity=".55" /> : null;
export const Zzz = ({ x, y, c, show }: { x: number; y: number; c: string; show?: boolean }) =>
  show ? <text className="fx-z" x={x} y={y} fontSize="8" fill={c} opacity=".75" fontFamily="monospace">z</text> : null;

export const svgClass = (form: string, pose: FormPose, extra?: string) => `nx-fox nx-form form-${form} pose-${pose} ${extra ?? ''}`;

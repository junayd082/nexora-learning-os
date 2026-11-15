/**
 * Tiny synthesized companion sounds (Web Audio, no files): Nova's fox calls plus one voice
 * per Scene Assistant (crab clicks, firefly chime, owl hoot, husky bark, wolf howl, frog croak,
 * turtle bubbles, cat meow, drone ping, bot beep). Off by default; the student
 * turns them on in Nova's panel and the choice is remembered on this device.
 */
import type { Sfx } from './forms/registry';

let ctx: AudioContext | null = null;
const KEY = 'nexora-nova-sound';

export function soundOn() {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}
export function setSound(on: boolean) {
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* private mode */ }
}

function ac() {
  if (typeof window === 'undefined') return null;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch { return null; }
}

function tone(type: OscillatorType, points: [number, number][], dur: number, vol = 0.08, vibrato = 0) {
  const a = ac(); if (!a) return;
  const t0 = a.currentTime;
  const o = a.createOscillator(); const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(points[0][1], t0);
  for (const [at, f] of points.slice(1)) o.frequency.linearRampToValueAtTime(f, t0 + at);
  if (vibrato) {
    const l = a.createOscillator(); const lg = a.createGain();
    l.frequency.value = 6; lg.gain.value = vibrato; l.connect(lg).connect(o.frequency); l.start(t0); l.stop(t0 + dur);
  }
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(t0); o.stop(t0 + dur + 0.05);
}

function noise(dur: number, vol = 0.05) {
  const a = ac(); if (!a) return;
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const s = a.createBufferSource(); const g = a.createGain(); const f = a.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = 1800; g.gain.value = vol;
  s.buffer = buf; s.connect(f).connect(g).connect(a.destination); s.start();
}

export type { Sfx };

export function play(sfx: Sfx) {
  if (!soundOn()) return;
  switch (sfx) {
    case 'yip': tone('triangle', [[0, 620], [0.08, 980], [0.14, 760]], 0.18, 0.07); break;
    case 'ouch': tone('square', [[0, 900], [0.12, 420]], 0.22, 0.04); break;
    case 'howl': tone('sine', [[0, 380], [0.35, 640], [1.0, 600], [1.5, 420]], 1.6, 0.09, 9); break;
    case 'munch': [0, 140, 280].forEach((ms) => setTimeout(() => noise(0.07, 0.06), ms)); break;
    case 'boing': tone('sine', [[0, 220], [0.18, 720], [0.35, 300]], 0.4, 0.07); break;
    case 'purr': tone('sawtooth', [[0, 70], [0.6, 64]], 0.7, 0.025, 4); break;
    case 'pop': tone('sine', [[0, 500], [0.05, 900]], 0.08, 0.05); break;
    case 'click': [0, 90, 180, 330, 420].forEach((ms) => setTimeout(() => tone('square', [[0, 2400], [0.02, 1800]], 0.03, 0.025), ms)); break;
    case 'chime': [0, 120, 240].forEach((ms, i) => setTimeout(() => tone('sine', [[0, [1320, 1760, 2093][i]]], 0.5, 0.035), ms)); break;
    case 'hoot': tone('sine', [[0, 420], [0.12, 380]], 0.28, 0.08); setTimeout(() => tone('sine', [[0, 400], [0.25, 340]], 0.45, 0.08), 330); break;
    case 'bark': tone('sawtooth', [[0, 520], [0.06, 380], [0.12, 300]], 0.14, 0.05); setTimeout(() => tone('sawtooth', [[0, 560], [0.06, 400]], 0.12, 0.045), 190); break;
    case 'wolfhowl': tone('sine', [[0, 260], [0.5, 520], [1.4, 500], [2.0, 300]], 2.1, 0.09, 7); break;
    case 'croak': [0, 260].forEach((ms) => setTimeout(() => tone('sawtooth', [[0, 140], [0.12, 110]], 0.16, 0.05, 30), ms)); break;
    case 'bubble': [0, 110, 260, 380].forEach((ms, i) => setTimeout(() => tone('sine', [[0, 500 + i * 140], [0.06, 900 + i * 160]], 0.08, 0.04), ms)); break;
    case 'meow': tone('triangle', [[0, 520], [0.18, 820], [0.5, 560]], 0.55, 0.06, 5); break;
    case 'ping': tone('sine', [[0, 1650]], 0.6, 0.05); setTimeout(() => tone('sine', [[0, 1650]], 0.4, 0.02), 280); break;
    case 'beep': tone('square', [[0, 880]], 0.09, 0.03); setTimeout(() => tone('square', [[0, 660]], 0.12, 0.03), 140); break;
  }
}

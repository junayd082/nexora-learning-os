'use client';

/**
 * Classroom sounds, synthesized (no files). Separate from the companion's sounds so a teacher can
 * keep raised-hand alerts on while the fox stays quiet.
 *  - hand:    two soft rising notes (a hand went up)
 *  - seen:    one warm note (student: your teacher is on the way)
 *  - timesUp: three bell strikes (timer reached zero) — played on the teacher's screen/projector
 */
let ctx: AudioContext | null = null;
function ac() {
  if (typeof window === 'undefined') return null;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch { return null; }
}

function bell(freq: number, at: number, dur = 1.2, vol = 0.12) {
  const a = ac(); if (!a) return;
  const t0 = a.currentTime + at;
  [1, 2.01, 3.02].forEach((mult, i) => {
    const o = a.createOscillator(); const g = a.createGain();
    o.type = 'sine'; o.frequency.value = freq * mult;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol / (i + 1.5), t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur / (i + 1));
    o.connect(g).connect(a.destination); o.start(t0); o.stop(t0 + dur);
  });
}

export function chime(kind: 'hand' | 'seen' | 'timesUp') {
  if (kind === 'hand') { bell(784, 0, 0.9, 0.1); bell(1047, 0.16, 1.1, 0.1); }
  else if (kind === 'seen') bell(659, 0, 1, 0.08);
  else { bell(880, 0, 1.4, 0.16); bell(880, 0.55, 1.4, 0.16); bell(880, 1.1, 1.8, 0.16); }
}

const KEY = 'nexora-hand-alerts';
/** Teacher's alert sound for raised hands (on unless turned off on this device). */
export function alertsOn() { try { return localStorage.getItem(KEY) !== '0'; } catch { return true; } }
export function setAlerts(on: boolean) { try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* private mode */ } }

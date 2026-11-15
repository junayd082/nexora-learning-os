/** Small, dependency-free helpers shared by scenes. */

/** Deterministic PRNG (mulberry32) so cached layers look the same after every resize. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const TAU = Math.PI * 2;

/** Offscreen canvas at device resolution with a context already scaled to CSS px. */
export function layer(w: number, h: number, dpr: number) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * dpr));
  c.height = Math.max(1, Math.round(h * dpr));
  const ctx = c.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { c, ctx };
}

export function vgrad(ctx: CanvasRenderingContext2D, y0: number, y1: number, stops: [number, string][]) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
}

export function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  // fade to the same colour at zero alpha — fading to transparent black leaves a grey ring
  g.addColorStop(1, transparent(color));
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}

/** Cheap smooth 1D value noise. */
export function noise1(seed: number) {
  const r = rng(seed);
  const p = Array.from({ length: 256 }, () => r());
  return (x: number) => {
    const i = Math.floor(x), f = x - i;
    const a = p[i & 255], b = p[(i + 1) & 255];
    const s = f * f * (3 - 2 * f);
    return a + (b - a) * s;
  };
}

/** Film grain tile, reused by several scenes. */
export function grainTile(size = 128, alpha = 0.06, seed = 7) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const r = rng(seed);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = r() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = alpha * 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Particle count scaled to screen area and the student's intensity setting. */
export function density(w: number, h: number, per100k: number, intensity: number, motionFactor = 1) {
  return Math.round(((w * h) / 100000) * per100k * (0.35 + intensity * 0.65) * motionFactor);
}

/** 'rgba(1,2,3,.5)' | 'rgb(1,2,3)' | '#abc' | '#aabbcc' -> same colour at alpha 0. */
export function transparent(color: string) {
  const m = color.match(/^rgba?\(([^,]+),([^,]+),([^,)]+)/);
  if (m) return `rgba(${m[1]},${m[2]},${m[3]},0)`;
  let hex = color.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const n = parseInt(hex.slice(0, 6), 16);
  return isNaN(n) ? 'rgba(0,0,0,0)' : `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},0)`;
}

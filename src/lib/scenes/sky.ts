import type { SceneDef } from './types';
import { rng, layer, vgrad, glow, clamp, TAU, noise1, transparent } from './util';

/** Shared mountain silhouette with snow caps clipped to the ridge. */
function ridge(ctx: CanvasRenderingContext2D, r: () => number, w: number, base: number, amp: number, color: string, snow?: string) {
  // midpoint displacement gives natural peaks and saddles
  const N = 64, ys = new Array(N + 1).fill(0);
  ys[0] = r(); ys[N] = r();
  for (let step = N, rough = 1; step > 1; step /= 2, rough *= 0.55)
    for (let i = step / 2; i < N; i += step) ys[i] = (ys[i - step / 2] + ys[i + step / 2]) / 2 + (r() - 0.5) * rough;
  const lo = Math.min(...ys), hi = Math.max(...ys);
  const path = new Path2D();
  path.moveTo(-20, base + 600);
  ys.forEach((v, i) => path.lineTo(-20 + ((w + 60) * i) / N, base - amp * (0.12 + 0.88 * ((v - lo) / (hi - lo || 1)))));
  path.lineTo(w + 40, base + 600); path.closePath();
  ctx.fillStyle = color; ctx.fill(path);
  if (snow) {
    ctx.save(); ctx.clip(path);
    const g = ctx.createLinearGradient(0, base - amp, 0, base - amp * 0.45);
    g.addColorStop(0, snow); g.addColorStop(1, transparent(snow));
    ctx.fillStyle = g; ctx.fillRect(0, base - amp - 10, w, amp * 0.6);
    ctx.restore();
  }
}

/** Northern Lights — curtains of green and violet light rolling over snowy peaks. Light gathers near the cursor. */
export const aurora: SceneDef = {
  id: 'aurora', accent: '#5cf2a5', base: '#06101e', scrim: 0.4, sound: 'wind', season: 'winter',
  create(seed) {
    let w = 0, h = 0, m = 1;
    let bg: HTMLCanvasElement, fg: HTMLCanvasElement, strips: HTMLCanvasElement[] = [];
    let stars: { x: number; y: number; ph: number }[] = [];
    const nz = [noise1(seed), noise1(seed + 1), noise1(seed + 2)];
    const COLORS = [['92,242,165', '60,180,255'], ['120,255,190', '180,110,255'], ['80,220,255', '255,110,200']];
    return {
      resize(W, H, dpr) {
        w = W; h = H; m = clamp(Math.min(w, h) / 900, 0.6, 1.5);
        const r = rng(seed + 31);
        const b = layer(w, h, dpr); bg = b.c;
        b.ctx.fillStyle = vgrad(b.ctx, 0, h, [[0, '#030814'], [0.55, '#081a2c'], [1, '#10304a']]); b.ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < (w * h) / 1600; i++) { b.ctx.globalAlpha = 0.2 + r() * 0.7; b.ctx.fillStyle = '#fff'; b.ctx.fillRect(r() * w, r() * h * 0.8, r() < 0.95 ? 0.8 : 1.6, r() < 0.95 ? 0.8 : 1.6); }
        b.ctx.globalAlpha = 1;
        stars = Array.from({ length: 60 }, () => ({ x: r() * w, y: r() * h * 0.7, ph: r() * TAU }));
        const f = layer(w, h, dpr); fg = f.c;
        ridge(f.ctx, r, w, h * 0.86, h * 0.26, '#0d2236', 'rgba(170,200,230,.35)');
        ridge(f.ctx, r, w, h * 0.95, h * 0.18, '#081625', 'rgba(150,180,215,.28)');
        f.ctx.fillStyle = vgrad(f.ctx, h * 0.9, h, [[0, '#0b1d2e'], [1, '#05101c']]); f.ctx.fillRect(0, h * 0.93, w, h);
        // one tall vertical gradient strip per colour pair, stretched at draw time (fast)
        strips = COLORS.map(([a, b2]) => {
          const s = document.createElement('canvas'); s.width = 4; s.height = 256;
          const c = s.getContext('2d')!; const g = c.createLinearGradient(0, 256, 0, 0);
          g.addColorStop(0, `rgba(${a},0)`); g.addColorStop(0.08, `rgba(${a},.95)`); g.addColorStop(0.4, `rgba(${a},.35)`); g.addColorStop(0.75, `rgba(${b2},.18)`); g.addColorStop(1, `rgba(${b2},0)`);
          c.fillStyle = g; c.fillRect(0, 0, 4, 256); return s;
        });
      },
      frame({ ctx, t, pointer, intensity, motion }) {
        const T = t * (motion === 'reduced' ? 0.45 : 1);
        ctx.drawImage(bg, 0, 0, w, h);
        for (const s of stars) { ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(T * 0.8 + s.ph)); ctx.fillStyle = '#fff'; ctx.fillRect(s.x, s.y, 1.6, 1.6); }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'lighter';
        const step = 5;
        for (let k = 0; k < 3; k++) {
          const n = nz[k], base = h * (0.34 + k * 0.08);
          for (let x = 0; x < w; x += step) {
            const u = x / w;
            const y = base + (n(u * 3 + T * 0.04 + k * 7) - 0.5) * h * 0.32 + Math.sin(u * 9 + T * 0.3 + k) * 14 * m;
            const len = (110 + n(u * 6 - T * 0.07 + k * 3) * 230) * m;
            let a = Math.pow(n(u * 14 + T * 0.35 + k * 11), 2) * (0.22 + intensity * 0.3);
            if (pointer.active) a *= 1 + Math.max(0, 1 - Math.hypot(pointer.x - x, pointer.y - y) / (260 * m)) * 1.4;
            if (a < 0.01) continue;
            ctx.globalAlpha = Math.min(1, a);
            ctx.drawImage(strips[k], x, y - len, step + 1, len);
          }
        }
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
        ctx.drawImage(fg, 0, 0, w, h);
      },
    };
  },
};

/** Snowfall — a quiet pine valley at blue hour with snow falling in three depths. The cursor nudges the wind. */
export const snow: SceneDef = {
  id: 'snow', accent: '#a9c8ff', base: '#2a3a55', scrim: 0.5, sound: 'wind', season: 'winter',
  create(seed) {
    let w = 0, h = 0, m = 1, wind = 0;
    let bg: HTMLCanvasElement;
    let flakes: { x: number; y: number; z: number; ph: number }[] = [];
    function pines(ctx: CanvasRenderingContext2D, r: () => number, base: number, size: number, color: string, gap: number) {
      ctx.fillStyle = color;
      for (let x = -20; x < w + 20; x += gap * (0.6 + r() * 0.8)) {
        const ht = size * (0.7 + r() * 0.6), wd = ht * 0.32;
        ctx.beginPath(); ctx.moveTo(x, base - ht);
        for (let tier = 1; tier <= 4; tier++) { const ty = base - ht + (ht * tier) / 4; ctx.lineTo(x + (wd * tier) / 4, ty); ctx.lineTo(x + (wd * tier) / 7, ty); }
        for (let tier = 4; tier >= 1; tier--) { const ty = base - ht + (ht * tier) / 4; ctx.lineTo(x - (wd * tier) / 7, ty); ctx.lineTo(x - (wd * tier) / 4, ty); }
        ctx.closePath(); ctx.fill();
      }
    }
    return {
      resize(W, H, dpr) {
        w = W; h = H; m = clamp(Math.min(w, h) / 900, 0.6, 1.5);
        const r = rng(seed + 41);
        const b = layer(w, h, dpr); bg = b.c;
        b.ctx.fillStyle = vgrad(b.ctx, 0, h, [[0, '#18233a'], [0.5, '#3b4f70'], [0.85, '#7f93b2'], [1, '#aebdd2']]); b.ctx.fillRect(0, 0, w, h);
        glow(b.ctx, w * 0.22, h * 0.2, 180 * m, 'rgba(230,236,255,1)', 0.35);
        b.ctx.fillStyle = '#eef2ff'; b.ctx.beginPath(); b.ctx.arc(w * 0.22, h * 0.2, 26 * m, 0, TAU); b.ctx.fill();
        ridge(b.ctx, r, w, h * 0.72, h * 0.24, '#5d7192', 'rgba(236,242,252,.85)');
        b.ctx.fillStyle = '#b9c7da'; b.ctx.fillRect(0, h * 0.76, w, h);
        pines(b.ctx, r, h * 0.8, 90 * m, '#3c4f6c', 22 * m);
        b.ctx.fillStyle = vgrad(b.ctx, h * 0.8, h, [[0, '#d4deeb'], [1, '#b7c6db']]); b.ctx.fillRect(0, h * 0.8, w, h);
        pines(b.ctx, r, h * 0.92, 150 * m, '#26354d', 40 * m);
        b.ctx.fillStyle = vgrad(b.ctx, h * 0.92, h, [[0, '#e3eaf4'], [1, '#c3d0e2']]); b.ctx.fillRect(0, h * 0.92, w, h);
        pines(b.ctx, r, h * 1.05, 260 * m, '#172235', 140 * m);
        flakes = Array.from({ length: Math.round((w * h) / 2600) }, () => ({ x: r() * w, y: r() * h, z: r(), ph: r() * TAU }));
      },
      frame({ ctx, t, dt, pointer, intensity, motion }) {
        const sp = motion === 'reduced' ? 0.45 : 1;
        ctx.drawImage(bg, 0, 0, w, h);
        wind += ((pointer.active ? clamp(pointer.vx * 0.06, -120, 120) : 0) + Math.sin(t * 0.2) * 14 - wind) * Math.min(1, dt);
        const n = Math.round(flakes.length * (0.3 + intensity * 0.7) * (motion === 'reduced' ? 0.6 : 1));
        ctx.fillStyle = '#fff';
        for (let i = 0; i < n; i++) {
          const f = flakes[i], s = (0.8 + f.z * 2.6) * m;
          f.y += (16 + f.z * 50) * m * dt * sp;
          f.x += (Math.sin(t * 0.7 + f.ph) * 10 * m + wind * (0.4 + f.z)) * dt * sp;
          if (f.y > h + 5) { f.y = -5; f.x = Math.random() * w; }
          if (f.x > w + 5) f.x = -5; else if (f.x < -5) f.x = w + 5;
          ctx.globalAlpha = 0.45 + f.z * 0.5; ctx.beginPath(); ctx.arc(f.x, f.y, s, 0, TAU); ctx.fill();
        }
        ctx.globalAlpha = 1;
      },
    };
  },
};

/** Deep Space — layered stars with parallax to the cursor, a nebula, a ringed planet and the occasional shooting star. */
export const space: SceneDef = {
  id: 'space', accent: '#8f7bff', base: '#04050c', scrim: 0.35, sound: 'space',
  create(seed) {
    let w = 0, h = 0, m = 1, cx = 0, cy = 0;
    let neb: HTMLCanvasElement;
    let layers: { x: number; y: number; s: number; ph: number }[][] = [];
    let shoot: { x: number; y: number; vx: number; vy: number; life: number } | null = null;
    let nextShoot = 4;
    return {
      resize(W, H, dpr) {
        w = W; h = H; m = clamp(Math.min(w, h) / 900, 0.6, 1.5);
        const r = rng(seed + 51);
        const b = layer(w, h, dpr); neb = b.c;
        b.ctx.fillStyle = '#04050c'; b.ctx.fillRect(0, 0, w, h);
        b.ctx.globalCompositeOperation = 'lighter';
        const cols = ['120,70,255', '255,70,170', '40,140,255', '90,40,200'];
        for (let i = 0; i < 18; i++) {
          const t = r(); const x = w * (0.2 + t * 0.7) + (r() - 0.5) * w * 0.2, y = h * (0.7 - t * 0.45) + (r() - 0.5) * h * 0.25;
          glow(b.ctx, x, y, (120 + r() * 260) * m, `rgba(${cols[(r() * cols.length) | 0]},1)`, 0.1 + r() * 0.12);
        }
        b.ctx.globalCompositeOperation = 'source-over';
        // ringed planet, bottom left
        const px = w * 0.14, py = h * 0.82, pr = 70 * m;
        const pg = b.ctx.createRadialGradient(px - pr * 0.4, py - pr * 0.4, pr * 0.1, px, py, pr);
        pg.addColorStop(0, '#d9b98f'); pg.addColorStop(0.7, '#8a5a48'); pg.addColorStop(1, '#2a1a22');
        b.ctx.strokeStyle = 'rgba(230,200,170,.35)'; b.ctx.lineWidth = 3 * m;
        b.ctx.beginPath(); b.ctx.ellipse(px, py, pr * 2, pr * 0.45, -0.35, Math.PI, TAU); b.ctx.stroke();
        b.ctx.fillStyle = pg; b.ctx.beginPath(); b.ctx.arc(px, py, pr, 0, TAU); b.ctx.fill();
        b.ctx.beginPath(); b.ctx.ellipse(px, py, pr * 2, pr * 0.45, -0.35, 0, Math.PI); b.ctx.stroke();
        layers = [0.25, 0.6, 1].map(z => Array.from({ length: Math.round(((w * h) / 2000) * (1.2 - z)) + 20 }, () => ({ x: r() * w, y: r() * h, s: (0.5 + r() * 1.1) * (0.6 + z), ph: r() * TAU })));
      },
      frame({ ctx, t, dt, pointer, intensity, motion }) {
        const sp = motion === 'reduced' ? 0.4 : 1;
        if (pointer.active) { cx += ((pointer.x - w / 2) - cx) * Math.min(1, dt * 2); cy += ((pointer.y - h / 2) - cy) * Math.min(1, dt * 2); }
        ctx.drawImage(neb, -cx * 0.01, -cy * 0.01, w * 1.02, h * 1.02);
        ctx.fillStyle = '#fff';
        layers.forEach((L, k) => {
          const z = [0.25, 0.6, 1][k], n = Math.round(L.length * (0.4 + intensity * 0.6));
          for (let i = 0; i < n; i++) {
            const s = L[i]; s.x -= z * 4 * m * dt * sp; if (s.x < -2) s.x = w + 2;
            const x = (s.x - cx * z * 0.04 + w) % w, y = (s.y - cy * z * 0.04 + h) % h;
            ctx.globalAlpha = 0.45 + 0.55 * Math.abs(Math.sin(t * (0.5 + z) + s.ph));
            ctx.fillRect(x, y, s.s, s.s);
          }
        });
        ctx.globalAlpha = 1;
        if (motion !== 'static') {
          nextShoot -= dt;
          if (!shoot && nextShoot < 0) { shoot = { x: w * (0.3 + Math.random() * 0.7), y: h * Math.random() * 0.4, vx: -700 * m, vy: 300 * m, life: 1 }; nextShoot = 7 + Math.random() * 9; }
          if (shoot) {
            shoot.x += shoot.vx * dt; shoot.y += shoot.vy * dt; shoot.life -= dt * 1.2;
            const g = ctx.createLinearGradient(shoot.x, shoot.y, shoot.x - shoot.vx * 0.12, shoot.y - shoot.vy * 0.12);
            g.addColorStop(0, `rgba(255,255,255,${Math.max(0, shoot.life)})`); g.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.strokeStyle = g; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(shoot.x, shoot.y); ctx.lineTo(shoot.x - shoot.vx * 0.12, shoot.y - shoot.vy * 0.12); ctx.stroke();
            if (shoot.life <= 0) shoot = null;
          }
        }
      },
    };
  },
};

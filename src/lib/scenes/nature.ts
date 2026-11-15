import type { SceneDef } from './types';
import { rng, layer, vgrad, glow, clamp, TAU, noise1 } from './util';

/** Under the Sea — sun rays through blue water, rising bubbles, drifting fish. Moving the cursor releases bubbles. */
export const ocean: SceneDef = {
  id: 'ocean', accent: '#3fd6d0', base: '#06344f', scrim: 0.42, sound: 'underwater', season: 'summer',
  create(seed) {
    let w = 0, h = 0, m = 1;
    let bg: HTMLCanvasElement;
    let bubbles: { x: number; y: number; r: number; v: number; ph: number }[] = [];
    let fish: { x: number; y: number; s: number; v: number; ph: number }[] = [];
    let snow: { x: number; y: number; ph: number }[] = [];
    let extra: { x: number; y: number; r: number; v: number; ph: number }[] = [];
    let lastPop = 0;
    return {
      resize(W, H, dpr) {
        w = W; h = H; m = clamp(Math.min(w, h) / 900, 0.6, 1.5);
        const r = rng(seed + 61);
        const b = layer(w, h, dpr); bg = b.c;
        b.ctx.fillStyle = vgrad(b.ctx, 0, h, [[0, '#1b8fa8'], [0.25, '#0d6582'], [0.65, '#073a59'], [1, '#03182b']]); b.ctx.fillRect(0, 0, w, h);
        // sea floor with rocks and kelp
        b.ctx.fillStyle = '#04213a'; b.ctx.beginPath(); b.ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 20) b.ctx.lineTo(x, h * 0.9 - Math.sin(x * 0.006) * 20 * m - r() * 8 * m);
        b.ctx.lineTo(w, h); b.ctx.fill();
        b.ctx.strokeStyle = 'rgba(10,70,60,.8)'; b.ctx.lineCap = 'round';
        for (let i = 0; i < 18; i++) {
          const x = r() * w, ht = (80 + r() * 200) * m; b.ctx.lineWidth = (3 + r() * 4) * m;
          b.ctx.beginPath(); b.ctx.moveTo(x, h); b.ctx.bezierCurveTo(x - 20 * m, h - ht * 0.4, x + 24 * m, h - ht * 0.7, x - 6 * m, h - ht); b.ctx.stroke();
        }
        bubbles = Array.from({ length: Math.round((w * h) / 16000) + 10 }, () => ({ x: r() * w, y: r() * h, r: (1.5 + r() * 4) * m, v: (20 + r() * 40) * m, ph: r() * TAU }));
        fish = Array.from({ length: 14 }, (_, i) => ({ x: r() * w, y: h * (0.25 + r() * 0.55), s: (0.6 + r() * 0.9) * m, v: (14 + r() * 26) * m * (i % 3 === 0 ? -1 : 1), ph: r() * TAU }));
        snow = Array.from({ length: Math.round((w * h) / 5000) }, () => ({ x: r() * w, y: r() * h, ph: r() * TAU }));
      },
      frame({ ctx, t, dt, pointer, intensity, motion }) {
        const sp = motion === 'reduced' ? 0.45 : 1, T = t * sp;
        ctx.drawImage(bg, 0, 0, w, h);
        // god rays
        ctx.globalCompositeOperation = 'lighter';
        for (let k = 0; k < 7; k++) {
          const x = w * (0.1 + k * 0.14) + Math.sin(T * 0.2 + k) * 30 * m, wd = (40 + (k % 3) * 30) * m;
          const a = (0.05 + 0.05 * Math.sin(T * 0.5 + k * 1.7)) * (0.6 + intensity * 0.6);
          const g = ctx.createLinearGradient(0, 0, 0, h * 0.85); g.addColorStop(0, `rgba(190,250,255,${a})`); g.addColorStop(1, 'rgba(190,250,255,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - wd * 0.4, 0); ctx.lineTo(x + wd * 0.4, 0); ctx.lineTo(x + wd * 2.2 + 80 * m, h * 0.85); ctx.lineTo(x + wd * 0.6 + 80 * m, h * 0.85); ctx.fill();
        }
        // caustic shimmer near the surface
        ctx.strokeStyle = 'rgba(200,255,255,.10)'; ctx.lineWidth = 2;
        for (let k = 0; k < 6; k++) {
          ctx.beginPath();
          for (let x = 0; x <= w; x += 14) ctx.lineTo(x, 12 * m + k * 14 * m + Math.sin(x * 0.02 + T * 1.3 + k) * 5 * m + Math.sin(x * 0.051 - T * 0.9) * 3 * m);
          ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
        // marine snow
        ctx.fillStyle = 'rgba(220,250,255,.35)';
        for (const s of snow) { s.y += 4 * m * dt * sp; if (s.y > h) s.y = 0; ctx.fillRect(s.x + Math.sin(T * 0.5 + s.ph) * 4, s.y, 1.2, 1.2); }
        // fish silhouettes
        for (const f of fish) {
          f.x += f.v * dt * sp; if (f.x > w + 60) f.x = -60; if (f.x < -60) f.x = w + 60;
          const y = f.y + Math.sin(T * 0.8 + f.ph) * 8 * m, dir = Math.sign(f.v), s = f.s;
          ctx.fillStyle = 'rgba(2,26,40,.55)';
          ctx.beginPath(); ctx.ellipse(f.x, y, 16 * s, 6 * s, 0, 0, TAU); ctx.fill();
          const wag = Math.sin(T * 8 + f.ph) * 3 * s;
          ctx.beginPath(); ctx.moveTo(f.x - dir * 14 * s, y); ctx.lineTo(f.x - dir * 24 * s, y - 6 * s + wag); ctx.lineTo(f.x - dir * 24 * s, y + 6 * s + wag); ctx.fill();
        }
        // bubbles
        if (pointer.active && Math.hypot(pointer.vx, pointer.vy) > 60 && t - lastPop > 0.08 && extra.length < 60) {
          extra.push({ x: pointer.x, y: pointer.y, r: (1.5 + Math.random() * 3) * m, v: (40 + Math.random() * 40) * m, ph: Math.random() * TAU }); lastPop = t;
        }
        const n = Math.round(bubbles.length * (0.35 + intensity * 0.65));
        ctx.strokeStyle = 'rgba(220,255,255,.55)'; ctx.lineWidth = 1;
        const draw = (b: { x: number; y: number; r: number; v: number; ph: number }) => {
          b.y -= b.v * dt * sp; const x = b.x + Math.sin(T * 2 + b.ph) * 3 * m;
          ctx.beginPath(); ctx.arc(x, b.y, b.r, 0, TAU); ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(x - b.r * 0.4, b.y - b.r * 0.5, 1.2, 1.2);
        };
        for (let i = 0; i < n; i++) { const b = bubbles[i]; draw(b); if (b.y < -10) { b.y = h + 10; b.x = Math.random() * w; } }
        extra = extra.filter(b => b.y > -10); extra.forEach(draw);
      },
    };
  },
};

/** Autumn Drift — maple leaves tumbling across a warm dusk over the hills. The cursor is the wind. */
export const autumn: SceneDef = {
  id: 'autumn', accent: '#ff9a4d', base: '#3a2234', scrim: 0.5, sound: 'wind', season: 'fall',
  create(seed) {
    let w = 0, h = 0, m = 1, wind = 0;
    let bg: HTMLCanvasElement;
    let leaves: { x: number; y: number; s: number; rot: number; vr: number; flip: number; vy: number; ph: number; c: string }[] = [];
    const COLS = ['#e8642c', '#f39a33', '#c8402a', '#f5c04a', '#a8322a', '#d9822b'];
    const leaf = (ctx: CanvasRenderingContext2D, s: number) => {
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i - 2) * 0.62, a2 = a + 0.31;
        ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s);
        ctx.lineTo(Math.cos(a2) * s * 0.45, Math.sin(a2) * s * 0.45);
      }
      ctx.lineTo(0, s * 0.5); ctx.closePath(); ctx.fill();
    };
    return {
      resize(W, H, dpr) {
        w = W; h = H; m = clamp(Math.min(w, h) / 900, 0.6, 1.5);
        const r = rng(seed + 71);
        const b = layer(w, h, dpr); bg = b.c;
        b.ctx.fillStyle = vgrad(b.ctx, 0, h, [[0, '#2a1d3d'], [0.45, '#6a3b4a'], [0.72, '#d7774a'], [1, '#f2a65c']]); b.ctx.fillRect(0, 0, w, h);
        glow(b.ctx, w * 0.65, h * 0.72, 300 * m, 'rgba(255,200,120,1)', 0.45);
        b.ctx.fillStyle = '#ffd99a'; b.ctx.beginPath(); b.ctx.arc(w * 0.65, h * 0.72, 40 * m, 0, TAU); b.ctx.fill();
        const hill = (base: number, amp: number, freq: number, col: string) => {
          b.ctx.fillStyle = col; b.ctx.beginPath(); b.ctx.moveTo(0, h);
          for (let x = 0; x <= w; x += 10) b.ctx.lineTo(x, base - Math.sin(x * freq + r() * 0.02) * amp - Math.sin(x * freq * 2.7) * amp * 0.3);
          b.ctx.lineTo(w, h); b.ctx.fill();
        };
        hill(h * 0.76, 30 * m, 0.004, '#7a3a3e'); hill(h * 0.84, 40 * m, 0.003, '#4c2333'); hill(h * 0.93, 30 * m, 0.005, '#2a1424');
        // bare tree on the left
        const tree = (x: number, y: number, a: number, len: number, wd: number, d: number) => {
          if (d > 7) return; const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
          b.ctx.strokeStyle = '#1e0f1a'; b.ctx.lineWidth = wd; b.ctx.lineCap = 'round'; b.ctx.beginPath(); b.ctx.moveTo(x, y); b.ctx.lineTo(ex, ey); b.ctx.stroke();
          tree(ex, ey, a - 0.35 - r() * 0.25, len * 0.74, wd * 0.68, d + 1); tree(ex, ey, a + 0.3 + r() * 0.25, len * 0.7, wd * 0.68, d + 1);
        };
        tree(w * 0.1, h, -Math.PI / 2 - 0.05, 150 * m, 14 * m, 0);
        leaves = Array.from({ length: Math.round((w * h) / 14000) + 20 }, () => ({ x: r() * w, y: r() * h, s: (5 + r() * 7) * m, rot: r() * TAU, vr: (r() - 0.5) * 3, flip: r() * TAU, vy: (22 + r() * 30) * m, ph: r() * TAU, c: COLS[(r() * COLS.length) | 0] }));
      },
      frame({ ctx, t, dt, pointer, intensity, motion }) {
        const sp = motion === 'reduced' ? 0.45 : 1;
        ctx.drawImage(bg, 0, 0, w, h);
        wind += ((pointer.active ? clamp(pointer.vx * 0.1, -220, 220) : 0) + 20 * m + Math.sin(t * 0.3) * 20 * m - wind) * Math.min(1, dt);
        const n = Math.round(leaves.length * (0.35 + intensity * 0.65));
        for (let i = 0; i < n; i++) {
          const L = leaves[i];
          L.y += L.vy * dt * sp; L.x += (wind + Math.sin(t + L.ph) * 30 * m) * dt * sp; L.rot += L.vr * dt * sp; L.flip += 2.4 * dt * sp;
          if (L.y > h + 20 || L.x > w + 30 || L.x < -30) { L.y = -20; L.x = Math.random() * w * 1.1 - w * 0.1; }
          ctx.save(); ctx.translate(L.x, L.y); ctx.rotate(L.rot); ctx.scale(Math.cos(L.flip), 1);
          ctx.fillStyle = L.c; ctx.globalAlpha = 0.95; leaf(ctx, L.s); ctx.restore();
        }
        ctx.globalAlpha = 1;
      },
    };
  },
};

/** Firefly Meadow — a summer night: grass sways, fireflies pulse and drift, and gather softly around the cursor. */
export const fireflies: SceneDef = {
  id: 'fireflies', accent: '#d8f26a', base: '#06110f', scrim: 0.35, sound: 'night', season: 'summer',
  create(seed) {
    let w = 0, h = 0, m = 1;
    let bg: HTMLCanvasElement, sprite: HTMLCanvasElement;
    let flies: { x: number; y: number; vx: number; vy: number; ph: number; f: number }[] = [];
    let blades: { x: number; h: number; c: string; ph: number }[] = [];
    const nz = noise1(seed);
    return {
      resize(W, H, dpr) {
        w = W; h = H; m = clamp(Math.min(w, h) / 900, 0.6, 1.5);
        const r = rng(seed + 81);
        const b = layer(w, h, dpr); bg = b.c;
        b.ctx.fillStyle = vgrad(b.ctx, 0, h, [[0, '#040a12'], [0.55, '#0b1b22'], [1, '#12291f']]); b.ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < (w * h) / 3000; i++) { b.ctx.globalAlpha = 0.2 + r() * 0.6; b.ctx.fillStyle = '#fff'; b.ctx.fillRect(r() * w, r() * h * 0.55, 1, 1); }
        b.ctx.globalAlpha = 1;
        glow(b.ctx, w * 0.82, h * 0.16, 150 * m, 'rgba(220,235,255,1)', 0.25);
        b.ctx.fillStyle = '#f4f6ff'; b.ctx.beginPath(); b.ctx.arc(w * 0.82, h * 0.16, 22 * m, 0, TAU); b.ctx.fill();
        b.ctx.fillStyle = '#071410';
        b.ctx.beginPath(); b.ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 12) b.ctx.lineTo(x, h * 0.62 - (Math.abs(Math.sin(x * 0.013)) * 50 + r() * 20) * m);
        b.ctx.lineTo(w, h); b.ctx.fill();
        b.ctx.fillStyle = '#0a1d16'; b.ctx.fillRect(0, h * 0.8, w, h);
        const s = document.createElement('canvas'); s.width = s.height = 64; sprite = s;
        const sc = s.getContext('2d')!; const g = sc.createRadialGradient(32, 32, 0, 32, 32, 32);
        g.addColorStop(0, 'rgba(255,255,210,1)'); g.addColorStop(0.15, 'rgba(225,250,120,.9)'); g.addColorStop(0.45, 'rgba(180,230,80,.25)'); g.addColorStop(1, 'rgba(180,230,80,0)');
        sc.fillStyle = g; sc.fillRect(0, 0, 64, 64);
        flies = Array.from({ length: Math.round((w * h) / 18000) + 18 }, () => ({ x: r() * w, y: h * (0.35 + r() * 0.6), vx: 0, vy: 0, ph: r() * TAU, f: 0.4 + r() * 0.8 }));
        blades = Array.from({ length: Math.round(w / 4) }, () => ({ x: r() * w, h: (30 + r() * 70) * m, c: r() < 0.5 ? '#0f2a1d' : '#143524', ph: r() * TAU }));
      },
      frame({ ctx, t, dt, pointer, intensity, motion }) {
        const sp = motion === 'reduced' ? 0.45 : 1, T = t * sp;
        ctx.drawImage(bg, 0, 0, w, h);
        const n = Math.round(flies.length * (0.35 + intensity * 0.65));
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < n; i++) {
          const f = flies[i];
          const ax = (nz(T * 0.3 + i * 9.1) - 0.5) * 60, ay = (nz(T * 0.3 + i * 4.7 + 50) - 0.5) * 60;
          f.vx += ax * dt; f.vy += ay * dt;
          if (pointer.active) { const dx = pointer.x - f.x, dy = pointer.y - f.y, d = Math.hypot(dx, dy); if (d < 260 * m && d > 30) { f.vx += (dx / d) * 22 * dt; f.vy += (dy / d) * 22 * dt; } }
          f.vx *= 0.985; f.vy *= 0.985;
          f.x += f.vx * dt * sp * m; f.y += f.vy * dt * sp * m;
          if (f.x < -20) f.x = w + 20; if (f.x > w + 20) f.x = -20; if (f.y < h * 0.25) f.vy += 10 * dt; if (f.y > h) f.y = h * 0.4;
          const a = Math.pow(Math.max(0, Math.sin(T * f.f * 2 + f.ph)), 3);
          if (a < 0.03) continue;
          const sz = (14 + a * 22) * m; ctx.globalAlpha = a; ctx.drawImage(sprite, f.x - sz / 2, f.y - sz / 2, sz, sz);
        }
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
        // grass in front, swaying
        ctx.lineWidth = 2 * m; ctx.lineCap = 'round';
        for (const b of blades) {
          const bend = Math.sin(T * 1.1 + b.ph + b.x * 0.004) * 8 * m;
          ctx.strokeStyle = b.c; ctx.beginPath(); ctx.moveTo(b.x, h + 4); ctx.quadraticCurveTo(b.x + bend * 0.3, h - b.h * 0.5, b.x + bend, h - b.h); ctx.stroke();
        }
      },
    };
  },
};

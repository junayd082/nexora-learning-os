import type { SceneDef } from './types';
import { rng, layer, vgrad, glow, clamp, TAU, grainTile } from './util';

/**
 * Sand & Sea — a calm afternoon beach. Waves roll in, wet the sand and slide back
 * on an 8-second rhythm. Sun glitter shimmers on the water; gulls cross now and then.
 * Moving the cursor over the water leaves small ripples.
 */
export const beach: SceneDef = {
  id: 'beach', accent: '#2fb3c6', base: '#9cc9e4', scrim: 0.62, sound: 'waves', season: 'summer',
  create(seed) {
    let w = 0, h = 0, m = 1, horizon = 0, shore = 0;
    let sky: HTMLCanvasElement, sand: HTMLCanvasElement, cloud: HTMLCanvasElement;
    let clouds: { x: number; y: number; s: number; v: number }[] = [];
    let glints: { x: number; y: number; l: number; ph: number }[] = [];
    let ripples: { x: number; y: number; r: number; a: number }[] = [];
    let lastRipple = 0;

    const shoreY = (x: number, t: number) => shore + Math.sin(x * 0.004 + 1.3) * 10 * m + Math.sin(x * 0.011 + t * 0.2) * 3 * m;

    return {
      resize(W, H, dpr) {
        w = W; h = H; m = clamp(Math.min(w, h) / 900, 0.55, 1.6);
        horizon = h * 0.44; shore = h * 0.66;
        const r = rng(seed + 11);
        const s = layer(w, h, dpr); sky = s.c;
        s.ctx.fillStyle = vgrad(s.ctx, 0, horizon, [[0, '#6aa9db'], [0.6, '#a9d3ee'], [1, '#f4e1c6']]);
        s.ctx.fillRect(0, 0, w, horizon + 2);
        glow(s.ctx, w * 0.76, h * 0.17, 260 * m, 'rgba(255,244,214,1)', 0.55);
        s.ctx.fillStyle = '#fff8e4'; s.ctx.beginPath(); s.ctx.arc(w * 0.76, h * 0.17, 34 * m, 0, TAU); s.ctx.fill();
        // distant headland
        s.ctx.fillStyle = 'rgba(88,128,150,.55)';
        s.ctx.beginPath(); s.ctx.moveTo(0, horizon);
        for (let x = 0; x <= w * 0.35; x += 8) s.ctx.lineTo(x, horizon - (Math.sin(x / (w * 0.35) * Math.PI) * 26 + Math.sin(x * 0.05) * 3) * m);
        s.ctx.lineTo(w * 0.35, horizon); s.ctx.fill();
        // sand with grain
        const sd = layer(w, h, dpr); sand = sd.c;
        sd.ctx.fillStyle = vgrad(sd.ctx, shore - 30, h, [[0, '#e7cf9f'], [0.5, '#e2c38d'], [1, '#d4ad73']]);
        sd.ctx.fillRect(0, shore - 40 * m, w, h);
        const g = grainTile(128, 0.11, seed);
        sd.ctx.globalCompositeOperation = 'multiply';
        sd.ctx.fillStyle = sd.ctx.createPattern(g, 'repeat')!; sd.ctx.fillRect(0, shore - 40 * m, w, h);
        sd.ctx.globalCompositeOperation = 'source-over';
        for (let i = 0; i < 26; i++) { // shells and pebbles
          sd.ctx.fillStyle = r() < 0.5 ? 'rgba(255,248,236,.8)' : 'rgba(150,120,90,.45)';
          sd.ctx.beginPath(); sd.ctx.ellipse(r() * w, shore + 50 * m + r() * (h - shore), (2 + r() * 3) * m, (1.5 + r() * 2) * m, r() * 3, 0, TAU); sd.ctx.fill();
        }
        // one soft cloud sprite, reused
        const c = layer(360, 120, dpr); cloud = c.c;
        for (let i = 0; i < 12; i++) glow(c.ctx, 70 + r() * 220, 64 + (r() - 0.5) * 26, 34 + r() * 36, 'rgba(255,255,255,1)', 0.5);
        clouds = Array.from({ length: 5 }, () => ({ x: r() * w, y: h * (0.05 + r() * 0.25), s: (0.6 + r() * 0.9) * m, v: (4 + r() * 6) * m }));
        glints = Array.from({ length: Math.round(w / 9) }, () => ({ x: w * 0.76 + (r() - 0.5) * w * 0.3 * (0.3 + r()), y: horizon + r() * (shore - horizon) * 0.9, l: (6 + r() * 18) * m, ph: r() * TAU }));
      },
      frame({ ctx, t, dt, pointer, intensity, motion }) {
        const sp = motion === 'reduced' ? 0.55 : 1;
        const T = t * sp;
        ctx.drawImage(sky, 0, 0, w, h);
        for (const c of clouds) {
          c.x += c.v * dt * sp; if (c.x > w + 200) c.x = -380 * c.s;
          ctx.globalAlpha = 0.75; ctx.drawImage(cloud, c.x, c.y, 360 * c.s, 120 * c.s); ctx.globalAlpha = 1;
        }
        // sea
        ctx.fillStyle = vgrad(ctx, horizon, shore, [[0, '#2f6f9a'], [0.55, '#3b93b4'], [1, '#5fc0c8']]);
        ctx.fillRect(0, horizon, w, shore - horizon + 30 * m);
        // swell lines moving toward the shore
        ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 1.2;
        for (let k = 0; k < 9; k++) {
          const p = ((T * 0.05 + k / 9) % 1);
          const y = horizon + (shore - horizon) * (p * p);
          ctx.globalAlpha = 0.15 + p * 0.45;
          ctx.beginPath();
          for (let x = 0; x <= w; x += 16) ctx.lineTo(x, y + Math.sin(x * 0.012 + k + T * 0.6) * (1 + p * 3) * m);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        // sun glitter
        const ng = Math.round(glints.length * (0.4 + intensity * 0.6));
        ctx.fillStyle = '#fffbe8';
        for (let i = 0; i < ng; i++) {
          const g = glints[i]; const a = Math.max(0, Math.sin(T * 2.4 + g.ph));
          if (a < 0.2) continue;
          ctx.globalAlpha = a * 0.85; ctx.fillRect(g.x + Math.sin(T + g.ph) * 6, g.y, g.l * a, 1.4);
        }
        ctx.globalAlpha = 1;
        // sand
        ctx.drawImage(sand, 0, 0, w, h);
        // three overlapping waves washing up and back
        for (let k = 0; k < 3; k++) {
          const p = ((T / 8 + k / 3) % 1);
          const reach = Math.sin(p * Math.PI);           // 0 → 1 → 0
          const out = p > 0.5;
          const dist = reach * (h - shore) * (0.18 + 0.1 * k);
          // wet sand left behind as water draws back
          if (out) { ctx.fillStyle = `rgba(120,92,58,${0.12 * (1 - reach)})`; ctx.fillRect(0, shore, w, dist + 26 * m); }
          ctx.beginPath(); ctx.moveTo(0, shore - 46 * m);
          const edge: number[] = [];
          for (let x = 0; x <= w + 10; x += 10) {
            const y = shoreY(x, T) + dist + Math.sin(x * 0.018 + k * 2 + T * 0.8) * 5 * m * reach;
            edge.push(y); ctx.lineTo(x, y);
          }
          ctx.lineTo(w, shore - 46 * m); ctx.closePath();
          ctx.fillStyle = `rgba(110,205,214,${0.22 + 0.15 * reach})`; ctx.fill();
          ctx.beginPath();
          edge.forEach((y, i) => (i ? ctx.lineTo(i * 10, y) : ctx.moveTo(0, y)));
          ctx.strokeStyle = `rgba(255,255,255,${0.35 + 0.5 * reach})`; ctx.lineWidth = 2.4 * m; ctx.stroke();
          ctx.strokeStyle = `rgba(255,255,255,${0.15 * reach})`; ctx.lineWidth = 7 * m; ctx.stroke();
        }
        // gulls
        const gx = ((T * 22 * m) % (w + 400)) - 200;
        ctx.strokeStyle = 'rgba(40,52,64,.7)'; ctx.lineWidth = 1.6 * m;
        for (const [ox, oy, s] of [[0, 0, 1], [36, 14, 0.8], [-30, 22, 0.7]]) {
          const x = gx + ox * m, y = h * 0.2 + oy * m + Math.sin(T * 0.7 + ox) * 6 * m, fl = Math.sin(T * 5 + ox) * 3 * m;
          ctx.beginPath(); ctx.moveTo(x - 9 * s * m, y - fl); ctx.quadraticCurveTo(x - 4 * s * m, y - 5 * s * m, x, y); ctx.quadraticCurveTo(x + 4 * s * m, y - 5 * s * m, x + 9 * s * m, y - fl); ctx.stroke();
        }
        // pointer ripples on the water
        if (pointer.active && pointer.y > horizon && pointer.y < shore && Math.hypot(pointer.vx, pointer.vy) > 40 && t - lastRipple > 0.12) {
          ripples.push({ x: pointer.x, y: pointer.y, r: 2, a: 0.6 }); lastRipple = t;
        }
        ripples = ripples.filter(rp => rp.a > 0.02);
        for (const rp of ripples) {
          rp.r += 40 * dt * m; rp.a *= 1 - dt * 1.4;
          ctx.strokeStyle = `rgba(255,255,255,${rp.a})`; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.ellipse(rp.x, rp.y, rp.r, rp.r * 0.3, 0, 0, TAU); ctx.stroke();
        }
      },
    };
  },
};

import type { SceneDef } from './types';
import { rng, layer, vgrad, glow, clamp, TAU } from './util';

/**
 * Rain on Glass — a window at night: blurred city lights behind, drops beaded on the glass,
 * and drops that slide down leaving thin trails. The cursor is a warm light behind the glass.
 */
interface Slider { x: number; y: number; r: number; v: number; pause: number; trail: number[] }

export const rain: SceneDef = {
  id: 'rain', accent: '#6fb6ff', base: '#101a26', scrim: 0.45, sound: 'rain', season: 'fall',
  create(seed) {
    let w = 0, h = 0, m = 1;
    let bg: HTMLCanvasElement, beads: HTMLCanvasElement;
    let sliders: Slider[] = [];
    let streaks: { x: number; y: number; l: number; v: number }[] = [];
    const R = Math.random;
    const newSlider = (top: boolean): Slider => ({ x: R() * w, y: top ? -10 : R() * h, r: (1.6 + R() * 2.8) * m, v: 0, pause: R() * 2, trail: [] });

    function drop(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, a = 1) {
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(10,18,28,.35)'; ctx.beginPath(); ctx.arc(x, y + r * 0.25, r, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(190,215,240,.35)'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.35, r * 0.32, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }

    return {
      resize(W, H, dpr) {
        w = W; h = H; m = clamp(Math.min(w, h) / 900, 0.6, 1.5);
        const r = rng(seed + 21);
        const b = layer(w, h, dpr); bg = b.c;
        b.ctx.fillStyle = vgrad(b.ctx, 0, h, [[0, '#0a111b'], [0.6, '#13202f'], [1, '#1c2a3a']]); b.ctx.fillRect(0, 0, w, h);
        const cols = ['255,176,90', '255,120,80', '120,200,255', '255,226,150', '180,140,255', '90,220,200'];
        for (let i = 0; i < 70; i++) {
          const y = h * (0.35 + r() * 0.7), rad = (12 + r() * 60) * m;
          glow(b.ctx, r() * w, y, rad, `rgba(${cols[(r() * cols.length) | 0]},1)`, 0.12 + r() * 0.22);
        }
        for (let i = 0; i < 26; i++) { // crisp bokeh discs
          const c = cols[(r() * cols.length) | 0], x = r() * w, y = h * (0.3 + r() * 0.7), rad = (8 + r() * 26) * m;
          b.ctx.fillStyle = `rgba(${c},.10)`; b.ctx.beginPath(); b.ctx.arc(x, y, rad, 0, TAU); b.ctx.fill();
          b.ctx.strokeStyle = `rgba(${c},.18)`; b.ctx.lineWidth = 1; b.ctx.stroke();
        }
        const d = layer(w, h, dpr); beads = d.c;
        const n = Math.round((w * h) / 1800);
        for (let i = 0; i < n; i++) drop(d.ctx, r() * w, r() * h, (0.5 + r() * r() * 2.6) * m, 0.8);
        sliders = Array.from({ length: Math.round((w * h) / 22000) + 10 }, () => newSlider(false));
        streaks = Array.from({ length: Math.round((w * h) / 6000) }, () => ({ x: r() * w, y: r() * h, l: (10 + r() * 22) * m, v: (500 + r() * 400) * m }));
      },
      frame({ ctx, t, dt, pointer, intensity, motion }) {
        const sp = motion === 'reduced' ? 0.45 : 1;
        const drift = Math.sin(t * 0.05) * 8 * m;
        ctx.drawImage(bg, drift, 0, w, h); ctx.drawImage(bg, drift - w, 0, w, h);
        if (pointer.active) glow(ctx, pointer.x, pointer.y, 220 * m, 'rgba(255,190,120,1)', 0.12);
        // falling rain far behind the glass
        const ns = Math.round(streaks.length * (0.3 + intensity * 0.7) * (motion === 'reduced' ? 0.5 : 1));
        ctx.strokeStyle = 'rgba(170,200,230,.16)'; ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < ns; i++) {
          const s = streaks[i]; s.y += s.v * dt * sp; s.x += s.v * 0.08 * dt * sp;
          if (s.y > h) { s.y = -s.l; s.x = Math.random() * w; }
          ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + s.l * 0.08, s.y + s.l);
        }
        ctx.stroke();
        ctx.drawImage(beads, 0, 0, w, h);
        // sliding drops: stop-and-go, with a trail
        const n = Math.round(sliders.length * (0.35 + intensity * 0.65));
        for (let i = 0; i < n; i++) {
          const d = sliders[i];
          if (d.pause > 0) d.pause -= dt * sp;
          else {
            d.v = Math.min(d.v + 260 * dt, 90 + d.r * 30);
            d.y += d.v * dt * sp; d.x += Math.sin(d.y * 0.05) * 0.3;
            d.trail.push(d.x, d.y); if (d.trail.length > 60) d.trail.splice(0, 2);
            if (Math.random() < 0.01) { d.pause = 0.3 + Math.random(); d.v = 0; }
          }
          if (d.y > h + 20) Object.assign(d, newSlider(true));
          if (d.trail.length > 3) {
            ctx.strokeStyle = 'rgba(200,225,250,.18)'; ctx.lineWidth = d.r * 0.6; ctx.lineCap = 'round';
            ctx.beginPath(); for (let k = 0; k < d.trail.length; k += 2) (k ? ctx.lineTo : ctx.moveTo).call(ctx, d.trail[k], d.trail[k + 1]); ctx.stroke();
          }
          drop(ctx, d.x, d.y, d.r);
        }
      },
    };
  },
};

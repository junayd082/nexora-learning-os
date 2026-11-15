import type { SceneDef, FrameInfo } from './types';
import { rng, layer, vgrad, glow, clamp, TAU } from './util';

/**
 * Sakura Night — indigo spring sky, a cherry tree reaching in from the top right,
 * petals drifting down. The cursor is a breeze: move it and the petals blow with it.
 */
interface Petal { x: number; y: number; s: number; rot: number; vr: number; vy: number; ph: number; c: string }

const PETAL_COLORS = ['#fbf4ff', '#f3e3fb', '#e8d2f6', '#f7dcef', '#ffffff'];
const BACK = ['rgba(170,150,226,.75)', 'rgba(150,132,214,.7)', 'rgba(196,172,236,.7)'];
const BLOSSOM = ['rgba(252,247,255,.95)', 'rgba(240,226,252,.92)', 'rgba(226,206,246,.9)', 'rgba(248,224,242,.9)'];

export const sakura: SceneDef = {
  id: 'sakura', accent: '#c9a8ff', base: '#24306f', scrim: 0.5, sound: 'wind', season: 'spring',
  create(seed) {
    let w = 0, h = 0, dpr = 1, m = 1;
    let bg: HTMLCanvasElement, tree: HTMLCanvasElement;
    let stars: { x: number; y: number; r: number; ph: number }[] = [];
    let petals: Petal[] = [];
    let wind = 0;

    /** A limb: drawn as a few jittered sub-segments so it bends like wood, tapering as it goes. */
    function branch(ctx: CanvasRenderingContext2D, r: () => number, x: number, y: number, a: number, len: number, wd: number, depth: number, blossoms: [number, number, number][]) {
      if (depth > 6 || len < 10 * m) { blossoms.push([x, y, 0.9 + r() * 0.5]); return; }
      const steps = 4;
      let cx = x, cy = y, ca = a;
      ctx.strokeStyle = depth < 2 ? '#1e1733' : '#271d3d'; ctx.lineCap = 'round';
      for (let i = 0; i < steps; i++) {
        ca += (r() - 0.5) * 0.35 + 0.025 * depth;        // wander, and droop as it thins
        const nx = cx + Math.cos(ca) * (len / steps), ny = cy + Math.sin(ca) * (len / steps);
        ctx.lineWidth = Math.max(0.6, wd * (1 - (i / steps) * 0.35));
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(nx, ny); ctx.stroke();
        if (depth >= 3 && r() < 0.32) blossoms.push([nx, ny, 0.5 + r() * 0.35]);
        cx = nx; cy = ny;
      }
      const kids = depth < 1 ? 3 : r() < 0.3 ? 3 : 2;
      for (let i = 0; i < kids; i++) {
        const spread = (i - (kids - 1) / 2) * (0.5 + r() * 0.35) + (r() - 0.5) * 0.25;
        branch(ctx, r, cx, cy, ca + spread, len * (0.62 + r() * 0.16), wd * 0.6, depth + 1, blossoms);
      }
    }

    function cluster(ctx: CanvasRenderingContext2D, r: () => number, x: number, y: number, k: number, back = false) {
      const n = Math.round((3 + r() * 7) * k);
      for (let i = 0; i < n; i++) {
        const fx = x + (r() - 0.5) * 30 * m * k, fy = y + (r() - 0.5) * 22 * m * k;
        const fr = (1.5 + r() * 2) * m;
        ctx.fillStyle = back ? BACK[(r() * BACK.length) | 0] : BLOSSOM[(r() * BLOSSOM.length) | 0];
        for (let p = 0; p < 5; p++) {
          const pa = (p / 5) * TAU + r();
          ctx.beginPath(); ctx.arc(fx + Math.cos(pa) * fr * 0.9, fy + Math.sin(pa) * fr * 0.9, fr * 0.72, 0, TAU); ctx.fill();
        }
        ctx.fillStyle = 'rgba(206,160,214,.9)';
        ctx.beginPath(); ctx.arc(fx, fy, fr * 0.32, 0, TAU); ctx.fill();
      }
    }

    function newPetal(r: () => number, anywhere: boolean): Petal {
      return {
        x: anywhere ? r() * w * 1.2 : w * (0.15 + r() * 1.0), y: anywhere ? r() * h : -20 - r() * h * 0.3,
        s: (2.5 + r() * 3.5) * m, rot: r() * TAU, vr: (r() - 0.5) * 2.2, vy: (18 + r() * 30) * m, ph: r() * TAU,
        c: PETAL_COLORS[(r() * PETAL_COLORS.length) | 0],
      };
    }

    return {
      resize(W, H, D) {
        w = W; h = H; dpr = D; m = clamp(Math.min(w, h) / 900, 0.55, 1.6);
        const r = rng(seed);
        // sky
        const b = layer(w, h, dpr); bg = b.c;
        b.ctx.fillStyle = vgrad(b.ctx, 0, h, [[0, '#1c2563'], [0.45, '#3446a6'], [0.8, '#4f60c0'], [1, '#6a76cf']]);
        b.ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 14; i++) glow(b.ctx, r() * w * 0.7, h * (0.45 + r() * 0.6), (120 + r() * 220) * m, 'rgba(160,170,240,0.6)', 0.18);
        for (let i = 0; i < 6; i++) glow(b.ctx, w * (0.5 + r() * 0.6), r() * h * 0.6, (160 + r() * 200) * m, 'rgba(190,150,235,0.6)', 0.15);
        const nStars = Math.round((w * h) / 1400);
        for (let i = 0; i < nStars; i++) {
          b.ctx.globalAlpha = 0.25 + r() * 0.6; b.ctx.fillStyle = '#fff';
          const s = r() < 0.92 ? 0.7 : 1.4; b.ctx.fillRect(r() * w, r() * h, s, s);
        }
        b.ctx.globalAlpha = 1;
        stars = Array.from({ length: Math.round((w * h) / 9000) }, () => ({ x: r() * w, y: r() * h, r: (0.8 + r() * 1.4), ph: r() * TAU }));
        // tree
        const t = layer(w, h, dpr); tree = t.c;
        const blossoms: [number, number, number][] = [];
        const L = Math.max(w, h);
        // [x, y, angle, length, width]: limbs reach in from the top-right and along the top edge
        const limbs: [number, number, number, number, number][] = [
          [w + 12, h * 0.06, Math.PI - 0.12, L * 0.2, 17],
          [w + 12, h * 0.34, Math.PI - 0.32, L * 0.17, 13],
          [w * 0.9, -14, Math.PI * 0.66, L * 0.15, 12],
          [w * 0.62, -14, Math.PI * 0.72, L * 0.12, 9],
          [w * 0.3, -14, Math.PI * 0.62, L * 0.09, 7],
        ];
        // collect the tree first so the haze can sit behind it
        const branches = layer(w, h, dpr);
        for (const [x, y, a, l, wd] of limbs) branch(branches.ctx, r, x, y, a, l, wd * m, 0, blossoms);
        const back = blossoms.map(() => r() < 0.4);
        for (const [x, y, k] of blossoms) if (r() < 0.3) glow(t.ctx, x, y, (24 + r() * 30) * m * k, 'rgba(150,130,225,1)', 0.2);
        blossoms.forEach(([x, y, k], i) => back[i] && cluster(t.ctx, r, x, y, k * 1.2, true));
        t.ctx.drawImage(branches.c, 0, 0, w, h);
        blossoms.forEach(([x, y, k], i) => !back[i] && cluster(t.ctx, r, x, y, k));
        // petals
        const pr = rng(seed + 1);
        petals = Array.from({ length: Math.round((w * h) / 9000) + 40 }, () => newPetal(pr, true));
      },
      frame(f: FrameInfo) {
        const { ctx, t, dt, pointer, intensity, motion } = f;
        const sp = motion === 'reduced' ? 0.5 : 1;
        ctx.drawImage(bg, 0, 0, w, h);
        // twinkle
        for (const s of stars) {
          const a = 0.5 + 0.5 * Math.sin(t * 1.6 + s.ph);
          ctx.globalAlpha = a * 0.9; ctx.fillStyle = '#fff';
          ctx.fillRect(s.x, s.y, s.r, s.r);
        }
        ctx.globalAlpha = 1;
        // tree sways a hair around the top-right corner
        const sway = Math.sin(t * 0.35) * 0.006 * sp + Math.sin(t * 0.9) * 0.002 * sp;
        ctx.save(); ctx.translate(w, 0); ctx.rotate(sway); ctx.translate(-w, 0);
        ctx.drawImage(tree, 0, 0, w, h); ctx.restore();
        // breeze from the pointer
        const target = pointer.active ? clamp(pointer.vx * 0.12, -260, 260) : 0;
        wind += (target - wind) * Math.min(1, dt * 1.5);
        const n = Math.round(petals.length * (0.35 + intensity * 0.65) * (motion === 'reduced' ? 0.6 : 1));
        const r = Math.random;
        for (let i = 0; i < n; i++) {
          const p = petals[i];
          p.y += p.vy * dt * sp;
          p.x += (-14 * m + Math.sin(t * 0.9 + p.ph) * 16 * m + wind) * dt * sp;
          p.rot += p.vr * dt * sp;
          if (pointer.active) {
            const dx = p.x - pointer.x, dy = p.y - pointer.y, d2 = dx * dx + dy * dy, R = 110 * m;
            if (d2 < R * R) { const d = Math.sqrt(d2) || 1; const push = (1 - d / R) * 140 * dt; p.x += (dx / d) * push; p.y += (dy / d) * push; }
          }
          if (p.y > h + 20 || p.x < -40 || p.x > w + 60) Object.assign(p, newPetal(r, false));
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(1, 0.55 + 0.45 * Math.abs(Math.sin(p.rot * 1.3)));
          ctx.fillStyle = p.c; ctx.globalAlpha = 0.92;
          ctx.beginPath(); ctx.ellipse(0, 0, p.s, p.s * 0.62, 0, 0, TAU); ctx.fill();
          ctx.restore();
        }
        ctx.globalAlpha = 1;
      },
    };
  },
};

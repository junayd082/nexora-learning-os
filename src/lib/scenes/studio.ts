import type { SceneDef } from './types';
import { rng, layer, vgrad, glow, clamp, TAU, grainTile } from './util';

/**
 * Ember Smoke — NEXORA's original ambient field: three pools of smoked orange, red and violet
 * light drifting on slow cycles, film grain, a vignette and a soft light that follows the cursor.
 */
export const ambient: SceneDef = {
  id: 'ambient', accent: '#ff7a1a', base: '#090a0d', scrim: 0.3, sound: null,
  create(seed) {
    let w = 0, h = 0, m = 1, gx = 0, gy = 0;
    let grain: HTMLCanvasElement, vig: HTMLCanvasElement, sprites: HTMLCanvasElement[] = [];
    const pools = [
      { c: '255,122,26', r: 0.55, ax: 0.32, ay: 0.3, px: 37, py: 43 },
      { c: '214,40,90', r: 0.5, ax: 0.7, ay: 0.62, px: 49, py: 31 },
      { c: '124,77,255', r: 0.6, ax: 0.55, ay: 0.2, px: 41, py: 53 },
    ];
    return {
      resize(W, H, dpr) {
        w = W; h = H; m = clamp(Math.min(w, h) / 900, 0.6, 1.6);
        grain = grainTile(160, 0.05, seed);
        const v = layer(w, h, dpr); vig = v.c;
        const g = v.ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.65)'); v.ctx.fillStyle = g; v.ctx.fillRect(0, 0, w, h);
        gx = w / 2; gy = h / 2;
        sprites = pools.map(p => { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d')!; glow(x, 128, 128, 128, `rgba(${p.c},1)`, 1); return c; });
      },
      frame({ ctx, t, dt, pointer, intensity, motion }) {
        const T = t * (motion === 'reduced' ? 0.5 : 1);
        ctx.fillStyle = '#090a0d'; ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'lighter';
        pools.forEach((p, i) => {
          const x = w * (p.ax + 0.12 * Math.sin((T / p.px) * TAU)), y = h * (p.ay + 0.1 * Math.cos((T / p.py) * TAU));
          const R = Math.max(w, h) * p.r;
          ctx.globalAlpha = 0.14 + intensity * 0.12; ctx.drawImage(sprites[i], x - R, y - R, R * 2, R * 2);
        });
        ctx.globalAlpha = 1;
        if (pointer.active) { gx += (pointer.x - gx) * Math.min(1, dt * 4); gy += (pointer.y - gy) * Math.min(1, dt * 4); glow(ctx, gx, gy, 260 * m, 'rgba(255,170,110,1)', 0.08); }
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(vig, 0, 0, w, h);
        ctx.fillStyle = ctx.createPattern(grain, 'repeat')!;
        ctx.save(); ctx.translate((T * 37) % 160, (T * 23) % 160); ctx.fillRect(-160, -160, w + 320, h + 320); ctx.restore();
      },
    };
  },
};

/**
 * Blueprint — drafting paper for the architecture & engineering rooms. The practice house
 * draws itself line by line, then fades and starts again. The cursor is a CAD crosshair with
 * live coordinates in feet and inches.
 */
export const blueprint: SceneDef = {
  id: 'blueprint', accent: '#7fc4ff', base: '#0d2747', scrim: 0.32, sound: null,
  create(seed) {
    let w = 0, h = 0, m = 1, s = 12, ox = 0, oy = 0;
    let bg: HTMLCanvasElement;
    // practice house linework in feet: [x1,y1,x2,y2] (y up)
    const segs: number[][] = [];
    const R = (a: number, b: number, c: number, d: number) => segs.push([a, b, c, b], [c, b, c, d], [c, d, a, d], [a, d, a, b]);
    R(0, 0, 30, 24); R(0.5, 0.5, 29.5, 23.5);
    segs.push([18, 0.5, 18, 23.5], [18.33, 0.5, 18.33, 23.5], [0.5, 14, 18, 14], [0.5, 14.33, 18, 14.33], [18.33, 9, 29.5, 9], [18.33, 9.33, 29.5, 9.33]);
    segs.push([0, -2, 30, -2], [-2, 0, -2, 24]);
    const arcs = [[5, 0.5, 3, 0, 90], [18.33, 2, 2.5, 0, 90], [18.33, 13.17, 2.67, 270, 360]];
    const fmt = (ft: number) => { const neg = ft < 0; ft = Math.abs(ft); let f = Math.floor(ft), i = Math.round((ft - f) * 12); if (i === 12) { f++; i = 0; } return `${neg ? '-' : ''}${f}'-${i}"`; };
    return {
      resize(W, H, dpr) {
        w = W; h = H; m = clamp(Math.min(w, h) / 900, 0.6, 1.5);
        s = Math.min(w * 0.42 / 34, h * 0.6 / 28); ox = w * 0.56; oy = h * 0.78;
        const r = rng(seed);
        const b = layer(w, h, dpr); bg = b.c;
        b.ctx.fillStyle = vgrad(b.ctx, 0, h, [[0, '#0f2d52'], [1, '#0a2140']]); b.ctx.fillRect(0, 0, w, h);
        for (let x = 0; x < w; x += 20) { b.ctx.fillStyle = x % 100 === 0 ? 'rgba(160,210,255,.13)' : 'rgba(160,210,255,.05)'; b.ctx.fillRect(x, 0, 1, h); }
        for (let y = 0; y < h; y += 20) { b.ctx.fillStyle = y % 100 === 0 ? 'rgba(160,210,255,.13)' : 'rgba(160,210,255,.05)'; b.ctx.fillRect(0, y, w, 1); }
        glow(b.ctx, w * 0.3, h * 0.3, Math.max(w, h) * 0.6, 'rgba(70,140,220,1)', 0.12 + r() * 0.01);
        // title block, bottom right
        b.ctx.strokeStyle = 'rgba(190,225,255,.35)'; b.ctx.lineWidth = 1;
        const tw = 220 * m, th = 70 * m, tx = w - tw - 24, ty = h - th - 24;
        b.ctx.strokeRect(tx, ty, tw, th); b.ctx.beginPath(); b.ctx.moveTo(tx, ty + th / 2); b.ctx.lineTo(tx + tw, ty + th / 2); b.ctx.stroke();
        b.ctx.fillStyle = 'rgba(200,230,255,.6)'; b.ctx.font = `600 ${11 * m}px ui-monospace, Menlo, monospace`;
        b.ctx.fillText('NEXORA · DRAFTING ROOM', tx + 10, ty + 22 * m); b.ctx.fillText('PRACTICE HOUSE   1/4" = 1\'-0"', tx + 10, ty + th - 13 * m);
      },
      frame({ ctx, t, pointer, motion }) {
        ctx.drawImage(bg, 0, 0, w, h);
        const X = (x: number) => ox - 15 * s + x * s, Y = (y: number) => oy - y * s;
        const cycle = 26, ct = motion === 'static' ? 18 : (t * (motion === 'reduced' ? 0.6 : 1)) % cycle;
        const draw = Math.min(1, ct / 18), fade = ct > 22 ? 1 - (ct - 22) / 4 : 1;
        const total = segs.length + arcs.length, upto = draw * total;
        ctx.strokeStyle = `rgba(200,235,255,${0.85 * fade})`; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
        let pen: [number, number] | null = null;
        segs.forEach((sg, i) => {
          if (i >= upto) return; const k = Math.min(1, upto - i);
          const [a, b, c, d] = sg; const ex = a + (c - a) * k, ey = b + (d - b) * k;
          ctx.globalAlpha = i >= 10 && i < 12 ? 0.6 : 1;
          ctx.beginPath(); ctx.moveTo(X(a), Y(b)); ctx.lineTo(X(ex), Y(ey)); ctx.stroke();
          if (k < 1) pen = [X(ex), Y(ey)];
        });
        arcs.forEach(([cx, cy, rr, a0, a1], j) => {
          const i = segs.length + j; if (i >= upto) return; const k = Math.min(1, upto - i);
          ctx.beginPath(); ctx.arc(X(cx), Y(cy), rr * s, -(a0 * Math.PI) / 180, -((a0 + (a1 - a0) * k) * Math.PI) / 180, true); ctx.stroke();
        });
        ctx.globalAlpha = fade;
        if (draw >= 1) {
          ctx.fillStyle = 'rgba(200,235,255,.8)'; ctx.font = `500 ${12 * m}px ui-monospace, Menlo, monospace`; ctx.textAlign = 'center';
          ctx.fillText(`30'-0"`, X(15), Y(-2) + 16 * m);
          ctx.save(); ctx.translate(X(-2) - 8 * m, Y(12)); ctx.rotate(-Math.PI / 2); ctx.fillText(`24'-0"`, 0, 0); ctx.restore();
          ctx.font = `600 ${10 * m}px ui-monospace, Menlo, monospace`;
          ctx.fillText('LIVING', X(9), Y(7)); ctx.fillText('KITCHEN', X(9), Y(19)); ctx.fillText('BEDROOM', X(24), Y(16.5)); ctx.fillText('BATH', X(24), Y(5));
          ctx.textAlign = 'start';
        }
        if (pen && motion !== 'static') { glow(ctx, pen[0], pen[1], 16, 'rgba(160,220,255,1)', 0.9); }
        ctx.globalAlpha = 1;
        // CAD crosshair
        if (pointer.active) {
          ctx.strokeStyle = 'rgba(200,235,255,.35)'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(0, pointer.y + 0.5); ctx.lineTo(w, pointer.y + 0.5); ctx.moveTo(pointer.x + 0.5, 0); ctx.lineTo(pointer.x + 0.5, h); ctx.stroke();
          ctx.strokeStyle = 'rgba(230,245,255,.9)'; ctx.strokeRect(pointer.x - 5, pointer.y - 5, 10, 10);
          ctx.fillStyle = 'rgba(220,240,255,.85)'; ctx.font = `500 ${11 * m}px ui-monospace, Menlo, monospace`;
          ctx.fillText(`${fmt((pointer.x - (ox - 15 * s)) / s)}, ${fmt((oy - pointer.y) / s)}`, pointer.x + 12, pointer.y - 10);
        }
      },
    };
  },
};

/** Calm — no motion, low contrast. The accessibility and test-day choice. */
export const calm: SceneDef = {
  id: 'calm', accent: '#9aa7b8', base: '#0e1116', scrim: 0.25, sound: null, still: true,
  create() {
    let w = 0, h = 0;
    return {
      resize(W, H) { w = W; h = H; },
      frame({ ctx }) {
        ctx.fillStyle = vgrad(ctx, 0, h, [[0, '#12161d'], [1, '#0b0d11']]); ctx.fillRect(0, 0, w, h);
        glow(ctx, w * 0.2, h * 0.1, Math.max(w, h) * 0.6, 'rgba(90,110,140,1)', 0.12);
      },
    };
  },
};

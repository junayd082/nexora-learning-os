import type { Motion, Pointer, SceneDef, SceneId, SceneInstance } from './types';
import { SCENES } from './registry';

/**
 * Mounts a living scene behind the page.
 * - One canvas per scene; switching scenes crossfades (700 ms) and then frees the old one.
 * - Device-pixel ratio is capped, and the backing store is capped at ~3.5 MP, so a 4K screen
 *   costs the same as a laptop.
 * - 'full' = 60 fps, 'reduced' = 30 fps with slower, sparser motion, 'static' = one frame.
 * - Pauses completely while the tab is hidden.
 */
export interface SceneHandle {
  setScene(id: SceneId): void;
  setMotion(m: Motion): void;
  setIntensity(v: number): void;
  /** Dims the scene (e.g. while taking a test). 0 = normal, 1 = almost black. */
  setDim(v: number): void;
  destroy(): void;
}

interface Layer { id: SceneId; def: SceneDef; inst: SceneInstance; canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; start: number; drawn: boolean }

const MAX_PIXELS = 3_500_000;

export function mountScene(host: HTMLElement, opts: { scene: SceneId; motion?: Motion; intensity?: number; seed?: number }): SceneHandle {
  let motion: Motion = opts.motion ?? 'full';
  let intensity = opts.intensity ?? 0.7;
  const seed = opts.seed ?? 1337;
  let w = 0, h = 0, dpr = 1;
  let layers: Layer[] = [];
  let raf = 0, last = 0, acc = 0;
  // Chromebook guard: if frames run slow, drop to 1x pixels and 30 fps automatically
  let ema = 1 / 60, frames = 0, lite = false;
  let hidden = typeof document !== 'undefined' && document.hidden;
  const pointer: Pointer = { x: 0, y: 0, vx: 0, vy: 0, active: false };
  let px = 0, py = 0, pt = 0;

  host.style.position ||= 'fixed';
  const dim = document.createElement('div');
  dim.style.cssText = 'position:absolute;inset:0;background:#000;opacity:0;transition:opacity .6s;pointer-events:none;z-index:2';
  host.appendChild(dim);

  const sizeFor = () => {
    const r = host.getBoundingClientRect();
    w = Math.max(1, r.width); h = Math.max(1, r.height);
    const cap = lite ? 1 : motion === 'full' ? 1.75 : 1.25;
    dpr = Math.min(window.devicePixelRatio || 1, cap);
    if (w * h * dpr * dpr > MAX_PIXELS) dpr = Math.sqrt(MAX_PIXELS / (w * h));
  };

  const fit = (L: Layer) => {
    L.canvas.width = Math.round(w * dpr); L.canvas.height = Math.round(h * dpr);
    L.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    L.inst.resize(w, h, dpr);
    L.drawn = false;
  };

  function addLayer(id: SceneId, fade: boolean) {
    const def = SCENES[id] ?? SCENES.calm;
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = `position:absolute;inset:0;width:100%;height:100%;display:block;transition:opacity .7s ease;opacity:${fade ? 0 : 1};z-index:1`;
    host.style.backgroundColor = def.base;
    host.insertBefore(canvas, dim);
    const ctx = canvas.getContext('2d', { alpha: false })!;
    const L: Layer = { id, def, inst: def.create(seed), canvas, ctx, start: performance.now(), drawn: false };
    fit(L);
    layers.push(L);
    drawLayer(L, 0);
    if (fade) {
      requestAnimationFrame(() => { canvas.style.opacity = '1'; });
      const old = layers.slice(0, -1);
      setTimeout(() => { old.forEach(destroyLayer); layers = layers.filter(l => !old.includes(l)); }, 760);
    }
  }

  function destroyLayer(L: Layer) { L.inst.destroy?.(); L.canvas.remove(); }

  function drawLayer(L: Layer, dt: number) {
    const still = motion === 'static' || L.def.still;
    if (still && L.drawn) return;
    // static scenes are drawn as if they had been running for a few seconds, so particles are spread out
    const t = still ? 6 : (performance.now() - L.start) / 1000;
    L.inst.frame({ ctx: L.ctx, w, h, t, dt: still ? 1 / 60 : dt, pointer, intensity, motion });
    L.drawn = true;
  }

  function loop(now: number) {
    raf = requestAnimationFrame(loop);
    if (hidden) { last = now; return; }
    const dt = Math.min(0.1, (now - (last || now)) / 1000);
    last = now;
    acc += dt;
    if (!lite && motion === 'full') {
      ema = ema * 0.95 + dt * 0.05; frames++;
      if (frames > 120 && ema > 0.028) { lite = true; sizeFor(); layers.forEach(fit); }
    }
    const step = motion === 'full' && !lite ? 0 : 1 / 30;
    if (acc < step) return;
    const frameDt = step ? acc : dt; acc = 0;
    // pointer velocity decays when the mouse stops
    pointer.vx *= 0.9; pointer.vy *= 0.9;
    for (const L of layers) drawLayer(L, frameDt);
  }

  const onMove = (e: PointerEvent) => {
    const r = host.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top, now = performance.now();
    const ddt = Math.max(1, now - pt) / 1000;
    if (pointer.active) { pointer.vx = pointer.vx * 0.7 + ((x - px) / ddt) * 0.3; pointer.vy = pointer.vy * 0.7 + ((y - py) / ddt) * 0.3; }
    pointer.x = px = x; pointer.y = py = y; pt = now; pointer.active = true;
  };
  const onLeave = () => { pointer.active = false; };
  const onVis = () => { hidden = document.hidden; };
  const ro = new ResizeObserver(() => { sizeFor(); layers.forEach(fit); layers.forEach(L => drawLayer(L, 0)); });

  sizeFor();
  addLayer(opts.scene, false);
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerdown', onMove, { passive: true });
  document.addEventListener('pointerleave', onLeave);
  window.addEventListener('blur', onLeave);
  document.addEventListener('visibilitychange', onVis);
  ro.observe(host);
  raf = requestAnimationFrame(loop);

  return {
    setScene(id) { if (layers.at(-1)?.id !== id) addLayer(id, motion !== 'static'); },
    setMotion(m) { if (m === motion) return; motion = m; sizeFor(); layers.forEach(fit); layers.forEach(L => drawLayer(L, 0)); },
    setIntensity(v) { intensity = Math.max(0, Math.min(1, v)); layers.forEach(L => { L.drawn = false; drawLayer(L, 0); }); },
    setDim(v) { dim.style.opacity = String(Math.max(0, Math.min(0.92, v))); },
    destroy() {
      cancelAnimationFrame(raf); ro.disconnect();
      window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerdown', onMove);
      document.removeEventListener('pointerleave', onLeave); window.removeEventListener('blur', onLeave);
      document.removeEventListener('visibilitychange', onVis);
      layers.forEach(destroyLayer); layers = []; dim.remove();
    },
  };
}

/**
 * One still frame of a scene, for picker tiles and class-period icons.
 * Rendered at a desktop-sized virtual canvas and scaled down (cover), so the tile
 * looks like a miniature of the real background instead of a zoomed-in crop.
 */
export function renderThumbnail(id: SceneId, w: number, h: number, seed = 1337): HTMLCanvasElement {
  const def = SCENES[id] ?? SCENES.calm;
  const VW = 1280, VH = 800;
  const big = document.createElement('canvas');
  big.width = VW; big.height = VH;
  const bctx = big.getContext('2d')!;
  const inst = def.create(seed);
  inst.resize(VW, VH, 1);
  inst.frame({ ctx: bctx, w: VW, h: VH, t: 6, dt: 1 / 60, pointer: { x: 0, y: 0, vx: 0, vy: 0, active: false }, intensity: 0.85, motion: 'static' });
  inst.destroy?.();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const c = document.createElement('canvas');
  c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
  const ctx = c.getContext('2d')!;
  const s = Math.max(c.width / VW, c.height / VH);
  const dw = VW * s, dh = VH * s;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(big, (c.width - dw) / 2, (c.height - dh) / 2, dw, dh);
  return c;
}

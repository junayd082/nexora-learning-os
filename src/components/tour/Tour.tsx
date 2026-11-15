'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, ArrowRight, Check, Sparkles, X } from 'lucide-react';
import type { Appearance } from '@/lib/appearance';
import { resolveScene } from '@/lib/scenes';
import { useAppearanceState, useSceneLock } from '@/components/scene/appearance-client';
import { FormArt, FORMS, formFor, type FormId } from '@/components/companion/forms';
import { play as sfx } from '@/components/companion/sound';
import { cn } from '@/lib/util';

/**
 * NEXORA's guided tour. On the first visit to Home the assistant (in whatever form the scene gives
 * it) leaves its dock and flies to each part of the interface in order of usefulness, with a
 * spotlight and a short card: where it is, what it does, how to use it. Later, the first time a
 * person opens a tool, it pops in once with a quick tip. "Guide me" (profile menu, Settings, or
 * asking the assistant) replays the tour any time: window.dispatchEvent(new CustomEvent('nexora:tour', { detail: 'main' })).
 * While it runs, the docked companion steps aside (nexora:tour-state) so there is only one of it.
 */
type Role = 'student' | 'teacher';
interface StepDef { id: string; targets: string[]; roles?: Role[]; nav?: boolean }
const MAIN: StepDef[] = [
  { id: 'welcome', targets: [] },
  { id: 'classnow', targets: ['classnow'] },
  { id: 'upcoming', targets: ['upcoming'], roles: ['student'] },
  { id: 'assistant', targets: ['@dock'] },
  { id: 'classrooms', targets: ['nav-classrooms', 'menu'], nav: true },
  { id: 'teach', targets: ['nav-teach', 'menu'], roles: ['teacher'], nav: true },
  { id: 'timer', targets: ['timer'], roles: ['teacher'] },
  { id: 'bell', targets: ['bell'], roles: ['teacher'] },
  { id: 'portfolio', targets: ['nav-portfolio', 'menu'], roles: ['student'], nav: true },
  { id: 'explore', targets: ['nav-discover', 'menu'], nav: true },
  { id: 'search', targets: ['search'] },
  { id: 'theme', targets: ['theme'] },
  { id: 'user', targets: ['user'] },
  { id: 'done', targets: [] },
];

function toolFor(path: string, role: Role): string | null {
  if (path === '/classes') return 'classes';
  if (/^\/classes\/[^/]+\/checks\/new/.test(path)) return role === 'teacher' ? 'checkNew' : null;
  if (/^\/classes\/[^/]+\/summary\/new/.test(path)) return role === 'teacher' ? 'summary' : null;
  if (/^\/classes\/[^/]+\/notes$/.test(path)) return 'cornell';
  if (/^\/classes\/[^/]+$/.test(path)) return role === 'teacher' ? 'classTeacher' : 'classStudent';
  if (path === '/portfolio') return role === 'student' ? 'portfolio' : null;
  if (path === '/portfolio/cv') return 'cv';
  if (['/discover', '/worlds', '/library', '/apps', '/profile'].includes(path)) return path.slice(1);
  if (path === '/teach') return role === 'teacher' ? 'teach' : null;
  return null;
}

type R = { x: number; y: number; w: number; h: number };
const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* */ } },
};

/** Bounding box of a [data-tour] anchor (anchors may be display:contents wrappers). */
function rectOf(el: Element): DOMRect | null {
  let e: Element | null = el;
  if (getComputedStyle(el).display === 'contents') e = Array.from(el.children).find((c) => getComputedStyle(c).display !== 'none') ?? null;
  if (!e) return null;
  const r = e.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? r : null;
}
function findTarget(names: string[]): { el: Element; name: string } | null {
  for (const n of names) {
    if (n === '@dock') return null;
    for (const el of Array.from(document.querySelectorAll(`[data-tour="${n}"]`))) {
      if (rectOf(el) && !el.closest('[aria-hidden="true"]')) return { el, name: n };
    }
  }
  return null;
}

export function Tour({ userId, role, appearance, companionOn, home = '/home' }: { userId: string; role: Role; appearance: Appearance; companionOn: boolean; home?: string }) {
  const t = useTranslations('tour');
  const tn = useTranslations('nova');
  const tt = t as unknown as (k: string, v?: Record<string, string | number>) => string;
  const path = usePathname();
  const router = useRouter();
  const [ap] = useAppearanceState(appearance);
  const lock = useSceneLock();
  const formId: FormId = formFor(lock ?? resolveScene(ap.scene), ap.companion, ap.sceneChosen);
  const form = FORMS[formId];
  const name = (tn as unknown as (k: string) => string)(`forms.${formId}.name`);
  const key = (k: string) => `nexora-tour:${userId}:${k}`;

  const [mode, setMode] = useState<null | { kind: 'main'; i: number } | { kind: 'tool'; id: string }>(null);
  const [steps, setSteps] = useState<StepDef[]>([]);
  const [vw, setVw] = useState(1280);
  const [vh, setVh] = useState(800);
  const [spot, setSpot] = useState<R | null>(null);
  const [onMenu, setOnMenu] = useState(false);
  const [card, setCard] = useState<{ x: number; y: number; w: number } | null>(null);
  const [cardH, setCardH] = useState(220);
  const [g, setG] = useState({ x: -200, y: -200, rot: 0, flying: false, shown: false });
  const [trail, setTrail] = useState<{ id: number; x: number; y: number }[]>([]);
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const gp = useRef({ x: -200, y: -200 });
  const anim = useRef(0);
  const pend = useRef<'main' | null>(null);
  const trailId = useRef(1);
  const reduce = typeof window !== 'undefined' && (window.matchMedia('(prefers-reduced-motion: reduce)').matches || ap.motion === 'static');
  const mobile = vw < 640;
  const gs = mobile ? 56 : 78; // guide size

  const dock = useCallback((): R => {
    const s = window.innerWidth < 768 ? 56 : window.innerWidth < 1100 ? 72 : 84;
    return { x: document.documentElement.clientWidth - s - 18, y: window.innerHeight - s - 10, w: s, h: s };
  }, []);

  // ---------------------------------------------------------------- flight
  const flyTo = useCallback((tx: number, ty: number, then?: () => void) => {
    cancelAnimationFrame(anim.current);
    const from = { ...gp.current };
    if (reduce || from.x < -100) {
      gp.current = { x: tx, y: ty }; setG((s) => ({ ...s, x: tx, y: ty, rot: 0, flying: false, shown: true })); then?.(); return;
    }
    const dist = Math.hypot(tx - from.x, ty - from.y);
    const ms = Math.min(1300, Math.max(520, dist * 1.25));
    const lift = Math.min(220, 60 + dist * 0.28);
    const cx = (from.x + tx) / 2 + (tx > from.x ? -1 : 1) * dist * 0.08;
    const cy = Math.min(from.y, ty) - lift;
    const t0 = performance.now();
    let lastTrail = 0;
    sfx(form.sfx.greet);
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; // ease in-out cubic
      const u = 1 - e;
      const x = u * u * from.x + 2 * u * e * cx + e * e * tx;
      const y = u * u * from.y + 2 * u * e * cy + e * e * ty;
      const dx = 2 * u * (cx - from.x) + 2 * e * (tx - cx);
      const rot = Math.max(-24, Math.min(24, dx / 40)) * Math.sin(Math.PI * k);
      gp.current = { x, y };
      setG({ x, y, rot, flying: k < 1, shown: true });
      if (now - lastTrail > 55 && k < 0.95) {
        lastTrail = now;
        const id = trailId.current++;
        setTrail((tr) => [...tr.slice(-16), { id, x: x + gs / 2 + (Math.random() - 0.5) * 14, y: y + gs * 0.6 + (Math.random() - 0.5) * 10 }]);
        setTimeout(() => setTrail((tr) => tr.filter((p) => p.id !== id)), 750);
      }
      if (k < 1) anim.current = requestAnimationFrame(tick); else then?.();
    };
    anim.current = requestAnimationFrame(tick);
  }, [reduce, form.sfx.greet, gs]);

  // ---------------------------------------------------------------- open / close
  const announce = (on: boolean) => window.dispatchEvent(new CustomEvent('nexora:tour-state', { detail: on }));
  const startMain = useCallback(() => {
    const avail = MAIN.filter((s) => (!s.roles || s.roles.includes(role)) && (s.id !== 'assistant' || companionOn)
      && (s.targets.length === 0 || s.targets[0] === '@dock' || !!findTarget(s.targets)));
    setSteps(avail);
    const d = dock();
    gp.current = { x: d.x, y: d.y - 10 };
    setG({ x: d.x, y: d.y - 10, rot: 0, flying: false, shown: true });
    announce(true);
    setMode({ kind: 'main', i: 0 });
  }, [role, companionOn, dock]);

  const close = useCallback((markMain = true) => {
    const d = dock();
    if (mode?.kind === 'main' && markMain) store.set(key('main'), 'done');
    setSpot(null); setCard(null);
    flyTo(d.x, d.y, () => { setMode(null); setG((s) => ({ ...s, shown: false })); announce(false); });
  }, [mode, dock, flyTo]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onResize = () => { setVw(window.innerWidth); setVh(window.innerHeight); };
    onResize();
    window.addEventListener('resize', onResize);
    const onTour = (e: Event) => {
      const what = (e as CustomEvent<string>).detail || 'main';
      if (what === 'reset-tips') { Object.keys(localStorage).filter((k) => k.startsWith(`nexora-tour:${userId}:tool:`) || k === key('tips')).forEach(store.del); return; }
      if (location.pathname !== home) { pend.current = 'main'; router.push(home); return; }
      startMain();
    };
    window.addEventListener('nexora:tour', onTour);
    return () => { window.removeEventListener('resize', onResize); window.removeEventListener('nexora:tour', onTour); };
  }, [startMain, router, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // First visit to Home → the tour; first visit to a tool → its tip.
  useEffect(() => {
    if (mode) return;
    if (path === home && (pend.current === 'main' || !store.get(key('main')))) {
      pend.current = null;
      const tm = setTimeout(startMain, 1400);
      return () => clearTimeout(tm);
    }
    const tool = toolFor(path, role);
    if (!tool || !store.get(key('main')) || store.get(key('tips')) === 'off' || store.get(key(`tool:${tool}`))) return;
    if (!t.has(`tools.${tool}.${role}` as never)) return;
    const tm = setTimeout(() => {
      const d = dock(); gp.current = { x: d.x, y: d.y - 10 };
      setG({ x: d.x, y: d.y - 10, rot: 0, flying: false, shown: true });
      announce(true); setMode({ kind: 'tool', id: tool });
    }, 1300);
    return () => clearTimeout(tm);
  }, [path, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------- layout for the current step
  const step = mode?.kind === 'main' ? steps[mode.i] : null;
  const place = useCallback(() => {
    if (!mode) return;
    const W = window.innerWidth; const H = window.innerHeight;
    const cw = Math.min(380, W - 32);
    if (mode.kind === 'tool') {
      const x = W < 640 ? 16 : W - cw - 24; const y = W < 640 ? H - cardH - 16 : Math.max(72, H - cardH - 130);
      setSpot(null); setCard({ x, y, w: cw });
      flyTo(x + (W < 640 ? 8 : -gs * 0.55), y - gs * 0.78);
      return;
    }
    if (!step) return;
    let r: R | null = null;
    let menu = false;
    if (step.targets[0] === '@dock') { const d = dock(); r = { x: d.x - 6, y: d.y - 6, w: d.w + 12, h: d.h + 12 }; }
    else if (step.targets.length) {
      const f = findTarget(step.targets);
      if (f) {
        menu = f.name === 'menu' && !!step.nav;
        const b = rectOf(f.el)!;
        if (b.top < 60 || b.bottom > H - 20) {
          if (b.height < H * 0.7) (f.el.firstElementChild ?? f.el).scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
          else window.scrollTo({ top: window.scrollY + b.top - 90, behavior: reduce ? 'auto' : 'smooth' });
        }
        const bb = rectOf(f.el)!;
        const pad = 8;
        r = { x: bb.left - pad, y: bb.top - pad, w: bb.width + pad * 2, h: Math.min(bb.height + pad * 2, H * 0.62) };
      }
    }
    setOnMenu(menu);
    // Card: centered for intro/outro; on phones a bottom (or top) sheet; else beside the target.
    let x: number; let y: number;
    if (!r) { x = (W - cw) / 2; y = Math.max(90, (H - cardH) / 2 + 30); }
    else if (W < 640) { x = 16; y = r.y + r.h / 2 > H * 0.52 ? 76 : H - cardH - 16; }
    else {
      const below = r.y + r.h + 18; const above = r.y - cardH - 18;
      if (below + cardH < H - 12) y = below; else if (above > 64) y = above; else y = Math.max(72, Math.min(H - cardH - 12, r.y));
      x = Math.max(16, Math.min(W - cw - 16, r.x + r.w / 2 - cw / 2));
      if (y === Math.max(72, Math.min(H - cardH - 12, r.y))) x = r.x + r.w + 18 + cw < W ? r.x + r.w + 18 : Math.max(16, r.x - cw - 18);
    }
    setSpot(r); setCard({ x, y, w: cw });
    // The guide perches on the card's top corner, facing the target.
    const left = r ? r.x + r.w / 2 < x + cw / 2 : false;
    const gx = !r ? x + cw / 2 - gs / 2 : left ? x - gs * 0.35 : x + cw - gs * 0.65;
    const gy = y - gs * 0.8;
    // "I live down here": land in the dock itself.
    if (step.targets[0] === '@dock' && r) { flyTo(r.x + (r.w - gs) / 2, r.y + (r.h - gs) / 2); return; }
    flyTo(Math.max(6, Math.min(W - gs - 6, gx)), Math.max(58, gy));
  }, [mode, step, cardH, dock, flyTo, gs, reduce]);

  useEffect(() => {
    if (!mode) return;
    const tm = setTimeout(place, step && step.targets.length && step.targets[0] !== '@dock' ? 380 : 60);
    return () => clearTimeout(tm);
  }, [mode, step, place]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!mode) return;
    let raf = 0;
    const re = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(place); };
    window.addEventListener('resize', re);
    return () => { window.removeEventListener('resize', re); cancelAnimationFrame(raf); };
  }, [mode, place]);
  useLayoutEffect(() => {
    if (!cardRef.current) return;
    const h = cardRef.current.offsetHeight;
    if (Math.abs(h - cardH) > 4) setCardH(h);
  });
  useEffect(() => { if (card) nextRef.current?.focus({ preventScroll: true }); }, [mode, card]);

  // ---------------------------------------------------------------- keys
  const go = useCallback((d: number) => {
    if (mode?.kind !== 'main') return;
    const i = mode.i + d;
    if (i < 0) return;
    if (i >= steps.length) { close(); return; }
    setMode({ kind: 'main', i });
  }, [mode, steps.length, close]);
  useEffect(() => {
    if (!mode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); if (mode.kind === 'tool') store.set(key(`tool:${mode.id}`), '1'); close(); }
      else if (mode.kind === 'main' && (e.key === 'ArrowRight' || (e.key === 'Enter' && !(e.target as Element)?.closest('button')))) { e.preventDefault(); go(1); }
      else if (mode.kind === 'main' && e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, go, close]); // eslint-disable-line react-hooks/exhaustive-deps

  const text = useMemo(() => {
    if (!mode) return null;
    if (mode.kind === 'tool') {
      return { title: tt(`tools.${mode.id}.title`), bullets: tt(`tools.${mode.id}.${role}`).split('|') };
    }
    if (!step) return null;
    const body = t.has(`s.${step.id}.${role}` as never) ? tt(`s.${step.id}.${role}`) : tt(`s.${step.id}.student`);
    return { title: tt(`s.${step.id}.title`, { name }), body };
  }, [mode, step, role, name]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!mode || !g.shown) return null;
  const isMain = mode.kind === 'main';
  const i = isMain ? mode.i : 0;
  const last = isMain && i === steps.length - 1;
  const glow = form.glow;

  return (
    <div className="nx-tour no-print" aria-live="polite">
      {/* dim + spotlight (main tour only) */}
      {isMain && (
        <>
          <div className="fixed inset-0 z-[80]" onClick={(e) => e.stopPropagation()} />
          <div aria-hidden className="nx-tour-spot fixed z-[81] rounded-2xl"
            style={spot ? { left: spot.x, top: spot.y, width: spot.w, height: spot.h } : { left: vw / 2, top: vh / 2, width: 0, height: 0 }} />
          {spot && <div aria-hidden className="nx-tour-ring fixed z-[82] rounded-2xl" style={{ left: spot.x, top: spot.y, width: spot.w, height: spot.h, ['--g1' as string]: glow[0], ['--g2' as string]: glow[1] }} />}
        </>
      )}

      {/* sparkle trail */}
      {trail.map((p) => <span key={p.id} aria-hidden className="nx-tour-trail fixed z-[83]" style={{ left: p.x, top: p.y, background: `radial-gradient(circle, ${glow[1]}, ${glow[0]}00 70%)` }} />)}

      {/* the guide */}
      <div aria-hidden className={cn('nx-tour-guide fixed z-[85]', g.flying && 'is-flying')}
        style={{ left: 0, top: 0, width: gs, height: gs, transform: `translate(${g.x}px, ${g.y}px) rotate(${g.rot}deg)`, ['--g1' as string]: glow[0], ['--g2' as string]: glow[1] }}>
        <span className="nx-tour-halo" />
        <FormArt id={formId} pose={g.flying ? 'walk' : 'stand'} mood={g.flying ? 'happy' : 'normal'} look={spot && card ? [spot.x + spot.w / 2 < card.x + card.w / 2 ? -0.8 : 0.8, -0.2] : [0, 0]} />
      </div>

      {/* card */}
      {card && text && (
        <div ref={cardRef} role="dialog" aria-modal={isMain} aria-labelledby="nx-tour-title"
          className={cn('nx-tour-card fixed z-[86] p-5', !isMain && 'is-tip')} style={{ left: card.x, top: card.y, width: card.w, ['--g1' as string]: glow[0], ['--g2' as string]: glow[1] }}>
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted">
              {isMain ? t('stepOf', { n: i + 1, total: steps.length }) : <span className="inline-flex items-center gap-1"><Sparkles size={11} aria-hidden />{name}</span>}
            </span>
            <button type="button" className="rounded-full p-1 text-muted hover:text-ink" aria-label={isMain ? t('skip') : t('gotIt')}
              onClick={() => { if (!isMain) store.set(key(`tool:${mode.id}`), '1'); close(); }}><X size={15} aria-hidden /></button>
          </div>
          <h2 id="nx-tour-title" className="text-[17px] font-semibold leading-snug [text-wrap:balance]">{text.title}</h2>
          {'body' in text && text.body && <p className="mt-2 text-sm leading-relaxed text-ink/85">{text.body}</p>}
          {isMain && onMenu && <p className="mt-2 text-xs text-muted">{t('inMenu')}</p>}
          {'bullets' in text && text.bullets && (
            <ul className="mt-2.5 space-y-1.5 text-sm leading-relaxed text-ink/85">
              {text.bullets.map((b) => <li key={b} className="flex gap-2"><span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: glow[0] }} />{b}</li>)}
            </ul>
          )}
          {last && <p className="mt-3 text-xs text-muted">{t('replay')}</p>}

          {isMain ? (
            <>
              <div className="mt-4 flex items-center gap-1" aria-hidden>
                {steps.map((s, k) => <span key={s.id} className="h-1 flex-1 rounded-full transition-colors" style={{ background: k <= i ? glow[0] : 'rgb(var(--line) / 0.15)' }} />)}
              </div>
              <div className="mt-4 flex items-center gap-2">
                {i === 0
                  ? <button type="button" className="btn-ghost btn-sm" onClick={() => close()}>{t('skip')}</button>
                  : <button type="button" className="btn-ghost btn-sm" onClick={() => go(-1)}><ArrowLeft size={14} aria-hidden />{t('back')}</button>}
                <span className="ml-auto hidden text-[10.5px] text-faint sm:inline">{t('keys')}</span>
                <button ref={nextRef} type="button" className="btn-primary btn-sm" onClick={() => go(1)}>
                  {last ? <><Check size={14} aria-hidden />{t('finish')}</> : <>{t('next')}<ArrowRight size={14} aria-hidden /></>}
                </button>
              </div>
            </>
          ) : (
            <div className="mt-4 flex items-center gap-2">
              <button type="button" className="btn-ghost btn-sm text-muted" onClick={() => { store.set(key('tips'), 'off'); store.set(key(`tool:${mode.id}`), '1'); close(); }}>{t('tipsOff')}</button>
              <button ref={nextRef} type="button" className="btn-primary btn-sm ml-auto" onClick={() => { store.set(key(`tool:${mode.id}`), '1'); close(); }}><Check size={14} aria-hidden />{t('gotIt')}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

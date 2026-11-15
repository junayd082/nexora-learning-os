'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { getNovaBrief, setLiving } from '@/lib/actions';
import { cn } from '@/lib/util';
import type { FoxMood, FoxPose } from './Fox';
import { FormArt, FORMS, formFor, restsIn, type FormDef, type FormId, type Particle } from './forms';
import { useAppearanceState, useSceneLock } from '@/components/scene/appearance-client';
import { resolveScene } from '@/lib/scenes';
import type { Appearance } from '@/lib/appearance';
import { NovaPanel, type PlayKind } from './NovaPanel';
import { nudge, type Brief } from './brain';
import { play as sfx } from './sound';

type Motion = 'full' | 'reduced' | 'static';
interface Labels { menu: string; search: string; explore: string; continue: string; tasks: string; hide: string; resting: string }
type Part = { id: number; kind: Particle; dx: number; delay: number };
const GLYPH: Record<Exclude<Particle, 'treat'>, string> = { heart: '♥', star: '✦', note: '♪', bang: '!', q: '?', bubble: '○', spark: '✧', snow: '❄', leaf: '🍁', ring: '◎', beep: 'beep' };
type Act = '' | 'hop' | 'tumble-r' | 'tumble-l' | 'flip' | 'shake' | 'land' | 'dangle' | 'chomp' | 'pounce' | 'howl' | 'spin';

// Never walk over these.
const BLOCKING = 'a,button,input,textarea,select,label,[role=button],[role=dialog],[role=menu],table,form,.card,h1,h2,h3,h4,p,li,img,svg,iframe,video';
const hasOwnText = (el: Element) => Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? '').trim().length > 0);
const dayKey = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const store = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* */ } } };

/**
 * Nova — NEXORA's companion. Since 0.7 Nova takes a different form in each living scene
 * (Cora the crab on the beach, Grid the bot on the blueprint…, see ./forms/registry.ts).
 * Every form shares this logic; the form decides the art, travel style, speed, sounds, treat,
 * particles and — through companion-forms.css — its own gesture for each act.
 * Nova (any form) —  A class helper (click → "Ask Nova": today's Do Now, lecture,
 * what's due) and a pet with a personality: notices the pointer, enjoys being petted,
 * tumbles when kicked, gets grumpy and runs off if kicked too often, can be picked up
 * and dropped, does tricks, eats treats, chases a ball and howls.
 * Reduced motion: reactions become expressions and words only. Never in Presentation Mode.
 */
export function Companion({ appearance, motion: motionProp, isEducator, signedIn = true }:
  { name?: string; appearance: Appearance; motion: Motion; isEducator: boolean; signedIn?: boolean; labels?: Labels }) {
  const t = useTranslations('nova');
  const tcmp = useTranslations('companion');
  // Which form is on screen: the student's scene (or a teacher's lock on this page), unless they pinned one.
  const [ap] = useAppearanceState({ ...appearance, motion: appearance.motion ?? motionProp });
  const pageLock = useSceneLock();
  const sceneId = pageLock ?? resolveScene(ap.scene);
  const formId: FormId = formFor(sceneId, ap.companion, ap.sceneChosen);
  const form: FormDef = FORMS[formId];
  const fm = useRef(form); fm.current = form;
  const motion: Motion = ap.motion;
  const name = (t as unknown as (k: string) => string)(`forms.${formId}.name`);
  const path = usePathname();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [size, setSize] = useState(84);
  const [x, setX] = useState(0);
  const [walkMs, setWalkMs] = useState(0);
  const [walking, setWalking] = useState(false);
  const [running, setRunning] = useState(false);
  const [away, setAway] = useState(false);
  const [pose, setPose] = useState<FoxPose>('sit');
  const [sleeping, setSleeping] = useState(false);
  const [flip, setFlip] = useState(false);
  const [look, setLook] = useState<[number, number]>([0, 0]);
  const [panel, setPanel] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [ducked, setDucked] = useState(false);
  const [ground, setGround] = useState(10);
  const [mood, setMood] = useState<FoxMood>('normal');
  const [morph, setMorph] = useState(false);
  const [act, setAct] = useState<Act>('');
  const [alert, setAlert] = useState(false);
  const [wag, setWag] = useState(false);
  const [say, setSay] = useState<{ text: string; open?: boolean } | null>(null);
  const [parts, setParts] = useState<Part[]>([]);
  const [drag, setDrag] = useState<{ x: number; b: number } | null>(null);
  const [fallMs, setFallMs] = useState(0);
  const [sliding, setSliding] = useState(false);
  const [gone, setGone] = useState(false);
  const [ball, setBall] = useState<{ x: number; ms: number } | null>(null);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [briefAt, setBriefAt] = useState(0);
  const [loading, setLoading] = useState(signedIn);
  const [badge, setBadge] = useState(false);
  // The guided tour flies its own copy of the assistant around; the docked one steps aside meanwhile.
  const [touring, setTouring] = useState(false);
  useEffect(() => {
    const on = (e: Event) => setTouring(!!(e as CustomEvent<boolean>).detail);
    window.addEventListener('nexora:tour-state', on);
    return () => window.removeEventListener('nexora:tour-state', on);
  }, []);
  const [, start] = useTransition();

  const st = useRef({ ground: 10, x: 0, away: false, pose: 'sit' as FoxPose, sleeping: false, panel: false, busy: false, lastActive: Date.now(), walking: false, size: 84 });
  Object.assign(st.current, { ground, x, away, pose, sleeping, panel, walking, size });
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => { const tm = setTimeout(fn, ms); timers.current.push(tm); return tm; };
  const moodTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const sayTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const homeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const partId = useRef(1);
  const kicks = useRef<number[]>([]);
  const lastKick = useRef(0);
  const lastPet = useRef(0);
  const helpShown = useRef(false);
  const suppressClick = useRef(false);
  const press = useRef<{ x: number; y: number; t: number; touch: boolean; dragging: boolean; lp?: ReturnType<typeof setTimeout> } | null>(null);

  // Quiet = lie down, no wandering or tricks: assignments, checks (tests) and the Calm scene.
  const focus = path.startsWith('/assignments/') || path.startsWith('/checks/') || restsIn(sceneId);
  const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lively = motion === 'full' && !reduce;
  const playful = motion !== 'static';
  const tt = t as unknown as (k: string, v?: Record<string, string | number>) => string;

  const dockX = useCallback(() => document.documentElement.clientWidth - st.current.size - 18, []);
  const minX = () => (document.querySelector('aside[data-sidebar]')?.getBoundingClientRect().right ?? 0) + 12;

  // ------------------------------------------------------------------ small helpers
  const speak = useCallback((text: string, ms = 2600, open = false) => {
    clearTimeout(sayTimer.current);
    setSay({ text, open });
    sayTimer.current = setTimeout(() => setSay(null), ms);
  }, []);
  const feel = useCallback((m: FoxMood, ms = 1600, a: Act = '', actMs = 700) => {
    clearTimeout(moodTimer.current);
    setSleeping(false); if (st.current.pose === 'lie' && !focus) setPose('sit');
    setMood(m);
    if (a) { setAct(''); requestAnimationFrame(() => setAct(a)); later(() => setAct((cur) => (cur === a ? '' : cur)), actMs); }
    moodTimer.current = setTimeout(() => setMood('normal'), ms);
    st.current.lastActive = Date.now();
  }, [focus]); // eslint-disable-line react-hooks/exhaustive-deps
  const burst = useCallback((kind: Part['kind'], n = 3) => {
    const add: Part[] = Array.from({ length: n }, (_, i) => ({ id: partId.current++, kind, dx: (Math.random() - 0.5) * 50, delay: i * 120 }));
    setParts((p) => [...p, ...add]);
    later(() => setParts((p) => p.filter((q) => !add.includes(q))), 1700 + n * 120);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Brief: what's on today (refreshed when the panel opens, at most once a minute).
  const loadBrief = useCallback(async () => {
    if (!signedIn) { setLoading(false); return; }
    try {
      const b = (await getNovaBrief()) as Brief | null;
      setBrief(b); setBriefAt(Date.now());
      const any = !!b?.classes.some((c) => c.items.length);
      setBadge(any && store.get('nexora-nova-seen') !== dayKey());
      return b;
    } catch { /* offline */ } finally { setLoading(false); }
    return null;
  }, [signedIn]);

  // ------------------------------------------------------------------ layout
  const measureGround = useCallback(() => {
    const f = document.querySelector('footer')?.getBoundingClientRect();
    const g = f && f.top < window.innerHeight - 10 ? Math.round(window.innerHeight - f.top) : 10;
    st.current.ground = g; setGround(g); return g;
  }, []);

  useEffect(() => {
    const layout = () => {
      const w = window.innerWidth;
      const s = w < 768 ? 56 : w < 1100 ? 72 : 84;
      setSize(s); st.current.size = s;
      if (!st.current.away) setX(document.documentElement.clientWidth - s - 18);
    };
    layout(); setMounted(true);
    window.addEventListener('resize', layout);
    return () => { window.removeEventListener('resize', layout); timers.current.forEach(clearTimeout); };
  }, []);

  // First brief + the morning nudge ("Today's Do Now: …").
  useEffect(() => {
    if (!mounted) return;
    void loadBrief().then((b) => {
      if (!b || focus || !playful) return;
      const line = nudge(b, tt);
      if (!line || store.get('nexora-nova-greeted') === dayKey()) return;
      store.set('nexora-nova-greeted', dayKey());
      later(() => { feel('happy', 2500, 'hop', 1100); sfx(fm.current.sfx.greet); burst('bang', 1); speak(line, 9000, true); }, 1800);
    });
  }, [mounted]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scene changed (or a teacher locked one, or a form was pinned) → Nova changes form:
  // a quick shimmer, then the new form introduces itself.
  const prevForm = useRef(formId);
  useEffect(() => {
    if (prevForm.current === formId) return;
    prevForm.current = formId;
    if (!mounted || hidden) return;
    setMorph(true); later(() => setMorph(false), 600);
    setSleeping(false); setMood('normal'); setAct('');
    if (!focus) setPose('sit');
    burst('star', 3);
    if (playful) speak(tt(`forms.${formId}.hello`), 3600);
    st.current.lastActive = Date.now();
  }, [formId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ------------------------------------------------------------------ movement
  const walkTo = useCallback((tx: number, done?: () => void, fast = false) => {
    const from = st.current.x;
    const ms = Math.max(fast ? 350 : 600, (Math.abs(tx - from) / (fast ? fm.current.run : fm.current.speed)) * 1000);
    setFlip(!fm.current.front && tx < from); // crab, owl, frog, drone and bot face the viewer setPose('walk'); setSleeping(false); setRunning(fast);
    setWalkMs(ms); setWalking(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setX(tx)));
    later(() => { setWalking(false); setRunning(false); setPose('sit'); setFlip(false); done?.(); }, ms + 40);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const goHome = useCallback(() => {
    clearTimeout(homeTimer.current);
    if (!st.current.away) return;
    walkTo(dockX(), () => { setAway(false); st.current.busy = false; });
  }, [walkTo, dockX]);
  const homeSoon = (ms: number) => { clearTimeout(homeTimer.current); homeTimer.current = setTimeout(() => { if (!press.current?.dragging) goHome(); }, ms); };

  const isClear = useCallback((px: number) => {
    const h = window.innerHeight; const s = st.current.size;
    for (const cx of [0.2, 0.5, 0.8]) for (const cy of [0.35, 0.8]) {
      const els = document.elementsFromPoint(px + cx * s, h - st.current.ground - s + cy * s);
      const top = els.find((e) => !ref.current?.contains(e) && !e.closest('.nx-field'));
      if (!top) continue;
      if (top.closest(BLOCKING) || hasOwnText(top) || top.closest('header,aside,nav')) return false;
    }
    return true;
  }, []);

  // Wandering (desktop, full motion, not in focus mode).
  useEffect(() => {
    if (!mounted || !lively || focus) return;
    let tm: ReturnType<typeof setTimeout>;
    const schedule = (first = false) => { tm = setTimeout(tryWander, first ? 25000 + Math.random() * 15000 : 70000 + Math.random() * 70000); };
    const tryWander = () => {
      const s = st.current; measureGround();
      if (window.innerWidth < 1100 || s.away || s.busy || s.sleeping || s.panel || document.hidden || press.current) return schedule();
      const lo = minX() + 12; const hi = dockX() - s.size * 2;
      if (hi - lo < s.size * 2) return schedule();
      for (let i = 0; i < 8; i++) {
        const tx = Math.round(lo + Math.random() * (hi - lo));
        let ok = isClear(tx);
        for (let p = Math.min(tx, dockX()); ok && p < Math.max(tx, dockX()); p += 48) ok = isClear(p);
        if (!ok) continue;
        s.busy = true; setAway(true);
        walkTo(tx, () => { later(() => setLook([-1, -0.4]), 3000); later(() => setLook([0.6, -0.2]), 7000); homeSoon(14000 + Math.random() * 10000); });
        break;
      }
      schedule();
    };
    schedule(true);
    return () => clearTimeout(tm);
  }, [mounted, lively, focus, dockX, isClear, walkTo, goHome]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scrolling or navigating sends Nova home; check if the dock covers content.
  useEffect(() => {
    if (!mounted) return;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0; measureGround();
        if (st.current.away && !st.current.walking && !press.current) goHome();
        else if (!st.current.away) setDucked(!isClear(dockX()));
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); if (frame) cancelAnimationFrame(frame); };
  }, [mounted, goHome, isClear, dockX, measureGround]);

  useEffect(() => {
    if (!mounted) return;
    goHome(); setPanel(false);
    const tm = setTimeout(() => { measureGround(); setDucked(!st.current.away && !isClear(dockX())); }, 400);
    return () => clearTimeout(tm);
  }, [path, mounted]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (focus) { setPose('lie'); setSleeping(false); }
    else if (st.current.pose === 'lie' && !st.current.sleeping) setPose('sit');
  }, [focus]);

  // ------------------------------------------------------------------ reactions
  const pet = useCallback(() => {
    lastPet.current = Date.now(); kicks.current = [];
    feel('love', 2400); setWag(true); later(() => setWag(false), 2400);
    burst('heart', 4); speak(t('r.hehe'), 1800); sfx(fm.current.sfx.love);
  }, [feel, burst, speak, t]); // eslint-disable-line react-hooks/exhaustive-deps

  const runAway = useCallback(() => {
    setPanel(false); feel('angry', 2000); speak(t('r.bye'), 2000); sfx('ouch');
    st.current.busy = true;
    const back = () => {
      setGone(false); speak(t('r.back'), 3200); feel('angry', 2600);
      st.current.busy = false;
    };
    if (!lively) { later(() => setGone(true), 900); later(back, 6000); return; }
    setAway(true);
    later(() => walkTo(document.documentElement.clientWidth + st.current.size + 30, () => {
      setGone(true);
      later(() => {
        setWalking(false); setX(document.documentElement.clientWidth + st.current.size + 30);
        later(() => { setGone(false); walkTo(dockX(), () => { setAway(false); back(); }); }, 60);
      }, 6500);
    }, true), 700);
  }, [feel, speak, t, lively, walkTo, dockX]); // eslint-disable-line react-hooks/exhaustive-deps

  const kick = useCallback((dir: number) => {
    const now = Date.now();
    if (now - lastKick.current < 700 || st.current.walking || st.current.panel) return;
    lastKick.current = now;
    kicks.current = kicks.current.filter((k) => now - k < 20000).concat(now);
    const n = kicks.current.length;
    sfx('ouch'); burst('star', 3);
    if (n >= 3) { kicks.current = []; runAway(); return; }
    feel(n === 1 ? 'dizzy' : 'angry', n === 1 ? 1800 : 3000, dir > 0 ? 'tumble-r' : 'tumble-l', 700);
    speak(n === 1 ? (Math.random() < 0.5 ? t('r.hey') : t('r.ouch')) : t('r.stop'), 1800);
    if (lively) {
      const nx = Math.max(minX(), Math.min(dockX(), st.current.x + dir * 80));
      if (nx !== st.current.x) {
        setSliding(true); setX(nx); later(() => setSliding(false), 700);
        if (Math.abs(nx - dockX()) > 4) { setAway(true); homeSoon(3200); }
      }
    }
  }, [burst, feel, speak, t, lively, dockX, runAway]); // eslint-disable-line react-hooks/exhaustive-deps

  const doPlay = useCallback((k: PlayKind) => {
    st.current.lastActive = Date.now();
    if (k === 'pet') return pet();
    const f = fm.current;
    if (k === 'treat') {
      burst('treat', 1);
      later(() => { feel('eat', 1800, 'chomp', 1300); sfx('munch'); }, 560);
      later(() => { speak(t('r.yum'), 1600); burst('heart', 2); }, 1700);
      return;
    }
    // Each animal's own trick and call (see companion-forms.css for the gestures).
    if (k === 'trick') { feel('happy', f.trickMs + 300, 'flip', f.trickMs); sfx(f.sfx.trick); later(() => { speak(tt(`forms.${f.id}.trick`), 1600); burst('star', 4); }, Math.round(f.trickMs * 0.85)); return; }
    if (k === 'howl') { feel('howl', f.callMs + 100, 'howl', f.callMs); sfx(f.sfx.call); speak(tt(`forms.${f.id}.call`), f.callMs + 200); burst(f.callParticle, 3); return; }
    if (k === 'ball') {
      const lo = minX() + 10;
      const target = Math.max(lo, st.current.x - 260);
      if (!lively || st.current.x - target < 80) { feel('happy', 1500, 'pounce', 700); speak(t('r.gotIt'), 1500); return; }
      setPanel(false);
      setBall({ x: st.current.x, ms: 0 });
      requestAnimationFrame(() => requestAnimationFrame(() => setBall({ x: target, ms: 900 })));
      setAway(true); st.current.busy = true;
      later(() => walkTo(target + 6, () => {
        feel('happy', 1800, 'pounce', 700); sfx(fm.current.sfx.happy); speak(t('r.gotIt'), 1600); setBall(null);
        later(() => { st.current.busy = false; goHome(); }, 1500);
      }, true), 350);
    }
  }, [pet, burst, feel, speak, t, lively, walkTo, goHome]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sleep after 45 s; pointer: eyes follow, ears perk when near, petting, swipe-kicks, startle.
  useEffect(() => {
    if (!mounted || motion === 'static') return;
    let frame = 0; let last: { x: number; y: number; t: number } | null = null;
    let lastEv: PointerEvent | null = null;
    let hoverSince = 0; let petSign = 0; let reversals: number[] = [];
    const onMove = (e: PointerEvent) => {
      const now = performance.now();
      const prev = last; last = { x: e.clientX, y: e.clientY, t: now }; lastEv = e;
      const s = st.current;
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      const cx = r.left + r.width / 2; const cy = r.top + r.height * 0.55;
      const d = Math.hypot(e.clientX - cx, e.clientY - cy);
      const wasAsleep = s.sleeping;
      if (Date.now() - s.lastActive > 1000) s.lastActive = Date.now();
      if (e.pointerType !== 'mouse' || press.current) return;
      const dt = prev ? Math.max(1, now - prev.t) : 16;
      const dx = prev ? e.clientX - prev.x : 0; const dy = prev ? e.clientY - prev.y : 0;
      const v = Math.hypot(dx, dy) / dt;
      const interactive = playful && !focus && !s.walking && !gone;

      // Wake up (startled if the pointer rushes in).
      if (wasAsleep && d < s.size * 1.6 && !focus) {
        setSleeping(false); setPose('sit');
        if (v > 1.3) { feel('surprised', 1200, 'hop', 600); burst('bang', 1); sfx(fm.current.sfx.greet); } else speak(t('r.yawn'), 1400);
      }
      setAlert(interactive && d < s.size * 2.2);

      if (interactive && prev && !s.panel) {
        // Swipe-kick: a fast pass straight through Nova with no button held.
        if (e.buttons === 0 && v > 1.7) {
          for (let i = 0; i <= 6; i++) {
            const px = prev.x + (dx * i) / 6; const py = prev.y + (dy * i) / 6;
            if (px > r.left + r.width * 0.12 && px < r.right - r.width * 0.12 && py > r.top + r.height * 0.2 && py < r.bottom) { kick(Math.sign(dx) || 1); break; }
          }
        }
        // Petting: slow back-and-forth strokes over Nova.
        const inside = e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom;
        if (inside) {
          if (!hoverSince) hoverSince = now;
          if (v < 1.1 && Math.abs(dx) > 1.5) {
            const sg = Math.sign(dx);
            if (petSign && sg !== petSign) reversals.push(now);
            petSign = sg;
            reversals = reversals.filter((q) => now - q < 1600);
            if (reversals.length >= 3 && Date.now() - lastPet.current > 2500) { reversals = []; pet(); }
          }
          if (!helpShown.current && now - hoverSince > 1400 && Date.now() - lastPet.current > 3000) { helpShown.current = true; speak(t('r.help'), 3200, true); }
        } else { hoverSince = 0; petSign = 0; }
      }

      if (!lively || frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const rr = ref.current?.getBoundingClientRect(); if (!rr || !lastEv) return;
        const hx = rr.left + rr.width * 0.68; const hy = rr.top + rr.height * 0.35;
        setLook([Math.max(-1, Math.min(1, (lastEv.clientX - hx) / 400)), Math.max(-1, Math.min(1, (lastEv.clientY - hy) / 300))]);
      });
    };
    const wake = () => { st.current.lastActive = Date.now(); if (st.current.sleeping && !focus) { setSleeping(false); setPose('sit'); } };
    const iv = setInterval(() => {
      const s = st.current;
      const idle = Date.now() - s.lastActive;
      if (!focus && !s.away && !s.panel && s.pose === 'sit' && idle > 45000) { setPose('lie'); setSleeping(true); setMood('normal'); }
      // Now and then, while nobody is busy with it: the animal's call, or its idle habit
      // (tail chase, dig, figure-eight, head tilt, shake off snow, sky watch, fly catch, shell peek, stretch, scan, measure).
      else if (lively && !focus && !s.away && !s.panel && !s.sleeping && idle > 20000 && idle < 44000 && !document.hidden && Math.random() < 0.08) {
        const f = fm.current;
        if (Math.random() < 0.45) { feel('howl', f.callMs, 'howl', f.callMs - 100); burst(f.callParticle, 2); speak(tt(`forms.${f.id}.call`), 1600); }
        else { feel('happy', f.idleMs + 200, 'spin', f.idleMs); if (f.idleParticle) burst(f.idleParticle, 3); }
      }
    }, 5000);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('keydown', wake);
    return () => { clearInterval(iv); window.removeEventListener('pointermove', onMove); window.removeEventListener('keydown', wake); if (frame) cancelAnimationFrame(frame); };
  }, [mounted, motion, lively, playful, focus, gone, feel, burst, speak, t, kick, pet]);

  // Guiding (navigation feedback) and celebrating (meaningful events).
  useEffect(() => {
    if (motion === 'static') return;
    const onGuide = () => {
      if (st.current.away || focus) return;
      setSleeping(false); setFlip(true); setPose('stand');
      later(() => { setFlip(false); setPose('sit'); }, 1100);
    };
    const onCelebrate = () => {
      setSleeping(false); setPose('stand'); setCelebrate(true); burst('star', 4); sfx(fm.current.sfx.happy);
      later(() => { setCelebrate(false); setPose(focus ? 'lie' : 'sit'); }, 1500);
    };
    // Any page can ask for a gesture: dispatchEvent(new CustomEvent('nexora:gesture', { detail: 'call' | 'trick' | 'idle' | 'greet' })).
    const onGesture = (e: Event) => {
      const g = (e as CustomEvent<string>).detail; const f = fm.current;
      if (focus || st.current.walking) return;
      if (g === 'call') { feel('howl', f.callMs, 'howl', f.callMs); sfx(f.sfx.call); burst(f.callParticle, 3); speak(tt(`forms.${f.id}.call`), f.callMs); }
      else if (g === 'trick') { feel('happy', f.trickMs + 300, 'flip', f.trickMs); sfx(f.sfx.trick); }
      else if (g === 'idle') { feel('happy', f.idleMs + 200, 'spin', f.idleMs); if (f.idleParticle) burst(f.idleParticle, 3); }
      else if (g === 'greet') { feel('happy', 1400, 'hop', 900); sfx(f.sfx.greet); }
    };
    window.addEventListener('nexora:guide', onGuide);
    window.addEventListener('nexora:celebrate', onCelebrate);
    window.addEventListener('nexora:gesture', onGesture);
    return () => { window.removeEventListener('nexora:guide', onGuide); window.removeEventListener('nexora:celebrate', onCelebrate); window.removeEventListener('nexora:gesture', onGesture); };
  }, [motion, focus]); // eslint-disable-line react-hooks/exhaustive-deps

  // Panel closes on an outside click.
  useEffect(() => {
    if (!panel) return;
    const onDown = (e: MouseEvent) => {
      const el = e.target as Element;
      if (ref.current?.contains(el) || el.closest?.('.nx-nova-panel')) return;
      setPanel(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [panel]);

  // ------------------------------------------------------------------ pick up / drop / tap
  const dropAt = (cx: number, b: number) => {
    const s = st.current;
    const nx = Math.max(8, Math.min(document.documentElement.clientWidth - s.size - 8, cx));
    const height = Math.max(0, b - s.ground);
    const ms = Math.min(650, 220 + height * 0.9);
    setFallMs(ms); setX(nx); setDrag(null);
    later(() => {
      setFallMs(0);
      // Fliers and floaters settle gently; everyone else lands with a bump.
      if (height > 220 && !fm.current.airborne) { feel('dizzy', 1800, 'land', 400); burst('star', 3); speak(t('r.land'), 1500); sfx('ouch'); }
      else { feel('happy', 1400, 'land', 400); speak(t('r.wee'), 1300); sfx('boing'); }
      const home = Math.abs(nx - dockX()) <= 4;
      setAway(!home); if (!home) homeSoon(3500);
    }, ms);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (st.current.walking || gone) return;
    const touch = e.pointerType !== 'mouse';
    if (!touch) e.preventDefault(); // no text selection while carrying Nova
    press.current = { x: e.clientX, y: e.clientY, t: performance.now(), touch, dragging: false };
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* */ }
    if (touch && playful && !focus) press.current.lp = setTimeout(() => startDrag(e.clientX, e.clientY), 420);
  };
  const startDrag = (px: number, py: number) => {
    if (!press.current || press.current.dragging || !playful || focus) return;
    press.current.dragging = true; suppressClick.current = true;
    clearTimeout(homeTimer.current);
    setPanel(false); setSleeping(false); setPose('sit');
    feel('surprised', 60000, 'dangle', 60000); speak(t('r.put'), 1600); sfx(fm.current.sfx.greet);
    setDrag({ x: px - st.current.size / 2, b: window.innerHeight - py - st.current.size * 0.2 });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const p = press.current; if (!p) return;
    const moved = Math.hypot(e.clientX - p.x, e.clientY - p.y);
    if (!p.dragging) {
      if (p.touch && moved > 14) {
        // A quick finger swipe across Nova is a kick; a slow one is a stroke.
        clearTimeout(p.lp);
        const v = moved / Math.max(1, performance.now() - p.t);
        press.current = null; suppressClick.current = true;
        if (playful && !focus) { if (v > 0.6) kick(Math.sign(e.clientX - p.x) || 1); else pet(); }
        return;
      }
      if (!p.touch && moved > 8 && (e.buttons & 1)) startDrag(e.clientX, e.clientY);
      return;
    }
    setDrag({ x: e.clientX - st.current.size / 2, b: window.innerHeight - e.clientY - st.current.size * 0.2 });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const p = press.current; press.current = null;
    if (!p) return;
    clearTimeout(p.lp);
    if (p.dragging) {
      clearTimeout(moodTimer.current); setAct(''); setMood('normal');
      dropAt(e.clientX - st.current.size / 2, window.innerHeight - e.clientY - st.current.size * 0.2);
    }
  };

  const openPanel = () => {
    if (suppressClick.current) { suppressClick.current = false; return; }
    if (gone) return;
    setPanel((open) => {
      const next = !open;
      if (next) {
        setSay(null); feel('happy', 1400, 'hop', 900); sfx(fm.current.sfx.greet);
        setBadge(false); store.set('nexora-nova-seen', dayKey());
        if (Date.now() - briefAt > 60000) void loadBrief();
        if (st.current.away && !st.current.walking) goHome();
      }
      return next;
    });
  };

  if (!mounted || hidden || touring || ['/login', '/signup', '/forgot-password', '/reset-password', '/auth/finish'].includes(path)) return null;

  const fx = drag ? drag.x : x;
  const bottom = drag ? drag.b : ground;
  const sayLeft = fx < 260;

  return (
    <>
      <div ref={ref} data-mood={mood} data-form={formId} data-loco={form.locomotion}
        className={cn('nx-companion no-print', morph && 'morph', walking && 'walking', running && 'running', away && 'away', celebrate && 'celebrate',
          ducked && !away && !drag && !panel && 'ducked', alert && 'alert', wag && 'wag', sliding && 'sliding', drag && 'dragging',
          fallMs > 0 && 'falling', gone && 'gone', act && `act-${act}`)}
        style={{ bottom, ['--fx' as string]: `${fx}px`, ['--fox' as string]: `${size}px`, ['--walk' as string]: `${walkMs}ms`, ['--fall' as string]: `${fallMs}ms`, ['--form-glow' as string]: `${form.glow[0]}55` }}>
        <button type="button" className="fox-btn" aria-label={t('open', { name })} aria-haspopup="dialog" aria-expanded={panel}
          title={sleeping ? tcmp('resting', { name }) : t('open', { name })}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
          onClick={openPanel}>
          <div className={cn('pose', flip && 'flip')}>
            <div className="gait">
              <FormArt id={formId} pose={pose} sleeping={sleeping} mood={mood} look={flip ? [-look[0], look[1]] : look} />
            </div>
          </div>
        </button>
        {badge && !panel && <span className="nx-badge" aria-label={t('badge')} />}
        {parts.map((p) => (
          <span key={p.id} aria-hidden className={cn('nx-part', `nx-part-${p.kind}`)} style={{ ['--dx' as string]: `${p.dx}px`, animationDelay: `${p.delay}ms` }}>
            {p.kind === 'treat' ? form.treat : GLYPH[p.kind]}
          </span>
        ))}
        {say && !panel && (
          say.open
            ? <button type="button" className={cn('nx-say', sayLeft && 'left')} onClick={() => { setSay(null); openPanel(); }}>{say.text}</button>
            : <div className={cn('nx-say', sayLeft && 'left')} role="status">{say.text}</div>
        )}
      </div>
      {ball && <span aria-hidden className="nx-ball no-print" style={{ bottom: ground, ['--bx' as string]: `${ball.x}px`, ['--bms' as string]: `${ball.ms}ms` }} />}
      {panel && (
        <div style={{ ['--panel-b' as string]: `${ground + size + 10}px` }} className="contents">
          <NovaPanel name={name} formId={formId} brief={brief} loading={loading} isEducator={isEducator}
            onClose={() => setPanel(false)} onPlay={doPlay}
            onHide={() => { setHidden(true); start(async () => { await setLiving({ companion: false }); router.refresh(); }); }} />
        </div>
      )}
    </>
  );
}

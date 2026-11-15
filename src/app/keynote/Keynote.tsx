'use client';

import '@fontsource/caveat/600.css';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, Expand, Music, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { FormArt, FORM_ORDER, FORMS, type FormId } from '@/components/companion/forms';
import { brand } from '@/lib/brand';
import { Score } from './score';
import { lineOf, NARRATORS, type NarratorId } from './script';
import { useNarrator, useRecorded } from './narration';

/**
 * NEXORA — the keynote. A launch-event introduction in the spirit of the big stage reveals:
 * black stage, one idea per screen, light that moves with the story, every build on a click.
 * → / Space / click: next · ← back · F full screen · N narrator · C captions · P autoplay · Home/End jump.
 * Everything shown on stage is a real NEXORA feature.
 */
export type Tone = 'ember' | 'violet' | 'cool' | 'mono' | 'gold';
export type Mode = 'drift' | 'converge' | 'burst' | 'calm' | 'storm';
interface SceneDef { id: string; beats: number; tone: Tone; mode?: Mode; label?: string; dur?: number[] }
const SCENES: SceneDef[] = [
  { id: 'open', beats: 3, tone: 'gold', mode: 'calm', dur: [2600, 3200, 4200] },
  { id: 'chaos', beats: 3, tone: 'mono', mode: 'storm', dur: [3600, 3400, 4200] },
  { id: 'question', beats: 1, tone: 'violet', mode: 'converge', dur: [4600] },
  { id: 'reveal', beats: 2, tone: 'ember', mode: 'burst', dur: [4200, 5200] },
  { id: 'home', beats: 3, tone: 'ember', label: '01 · Home', dur: [3200, 4600, 4600] },
  { id: 'room', beats: 3, tone: 'violet', label: '02 · The room, live', dur: [3200, 5200, 4600] },
  { id: 'engine', beats: 4, tone: 'cool', label: '03 · The question engine', dur: [3200, 4200, 3600, 5600] },
  { id: 'loop', beats: 3, tone: 'violet', label: '04 · Session summary', dur: [3200, 5000, 4600] },
  { id: 'alive', beats: 2, tone: 'ember', label: '05 · Alive', dur: [5200, 4600] },
  { id: 'students', beats: 2, tone: 'cool', label: '06 · For students', dur: [5200, 4200] },
  { id: 'notes', beats: 3, tone: 'gold', label: '07 · Cornell Notes', dur: [5200, 6200, 5600] },
  { id: 'numbers', beats: 1, tone: 'gold', dur: [6200] },
  { id: 'founder', beats: 2, tone: 'ember', mode: 'calm', dur: [4200, 6400] },
  { id: 'onemore', beats: 2, tone: 'violet', mode: 'calm', dur: [3800, 6800] },
  { id: 'close', beats: 1, tone: 'ember', mode: 'converge', dur: [9000] },
];
export const TONES: Record<Tone, [string, string, string]> = {
  ember: ['#ff7a1a', '#e0459c', '#ffb26b'], violet: ['#8758ff', '#e0459c', '#b9a3ff'],
  cool: ['#3fc8ff', '#8758ff', '#a9ecff'], mono: ['#8a8680', '#4b4946', '#d8d3cc'], gold: ['#ffb26b', '#ff7a1a', '#fff1dc'],
};

// ------------------------------------------------------------------ the light field
export function Field({ tone, mode }: { tone: Tone; mode: Mode }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const st = useRef({ tone, mode, t0: performance.now() });
  useEffect(() => { st.current = { tone, mode, t0: performance.now() }; }, [tone, mode]);
  useEffect(() => {
    const c = ref.current!; const ctx = c.getContext('2d')!;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0, h = 0, raf = 0; const dpr = Math.min(2, devicePixelRatio || 1);
    const N = innerWidth < 700 ? 90 : 170;
    const ps = Array.from({ length: N }, () => ({ x: Math.random(), y: Math.random(), z: Math.random() * 0.9 + 0.1, a: Math.random() * Math.PI * 2, s: Math.random() * 0.5 + 0.2 }));
    const size = () => { w = c.clientWidth; h = c.clientHeight; c.width = w * dpr; c.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    size(); addEventListener('resize', size);
    const draw = (now: number) => {
      const { tone: tn, mode: md, t0 } = st.current; const col = TONES[tn]; const k = (now - t0) / 1000;
      ctx.clearRect(0, 0, w, h);
      for (const p of ps) {
        const cx = 0.5, cy = 0.5;
        if (!reduce) {
          if (md === 'converge') { p.x += (cx - p.x) * 0.006 * p.z; p.y += (cy - p.y) * 0.006 * p.z; p.a += 0.01; }
          else if (md === 'burst') { const dx = p.x - cx, dy = p.y - cy; const d = Math.hypot(dx, dy) + 0.001; const f = k < 2.2 ? 0.012 / (1 + k) : 0.0004; p.x += (dx / d) * f * p.z; p.y += (dy / d) * f * p.z; }
          else if (md === 'storm') { p.a += 0.05 * p.s; p.x += Math.cos(p.a) * 0.0016 * p.z; p.y += Math.sin(p.a * 1.3) * 0.0016 * p.z; }
          else if (md === 'calm') { p.y -= 0.00012 * p.z; p.x += Math.sin(now / 4000 + p.a) * 0.00008; }
          else { p.y -= 0.00028 * p.z; p.x += Math.cos(now / 3000 + p.a) * 0.00015 * p.z; }
          if (p.x < -0.05) p.x = 1.05; if (p.x > 1.05) p.x = -0.05; if (p.y < -0.05) p.y = 1.05; if (p.y > 1.05) p.y = -0.05;
        }
        const r = (md === 'calm' ? 0.6 : 1) * (0.6 + p.z * 1.6);
        const alpha = (md === 'calm' ? 0.35 : 0.55) * p.z * (0.6 + 0.4 * Math.sin(now / 900 + p.a));
        ctx.beginPath(); ctx.fillStyle = p.z > 0.7 ? col[2] : p.z > 0.4 ? col[0] : col[1];
        ctx.globalAlpha = Math.max(0, alpha); ctx.arc(p.x * w, p.y * h, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', size); };
  }, []);
  return <canvas ref={ref} aria-hidden />;
}

// ------------------------------------------------------------------ helpers
const R = ({ on, children, className = '', delay = 0, as: Tag = 'div' }:
  { on: boolean; children: React.ReactNode; className?: string; delay?: number; as?: 'div' | 'span' | 'p' | 'h1' | 'h2' }) =>
  <Tag className={`kn-r ${className}`} data-on={on ? '1' : '0'} style={{ transitionDelay: on ? `${delay}ms` : '0ms' }}>{children}</Tag>;

function Countdown({ from, run }: { from: number; run: boolean }) {
  const [s, setS] = useState(from);
  useEffect(() => { if (!run) { setS(from); return; } const iv = setInterval(() => setS((v) => (v > 0 ? v - 1 : from)), 1000); return () => clearInterval(iv); }, [run, from]);
  const p = s / from; const C = 2 * Math.PI * 52;
  return (
    <div className="relative mx-auto h-[150px] w-[150px]">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90"><circle cx="60" cy="60" r="52" fill="none" stroke="#ffffff14" strokeWidth="7" />
        <circle cx="60" cy="60" r="52" fill="none" stroke="url(#kn-tg)" strokeWidth="7" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - p)} style={{ transition: 'stroke-dashoffset 1s linear' }} />
        <defs><linearGradient id="kn-tg"><stop offset="0" stopColor="#ff7a1a" /><stop offset="1" stopColor="#8758ff" /></linearGradient></defs></svg>
      <div className="absolute inset-0 grid place-items-center text-[34px] font-bold tabular-nums tracking-tight">{Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}</div>
    </div>
  );
}

const CHIPS = ['Slides', 'A quiz website', 'The LMS', 'A phone timer', 'Paper hall passes', 'Bell schedule PDF', 'Gradebook', 'Sign-out sheet', 'Email', 'A spreadsheet', 'Sticky notes', 'Group chat'];
const CHIP_POS = [[8, 16], [62, 10], [32, 6], [80, 30], [12, 62], [72, 62], [40, 76], [84, 80], [18, 86], [64, 88], [3, 36], [26, 26]];

// ------------------------------------------------------------------ scenes
function Scene({ id, b }: { id: string; b: number }) {
  const tn = useTranslations('nova');
  const name = (f: FormId) => (tn as unknown as (k: string) => string)(`forms.${f}.name`);
  const on = (n: number) => b >= n;

  switch (id) {
    case 'open':
      return (
        <div className="relative flex min-h-[60vh] flex-col items-center justify-center text-center">
          <div className="relative mb-14"><div className="kn-point" />{[1, 2, 3].map((k) => <span key={k} className={`kn-ring ${on(2) ? 'on' : ''} d${k}`} />)}</div>
          <R on={on(1)} className="kn-h2">Every school day begins the same way.</R>
          <R on={on(2)} className="kn-h1 mt-4" delay={300}><span className="kn-grad">With a bell.</span></R>
        </div>
      );
    case 'chaos':
      return (
        <div className="relative h-[70vh] w-full">
          {CHIPS.map((c, i) => {
            const [x, y] = CHIP_POS[i];
            const gone = on(2);
            return <span key={c} className={`kn-chip ${on(1) && !gone ? 'wob' : ''}`}
              style={{ left: gone ? '46%' : `${x}%`, top: gone ? '48%' : `${y}%`, opacity: on(0) && !gone ? 1 : 0, transform: gone ? 'scale(.4)' : 'none', transitionDelay: `${i * (gone ? 30 : 90)}ms`, animationDelay: `${i * 70}ms` }}>{c}</span>;
          })}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <R on={on(0) && !on(2)} className="kn-h2" delay={900}>And then, the tabs.</R>
            <R on={on(2)} className="kn-h1 -mt-[1.2em]" delay={700}>Twelve tools.<br /><span className="kn-dim">None of them talk to each other.</span></R>
          </div>
        </div>
      );
    case 'question':
      return (
        <div className="text-center">
          <R on={on(0)} className="kn-h1">What if the classroom had<br /><span className="kn-grad">an operating system?</span></R>
        </div>
      );
    case 'reveal':
      return (
        <div className="relative flex flex-col items-center text-center">
          <span className={`kn-burst ${on(0) ? 'on' : ''}`} />
          <div className="kn-logo">
            <R on={on(0)} className="fade"><div className="kn-mark">
              <svg viewBox="0 0 64 64" className="h-[62%] w-[62%]"><defs><linearGradient id="kn-mg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FF8A3D" /><stop offset=".55" stopColor="#C044B7" /><stop offset="1" stopColor="#8758FF" /></linearGradient></defs>
                <path d="M19 46V18l26 28V18" fill="none" stroke="url(#kn-mg)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" pathLength={100} strokeDasharray="100" strokeDashoffset={on(0) ? 0 : 100} style={{ transition: 'stroke-dashoffset 2.2s cubic-bezier(.7,0,.3,1) .3s' }} /></svg>
            </div></R>
            <div className="kn-word" data-on={on(0) ? '1' : '0'}>{brand.productName.split('').map((ch, i) => <span key={i} style={{ transitionDelay: `${700 + i * 110}ms` }}>{ch}</span>)}</div>
          </div>
          <R on={on(1)} className="kn-h2 mt-12"><span className="kn-grad">The Learning Operating System.</span></R>
          <R on={on(1)} className="kn-lead mt-5" delay={500}>{brand.tagline}</R>
        </div>
      );
    case 'home':
      return (
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.15fr]">
          <div>
            <R on={on(0)} className="kn-h1">It knows<br />what period<br /><span className="kn-grad">it is.</span></R>
            <R on={on(2)} className="kn-lead mt-8">The Westfield bell schedule is built in. Odd days, even days, Wednesdays, A–D lunch. Home opens on the class you’re in, and everything due before it.</R>
          </div>
          <R on={on(1)} className="kn-panel p-6 sm:p-7">
            <div className="flex items-center justify-between text-sm text-[#8b8780]"><span className="kn-eyebrow">Now · Period 3</span><span className="tabular-nums">10:46 AM</span></div>
            <div className="mt-3 text-[clamp(26px,3.2vw,44px)] font-bold tracking-tight">Architecture Design 1</div>
            <div className="mt-1 text-[#a9a5a0]">Mr. C · Room 105</div>
            <div className="kn-bar mt-5"><i style={{ width: on(1) ? '58%' : '0%' }} /></div>
            <div className="mt-2 flex justify-between text-xs text-[#8b8780]"><span>10:25</span><span>ends in 39 min</span><span>12:05</span></div>
            <div className="mt-6 grid grid-cols-8 gap-1.5">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((p) => <div key={p} className="rounded-lg py-2 text-center text-xs font-bold" style={{ background: p === 3 ? 'linear-gradient(135deg,#ff7a1a,#e0459c)' : '#ffffff0b', color: p === 3 ? '#fff' : p % 2 ? '#a9a5a0' : '#4f4c49' }}>P{p}</div>)}
            </div>
            <div className="mt-6 space-y-2">
              {[['Do Now', 'Units & coordinates', '#ff7a1a'], ['Due before class', 'Floor plan, sheet 2', '#e0459c'], ['Announcement', 'Field trip forms by Friday', '#8758ff']].map(([k, v, c], i) => (
                <R key={k} on={on(2)} delay={i * 180} className="kn-glass flex items-center gap-3 px-4 py-3">
                  <span className="h-8 w-1 rounded-full" style={{ background: c }} /><span className="min-w-0"><span className="block text-[11px] font-bold uppercase tracking-[.12em] text-[#8b8780]">{k}</span><span className="block truncate font-semibold">{v}</span></span>
                </R>
              ))}
            </div>
          </R>
        </div>
      );
    case 'room':
      return (
        <div>
          <R on={on(0)} className="kn-h1 text-center">Raise a hand.<br /><span className="kn-grad">Without raising a hand.</span></R>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            <R on={on(1)} className="kn-panel p-6 text-center" delay={0}>
              <div className="text-[64px] leading-none" style={{ animation: on(1) ? 'kn-wob .7s ease-in-out infinite alternate' : 'none' }}>✋</div>
              <div className="mt-4 font-semibold">Ava M. · Period 3</div><div className="text-sm text-[#8b8780]">raised 0:42 ago · #1 in line</div>
              <div className="mt-4 kn-pill">Teacher’s bell rings</div>
            </R>
            <R on={on(1)} className="kn-panel p-6" delay={220}>
              <div className="kn-eyebrow">Hall pass board</div>
              <div className="mt-4 kn-glass flex items-center justify-between px-4 py-3"><span className="font-semibold">Out of room</span><span className="tabular-nums text-[#ffb26b]">4:12</span></div>
              <div className="mt-2 kn-glass flex items-center justify-between px-4 py-3"><span>Next</span><span className="text-[#8b8780]">2 waiting</span></div>
              <div className="mt-4 text-sm text-[#8b8780]">One out at a time. Teacher approves every pass.</div>
            </R>
            <R on={on(1)} className="kn-panel p-6 text-center" delay={440}>
              <div className="kn-eyebrow mb-3">Do Now timer</div>
              <Countdown from={300} run={on(1)} />
            </R>
          </div>
          <R on={on(2)} className="kn-lead mt-10 text-center">Private by default. Classmates see “Out of room”, never where.</R>
        </div>
      );
    case 'engine': {
      const lines: [string, 'cut' | 'core' | ''][] = [
        ['Table of contents ............ 1', 'cut'], ['Lesson 2 · Pacing: 90-minute block · TEKS 130.xx', 'cut'],
        ['2.1 Setting Architectural Units', ''], ['Units tell AutoCAD how to read and show numbers. Architecture in the U.S. uses feet and inches, so we use Architectural units.', 'core'],
        ['AutoCAD 2026 · Page 2 of 14', 'cut'], ['2.5 Object Snaps', ''], ['Object Snap grabs exact points on objects, so lines meet perfectly instead of almost.', 'core'],
        ['Teacher note: collect worksheets at the door', 'cut'], ['Index: arc, block, circle, dimension…', 'cut'],
      ];
      return (
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.05fr]">
          <div>
            <R on={on(0)} className="kn-h1 kn-split">Every question <span className="kn-grad-cool">proves its answer.</span></R>
            <R on={on(1)} className="kn-lead mt-8">NEXORA reads the lecture you actually taught. It throws out tables of contents, indexes, headers, pacing and teacher notes.</R>
            <R on={on(2)} className="kn-lead mt-4">It writes only from the paragraphs that teach, and quotes the lesson for every answer. Then it checks the quote.</R>
          </div>
          <div className="relative">
            <R on={on(0)} className="kn-doc">
              {lines.map(([l, k], i) => <div key={i} className={`kn-line ${on(1) && k === 'cut' ? 'cut' : ''} ${on(2) && k === 'core' ? 'core' : ''}`} style={{ animationDelay: `${i * 120}ms`, fontWeight: k === '' ? 700 : 400 }}>{l}</div>)}
            </R>
            <R on={on(3)} className="kn-panel absolute -bottom-10 -right-2 w-[min(420px,92%)] p-5 sm:-right-8">
              <div className="kn-eyebrow">Do Now · Q1</div>
              <div className="mt-2 font-semibold leading-snug">Why do architecture drawings in the U.S. use Architectural units?</div>
              <div className="mt-3 grid gap-1.5 text-sm">{['They show feet and inches', 'They are metric', 'They draw faster'].map((o, i) => <div key={o} className="kn-glass px-3 py-2" style={i === 0 ? { borderColor: '#5cd49a88' } : {}}>{o}</div>)}</div>
              <div className="mt-3 border-l-2 border-[#ff7a1a] pl-3 text-sm italic text-[#a9a5a0]">“Units tell AutoCAD how to read and show numbers.” p. 2</div>
              <div className="mt-2 kn-verified">✓ Quote verified in the lesson</div>
            </R>
          </div>
        </div>
      );
    }
    case 'loop': {
      const nodes = [['Teach', 'Your lecture or PDF'], ['Check', 'Do Now · Exit ticket'], ['Summarize', 'One page for students'], ['Re-teach', 'Tomorrow’s Do Now']];
      const C = 2 * Math.PI * 150;
      return (
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1fr]">
          <div>
            <R on={on(0)} className="kn-h1">Then it<br /><span className="kn-grad">closes the loop.</span></R>
            <R on={on(2)} className="kn-lead mt-8">Today’s Exit ticket results write the session summary, the re-teach notes, and the focus of tomorrow’s Do Now. Absent students get a catch-up plan.</R>
          </div>
          <R on={on(1)} className="relative mx-auto aspect-square w-[min(440px,82vw)]">
            <svg viewBox="0 0 360 360" className="kn-loop absolute inset-0 h-full w-full -rotate-90">
              <defs><linearGradient id="kn-lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ff7a1a" /><stop offset=".5" stopColor="#e0459c" /><stop offset="1" stopColor="#8758ff" /></linearGradient></defs>
              <circle cx="180" cy="180" r="150" fill="none" stroke="#ffffff10" strokeWidth="2" />
              <circle className="arc" cx="180" cy="180" r="150" fill="none" stroke="url(#kn-lg)" strokeWidth="3" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={on(1) ? 0 : C} />
            </svg>
            {nodes.map(([n, s], i) => {
              const a = (i / 4) * Math.PI * 2 - Math.PI / 2; const x = 50 + Math.cos(a) * 41.6; const y = 50 + Math.sin(a) * 41.6;
              return (
                <div key={n} className="absolute" style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%,-50%)' }}>
                  <R on={on(1)} delay={400 + i * 550} className="kn-panel whitespace-nowrap px-4 py-3 text-center">
                    <div className="font-bold">{n}</div><div className="text-xs text-[#8b8780]">{s}</div>
                  </R>
                </div>
              );
            })}
            <div className="absolute inset-0 hidden place-items-center sm:grid"><R on={on(1)} delay={2600} className="kn-eyebrow text-center">Every day,<br />a little better</R></div>
          </R>
        </div>
      );
    }
    case 'alive':
      return (
        <div className="text-center">
          <R on={on(0)} className="kn-h2">Eleven companions. <span className="kn-grad">One for every scene.</span></R>
          <div className="mx-auto mt-14 grid max-w-6xl grid-cols-4 gap-x-4 gap-y-7 sm:grid-cols-6 lg:grid-cols-11">
            {FORM_ORDER.map((f, i) => (
              <R key={f} on={on(0)} delay={500 + i * 110} className="flex flex-col items-center">
                <div className="relative h-[clamp(56px,7vw,112px)] w-[clamp(56px,7vw,112px)]">
                  <span className="absolute -inset-3 rounded-full opacity-50 blur-xl" style={{ background: `radial-gradient(circle, ${FORMS[f].glow[0]}, transparent 70%)` }} />
                  <div className="relative h-full w-full"><FormArt id={f} pose="sit" mood="happy" /></div>
                </div>
                <div className="mt-3 text-sm font-semibold text-[#a9a5a0]">{name(f)}</div>
              </R>
            ))}
          </div>
          <R on={on(1)} className="kn-lead mt-12">And on your first day, one of them flies across the screen and shows you around.</R>
        </div>
      );
    case 'students':
      return (
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <R on={on(0)} className="kn-h1 kn-split">A professional CV. <span className="kn-grad-cool">Built in high school.</span></R>
            <R on={on(0)} delay={500} className="kn-lead mt-8">For summer jobs, part-time work and training programs. Skills, courses and projects come straight from NEXORA. One page, every time.</R>
            <R on={on(1)} className="kn-h2 mt-10">In English. <span className="kn-grad">Y en español.</span></R>
          </div>
          <R on={on(0)} delay={300} className="mx-auto w-[min(380px,80vw)] rotate-[2deg] rounded-md bg-white p-7 text-[#0f172a] shadow-[0_40px_120px_-20px_#000]">
            <div className="text-center"><div className="font-serif text-2xl font-bold">Alex Rivera</div><div className="mt-1 text-[11px] text-slate-500">Grade 11 · Architecture & Construction (CTE)</div><div className="mx-auto mt-3 h-[2px] w-full bg-[#1e3a8a]" /></div>
            {[['Profile', 3], ['Experience', 4], ['Education', 2], ['Skills', 2], ['Certifications', 2]].map(([h, n]) => (
              <div key={h as string} className="mt-3"><div className="text-[9px] font-bold uppercase tracking-[.16em] text-[#1e3a8a]">{h}</div>
                {Array.from({ length: n as number }, (_, i) => <div key={i} className="mt-1.5 h-[5px] rounded bg-slate-200" style={{ width: `${92 - i * 13}%` }} />)}</div>
            ))}
          </R>
        </div>
      );
    case 'notes': {
      const cue = ['Architectural units?', 'Relative vs. polar?', 'Ortho (F8)'];
      const lines = ['Units tell AutoCAD how to read numbers', 'U.S. architecture: feet and inches', '@x,y measures from the last point', '@distance<angle uses length + angle', 'Ortho locks horizontal / vertical'];
      const hand = { fontFamily: 'Caveat, cursive' };
      return (
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.15fr]">
          <div>
            <R on={on(0)} className="kn-h1 kn-split">Cornell notes. <span className="kn-grad">Built into every class.</span></R>
            <R on={on(1)} className="kn-lead mt-8">Questions on the left. Notes on the right. A summary at the bottom. Fill a page, and it simply continues on the next.</R>
            <R on={on(2)} className="mt-8 flex flex-wrap gap-3">
              <span className="kn-pill"><span style={{ color: '#5aa0ff' }}>W</span> Word (.docx)</span>
              <span className="kn-pill"><span style={{ color: '#ff6b6b' }}>PDF</span> Download</span>
              <span className="kn-pill">Quiz myself</span>
            </R>
          </div>
          <R on={on(0)} delay={250} className="relative mx-auto w-[min(640px,88vw)]">
            {/* second page sliding in behind */}
            <div className="absolute inset-0 rounded-md bg-[#f4f0e6] shadow-[0_30px_80px_-20px_#000]" style={{ transform: on(1) ? 'translate(18px, 16px) rotate(2.2deg)' : 'none', transition: 'transform 1.6s cubic-bezier(.22,1,.36,1) .9s' }} />
            <div className="relative overflow-hidden rounded-md text-[#1c1c21] shadow-[0_40px_120px_-20px_#000]"
              style={{ background: '#fffdf7', backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0 29px, #bcd3e6 29px 30px)', backgroundPosition: '0 70px', padding: '16px 20px 14px 44px' }}>
              <span className="absolute inset-y-0 left-[30px] w-[2px] bg-[#e58b8b]" />
              <div className="flex items-center justify-between">
                <span className="rounded-xl bg-[#f6e3a1] px-3 pb-1 text-[26px] font-semibold leading-none" style={{ ...hand, transform: 'rotate(-1deg)', display: 'inline-block' }}>Cornell Notes</span>
                <span className="font-mono text-[10px] tracking-[0.14em] text-[#8a8a94]">PAGE 1 OF 2</span>
              </div>
              <div className="mt-2 flex justify-between text-[13px]"><b>Lesson 2 — Lines and coordinates</b><span className="text-[#6f6f78]">Oct 28</span></div>
              <div className="mt-2 h-[3px] bg-[#17171b]" />
              <div className="grid grid-cols-[30%_1fr]" style={{ minHeight: 210 }}>
                <div className="border-r-[3px] border-[#17171b] pr-2 pt-1 text-[15px] font-semibold leading-[30px]">
                  <div className="text-[19px] font-semibold text-[#3a3a42]" style={hand}>Questions</div>
                  {cue.map((c, i) => <div key={c} className="truncate" style={{ opacity: on(1) ? 1 : 0, transition: `opacity .6s ease ${0.4 + i * 0.9}s`, marginTop: i ? 30 : 0 }}>{c}</div>)}
                </div>
                <div className="relative pl-3 pt-1 text-[16px] leading-[30px]" style={hand}>
                  <div className="text-[19px] font-semibold text-[#3a3a42]">Notes</div>
                  {lines.map((l, i) => (
                    <div key={l} className="overflow-hidden whitespace-nowrap" style={{ width: on(1) ? '100%' : '0%', transition: `width 1.1s steps(28) ${0.2 + i * 0.6}s`, fontSize: 20 }}>{l}</div>
                  ))}
                  <div className="absolute inset-0 top-[30px] flex items-center justify-center text-center text-[13px] text-[#4a4a52]"
                    style={{ background: 'repeating-linear-gradient(135deg, #f3efe4 0 12px, #efe9db 12px 24px)', opacity: on(2) ? 1 : 0, transform: on(2) ? 'none' : 'translateX(30px)', transition: 'all .9s cubic-bezier(.22,1,.36,1) .3s', fontFamily: 'inherit' }}>
                    <span className="rounded-full bg-[#1c1c21] px-4 py-2 text-[13px] font-semibold text-white" style={{ fontFamily: 'Manrope Variable, sans-serif' }}>Quiz myself · Reveal notes</span>
                  </div>
                </div>
              </div>
              <div className="h-[3px] bg-[#17171b]" />
              <div className="pt-1 leading-[30px]" style={hand}>
                <span className="text-[19px] font-semibold text-[#3a3a42]">Summary</span>
                <div className="overflow-hidden whitespace-nowrap text-[19px]" style={{ width: on(1) ? '100%' : '0%', transition: 'width 1.6s steps(40) 3.6s' }}>Units + coordinates let AutoCAD draw exact sizes.</div>
              </div>
            </div>
          </R>
        </div>
      );
    }
    case 'numbers': {
      const N = [['8', 'periods on the bell rail'], ['11', 'living companions'], ['2', 'languages, every screen'], ['1', 'home for the whole day'], ['0', 'paper hall passes'], ['100%', 'of AI questions cite the lesson']];
      return (
        <div className="grid grid-cols-2 gap-x-8 gap-y-12 md:grid-cols-3">
          {N.map(([n, l], i) => (
            <R key={l} on={on(0)} delay={i * 260}>
              <div className="kn-num kn-grad">{n}</div>
              <div className="mt-3 text-[clamp(14px,1.4vw,20px)] font-semibold text-[#a9a5a0]">{l}</div>
            </R>
          ))}
        </div>
      );
    }
    case 'founder':
      return (
        <div className="mx-auto max-w-4xl text-center">
          <R on={on(0)} className="kn-h1"><span className="kn-grad">{brand.signature}</span></R>
          <R on={on(1)} className="kn-lead mt-10">Designed and built in Room 105 at Westfield High School, by a CTE Architecture & Engineering teacher who wanted one place for everything his students need.</R>
          <R on={on(1)} delay={700} className="mt-8 font-mono text-sm tracking-[.3em] text-[#8b8780]">{brand.founder.toUpperCase()}</R>
        </div>
      );
    case 'onemore':
      return (
        <div className="text-center">
          <R on={on(0) && !on(1)} className="kn-h1">One more thing.</R>
          <div className="-mt-[1.1em]">
            <R on={on(1)} className="kn-h1">NEXORA is built <span className="kn-grad">with teachers.</span></R>
            <R on={on(1)} delay={900} className="kn-h2 mt-6 kn-dim">Not just for them.</R>
            <R on={on(1)} delay={1800} className="kn-lead mt-10">What would make your day easier? I want to hear it.</R>
          </div>
        </div>
      );
    case 'close':
      return (
        <div className="flex flex-col items-center text-center">
          <R on={on(0)} className="kn-logo">
            <div className="kn-mark"><svg viewBox="0 0 64 64" className="h-[62%] w-[62%]"><defs><linearGradient id="kn-mg2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FF8A3D" /><stop offset=".55" stopColor="#C044B7" /><stop offset="1" stopColor="#8758FF" /></linearGradient></defs><path d="M19 46V18l26 28V18" fill="none" stroke="url(#kn-mg2)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
            <div className="kn-word" data-on="1">{brand.productName.split('').map((ch, i) => <span key={i}>{ch}</span>)}</div>
          </R>
          <R on={on(0)} delay={800} className="kn-lead mt-10">{brand.tagline}</R>
          <R on={on(0)} delay={1500} className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <span className="kn-pill">Available now</span><span className="kn-pill font-mono tracking-wide">nexoraclass.vercel.app</span><span className="kn-pill">v{brand.version}</span>
          </R>
        </div>
      );
    default: return null;
  }
}


// ------------------------------------------------------------------ the stage
export function Keynote() {
  const [s, setS] = useState(0);
  const [b, setB] = useState(0);
  const [auto, setAuto] = useState(false);
  const [idle, setIdle] = useState(false);
  const [narrate, setNarrate] = useState(false);
  const [captions, setCaptions] = useState(true);
  const [cap, setCap] = useState('');
  const [voiceSel, setVoiceSel] = useState<NarratorId | 'browser'>('heart');
  useEffect(() => { try { const v = localStorage.getItem('nexora-keynote-narrator'); if (v === 'heart' || v === 'michael' || v === 'browser') setVoiceSel(v); } catch { /* */ } }, []);
  const chooseVoice = (v: NarratorId | 'browser') => { setVoiceSel(v); try { localStorage.setItem('nexora-keynote-narrator', v); } catch { /* */ } };
  const nar = useNarrator();
  const score = useRef<Score | null>(null);
  const getCtx = useCallback(() => (score.current?.ctx && score.current.voice ? { ctx: score.current.ctx, out: score.current.voice as AudioNode } : null), []);
  const rec = useRecorded(voiceSel === 'browser' ? 'heart' : voiceSel, getCtx);
  const useRec = voiceSel !== 'browser' && rec.available;
  const root = useRef<HTMLDivElement>(null);
  const scene = SCENES[s];
  const total = useMemo(() => SCENES.reduce((n, x) => n + x.beats, 0), []);
  const pos = SCENES.slice(0, s).reduce((n, x) => n + x.beats, 0) + b + 1;

  // ---- the score
  const [music, setMusic] = useState(true);
  const [scoreOn, setScoreOn] = useState(false);
  const wakeAudio = useCallback(() => {
    if (!score.current) score.current = new Score();
    score.current.enabled = music;
    score.current.start(); setScoreOn(true);
    void rec.prepare();
  }, [music, rec]);
  useEffect(() => { score.current?.setEnabled(music); }, [music]);
  useEffect(() => () => score.current?.stop(), []);

  const next = useCallback(() => {
    if (b + 1 < scene.beats) setB(b + 1);
    else if (s + 1 < SCENES.length) { setS(s + 1); setB(0); }
    else { setAuto(false); setNarrate(false); }
  }, [b, s, scene.beats]);
  const prev = useCallback(() => {
    if (b > 0) setB(b - 1);
    else if (s > 0) { setS(s - 1); setB(SCENES[s - 1].beats - 1); }
  }, [b, s]);
  const full = () => { const el = root.current; if (!document.fullscreenElement) el?.requestFullscreen?.().catch(() => {}); else document.exitFullscreen?.().catch(() => {}); };
  const startNarrator = useCallback(() => { nar.unlock(); wakeAudio(); setNarrate(true); }, [nar, wakeAudio]);
  // ---- the show: Play = theater mode (full screen, voice + music, controls drop away)
  const [voiceOn, setVoiceOn] = useState(true);
  const playing = auto || narrate;
  const dropTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const playShow = useCallback(() => {
    wakeAudio(); nar.unlock();
    setAuto(true); if (voiceOn) setNarrate(true);
    const el = root.current;
    if (el && !document.fullscreenElement) el.requestFullscreen?.().catch(() => {});
    clearTimeout(dropTimer.current); dropTimer.current = setTimeout(() => setIdle(true), 900);
  }, [wakeAudio, nar, voiceOn]);
  const pauseShow = useCallback(() => { setAuto(false); setNarrate(false); setIdle(false); }, []);
  const togglePlay = useCallback(() => { if (playing) pauseShow(); else playShow(); }, [playing, pauseShow, playShow]);
  const toggleNarrator = useCallback(() => {
    const on = !voiceOn; setVoiceOn(on);
    if (on && playing) startNarrator(); else if (!on) setNarrate(false);
  }, [voiceOn, playing, startNarrator]);

  // ---- scene changes, in sequence: the old scene leaves completely, a breath of dark, then the new
  // scene arrives. `view` is what is on stage; it trails the requested scene by OUT + GAP.
  const OUT = 520, GAP = 280;
  const [view, setView] = useState({ s: 0, b: 0 });
  const [leaving, setLeaving] = useState<{ id: string; b: number; k: number } | null>(null);
  const shown = useRef({ s: 0, b: 0 });
  useEffect(() => {
    const cur = shown.current;
    if (cur.s === s) { shown.current = { s, b }; setView({ s, b }); if (scoreOn && cur.b !== b) score.current?.cue(SCENES[s].id, b, false); return; }
    // scene change: take the current scene off, wait, then bring the new one on
    setLeaving({ id: SCENES[cur.s].id, b: cur.b, k: performance.now() });
    setView({ s: -1, b: 0 });
    if (scoreOn) score.current?.whoosh(SCENES[s].id === 'chaos' ? 1.2 : 0.9);
    const tm = setTimeout(() => {
      setLeaving(null);
      shown.current = { s, b }; setView({ s, b });
      if (scoreOn) score.current?.cue(SCENES[s].id, b, false);
    }, OUT + GAP);
    return () => clearTimeout(tm);
  }, [s, b, scoreOn]);
  useEffect(() => { if (scoreOn) score.current?.scene(SCENES[s].id); }, [scoreOn]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- keys
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as Element)?.closest?.('select')) return;
      if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); wakeAudio(); next(); }
      else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); prev(); }
      else if (e.key === 'f' || e.key === 'F') full();
      else if (e.key === 'p' || e.key === 'P' || e.key === 'k' || e.key === 'K') togglePlay();
      else if (e.key === 'Escape' && playing) pauseShow();
      else if (e.key === 'n' || e.key === 'N') toggleNarrator();
      else if (e.key === 'm' || e.key === 'M') { wakeAudio(); setMusic((m) => !m); }
      else if (e.key === 'c' || e.key === 'C') setCaptions((c) => !c);
      else if (e.key === 'Home') { setS(0); setB(0); }
      else if (e.key === 'End') { setS(SCENES.length - 1); setB(0); }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [next, prev, wakeAudio, toggleNarrator, togglePlay, pauseShow, playing]);

  // ---- autoplay without narrator
  useEffect(() => {
    if (!auto || narrate) return;
    const tm = setTimeout(next, scene.dur?.[b] ?? 4000);
    return () => clearTimeout(tm);
  }, [auto, narrate, s, b, next, scene.dur]);

  // ---- narration: speaks the line of what is on stage, the moment it appears; then the next build
  const nextRef = useRef(next); nextRef.current = next;
  useEffect(() => {
    if (!narrate) { if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel(); setCap(''); score.current?.duck(false); return; }
    if (view.s < 0) { setCap(''); return; } // between scenes
    const sc = SCENES[view.s];
    const line = lineOf(sc.id, view.b);
    const key = `${sc.id}-${view.b}`;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (fn: () => void, ms: number) => timers.push(setTimeout(fn, ms));
    let stop = () => {};
    const lastBeat = view.b === sc.beats - 1;
    // After a line: a short breath before the next build, a longer one before a new scene.
    const after = () => { score.current?.duck(false); later(() => nextRef.current(), lastBeat ? 900 : 550); };
    if (!line.text) { setCap(''); later(() => nextRef.current(), sc.dur?.[view.b] ?? 2400); }
    else {
      // Speak as the words become readable: the headline of a new scene is legible ~250 ms into its entrance.
      const lead = view.b === 0 ? 320 : 120;
      later(() => {
        setCap(line.text);
        if (useRec) {
          stop = rec.play(key, {
            start: () => score.current?.duck(true),
            end: after,
            fail: () => { stop = nar.say(line.say, line.lang, after, (on) => score.current?.duck(on)); },
          });
        } else stop = nar.say(line.say, line.lang, after, (on) => score.current?.duck(on));
      }, lead);
    }
    return () => { timers.forEach(clearTimeout); stop(); };
  }, [narrate, view.s, view.b, useRec, voiceSel]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel(); }, []);

  // ---- chrome fades when the pointer rests
  useEffect(() => {
    let tm: ReturnType<typeof setTimeout>;
    const wake = () => { setIdle(false); clearTimeout(tm); tm = setTimeout(() => setIdle(true), 2200); };
    addEventListener('pointermove', wake); addEventListener('pointerdown', wake);
    return () => { removeEventListener('pointermove', wake); removeEventListener('pointerdown', wake); clearTimeout(tm); };
  }, []);
  const touch = useRef<number | null>(null);

  const [c1, c2] = TONES[scene.tone];
  const preparing = voiceOn && useRec && rec.loaded < rec.total;
  return (
    <div ref={root} className={`kn ${playing ? 'theater' : ''} ${playing && idle ? 'idle' : ''}`}
      onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => { const x0 = touch.current; touch.current = null; if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) { wakeAudio(); if (dx < 0) next(); else prev(); } }}>
      <div className="kn-orb" style={{ width: '60vmax', height: '60vmax', left: '-18vmax', top: '-22vmax', background: c1, opacity: scene.id === 'open' ? 0.06 : 0.16, transform: `translate(${s * 2}vmax, ${b * 2}vmax)` }} />
      <div className="kn-orb" style={{ width: '54vmax', height: '54vmax', right: '-20vmax', bottom: '-24vmax', background: c2, opacity: scene.id === 'open' ? 0.04 : 0.14, transform: `translate(${-s * 1.5}vmax, ${-b * 2}vmax)` }} />
      <Field tone={scene.tone} mode={scene.mode ?? 'drift'} />
      <div key={`sweep-${scene.id}`} className="kn-sweep" aria-hidden />
      <button type="button" className="kn-hit" aria-label="Next" onClick={() => { wakeAudio(); next(); }} />

      <div className="kn-bar-t" aria-hidden /><div className="kn-bar-b" aria-hidden />
      <div className="kn-top pointer-events-none">
        <span className="kn-eyebrow">{brand.productName} · Keynote</span>
        <span className="kn-eyebrow">{scene.label ?? ''}</span>
      </div>

      <div className="kn-stage pointer-events-none max-sm:pointer-events-auto">
        <div className="kn-layers">
          {leaving
            ? <div key={`out-${leaving.k}`} className="kn-scene kn-leave" aria-hidden><Scene id={leaving.id} b={leaving.b} /></div>
            : view.s >= 0 && <div key={SCENES[view.s].id} className="kn-scene kn-in"><div className="kn-drift"><Scene id={SCENES[view.s].id} b={view.b} /></div></div>}
        </div>
      </div>

      {narrate && captions && cap && <div key={cap} className="kn-caption" aria-live="polite">{cap}</div>}
      {narrate && !useRec && (nar.heard === 'silent' || nar.heard === 'novoice') && (
        <div className="kn-warn" role="alert">
          {nar.heard === 'novoice'
            ? 'This browser has no speech voices installed. Choose the Heart or Michael narrator instead.'
            : 'No sound is coming out. On an iPhone, turn off Silent mode and turn the volume up. On a computer, check the volume and that this tab isn’t muted.'}
        </div>
      )}

      <div className="kn-bottom">
        <span className="kn-eyebrow kn-keys hidden xl:inline">→ next · ← back · P play · N voice · M music · C captions · F full screen</span>
        <div className="kn-ctrl ml-auto flex flex-wrap items-center justify-end gap-2">
          <button type="button" className="kn-btn kn-play" onClick={togglePlay} aria-pressed={playing}>
            {playing ? <Pause size={14} /> : <Play size={14} />}{playing ? 'Pause' : 'Play'}
          </button>
          <button type="button" className={`kn-btn ${voiceOn ? 'kn-on' : ''}`} onClick={toggleNarrator} aria-pressed={voiceOn} title="Narrator voice">
            {voiceOn ? <Volume2 size={13} /> : <VolumeX size={13} />}{preparing ? `Voice ${rec.loaded}/${rec.total}` : 'Voice'}
          </button>
          <select aria-label="Narrator" className="kn-btn kn-select" value={voiceSel} onChange={(e) => chooseVoice(e.target.value as NarratorId | 'browser')}>
            {NARRATORS.map((v) => <option key={v.id} value={v.id}>{v.label} · {v.note}</option>)}
            <option value="browser">Browser voice</option>
          </select>
          {voiceSel === 'browser' && nar.voices.length > 0 && (
            <select aria-label="Browser voice" className="kn-btn kn-select max-w-[180px]" value={nar.voice} onChange={(e) => nar.pick(e.target.value)}>
              {nar.voices.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name.replace(/^Microsoft |^Google /, '').replace(/ Online \(Natural\).*/, ' · Natural')}</option>)}
            </select>
          )}
          <button type="button" className={`kn-btn ${captions ? 'kn-on' : ''}`} onClick={() => setCaptions((c) => !c)} aria-pressed={captions}>CC</button>
          <button type="button" className={`kn-btn ${music && scoreOn ? 'kn-on' : ''}`} onClick={() => { wakeAudio(); setMusic((m) => (scoreOn ? !m : true)); }} aria-pressed={music && scoreOn} aria-label="Music"><Music size={13} /></button>
          <button type="button" className="kn-btn" onClick={prev} aria-label="Back"><ChevronLeft size={14} /></button>
          <span className="font-mono text-xs tabular-nums text-[#8b8780]">{pos}/{total}</span>
          <button type="button" className="kn-btn" onClick={() => { wakeAudio(); next(); }} aria-label="Next"><ChevronRight size={14} /></button>
          <button type="button" className="kn-btn" onClick={full} aria-label="Full screen"><Expand size={13} /></button>
        </div>
      </div>
      <div className="kn-progress" style={{ width: `${(pos / total) * 100}%` }} />
    </div>
  );
}

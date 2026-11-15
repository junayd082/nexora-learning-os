'use client';

import '@fontsource/caveat/600.css';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Check, ChevronLeft, ChevronRight, Expand, Hand, Library, Music, NotebookPen, Pause, Play, Sparkles, Ticket, Timer, Volume2, VolumeX, Home, GraduationCap, MessageCircle } from 'lucide-react';
import { brand } from '@/lib/brand';
import { Field, TONES, type Mode, type Tone } from '../keynote/Keynote';
import { Score } from '../keynote/score';
import { NARRATORS, type NarratorId } from '../keynote/script';
import { useNarrator, useRecorded } from '../keynote/narration';
import { demoLine } from './script';
import { AppChrome, CHAPTER_VIEW, CURSOR, Screen } from './screens';

/**
 * NEXORA Live — a narrated product demonstration: one class period of Lecture 2 from the teacher's
 * side, inside a browser window, with a cursor that really moves, clicks and types. Every action is
 * timed as a fraction of its narration line, so the choreography fits either recorded voice.
 * → / Space next · ← back · P play · N voice · M music · C captions · F full screen.
 */
interface Chapter { id: string; beats: number; label: string; clock?: string; role?: 'Teacher' | 'Student'; tone: Tone; mode?: Mode; chord: string; dur: number[] }
const CHAPTERS: Chapter[] = [
  { id: 'cold', beats: 2, label: 'NEXORA Live', tone: 'gold', mode: 'calm', chord: 'open', dur: [6, 6.5] },
  { id: 'morning', beats: 3, label: 'Morning · Home', clock: 'Thu · 6:58 AM', role: 'Teacher', tone: 'ember', chord: 'home', dur: [7, 8, 6] },
  { id: 'plan', beats: 3, label: 'Planning · Materials', clock: 'Thu · 7:04 AM', role: 'Teacher', tone: 'ember', chord: 'home', dur: [7, 8, 6.5] },
  { id: 'donow', beats: 4, label: 'The question engine · Do Now', clock: 'Thu · 7:09 AM', role: 'Teacher', tone: 'cool', chord: 'engine', dur: [6, 8, 9, 6] },
  { id: 'room', beats: 5, label: 'Period 3 · The room, live', clock: 'Thu · 8:45 AM', role: 'Teacher', tone: 'violet', chord: 'room', dur: [6, 8, 6.5, 7.5, 8] },
  { id: 'notes', beats: 3, label: 'Period 3 · Cornell notes', clock: 'Thu · 9:12 AM', role: 'Student', tone: 'gold', chord: 'notes', dur: [6, 9, 7] },
  { id: 'exit', beats: 3, label: 'Period 3 · Exit ticket', clock: 'Thu · 10:08 AM', role: 'Teacher', tone: 'cool', chord: 'engine', dur: [7.5, 8.5, 5.5] },
  { id: 'summary', beats: 3, label: 'After class · Session summary', clock: 'Thu · 12:20 PM', role: 'Teacher', tone: 'violet', chord: 'loop', dur: [7, 9.5, 7.5] },
  { id: 'student', beats: 3, label: 'That evening · Student view', clock: 'Thu · 7:40 PM', role: 'Student', tone: 'cool', chord: 'students', dur: [5, 6.5, 7.5] },
  { id: 'close', beats: 2, label: 'NEXORA', tone: 'ember', mode: 'converge', chord: 'close', dur: [8, 7] },
];
const W = 1280, H = 760 + 34;

const R = ({ on, children, className = '', delay = 0 }: { on: boolean; children: React.ReactNode; className?: string; delay?: number }) =>
  <div className={`kn-r ${className}`} data-on={on ? '1' : '0'} style={{ transitionDelay: on ? `${delay}ms` : '0ms' }}>{children}</div>;

// ---------------------------------------------------------------------------------------------- cursor
function Cursor({ host, scale, beatKey, p, onClick }: { host: HTMLDivElement | null; scale: number; beatKey: string; p: number; onClick: () => void }) {
  const last = useRef({ x: W - 120, y: 640 });
  const startOfBeat = useRef({ key: '', x: W - 120, y: 640 });
  const fired = useRef(new Set<string>());
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  const kfs = CURSOR[beatKey] ?? [];
  if (startOfBeat.current.key !== beatKey) { startOfBeat.current = { key: beatKey, ...last.current }; fired.current = new Set(); }
  const where = (k: string) => {
    if (k === 'rest-br' || !host) return { x: W - 150, y: 660 };
    const el = host.querySelector(`[data-k="${k}"]`);
    if (!el) return null;
    const hr = host.getBoundingClientRect(); const r = el.getBoundingClientRect();
    return { x: (r.left - hr.left + r.width * 0.5) / scale, y: (r.top - hr.top + r.height * 0.55) / scale + 34 };
  };
  let pos: { x: number; y: number } = { x: startOfBeat.current.x, y: startOfBeat.current.y }; let down = false;
  let prevP = 0; let prev = { x: startOfBeat.current.x, y: startOfBeat.current.y };
  for (const [kp, k, click] of kfs) {
    const target = where(k) ?? prev;
    const from = Math.max(prevP, kp - 0.16);
    if (p >= kp) { pos = target; if (click && p < kp + 0.035) down = true; }
    else if (p > from) {
      const x = (p - from) / Math.max(0.001, kp - from); const e = x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
      pos = { x: prev.x + (target.x - prev.x) * e, y: prev.y + (target.y - prev.y) * e }; break;
    } else { pos = prev; break; }
    prev = target; prevP = kp;
    const id = `${beatKey}:${kp}`;
    if (click && p >= kp && !fired.current.has(id)) { fired.current.add(id); queueMicrotask(() => { setRipples((r) => [...r.slice(-3), { id: Math.random(), x: target.x, y: target.y }]); onClick(); }); }
  }
  last.current = pos;
  return (
    <>
      {ripples.map((r) => <span key={r.id} className="dm-ripple" style={{ left: r.x, top: r.y }} onAnimationEnd={() => setRipples((rs) => rs.filter((q) => q.id !== r.id))} />)}
      <div className={`dm-cursor ${down ? 'down' : ''}`} style={{ transform: `translate(${pos.x - 3}px, ${pos.y - 3}px)` }}>
        <svg width="22" height="22" viewBox="0 0 24 24"><path d="M4 2.5v17.2l4.7-4.4 3 6.6 2.6-1.2-3-6.5H18L4 2.5Z" fill="#fff" stroke="#111" strokeWidth="1.4" strokeLinejoin="round" /></svg>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------------------------- title cards
function Titles({ id, b }: { id: string; b: number }) {
  if (id === 'cold') return (
    <div className="mx-auto max-w-5xl text-center">
      <R on className="kn-eyebrow">A live demonstration</R>
      <R on delay={300} className="kn-h1 mt-5"><span className="kn-grad">NEXORA</span> Live</R>
      <R on delay={700} className="kn-lead mt-6">One class period. One real lesson. From the teacher’s side.</R>
      <R on={b >= 1} className="mt-10 flex flex-wrap justify-center gap-3">
        {['Room 105', 'Architecture Design 1 · Period 3', '24 students', 'Lecture 2 · Units, Coordinates & Precise Lines'].map((t, i) => <span key={t} className="kn-pill" style={{ transitionDelay: `${i * 150}ms` }}>{t}</span>)}
      </R>
    </div>
  );
  const tools: [string, typeof Home][] = [['Home & the bell schedule', Home], ['Library lessons', Library], ['The question engine', Sparkles], ['Class timer', Timer], ['Raise hand', Hand], ['Hall passes', Ticket], ['Cornell notes', NotebookPen], ['Exit ticket results', GraduationCap], ['Session summary', BookOpen], ['The assistant', MessageCircle]];
  return (
    <div className="mx-auto max-w-6xl text-center">
      {b === 0 ? (
        <>
          <R on className="kn-h2">One class period. <span className="kn-grad">Every tool, one place.</span></R>
          <div className="mx-auto mt-12 grid max-w-5xl grid-cols-2 gap-3 sm:grid-cols-5">
            {tools.map(([t, I], i) => <R key={t} on delay={400 + i * 220} className="kn-panel flex flex-col items-center gap-2 px-3 py-4 text-[14px] font-semibold"><I size={22} className="text-[#ffb26b]" />{t}<Check size={14} className="text-[#5cd49a]" /></R>)}
          </div>
        </>
      ) : (
        <>
          <R on className="kn-h1"><span className="kn-grad">NEXORA.</span></R>
          <R on delay={500} className="kn-lead mt-6">{brand.tagline}</R>
          <R on delay={1100} className="mt-10 flex flex-wrap items-center justify-center gap-3"><span className="kn-pill">Now, live</span><span className="kn-pill font-mono tracking-wide">nexoraclass.vercel.app</span></R>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- stage
export function LiveDemo() {
  const [c, setC] = useState(0);
  const [b, setB] = useState(0);
  const [auto, setAuto] = useState(false);
  const [narrate, setNarrate] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [captions, setCaptions] = useState(true);
  const [cap, setCap] = useState('');
  const [idle, setIdle] = useState(false);
  const [music, setMusic] = useState(true);
  const [scoreOn, setScoreOn] = useState(false);
  const [voiceSel, setVoiceSel] = useState<NarratorId | 'browser'>('heart');
  useEffect(() => { try { const v = localStorage.getItem('nexora-keynote-narrator'); if (v === 'heart' || v === 'michael' || v === 'browser') setVoiceSel(v); } catch { /* */ } }, []);
  const chooseVoice = (v: NarratorId | 'browser') => { setVoiceSel(v); try { localStorage.setItem('nexora-keynote-narrator', v); } catch { /* */ } };
  const root = useRef<HTMLDivElement>(null);
  const score = useRef<Score | null>(null);
  const getCtx = useCallback(() => (score.current?.ctx && score.current.voice ? { ctx: score.current.ctx, out: score.current.voice as AudioNode } : null), []);
  const nar = useNarrator();
  const rec = useRecorded(voiceSel === 'browser' ? 'heart' : voiceSel, getCtx, '/demo/voice');
  const useRec = voiceSel !== 'browser' && rec.available;
  const ch = CHAPTERS[c];
  const total = useMemo(() => CHAPTERS.reduce((n, x) => n + x.beats, 0), []);
  const pos = CHAPTERS.slice(0, c).reduce((n, x) => n + x.beats, 0) + b + 1;
  const playing = auto || narrate;
  const key = `${ch.id}-${b}`;

  const wakeAudio = useCallback(() => {
    if (!score.current) { score.current = new Score(); score.current.bed = 0.13; }
    score.current.enabled = music; score.current.start(); setScoreOn(true); void rec.prepare();
  }, [music, rec]);
  useEffect(() => { score.current?.setEnabled(music); }, [music]);
  useEffect(() => () => score.current?.stop(), []);

  const next = useCallback(() => {
    if (b + 1 < ch.beats) setB(b + 1);
    else if (c + 1 < CHAPTERS.length) { setC(c + 1); setB(0); }
    else { setAuto(false); setNarrate(false); }
  }, [b, c, ch.beats]);
  const prev = useCallback(() => { if (b > 0) setB(b - 1); else if (c > 0) { setC(c - 1); setB(CHAPTERS[c - 1].beats - 1); } }, [b, c]);
  const full = () => { const el = root.current; if (!document.fullscreenElement) el?.requestFullscreen?.().catch(() => {}); else document.exitFullscreen?.().catch(() => {}); };
  const dropTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const playShow = useCallback(() => {
    wakeAudio(); nar.unlock(); setAuto(true); if (voiceOn) setNarrate(true);
    if (root.current && !document.fullscreenElement) root.current.requestFullscreen?.().catch(() => {});
    clearTimeout(dropTimer.current); dropTimer.current = setTimeout(() => setIdle(true), 900);
  }, [wakeAudio, nar, voiceOn]);
  const pauseShow = useCallback(() => { setAuto(false); setNarrate(false); setIdle(false); }, []);
  const togglePlay = useCallback(() => (playing ? pauseShow() : playShow()), [playing, pauseShow, playShow]);
  const toggleVoice = useCallback(() => { const on = !voiceOn; setVoiceOn(on); if (on && playing) { nar.unlock(); wakeAudio(); setNarrate(true); } else if (!on) setNarrate(false); }, [voiceOn, playing, nar, wakeAudio]);

  // ---- the beat clock: p runs 0 → 1 over the narration line (or the default length)
  const [now, setNow] = useState(0);
  const beatStart = useRef(0);
  const lead = useRef(0);
  const d = (narrate && useRec && rec.length(key) ? rec.length(key) + 0.15 : ch.dur[b] ?? 6) * 1000;
  useLayoutEffect(() => { lead.current = b === 0 ? 450 : 120; beatStart.current = performance.now() + lead.current; }, [c, b]);
  useEffect(() => {
    let raf = 0; const tick = (t: number) => { setNow(t); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, []);
  const [freeze, setFreeze] = useState<number | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const at = q.get('at'); const fp = q.get('p');
    if (at) { const [id, bb] = at.split('-'); const i = CHAPTERS.findIndex((x) => x.id === id); if (i >= 0) { setC(i); setB(Math.min(Number(bb) || 0, CHAPTERS[i].beats - 1)); } }
    if (fp != null && !Number.isNaN(Number(fp))) setFreeze(Math.max(0, Math.min(1, Number(fp))));
  }, []);
  const p = freeze ?? Math.max(0, Math.min(1, (now - beatStart.current) / d));

  // ---- music cues
  const lastCh = useRef(-1);
  useEffect(() => {
    if (!scoreOn) return;
    score.current?.scene(ch.chord);
    if (lastCh.current !== c && lastCh.current !== -1) score.current?.whoosh(0.7);
    if (ch.id === 'room' && b === 0) setTimeout(() => score.current?.bell(), 400);
    if (ch.id === 'close' && b === 1) score.current?.impact(0.7);
    lastCh.current = c;
  }, [c, b, scoreOn]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- narration / autoplay: speak this beat's line, then move on
  const nextRef = useRef(next); nextRef.current = next;
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (fn: () => void, ms: number) => timers.push(setTimeout(fn, ms));
    let stop = () => {};
    const lastBeat = b === ch.beats - 1;
    if (!narrate) {
      setCap(''); score.current?.duck(false);
      if (auto) later(() => nextRef.current(), lead.current + (ch.dur[b] ?? 6) * 1000 + (lastBeat ? 1300 : 700));
      return () => timers.forEach(clearTimeout);
    }
    const line = demoLine(ch.id, b);
    const after = () => { score.current?.duck(false); later(() => nextRef.current(), lastBeat ? 1300 : 700); };
    later(() => {
      setCap(line.text);
      if (useRec) stop = rec.play(key, { start: () => score.current?.duck(true), end: after, fail: () => { stop = nar.say(line.say, line.lang, after, (on) => score.current?.duck(on)); } });
      else stop = nar.say(line.say, line.lang, after, (on) => score.current?.duck(on));
    }, lead.current);
    return () => { timers.forEach(clearTimeout); stop(); };
  }, [narrate, auto, c, b, useRec, voiceSel]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- keys, idle chrome, touch
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as Element)?.closest?.('select')) return;
      if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); wakeAudio(); next(); }
      else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); prev(); }
      else if (e.key === 'f' || e.key === 'F') full();
      else if (e.key === 'p' || e.key === 'P' || e.key === 'k' || e.key === 'K') togglePlay();
      else if (e.key === 'Escape' && playing) pauseShow();
      else if (e.key === 'n' || e.key === 'N') toggleVoice();
      else if (e.key === 'm' || e.key === 'M') { wakeAudio(); setMusic((m) => !m); }
      else if (e.key === 'c' || e.key === 'C') setCaptions((x) => !x);
      else if (e.key === 'Home') { setC(0); setB(0); }
    };
    addEventListener('keydown', onKey); return () => removeEventListener('keydown', onKey);
  }, [next, prev, wakeAudio, togglePlay, pauseShow, toggleVoice, playing]);
  useEffect(() => {
    let tm: ReturnType<typeof setTimeout>;
    const wake = () => { setIdle(false); clearTimeout(tm); tm = setTimeout(() => setIdle(true), 2200); };
    addEventListener('pointermove', wake); addEventListener('pointerdown', wake);
    return () => { removeEventListener('pointermove', wake); removeEventListener('pointerdown', wake); clearTimeout(tm); };
  }, []);
  const touch = useRef<number | null>(null);

  // ---- the window scale
  const wrap = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.8);
  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const fit = () => {
      // Usable box = the wrapper minus its padding (the space above is for the chapter title, below for captions).
      const cs = getComputedStyle(el);
      const w = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const h = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      setScale(Math.max(0.2, Math.min(w / W, h / H, 1.25)));
    };
    fit(); const ro = new ResizeObserver(fit); ro.observe(el); return () => ro.disconnect();
  }, []);
  const viewport = useRef<HTMLDivElement>(null);

  const view = CHAPTER_VIEW[ch.id];
  const inApp = !!view;
  const [c1, c2] = TONES[ch.tone];
  const preparing = voiceOn && useRec && rec.loaded < rec.total;
  const url = view?.url ?? '/';

  return (
    <div ref={root} className={`kn ${playing ? 'theater' : ''} ${playing && idle ? 'idle' : ''}`}
      onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => { const x0 = touch.current; touch.current = null; if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) { wakeAudio(); if (dx < 0) next(); else prev(); } }}>
      <div className="kn-orb" style={{ width: '60vmax', height: '60vmax', left: '-18vmax', top: '-22vmax', background: c1, opacity: 0.13 }} />
      <div className="kn-orb" style={{ width: '54vmax', height: '54vmax', right: '-20vmax', bottom: '-24vmax', background: c2, opacity: 0.11 }} />
      <Field tone={ch.tone} mode={ch.mode ?? 'calm'} />
      <button type="button" className="kn-hit" aria-label="Next" onClick={() => { wakeAudio(); next(); }} />
      <div className="kn-bar-t" aria-hidden /><div className="kn-bar-b" aria-hidden />

      {/* lower third: chapter, time of day, whose screen */}
      <div className="dm-lower" key={`lt-${c}`}>
        <span className="dm-chap kn-r" data-on="1">{ch.label}</span>
        {ch.clock && <span className="dm-clock kn-r" data-on="1" style={{ transitionDelay: '150ms' }}>{ch.clock}</span>}
        {ch.role && <span className="dm-role kn-r" data-on="1" style={{ transitionDelay: '300ms', background: ch.role === 'Teacher' ? '#ff7a1a26' : '#3fc8ff26', color: ch.role === 'Teacher' ? '#ffb26b' : '#8fdcff' }}>{ch.role} view</span>}
      </div>

      {/* title cards (open / close) */}
      {!inApp && <div className="kn-stage pointer-events-none"><div key={ch.id} className="kn-layers"><div className="kn-scene kn-in"><Titles id={ch.id} b={b} /></div></div></div>}

      {ch.id === 'close' && b === 1 && <a href="/classes" className="dm-open kn-btn kn-play">Open the demo class →</a>}

      {/* the product, live */}
      <div ref={wrap} className="dm-wrap" style={{ opacity: inApp ? 1 : 0, transform: inApp ? 'none' : 'scale(.94)', transition: 'opacity .8s ease, transform 1s cubic-bezier(.22,1,.36,1)' }}>
        <div className="dm-scaler" style={{ transform: `scale(${scale})`, width: W, height: H, flex: 'none', ['--dm-glow' as string]: `${c1}55` }}>
          <div className="dm-window">
            <div className="dm-titlebar"><div className="dm-dots"><i style={{ background: '#ff5f57' }} /><i style={{ background: '#febc2e' }} /><i style={{ background: '#28c840' }} /></div>
              <div className="dm-url">🔒 <b>nexoraclass.vercel.app</b>{url}</div><div style={{ width: 52 }} /></div>
            <div ref={viewport} className="dm-viewport">
              <div className="dm-ambient" />
              {inApp && (
                <AppChrome active={view.nav} teacher={view.teacher} avatar={view.avatar} bell={view.bell?.(b, p) ?? 0}>
                  <div key={ch.id} className="kn-in h-full"><Screen c={ch.id} b={b} p={p} /></div>
                </AppChrome>
              )}
              {inApp && <Cursor host={viewport.current} scale={scale} beatKey={key} p={p} onClick={() => score.current?.click()} />}
            </div>
          </div>
        </div>
      </div>

      {narrate && captions && cap && <div key={cap} className="kn-caption" aria-live="polite">{cap}</div>}

      <div className="kn-bottom">
        <span className="kn-eyebrow kn-keys hidden xl:inline">→ next · ← back · P play · N voice · M music · C captions · F full screen</span>
        <div className="kn-ctrl ml-auto flex flex-wrap items-center justify-end gap-2">
          <button type="button" className="kn-btn kn-play" onClick={togglePlay} aria-pressed={playing}>{playing ? <Pause size={14} /> : <Play size={14} />}{playing ? 'Pause' : 'Play'}</button>
          <button type="button" className={`kn-btn ${voiceOn ? 'kn-on' : ''}`} onClick={toggleVoice} aria-pressed={voiceOn}>{voiceOn ? <Volume2 size={13} /> : <VolumeX size={13} />}{preparing ? `Voice ${rec.loaded}/${rec.total}` : 'Voice'}</button>
          <select aria-label="Narrator" className="kn-btn kn-select" value={voiceSel} onChange={(e) => chooseVoice(e.target.value as NarratorId | 'browser')}>
            {NARRATORS.map((v) => <option key={v.id} value={v.id}>{v.label} · {v.note}</option>)}<option value="browser">Browser voice</option>
          </select>
          <button type="button" className={`kn-btn ${captions ? 'kn-on' : ''}`} onClick={() => setCaptions((x) => !x)} aria-pressed={captions}>CC</button>
          <button type="button" className={`kn-btn ${music && scoreOn ? 'kn-on' : ''}`} onClick={() => { wakeAudio(); setMusic((m) => (scoreOn ? !m : true)); }} aria-label="Music"><Music size={13} /></button>
          <button type="button" className="kn-btn" onClick={prev} aria-label="Back"><ChevronLeft size={14} /></button>
          <span className="font-mono text-xs tabular-nums text-[#8b8780]">{pos}/{total}</span>
          <button type="button" className="kn-btn" onClick={() => { wakeAudio(); next(); }} aria-label="Next"><ChevronRight size={14} /></button>
          <button type="button" className="kn-btn" onClick={full} aria-label="Full screen"><Expand size={13} /></button>
        </div>
      </div>
      <div className="kn-progress" style={{ width: `${((pos - 1 + p) / total) * 100}%` }} />
    </div>
  );
}

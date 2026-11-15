'use client';
/**
 * Narration for the stage pages (Keynote, Live demo): recorded neural narration played through the
 * Web Audio engine (primary), with the browser's own speech voice as a fallback.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NarratorId } from './script';

// ------------------------------------------------------------------ narration
// Recorded narration (Kokoro neural voices, made by scripts/keynote-voice.py from ./script.ts) is the
// primary narrator: it sounds human and identical on every computer. The browser's own speech voice
// remains as a fallback ("Browser voice").
const PREFER = ['natural', 'neural', 'premium', 'enhanced', 'google uk english male', 'daniel', 'arthur', 'guy', 'ryan', 'christopher', 'davis', 'andrew', 'aaron', 'alex', 'fred', 'google us english'];
const rank = (v: SpeechSynthesisVoice) => { const n = v.name.toLowerCase(); const i = PREFER.findIndex((p) => n.includes(p)); return (i < 0 ? 99 : i) + (v.localService ? 0 : -0.5); };
const KEEP: SpeechSynthesisUtterance[] = [];
/**
 * Phrases for a flowing read: split after sentence ends and dramatic ellipses, join short sentences
 * so the voice doesn't stop and start, and give each break its own breath.
 */
function phrases(t: string): { text: string; pause: number }[] {
  const raw = t.split(/(?<=[.!?…]["”]?)\s+/).map((x) => x.trim()).filter(Boolean);
  const out: { text: string; pause: number }[] = [];
  for (const r of raw) {
    const last = out[out.length - 1];
    const dramatic = /…["”]?$/.test(r);
    if (last && !/…["”]?$/.test(last.text) && last.text.length + r.length < 150 && r.length < 70 && !dramatic && !/\?$/.test(last.text)) { last.text += ` ${r}`; continue; }
    out.push({ text: r, pause: 0 });
  }
  return out.map((p) => ({
    // A trailing ellipsis is a held breath, not words to read.
    text: p.text.replace(/…(["”]?)$/, '$1').replace(/…/g, ',').trim(),
    pause: /…["”]?$/.test(p.text) ? 720 : /\?["”]?$/.test(p.text) ? 560 : /!["”]?$/.test(p.text) ? 420 : 340,
  }));
}

export function useNarrator() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voice, setVoice] = useState('');
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    if (typeof speechSynthesis === 'undefined') return;
    setSupported(true);
    const load = () => {
      const all = speechSynthesis.getVoices();
      const en = all.filter((v) => v.lang.toLowerCase().startsWith('en')).sort((a, b) => rank(a) - rank(b));
      setVoices([...en, ...all.filter((v) => v.lang.toLowerCase().startsWith('es'))]);
      setVoice((cur) => {
        if (cur) return cur;
        let saved = ''; try { saved = localStorage.getItem('nexora-keynote-voice') ?? ''; } catch { /* */ }
        return all.some((v) => v.voiceURI === saved) ? saved : en[0]?.voiceURI ?? '';
      });
    };
    load(); speechSynthesis.addEventListener('voiceschanged', load);
    return () => speechSynthesis.removeEventListener('voiceschanged', load);
  }, []);
  const pick = (uri: string) => { setVoice(uri); try { localStorage.setItem('nexora-keynote-voice', uri); } catch { /* */ } };
  /** Speak `text`; resolves when done (or when cancelled). */
  const [heard, setHeard] = useState<'unknown' | 'ok' | 'silent' | 'novoice'>('unknown');
  /**
   * Unlock audio inside the tap itself. iPhone Safari (and some Chrome builds) only allow speech that
   * starts during a user gesture; after that, later lines may play from timers.
   */
  const unlock = useCallback(() => {
    if (typeof speechSynthesis === 'undefined') return;
    try {
      speechSynthesis.cancel(); speechSynthesis.resume();
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0.01; u.rate = 1;
      KEEP.push(u); speechSynthesis.speak(u);
    } catch { /* */ }
  }, []);
  /** Speak `text`, sentence by sentence; calls onDone when finished (with a watchdog if the engine never reports the end). */
  const say = useCallback((text: string, lang: 'en' | 'es', onDone: () => void, onSpeaking?: (on: boolean) => void) => {
    if (typeof speechSynthesis === 'undefined') { onDone(); return () => {}; }
    const all = speechSynthesis.getVoices();
    if (!all.length) setHeard('novoice');
    const v = lang === 'es' ? all.find((x) => x.lang.toLowerCase().startsWith('es')) ?? all.find((x) => x.voiceURI === voice) : all.find((x) => x.voiceURI === voice) ?? all.find((x) => x.lang.toLowerCase().startsWith('en'));
    const parts = phrases(text);
    let alive = true; let i = 0; let finished = false;
    const finish = () => { if (finished || !alive) return; finished = true; clearTimeout(dog); onSpeaking?.(false); onDone(); };
    // If the engine never fires "end" (muted device, missing voice), move on after the time it would take to read.
    const words = text.split(/\s+/).length;
    const dog = setTimeout(finish, 3500 + (words / 2.0) * 1000 + parts.reduce((n, p) => n + p.pause, 0));
    let started = false;
    const speakNext = () => {
      if (!alive) return;
      if (i >= parts.length) { finish(); return; }
      const part = parts[i++];
      const u = new SpeechSynthesisUtterance(part.text);
      if (v) u.voice = v; u.lang = v?.lang ?? (lang === 'es' ? 'es-MX' : 'en-US');
      // Unhurried, warm, a touch low: a narrator, not an announcer.
      u.rate = 0.88; u.pitch = 0.9; u.volume = 1;
      u.onstart = () => { started = true; setHeard('ok'); onSpeaking?.(true); };
      u.onend = () => { onSpeaking?.(false); setTimeout(speakNext, part.pause); };
      u.onerror = (e) => { if ((e as SpeechSynthesisErrorEvent).error === 'not-allowed') setHeard('silent'); setTimeout(speakNext, 100); };
      KEEP.push(u); if (KEEP.length > 40) KEEP.splice(0, KEEP.length - 40); // Chrome drops "end" events of collected utterances.
      speechSynthesis.speak(u);
      speechSynthesis.resume();
    };
    // Never speak in the same tick as cancel (Chrome swallows it).
    const busy = speechSynthesis.speaking || speechSynthesis.pending;
    if (busy) speechSynthesis.cancel();
    const go = setTimeout(speakNext, busy ? 140 : 0);
    // Nothing started after 3 s → sound is blocked (silent switch, muted tab, no voice).
    const check = setTimeout(() => { if (alive && !started) setHeard((h) => (h === 'novoice' ? h : 'silent')); }, 3000);
    return () => { alive = false; clearTimeout(go); clearTimeout(check); clearTimeout(dog); speechSynthesis.cancel(); };
  }, [voice]);
  return { voices, voice, pick, say, unlock, supported, heard };
}


/**
 * Recorded narration through the Web Audio engine: every clip is downloaded when the page opens and
 * decoded into memory on the first tap, so a line starts on the exact frame it is asked for (no
 * player start-up, no network). Falls back to a plain <audio> element if decoding is unavailable.
 */
export function useRecorded(narrator: NarratorId, getCtx: () => { ctx: AudioContext; out: AudioNode } | null, base = '/keynote/voice') {
  const raw = useRef<Record<string, ArrayBuffer>>({});
  const buffers = useRef<Record<string, AudioBuffer>>({});
  const el = useRef<HTMLAudioElement | null>(null);
  const [manifest, setManifest] = useState<Record<string, Record<string, number>> | null>(null);
  const [loaded, setLoaded] = useState(0);
  const [decoded, setDecoded] = useState(0);
  useEffect(() => {
    el.current = new Audio(); el.current.preload = 'auto';
    fetch(`${base}/manifest.json`).then((r) => (r.ok ? r.json() : null)).then(setManifest).catch(() => setManifest(null));
    return () => { el.current?.pause(); };
  }, [base]);
  const keys = useMemo(() => Object.keys(manifest?.[narrator] ?? {}), [manifest, narrator]);
  // Download every clip for this narrator up front.
  useEffect(() => {
    if (!keys.length) return;
    let alive = true; raw.current = {}; buffers.current = {}; setLoaded(0); setDecoded(0);
    let n = 0;
    Promise.all(keys.map(async (k) => {
      try { const r = await fetch(`${base}/${narrator}/${k}.mp3`); raw.current[k] = await r.arrayBuffer(); } catch { /* streamed later */ }
      if (alive) setLoaded(++n);
    }));
    return () => { alive = false; };
  }, [keys, narrator, base]);
  /** Decode everything into the audio engine (call from a tap, after the engine exists). */
  const prepare = useCallback(async () => {
    const c = getCtx(); if (!c) return;
    let n = Object.keys(buffers.current).length;
    for (const k of keys) {
      if (buffers.current[k] || !raw.current[k]) continue;
      try { buffers.current[k] = await c.ctx.decodeAudioData(raw.current[k].slice(0)); setDecoded(++n); } catch { /* falls back to <audio> */ }
    }
  }, [keys, getCtx]);
  useEffect(() => { if (loaded === keys.length && keys.length && getCtx()) void prepare(); }, [loaded, keys.length, prepare, getCtx]);
  const play = useCallback((key: string, on: { start: () => void; end: () => void; fail: () => void }) => {
    const len = manifest?.[narrator]?.[key];
    if (!len) { on.fail(); return () => {}; }
    let done = false;
    const end = () => { if (done) return; done = true; on.end(); };
    const c = getCtx(); const buf = buffers.current[key];
    if (c && buf) {
      const src = c.ctx.createBufferSource(); src.buffer = buf; src.connect(c.out);
      src.onended = end; src.start(c.ctx.currentTime + 0.005); on.start();
      return () => { done = true; src.onended = null; try { src.stop(); } catch { /* */ } };
    }
    const a = el.current; if (!a) { on.fail(); return () => {}; }
    a.onplaying = () => on.start(); a.onended = end; a.onerror = () => { if (!done) { done = true; on.fail(); } };
    a.src = `${base}/${narrator}/${key}.mp3`; a.currentTime = 0;
    a.play().catch(() => { if (!done) { done = true; on.fail(); } });
    const dog = setTimeout(end, (len + 2.5) * 1000);
    return () => { done = true; clearTimeout(dog); a.onended = null; a.onplaying = null; a.onerror = null; a.pause(); };
  }, [manifest, narrator, getCtx]);
  return { available: !!manifest?.[narrator], loaded, decoded, total: keys.length, prepare, play, length: (k: string) => manifest?.[narrator]?.[k] ?? 0 };
}


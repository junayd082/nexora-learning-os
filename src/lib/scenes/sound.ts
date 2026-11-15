import type { SoundId } from './types';

/**
 * Optional soundscapes, generated live with Web Audio — no audio files to download or license.
 * Off by default. Browsers only allow audio after a click, so call play() from a click handler.
 */
export interface Soundscape {
  play(id: SoundId): void;
  stop(): void;
  setVolume(v: number): void;
  readonly playing: SoundId | null;
}

export function createSoundscape(): Soundscape {
  let ac: AudioContext | null = null;
  let master: GainNode | null = null;
  let nodes: AudioNode[] = [];
  let playing: SoundId | null = null;
  let volume = 0.5;

  const noise = (kind: 'white' | 'brown') => {
    const len = ac!.sampleRate * 4, buf = ac!.createBuffer(1, len, ac!.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const wv = Math.random() * 2 - 1;
      if (kind === 'white') d[i] = wv;
      else { last = (last + 0.02 * wv) / 1.02; d[i] = last * 3.5; }
    }
    const src = ac!.createBufferSource(); src.buffer = buf; src.loop = true; src.start(); return src;
  };
  const lfo = (freq: number, depth: number, target: AudioParam, offset?: number) => {
    const o = ac!.createOscillator(); o.frequency.value = freq;
    const g = ac!.createGain(); g.gain.value = depth;
    o.connect(g).connect(target); o.start();
    if (offset !== undefined) target.value = offset;
    nodes.push(o, g);
  };
  const filt = (type: BiquadFilterType, freq: number, q = 0.7) => { const f = ac!.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; nodes.push(f); return f; };
  const gain = (v: number) => { const g = ac!.createGain(); g.gain.value = v; nodes.push(g); return g; };

  function build(id: SoundId) {
    const out = master!;
    if (id === 'rain') {
      const n = noise('white'); nodes.push(n);
      n.connect(filt('highpass', 900)).connect(filt('lowpass', 7000)).connect(gain(0.28)).connect(out);
      const b = noise('brown'); nodes.push(b); b.connect(filt('lowpass', 400)).connect(gain(0.35)).connect(out);
    } else if (id === 'waves') {
      const n = noise('brown'); nodes.push(n);
      const g = gain(0.5); n.connect(filt('lowpass', 700)).connect(g).connect(out);
      lfo(0.125, 0.45, g.gain, 0.5);
      const hiss = noise('white'); nodes.push(hiss); const hg = gain(0.04); hiss.connect(filt('highpass', 2500)).connect(hg).connect(out); lfo(0.125, 0.04, hg.gain, 0.04);
    } else if (id === 'wind') {
      const n = noise('white'); nodes.push(n);
      const f = filt('bandpass', 450, 0.9); n.connect(f).connect(gain(0.35)).connect(out);
      lfo(0.07, 220, f.frequency, 450);
    } else if (id === 'night') {
      const n = noise('brown'); nodes.push(n); n.connect(filt('lowpass', 250)).connect(gain(0.15)).connect(out);
      // crickets: a high tone gated twice — fast trill inside a slower chirp
      const o = ac!.createOscillator(); o.frequency.value = 4300; o.start(); nodes.push(o);
      const g1 = gain(0); const g2 = gain(0); o.connect(g1).connect(g2).connect(gain(0.05)).connect(out);
      lfo(28, 0.5, g1.gain, 0.5); lfo(0.9, 0.5, g2.gain, 0.5);
    } else if (id === 'space') {
      [55, 82.6, 110.3].forEach((f, i) => { const o = ac!.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.start(); nodes.push(o); const g = gain(0.07 / (i + 1)); o.connect(g).connect(out); lfo(0.05 + i * 0.03, 0.03, g.gain, 0.07 / (i + 1)); });
      const n = noise('white'); nodes.push(n); n.connect(filt('bandpass', 1200, 4)).connect(gain(0.03)).connect(out);
    } else if (id === 'underwater') {
      const n = noise('brown'); nodes.push(n); const g = gain(0.55); n.connect(filt('lowpass', 320)).connect(g).connect(out); lfo(0.09, 0.2, g.gain, 0.55);
    }
  }

  return {
    get playing() { return playing; },
    play(id) {
      ac ||= new AudioContext();
      void ac.resume();
      this.stop();
      master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination);
      build(id);
      master.gain.linearRampToValueAtTime(volume * 0.6, ac.currentTime + 1.2);
      playing = id;
    },
    stop() {
      if (!ac || !master) return;
      const m = master, old = nodes;
      m.gain.cancelScheduledValues(ac.currentTime); m.gain.setValueAtTime(m.gain.value, ac.currentTime); m.gain.linearRampToValueAtTime(0, ac.currentTime + 0.6);
      setTimeout(() => { old.forEach(n => { try { (n as AudioScheduledSourceNode).stop?.(); } catch { /* already stopped */ } n.disconnect(); }); m.disconnect(); }, 700);
      nodes = []; master = null; playing = null;
    },
    setVolume(v) { volume = Math.max(0, Math.min(1, v)); if (ac && master) master.gain.linearRampToValueAtTime(volume * 0.6, ac.currentTime + 0.2); },
  };
}

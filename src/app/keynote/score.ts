/**
 * The keynote's score, synthesised live with the Web Audio API (no files, no licences):
 * a warm pad that changes chord with each chapter, a whoosh on every scene change, a bell,
 * a sub impact for the reveal, a riser before it, and ducking under the narrator.
 * Must be started from a user gesture (browser autoplay rules).
 */
type Cue = { chord: number[]; bright?: number };
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

// D major world, moving like a film cue: calm → tension → question → arrival → lift → home.
const CHORDS: Record<string, Cue> = {
  open: { chord: [38, 50, 57, 62, 64], bright: 0.25 },      // Dadd9, distant
  chaos: { chord: [35, 47, 54, 59, 61], bright: 0.45 },     // Bm add9, unsettled
  question: { chord: [31, 43, 50, 55, 57, 62], bright: 0.4 }, // Gmaj(add9)
  reveal: { chord: [38, 50, 57, 62, 66, 69], bright: 0.9 },  // D major, wide and bright
  home: { chord: [38, 50, 57, 62, 66], bright: 0.6 },
  room: { chord: [33, 45, 52, 57, 61, 64], bright: 0.6 },    // A
  engine: { chord: [35, 47, 54, 59, 62, 66], bright: 0.55 }, // Bm7
  loop: { chord: [31, 43, 50, 55, 59, 62], bright: 0.65 },   // G
  alive: { chord: [38, 50, 57, 62, 66, 69], bright: 0.75 },
  students: { chord: [33, 45, 52, 57, 61, 64], bright: 0.6 },
  notes: { chord: [38, 50, 57, 62, 64, 69], bright: 0.55 },       // Dadd9, warm and studious
  numbers: { chord: [31, 43, 50, 55, 59, 62, 66], bright: 0.8 }, // Gmaj7 lift
  founder: { chord: [35, 47, 54, 59, 62], bright: 0.35 },
  onemore: { chord: [31, 43, 50, 57, 62], bright: 0.3 },
  close: { chord: [38, 50, 57, 62, 66, 69, 74], bright: 0.85 },
};

export class Score {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  /** Narration goes here: straight to the output, never through the music reverb. */
  voice: GainNode | null = null;
  private music!: GainNode;
  private fx!: GainNode;
  private verb!: ConvolverNode;
  private voices: { osc: OscillatorNode[]; gain: GainNode; filter: BiquadFilterNode }[] = [];
  private current = '';
  enabled = true;
  /** Music level under the stage (lower for the live demo, where the voice leads). */
  bed = 0.2;

  start() {
    if (this.ctx) { void this.ctx.resume(); return; }
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 3;
    this.master = ctx.createGain(); this.master.gain.value = 0.9;
    this.master.connect(comp).connect(ctx.destination);
    this.voice = ctx.createGain(); this.voice.gain.value = 1; this.voice.connect(ctx.destination);
    // Hall reverb from a generated impulse.
    this.verb = ctx.createConvolver();
    const len = ctx.sampleRate * 4.2; const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    this.verb.buffer = ir;
    const wet = ctx.createGain(); wet.gain.value = 0.55;
    this.verb.connect(wet).connect(this.master);
    this.music = ctx.createGain(); this.music.gain.value = 0;
    this.music.connect(this.master); this.music.connect(this.verb);
    this.fx = ctx.createGain(); this.fx.gain.value = 0.8;
    this.fx.connect(this.master); this.fx.connect(this.verb);
    this.music.gain.setTargetAtTime(this.enabled ? this.bed : 0, ctx.currentTime, 1.2);
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.music.gain.setTargetAtTime(on ? this.bed : 0, t, 0.6);
    this.fx.gain.setTargetAtTime(on ? 0.8 : 0, t, 0.3);
  }

  /** Music sits lower while the narrator speaks. */
  duck(speaking: boolean) {
    if (!this.ctx || !this.enabled) return;
    this.music.gain.setTargetAtTime(speaking ? this.bed * 0.42 : this.bed, this.ctx.currentTime, speaking ? 0.25 : 1.4);
  }

  /** Crossfade the pad to this scene's chord. */
  scene(id: string) {
    if (!this.ctx || id === this.current) return;
    this.current = id;
    const ctx = this.ctx; const t = ctx.currentTime; const cue = CHORDS[id] ?? CHORDS.home;
    // release the old chord slowly
    for (const v of this.voices) {
      v.gain.gain.cancelScheduledValues(t); v.gain.gain.setValueAtTime(v.gain.gain.value, t);
      v.gain.gain.linearRampToValueAtTime(0, t + 3.2);
      v.osc.forEach((o) => o.stop(t + 3.4));
    }
    this.voices = cue.chord.map((m, i) => {
      const f = mtof(m);
      const gain = ctx.createGain(); gain.gain.value = 0;
      const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.Q.value = 0.7;
      filter.frequency.value = 380 + (cue.bright ?? 0.5) * 1700 + i * 60;
      // slow filter breathing
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.06 + i * 0.013;
      const lfoAmt = ctx.createGain(); lfoAmt.gain.value = 180 + (cue.bright ?? 0.5) * 300;
      lfo.connect(lfoAmt).connect(filter.frequency);
      const kinds: OscillatorType[] = m < 45 ? ['sine', 'triangle'] : ['sawtooth', 'triangle'];
      const osc = kinds.flatMap((k, j) => [-1, 1].map((d) => {
        const o = ctx.createOscillator(); o.type = k; o.frequency.value = f; o.detune.value = d * (j ? 4 : 7);
        o.connect(filter); o.start(t); return o;
      }));
      lfo.start(t); osc.push(lfo);
      filter.connect(gain).connect(this.music);
      const level = (m < 45 ? 0.16 : 0.055) / Math.sqrt(cue.chord.length / 4);
      gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(level, t + 2.8 + i * 0.25);
      return { osc, gain, filter };
    });
  }

  private noise(dur: number) {
    const ctx = this.ctx!; const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf; return src;
  }

  /** Air moving past: band-passed noise sweeping up, then away. */
  whoosh(strength = 1) {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx; const t = ctx.currentTime;
    const src = this.noise(1.6); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(250, t); bp.frequency.exponentialRampToValueAtTime(2600, t + 0.7); bp.frequency.exponentialRampToValueAtTime(600, t + 1.5);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.16 * strength, t + 0.55); g.gain.exponentialRampToValueAtTime(0.001, t + 1.55);
    const pan = ctx.createStereoPanner(); pan.pan.setValueAtTime(-0.6, t); pan.pan.linearRampToValueAtTime(0.6, t + 1.4);
    src.connect(bp).connect(g).connect(pan).connect(this.fx); src.start(t); src.stop(t + 1.6);
  }

  /** A school bell, struck once: inharmonic partials with a long decay. */
  bell() {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx; const t = ctx.currentTime + 0.05; const base = 587.33; // D5
    [[1, 0.5, 5], [2.0, 0.22, 3.6], [2.76, 0.16, 2.8], [5.4, 0.08, 1.6], [0.5, 0.18, 6]].forEach(([r, a, d]) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = base * r;
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a * 0.5, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0008, t + d);
      o.connect(g).connect(this.fx); o.start(t); o.stop(t + d + 0.1);
    });
  }

  /** Sub drop + body for big moments. */
  impact(size = 1) {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx; const t = ctx.currentTime + 0.02;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(92, t); o.frequency.exponentialRampToValueAtTime(34, t + 1.4);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.75 * size, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 2.6);
    o.connect(g).connect(this.fx); o.start(t); o.stop(t + 2.7);
    const n = this.noise(1.2); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(1800, t); lp.frequency.exponentialRampToValueAtTime(120, t + 1);
    const ng = ctx.createGain(); ng.gain.setValueAtTime(0.28 * size, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
    n.connect(lp).connect(ng).connect(this.fx); n.start(t); n.stop(t + 1.2);
  }

  /** Rising tension into a reveal. */
  riser(dur = 4) {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx; const t = ctx.currentTime;
    const n = this.noise(dur + 0.2); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2.5;
    bp.frequency.setValueAtTime(200, t); bp.frequency.exponentialRampToValueAtTime(5200, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.13, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.15);
    n.connect(bp).connect(g).connect(this.fx); n.start(t); n.stop(t + dur + 0.2);
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(440, t + dur);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    const og = ctx.createGain(); og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.05, t + dur); og.gain.linearRampToValueAtTime(0, t + dur + 0.1);
    o.connect(lp).connect(og).connect(this.fx); o.start(t); o.stop(t + dur + 0.2);
  }

  /** A soft mouse click for the live demo's cursor. */
  click() {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx; const t = ctx.currentTime + 0.005;
    const n = this.noise(0.05); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3200; bp.Q.value = 1.2;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.09, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.045);
    n.connect(bp).connect(g).connect(this.master); n.start(t); n.stop(t + 0.06);
  }

  /** Soft glassy tick for builds inside a scene. */
  shimmer() {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx; const t = ctx.currentTime + 0.02;
    [1318.5, 1975.5].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t + i * 0.06); g.gain.linearRampToValueAtTime(0.035, t + i * 0.06 + 0.01); g.gain.exponentialRampToValueAtTime(0.0005, t + i * 0.06 + 1.6);
      o.connect(g).connect(this.fx); o.start(t + i * 0.06); o.stop(t + 2);
    });
  }

  /** What plays when the stage arrives at scene `id`, build `b`. */
  cue(id: string, b: number, sceneChanged: boolean) {
    if (!this.ctx) return;
    this.scene(id);
    if (id === 'open' && b === 2) this.bell();
    else if (id === 'question' && b === 0) this.riser(4.2);
    else if (id === 'reveal' && b === 0) this.impact(1.1);
    else if (id === 'close' && b === 0) this.impact(0.8);
    else if (id === 'onemore' && b === 1) this.impact(0.5);
    else if (sceneChanged) this.whoosh(id === 'chaos' ? 1.2 : 0.9);
    else if (b > 0) this.shimmer();
  }

  stop() { try { void this.ctx?.close(); } catch { /* */ } this.ctx = null; this.voice = null; this.voices = []; this.current = ''; }
}

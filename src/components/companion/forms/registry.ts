import type { SceneId } from '@/lib/scenes/types';

/**
 * NEXORA Scene Assistants — one companion (Nova), eleven forms.
 * Everything that differs per animal lives here: which scene it belongs to, how it moves,
 * which gesture plays for each shared action, its sounds, particles and treat.
 * The companion logic (Companion.tsx) is shared; CSS in globals.css (".nx-companion[data-form=…]")
 * turns the shared acts into each animal's own gesture.
 */
export const FORM_ORDER = ['nova', 'cora', 'lumi', 'maple', 'yuki', 'aurora', 'rain', 'nemo', 'ash', 'orbit', 'grid'] as const;
export type FormId = (typeof FORM_ORDER)[number];
export type CompanionPref = 'scene' | FormId;

/** How the form gets from A to B along the dock. */
export type Locomotion = 'walk' | 'scuttle' | 'hover' | 'glide' | 'bound' | 'prowl' | 'hop' | 'swim';

export type Particle = 'heart' | 'star' | 'note' | 'bang' | 'treat' | 'q' | 'bubble' | 'spark' | 'snow' | 'leaf' | 'ring' | 'beep';
export type Sfx = 'yip' | 'howl' | 'ouch' | 'munch' | 'boing' | 'purr' | 'pop'
  | 'click' | 'chime' | 'hoot' | 'bark' | 'wolfhowl' | 'croak' | 'bubble' | 'meow' | 'ping' | 'beep';

export interface FormDef {
  id: FormId;
  scene: SceneId;
  /** Display colours (glow A / glow B), used by the dock light and the Settings tile. */
  glow: [string, string];
  locomotion: Locomotion;
  /** Walking speed in px/s and running speed (fetch, run away). */
  speed: number; run: number;
  /** Faces the viewer: never mirrored when it changes direction (crab, owl, frog, drone, bot). */
  front: boolean;
  /** Flies or floats: drops gently instead of falling when put down. */
  airborne: boolean;
  /** Particles for the species call, the greeting and the idle gesture. */
  callParticle: Particle; idleParticle: Particle | null;
  treat: string;
  sfx: { greet: Sfx; call: Sfx; happy: Sfx; love: Sfx; hurt: Sfx; trick: Sfx };
  /** Duration (ms) of the call and trick gestures, to keep sound, speech and motion in step. */
  callMs: number; trickMs: number; idleMs: number;
}

export const FORMS: Record<FormId, FormDef> = {
  nova:   { id: 'nova',   scene: 'sakura',    glow: ['#9A72FF', '#FF6FA8'], locomotion: 'walk',    speed: 46, run: 260, front: false, airborne: false, callParticle: 'note',   idleParticle: null,    treat: '🍖', sfx: { greet: 'yip',   call: 'howl',     happy: 'yip',   love: 'purr',   hurt: 'ouch', trick: 'boing' }, callMs: 1900, trickMs: 900,  idleMs: 1200 },
  cora:   { id: 'cora',   scene: 'beach',     glow: ['#3FE0E0', '#FF6F59'], locomotion: 'scuttle', speed: 62, run: 300, front: true,  airborne: false, callParticle: 'star',   idleParticle: null,    treat: '🐟', sfx: { greet: 'click', call: 'click',    happy: 'click', love: 'pop',    hurt: 'ouch', trick: 'click' }, callMs: 1400, trickMs: 1300, idleMs: 1600 },
  lumi:   { id: 'lumi',   scene: 'fireflies', glow: ['#FFE45C', '#B8F04A'], locomotion: 'hover',   speed: 54, run: 240, front: false, airborne: true,  callParticle: 'spark',  idleParticle: 'spark', treat: '🌼', sfx: { greet: 'chime', call: 'chime',    happy: 'chime', love: 'chime',  hurt: 'ouch', trick: 'chime' }, callMs: 1600, trickMs: 1200, idleMs: 1800 },
  maple:  { id: 'maple',  scene: 'autumn',    glow: ['#FFB347', '#C8642B'], locomotion: 'glide',   speed: 120, run: 320, front: true,  airborne: true,  callParticle: 'note',   idleParticle: 'leaf',  treat: '🫐', sfx: { greet: 'hoot',  call: 'hoot',     happy: 'hoot',  love: 'purr',   hurt: 'ouch', trick: 'boing' }, callMs: 1600, trickMs: 1400, idleMs: 1600 },
  yuki:   { id: 'yuki',   scene: 'snow',      glow: ['#8FD8FF', '#E8F6FF'], locomotion: 'bound',   speed: 70, run: 300, front: false, airborne: false, callParticle: 'note',   idleParticle: 'snow',  treat: '🦴', sfx: { greet: 'bark',  call: 'howl',     happy: 'bark',  love: 'purr',   hurt: 'ouch', trick: 'boing' }, callMs: 1900, trickMs: 1200, idleMs: 1100 },
  aurora: { id: 'aurora', scene: 'aurora',    glow: ['#4CE6F0', '#A06BFF'], locomotion: 'prowl',   speed: 40, run: 280, front: false, airborne: false, callParticle: 'note',   idleParticle: 'spark', treat: '🍖', sfx: { greet: 'yip',   call: 'wolfhowl', happy: 'yip',   love: 'purr',   hurt: 'ouch', trick: 'boing' }, callMs: 2300, trickMs: 1200, idleMs: 2200 },
  rain:   { id: 'rain',   scene: 'rain',      glow: ['#35E0B8', '#1FA58A'], locomotion: 'hop',     speed: 58, run: 260, front: true,  airborne: false, callParticle: 'note',   idleParticle: null,    treat: '🪰', sfx: { greet: 'croak', call: 'croak',    happy: 'croak', love: 'pop',    hurt: 'ouch', trick: 'boing' }, callMs: 1500, trickMs: 1000, idleMs: 900 },
  nemo:   { id: 'nemo',   scene: 'ocean',     glow: ['#49C2FF', '#1E7FB8'], locomotion: 'swim',    speed: 30, run: 160, front: false, airborne: false, callParticle: 'bubble', idleParticle: 'bubble', treat: '🥬', sfx: { greet: 'bubble', call: 'bubble',  happy: 'bubble', love: 'pop',   hurt: 'ouch', trick: 'boing' }, callMs: 1500, trickMs: 1400, idleMs: 2200 },
  ash:    { id: 'ash',    scene: 'ambient',   glow: ['#FF4A3D', '#FF8A3D'], locomotion: 'prowl',   speed: 50, run: 320, front: false, airborne: false, callParticle: 'note',   idleParticle: null,    treat: '🐟', sfx: { greet: 'meow',  call: 'meow',     happy: 'meow',  love: 'purr',   hurt: 'ouch', trick: 'boing' }, callMs: 1200, trickMs: 1100, idleMs: 1800 },
  orbit:  { id: 'orbit',  scene: 'space',     glow: ['#8F6BFF', '#E04BFF'], locomotion: 'hover',   speed: 64, run: 300, front: true,  airborne: true,  callParticle: 'ring',   idleParticle: null,    treat: '🔋', sfx: { greet: 'ping',  call: 'ping',     happy: 'ping',  love: 'chime',  hurt: 'ouch', trick: 'ping' },  callMs: 1500, trickMs: 1000, idleMs: 1800 },
  grid:   { id: 'grid',   scene: 'blueprint', glow: ['#5FB0FF', '#BFE0FF'], locomotion: 'walk',    speed: 40, run: 220, front: true,  airborne: false, callParticle: 'beep',   idleParticle: null,    treat: '🔩', sfx: { greet: 'beep',  call: 'beep',     happy: 'beep',  love: 'chime',  hurt: 'ouch', trick: 'beep' },  callMs: 1300, trickMs: 1600, idleMs: 2000 },
};

const BY_SCENE: Partial<Record<SceneId, FormId>> = Object.fromEntries(FORM_ORDER.map((id) => [FORMS[id].scene, id]));

export const isFormId = (v: unknown): v is FormId => typeof v === 'string' && (FORM_ORDER as readonly string[]).includes(v);
export const isCompanionPref = (v: unknown): v is CompanionPref => v === 'scene' || isFormId(v);

/**
 * Which form is on screen.
 * - A pinned favourite always wins.
 * - Ember Smoke is NEXORA's default scene: a student who never chose a scene meets Nova the fox;
 *   a student who picks Ember Smoke on purpose meets ASH.
 * - Calm has no animal of its own: Nova stays (asleep — see `restsIn`).
 */
export function formFor(scene: SceneId, pref: CompanionPref = 'scene', sceneChosen = true): FormId {
  if (pref !== 'scene') return pref;
  if (scene === 'ambient' && !sceneChosen) return 'nova';
  return BY_SCENE[scene] ?? 'nova';
}

/** Scenes where the assistant stays curled up in the dock (no wandering, no idle tricks). */
export const restsIn = (scene: SceneId) => scene === 'calm';

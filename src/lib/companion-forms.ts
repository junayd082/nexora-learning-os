import type { SceneId, ScenePref } from './scenes/types';
import { resolveScene } from './scenes/registry';

/**
 * Scene Assistants (NEXORA 0.7). Nova is one companion with many forms: the active scene
 * decides which form walks the dock, unless the student keeps a favourite.
 * Names, animals and colours follow the Scene Assistants design brief v1.0.
 */
export type FormId = 'nova' | 'cora' | 'lumi' | 'maple' | 'yuki' | 'aurora' | 'rain' | 'nemo' | 'ash' | 'orbit' | 'grid';
export type Locomotion = 'walk' | 'scuttle' | 'hover' | 'hop' | 'swim' | 'drift';

export interface FormDef {
  id: FormId;
  name: string;          // shown on the dock and in the panel
  animal: { en: string; es: string };
  glow: [string, string]; // the two accent colours from the brief
  move: Locomotion;
  /** Walking speed relative to Nova (px/s multiplier). */
  speed: number;
  /** Floats above the ground (fliers, swimmers). */
  floats?: boolean;
}

export const FORMS: Record<FormId, FormDef> = {
  nova:   { id: 'nova',   name: 'Nova',   animal: { en: 'Fox', es: 'Zorro' },          glow: ['#9A72FF', '#FF6FA8'], move: 'walk',    speed: 1 },
  cora:   { id: 'cora',   name: 'Cora',   animal: { en: 'Crab', es: 'Cangrejo' },      glow: ['#3FD6E0', '#FF6B4A'], move: 'scuttle', speed: 0.8 },
  lumi:   { id: 'lumi',   name: 'Lumi',   animal: { en: 'Firefly', es: 'Luciérnaga' }, glow: ['#F6E05A', '#A8F25C'], move: 'hover',   speed: 1.1, floats: true },
  maple:  { id: 'maple',  name: 'Maple',  animal: { en: 'Owl', es: 'Búho' },           glow: ['#FFB547', '#C2551F'], move: 'hop',     speed: 0.8 },
  yuki:   { id: 'yuki',   name: 'Yuki',   animal: { en: 'Husky', es: 'Husky' },        glow: ['#8FD8FF', '#E8F6FF'], move: 'walk',    speed: 1.1 },
  aurora: { id: 'aurora', name: 'Aurora', animal: { en: 'Wolf', es: 'Lobo' },          glow: ['#4FF0E0', '#A77BFF'], move: 'walk',    speed: 0.9 },
  rain:   { id: 'rain',   name: 'Rain',   animal: { en: 'Frog', es: 'Rana' },          glow: ['#3FE0B8', '#2AA7A0'], move: 'hop',     speed: 0.9 },
  nemo:   { id: 'nemo',   name: 'Nemo',   animal: { en: 'Turtle', es: 'Tortuga' },     glow: ['#4FC3FF', '#7FF0FF'], move: 'swim',    speed: 0.6, floats: true },
  ash:    { id: 'ash',    name: 'Ash',    animal: { en: 'Cat', es: 'Gato' },           glow: ['#FF3B2F', '#FF8A4C'], move: 'walk',    speed: 1 },
  orbit:  { id: 'orbit',  name: 'Orbit',  animal: { en: 'Drone', es: 'Dron' },         glow: ['#8F7BFF', '#E35CE6'], move: 'drift',   speed: 1, floats: true },
  grid:   { id: 'grid',   name: 'Grid',   animal: { en: 'Bot', es: 'Robot' },          glow: ['#5AA9FF', '#9FD3FF'], move: 'walk',    speed: 0.85 },
};

export const FORM_ORDER: FormId[] = ['nova', 'cora', 'lumi', 'maple', 'yuki', 'aurora', 'rain', 'nemo', 'ash', 'orbit', 'grid'];

/**
 * Which form each scene brings. Ember Smoke (NEXORA's default) keeps Nova the fox, so every new
 * student meets Nova first; Ash the cat is chosen as a favourite. Calm keeps the current form, asleep.
 */
export const SCENE_FORM: Record<Exclude<SceneId, 'calm'>, FormId> = {
  ambient: 'nova', sakura: 'nova', beach: 'cora', fireflies: 'lumi', autumn: 'maple', snow: 'yuki',
  aurora: 'aurora', rain: 'rain', ocean: 'nemo', space: 'orbit', blueprint: 'grid',
};

/** 'scene' = follow the scene; a form id = keep that favourite everywhere. */
export type FormPref = 'scene' | FormId;
export const FORM_COOKIE = 'NEXORA_FORM';
export const isFormId = (v: unknown): v is FormId => typeof v === 'string' && v in FORMS;
export const isFormPref = (v: unknown): v is FormPref => v === 'scene' || isFormId(v);

/** The form to show, plus whether it should be asleep (Calm). */
export function resolveForm(pref: FormPref, scene: ScenePref | SceneId, last: FormId = 'nova'): { form: FormId; asleep: boolean } {
  const s = resolveScene(scene as ScenePref);
  if (s === 'calm') return { form: pref === 'scene' ? last : pref, asleep: true };
  return { form: pref === 'scene' ? SCENE_FORM[s] : pref, asleep: false };
}

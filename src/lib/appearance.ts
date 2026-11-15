import { cookies } from 'next/headers';
import { isScenePref, SCENES } from './scenes/registry';
import type { SceneId, ScenePref } from './scenes/types';
import { MOTION_COOKIE, type Motion } from './living';
import type { PeriodIcon } from './period-icons';
import { createClient } from './supabase/server';
import { isCompanionPref, type CompanionPref } from '@/components/companion/forms/registry';

/**
 * Appearance = the student's living scene and how it behaves.
 * Cookies make the first paint correct with no flash; the database row
 * (appearance_preferences) carries the choice to the student's other devices.
 */
export const SCENE_COOKIE = 'NEXORA_SCENE';
export const APPEARANCE_COOKIE = 'NEXORA_APPEARANCE'; // "intensity,contrast,focusDim" e.g. "70,50,1"
export const COMPANION_FORM_COOKIE = 'NEXORA_COMPANION_FORM'; // 'scene' or a pinned form id, e.g. 'grid'

export interface Appearance {
  scene: ScenePref;
  motion: Motion;
  intensity: number; // 0..1
  contrast: number;  // 0..1
  focusDim: boolean;
  /** Scene Assistant: 'scene' = change form with the scene, or a pinned form ('cora', 'grid', …). */
  companion: CompanionPref;
  /** False until the student picks a scene. Lets a new student meet Nova (not Ash) in the default Ember Smoke. */
  sceneChosen: boolean;
}

export const DEFAULT_APPEARANCE: Appearance = { scene: 'ambient', motion: 'full', intensity: 0.7, contrast: 0.5, focusDim: true, companion: 'scene', sceneChosen: false };

export function parseAppearanceCookie(raw: string | undefined) {
  const [i, c, f] = (raw ?? '').split(',');
  const pct = (v: string | undefined, d: number) => { const n = Number(v); return Number.isFinite(n) && v !== '' && v !== undefined ? Math.min(1, Math.max(0, n / 100)) : d; };
  return { intensity: pct(i, DEFAULT_APPEARANCE.intensity), contrast: pct(c, DEFAULT_APPEARANCE.contrast), focusDim: f === undefined || f === '' ? DEFAULT_APPEARANCE.focusDim : f === '1' };
}
export const formatAppearanceCookie = (a: Pick<Appearance, 'intensity' | 'contrast' | 'focusDim'>) =>
  `${Math.round(a.intensity * 100)},${Math.round(a.contrast * 100)},${a.focusDim ? 1 : 0}`;

export async function getAppearance(): Promise<Appearance> {
  const store = await cookies();
  const m = store.get(MOTION_COOKIE)?.value;
  const motion: Motion = m === 'reduced' || m === 'static' ? m : 'full';
  const s = store.get(SCENE_COOKIE)?.value;
  const rest = parseAppearanceCookie(store.get(APPEARANCE_COOKIE)?.value);
  const cf = store.get(COMPANION_FORM_COOKIE)?.value;
  const companion: CompanionPref = isCompanionPref(cf) ? cf : 'scene';
  if (isScenePref(s)) return { scene: s, motion, ...rest, companion, sceneChosen: true };

  // No cookie on this device yet: fall back to the student's saved row, if signed in.
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('appearance_preferences').select('scene, motion, intensity, contrast, focus_dim, companion_form').eq('user_id', user.id).maybeSingle();
      if (data && isScenePref(data.scene)) {
        return { scene: data.scene, motion: (data.motion as Motion) ?? motion, intensity: data.intensity ?? rest.intensity, contrast: data.contrast ?? rest.contrast, focusDim: data.focus_dim ?? rest.focusDim,
          companion: isCompanionPref(cf) ? companion : isCompanionPref(data.companion_form) ? data.companion_form : 'scene', sceneChosen: true };
      }
    }
  } catch { /* signed out or table not migrated yet: use defaults */ }
  return { ...DEFAULT_APPEARANCE, motion, ...rest, companion };
}

/** The signed-in student's icons for their classes, keyed by class id. Image icons get a 1-hour signed URL. */
export async function getPeriodIcons(classIds: string[]): Promise<Record<string, PeriodIcon>> {
  if (!classIds.length) return {};
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return {};
  const { data } = await supabase.from('period_icons').select('class_id, kind, scene, palette, symbol, image_path').eq('user_id', user.id).in('class_id', classIds);
  const out: Record<string, PeriodIcon> = {};
  for (const r of data ?? []) {
    if (r.kind === 'scene' && r.scene) out[r.class_id] = { kind: 'scene', scene: r.scene };
    else if (r.kind === 'color') out[r.class_id] = { kind: 'color', palette: r.palette ?? 0 };
    else if (r.kind === 'symbol' && r.symbol) out[r.class_id] = { kind: 'symbol', symbol: r.symbol, palette: r.palette ?? 0 };
    else if (r.kind === 'image' && r.image_path) {
      const { data: signed } = await supabase.storage.from('period-icons').createSignedUrl(r.image_path, 3600);
      if (signed?.signedUrl) out[r.class_id] = { kind: 'image', url: signed.signedUrl };
    }
  }
  return out;
}

export interface ClassAppearance { allowCustomIcons: boolean; lockScene: SceneId | null }

/** A teacher's rules for one class. Missing row (or table not migrated yet) = defaults. */
export async function getClassAppearance(classId: string): Promise<ClassAppearance> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from('class_appearance').select('allow_custom_icons, lock_scene').eq('class_id', classId).maybeSingle();
    const lock = data?.lock_scene;
    return { allowCustomIcons: data?.allow_custom_icons ?? true, lockScene: lock && lock in SCENES ? (lock as SceneId) : null };
  } catch { return { allowCustomIcons: true, lockScene: null }; }
}

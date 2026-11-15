import type { SceneDef, SceneId, ScenePref } from './types';
import { sakura } from './sakura';
import { beach } from './beach';
import { rain } from './rain';
import { aurora, snow, space } from './sky';
import { ocean, autumn, fireflies } from './nature';
import { ambient, blueprint, calm } from './studio';

export const SCENES: Record<SceneId, SceneDef> = { ambient, sakura, beach, rain, aurora, snow, space, ocean, autumn, fireflies, blueprint, calm };

/** Display order in pickers. */
export const SCENE_ORDER: SceneId[] = ['ambient', 'sakura', 'beach', 'fireflies', 'autumn', 'snow', 'aurora', 'rain', 'ocean', 'space', 'blueprint', 'calm'];

/** Northern-hemisphere seasons by month (Texas school calendar). */
export function seasonScene(date = new Date()): SceneId {
  const mth = date.getMonth(); // 0 = Jan
  if (mth >= 2 && mth <= 4) return 'sakura';   // Mar–May
  if (mth >= 5 && mth <= 7) return 'fireflies'; // Jun–Aug
  if (mth >= 8 && mth <= 10) return 'autumn';   // Sep–Nov
  return 'snow';                                // Dec–Feb
}

export function resolveScene(pref: ScenePref | null | undefined, date = new Date()): SceneId {
  if (!pref) return 'ambient';
  if (pref === 'season') return seasonScene(date);
  return pref in SCENES ? (pref as SceneId) : 'ambient';
}

export const isScenePref = (v: unknown): v is ScenePref => v === 'season' || (typeof v === 'string' && v in SCENES);

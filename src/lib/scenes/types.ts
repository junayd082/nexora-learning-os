/** NEXORA Living Scenes — shared types. Pure TypeScript, no React, so the same engine runs in the app and in previews. */

export type Motion = 'full' | 'reduced' | 'static';

export type SceneId =
  | 'ambient'
  | 'sakura'
  | 'beach'
  | 'rain'
  | 'aurora'
  | 'snow'
  | 'space'
  | 'ocean'
  | 'autumn'
  | 'fireflies'
  | 'blueprint'
  | 'calm';

/** What a student picks. 'season' resolves to a concrete scene from the calendar. */
export type ScenePref = SceneId | 'season';

export interface Pointer {
  /** CSS px, relative to the canvas. */
  x: number;
  y: number;
  /** Smoothed velocity, px per second. */
  vx: number;
  vy: number;
  /** False until the pointer moves, and on touch devices after the touch ends. */
  active: boolean;
}

export interface FrameInfo {
  ctx: CanvasRenderingContext2D;
  /** Canvas size in CSS px (the context is already scaled by the device pixel ratio). */
  w: number;
  h: number;
  /** Seconds since the scene started. */
  t: number;
  /** Seconds since the previous frame, clamped to 0.1. */
  dt: number;
  pointer: Pointer;
  /** 0..1 — student's "intensity" setting (particle density, light strength). */
  intensity: number;
  motion: Motion;
}

export interface SceneInstance {
  /** Called on mount and on every resize; rebuild cached layers here. */
  resize(w: number, h: number, dpr: number): void;
  frame(f: FrameInfo): void;
  destroy?(): void;
}

export interface SceneMeta {
  id: SceneId;
  /** Dominant accent for UI chrome (hex). */
  accent: string;
  /** Base colour shown before the first frame and behind the canvas. */
  base: string;
  /** How strong the reading scrim behind cards should be (0..1). Bright scenes need more. */
  scrim: number;
  /** Which soundscape fits (optional, off by default). */
  sound: SoundId | null;
  /** Season tag used by Auto-season. */
  season?: 'spring' | 'summer' | 'fall' | 'winter';
  /** Scene never changes after the first frame (engine draws it once). */
  still?: boolean;
}

export type SoundId = 'rain' | 'waves' | 'wind' | 'night' | 'space' | 'underwater';

export interface SceneDef extends SceneMeta {
  create(seed: number): SceneInstance;
}

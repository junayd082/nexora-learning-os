'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { mountScene, resolveScene, SCENES, type SceneHandle, type SceneId } from '@/lib/scenes';
import type { Appearance } from '@/lib/appearance';
import { moodFor } from '../AmbientField';
import { onAppearance, useAppearanceState, useSceneLock } from './appearance-client';

/**
 * The student's living scene, mounted behind the whole app.
 * - 'ambient' keeps NEXORA's original <AmbientField/> (passed in), so nothing changes for anyone who doesn't pick a scene.
 * - Pages whose mood is 'focus' (assignments, tests) dim the scene when the student has focus dimming on.
 * - `lockScene` lets a teacher's live session or a test force a scene (usually 'calm').
 */
export function SceneBackground({ initial, ambient, lockScene }: { initial: Appearance; ambient: ReactNode; lockScene?: SceneId | null }) {
  const [a] = useAppearanceState(initial);
  const host = useRef<HTMLDivElement>(null);
  const handle = useRef<SceneHandle | null>(null);
  const path = usePathname();
  const focusPreview = useRef(false);

  const pageLock = useSceneLock();
  const sceneId: SceneId = lockScene ?? pageLock ?? resolveScene(a.scene);
  const useEngine = sceneId !== 'ambient';
  const focus = a.focusDim && (moodFor(path) === 'focus');

  // mount / unmount the engine when switching to or from the original ambient field
  useEffect(() => {
    if (!useEngine || !host.current) return;
    handle.current = mountScene(host.current, { scene: sceneId, motion: a.motion, intensity: a.intensity });
    return () => { handle.current?.destroy(); handle.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useEngine]);

  useEffect(() => { handle.current?.setScene(sceneId); }, [sceneId]);
  useEffect(() => { handle.current?.setMotion(a.motion); document.documentElement.dataset.motion = a.motion; }, [a.motion]);
  useEffect(() => { handle.current?.setIntensity(a.intensity); }, [a.intensity]);
  useEffect(() => { handle.current?.setDim(focus || focusPreview.current ? 0.72 : 0); }, [focus]);
  useEffect(() => onAppearance(p => {
    if (p.focusPreview !== undefined) { focusPreview.current = p.focusPreview; handle.current?.setDim(p.focusPreview ? 0.72 : 0); }
  }), []);

  // UI chrome follows the scene: accent colour and the strength of the reading glass
  useEffect(() => {
    const def = SCENES[sceneId];
    const root = document.documentElement;
    root.dataset.scene = sceneId;
    root.style.setProperty('--nx-scene-accent', def.accent);
    root.style.setProperty('--nx-scrim', String(Math.min(0.9, def.scrim * (0.55 + a.contrast * 0.9))));
  }, [sceneId, a.contrast]);

  if (!useEngine) return <>{ambient}</>;
  return <div ref={host} aria-hidden="true" className="nx-scene" style={{ backgroundColor: SCENES[sceneId].base }} />;
}

'use client';

import { useEffect, useState } from 'react';
import { renderThumbnail, type SceneId } from '@/lib/scenes';
import type { Appearance } from '@/lib/appearance';

/**
 * Tiny in-page bus so the Scene switch, the settings page and the background stay in sync
 * instantly — the server action saves in the background; nothing waits on the network.
 */
const EVENT = 'nexora:appearance';

export function publishAppearance(patch: Partial<Appearance> & { focusPreview?: boolean }) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: patch }));
}

export function useAppearanceState(initial: Appearance) {
  const [a, setA] = useState(initial);
  useEffect(() => {
    const on = (e: Event) => setA(prev => ({ ...prev, ...(e as CustomEvent<Partial<Appearance>>).detail }));
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return [a, setA] as const;
}

export function onAppearance(fn: (patch: Partial<Appearance> & { focusPreview?: boolean }) => void) {
  const on = (e: Event) => fn((e as CustomEvent).detail);
  window.addEventListener(EVENT, on);
  return () => window.removeEventListener(EVENT, on);
}

/**
 * A teacher's scene lock for the class the student is in right now (e.g. Calm on test day).
 * Pages render <SceneLock/>; the background and the Scene switch listen.
 */
const LOCK_EVENT = 'nexora:scene-lock';
let currentLock: SceneId | null = null;
export function publishLock(scene: SceneId | null) {
  currentLock = scene;
  window.dispatchEvent(new CustomEvent(LOCK_EVENT, { detail: scene }));
}
export function useSceneLock() {
  const [lock, setLock] = useState<SceneId | null>(null);
  useEffect(() => {
    setLock(currentLock);
    const on = (e: Event) => setLock((e as CustomEvent<SceneId | null>).detail);
    window.addEventListener(LOCK_EVENT, on);
    return () => window.removeEventListener(LOCK_EVENT, on);
  }, []);
  return lock;
}

/** Scene thumbnails are rendered once per page load, lazily, in idle time. */
const cache = new Map<SceneId, string>();
const waiting = new Map<SceneId, ((url: string) => void)[]>();
const queue: SceneId[] = [];
let pumping = false;
function pump() {
  const id = queue.shift();
  if (!id) { pumping = false; return; }
  if (!cache.has(id)) {
    const url = renderThumbnail(id, 240, 150).toDataURL('image/webp', 0.85);
    cache.set(id, url);
    waiting.get(id)?.forEach(f => f(url)); waiting.delete(id);
  }
  const idle = (window as Window & { requestIdleCallback?: (f: () => void) => number }).requestIdleCallback;
  idle ? idle(pump) : setTimeout(pump, 30);
}

export function useSceneThumb(id: SceneId) {
  const [url, setUrl] = useState(() => cache.get(id) ?? '');
  useEffect(() => {
    if (cache.has(id)) { setUrl(cache.get(id)!); return; }
    const list = waiting.get(id) ?? []; list.push(setUrl); waiting.set(id, list);
    if (!queue.includes(id)) queue.push(id);
    if (!pumping) { pumping = true; setTimeout(pump, 0); }
    return () => { const l = waiting.get(id); if (l) waiting.set(id, l.filter(f => f !== setUrl)); };
  }, [id]);
  return url;
}

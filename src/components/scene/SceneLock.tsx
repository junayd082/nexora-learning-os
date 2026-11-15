'use client';

import { useEffect } from 'react';
import type { SceneId } from '@/lib/scenes';
import { publishLock } from './appearance-client';

/** Put on a class, assignment or check page: while it is open, the background shows the teacher's scene. */
export function SceneLock({ scene }: { scene: SceneId | null | undefined }) {
  useEffect(() => {
    if (!scene) return;
    publishLock(scene);
    return () => publishLock(null);
  }, [scene]);
  return null;
}

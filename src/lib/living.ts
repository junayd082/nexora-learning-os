import { cookies } from 'next/headers';

export type Motion = 'full' | 'reduced' | 'static';
export const MOTION_COOKIE = 'NEXORA_MOTION';
export const COMPANION_COOKIE = 'NEXORA_COMPANION';

export async function getLiving() {
  const store = await cookies();
  const m = store.get(MOTION_COOKIE)?.value;
  const motion: Motion = m === 'reduced' || m === 'static' ? m : 'full';
  const companion = store.get(COMPANION_COOKIE)?.value !== 'off';
  return { motion, companion };
}

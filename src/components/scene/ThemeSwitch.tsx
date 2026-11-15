'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import type { Appearance } from '@/lib/appearance';
import type { Motion, ScenePref } from '@/lib/scenes';
import { setAppearance } from '@/lib/appearance-actions';
import { publishAppearance, useAppearanceState, useSceneLock } from './appearance-client';
import { SceneTiles } from './SceneTiles';

/** Header button that sits next to the 🌐 language switch. Opens a compact scene picker. */
export function ThemeSwitch({ initial }: { initial: Appearance }) {
  const t = useTranslations('appearance');
  const [a] = useAppearanceState(initial);
  const lock = useSceneLock();
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onDown = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('keydown', onKey); document.addEventListener('pointerdown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDown); };
  }, [open]);

  const pick = (scene: ScenePref) => { publishAppearance({ scene, sceneChosen: true }); start(() => { void setAppearance({ scene }); }); };
  const motion = (m: Motion) => { publishAppearance({ motion: m }); start(() => { void setAppearance({ motion: m }); }); };

  return (
    <div className="nx-switch" ref={box}>
      <button type="button" className="nx-icon-btn" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(o => !o)}
        aria-label={`${t('scene')}: ${t(`scenes.${a.scene}.name`)}`} title={t('scene')}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-.9 2-2 0-1.5-1.3-2 0-3.2 1-.8 2.3-.8 4-.8a3 3 0 0 0 3-3A9 9 0 0 0 12 3Z" />
          <circle cx="7.5" cy="11" r="1" /><circle cx="10.5" cy="7" r="1" /><circle cx="15.5" cy="7.5" r="1" />
        </svg>
      </button>
      {open && (
        <div className="nx-pop" role="dialog" aria-label={t('scene')}>
          <div className="nx-row">
            <span className="nx-lbl">{t('scene')}</span>
            <MotionSeg value={a.motion} onChange={motion} />
          </div>
          {lock && <span className="nx-hint" role="note">{t('teacher.lockedNote', { scene: t(`scenes.${lock}.name`) })}</span>}
          <SceneTiles value={a.scene} onPick={pick} />
          <Link href="/profile#appearance" className="nx-link" onClick={() => setOpen(false)}>{t('allSettings')} →</Link>
        </div>
      )}
    </div>
  );
}

export function MotionSeg({ value, onChange }: { value: Motion; onChange: (m: Motion) => void }) {
  const t = useTranslations('appearance');
  return (
    <div className="nx-seg" role="group" aria-label={t('motion')}>
      {(['full', 'reduced', 'static'] as Motion[]).map(m => (
        <button key={m} type="button" aria-pressed={value === m} onClick={() => onChange(m)}>{t(`motionMode.${m}`)}</button>
      ))}
    </div>
  );
}

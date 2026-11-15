'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { createSoundscape, resolveScene, SCENES, type Soundscape } from '@/lib/scenes';
import type { Appearance } from '@/lib/appearance';
import { setAppearance } from '@/lib/appearance-actions';
import { publishAppearance, useAppearanceState } from './appearance-client';
import { SceneTiles } from './SceneTiles';
import { MotionSeg } from './ThemeSwitch';
import { AssistantPicker } from './AssistantPicker';

/** Settings → Appearance. Put it on /profile with id="appearance" so the header link lands here. */
export function AppearanceSettings({ initial }: { initial: Appearance }) {
  const t = useTranslations('appearance');
  const [a] = useAppearanceState(initial);
  const [, start] = useTransition();
  const [focusPreview, setFocusPreview] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const sound = useRef<Soundscape | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const update = (patch: Partial<Appearance>, debounce = false) => {
    publishAppearance(patch);
    clearTimeout(saveTimer.current);
    const run = () => start(() => { void setAppearance(patch); });
    if (debounce) saveTimer.current = setTimeout(run, 400); else run();
  };

  const current = resolveScene(a.scene);
  const soundId = SCENES[current].sound;
  useEffect(() => { if (playing && sound.current) { if (soundId) sound.current.play(soundId); else { sound.current.stop(); setPlaying(false); } } }, [soundId, playing]);
  useEffect(() => () => { sound.current?.stop(); publishAppearance({ focusPreview: false }); }, []);

  return (
    <section id="appearance" className="nx-settings" aria-labelledby="appearance-h">
      <h2 id="appearance-h">{t('title')}</h2>

      <div className="nx-set">
        <span className="nx-lbl">{t('scenes.heading')}</span>
        <SceneTiles value={a.scene} onPick={scene => { publishAppearance({ sceneChosen: true }); update({ scene }); }} detailed />
      </div>

      <AssistantPicker value={a.companion} scene={current} sceneChosen={a.sceneChosen} onPick={companion => update({ companion })} />

      <div className="nx-set nx-row">
        <span className="nx-lbl">{t('motion')}</span>
        <MotionSeg value={a.motion} onChange={motion => update({ motion })} />
      </div>

      <label className="nx-set">
        <span className="nx-row"><span className="nx-lbl">{t('intensity')}</span><span className="nx-num">{Math.round(a.intensity * 100)}%</span></span>
        <input type="range" min={0} max={100} value={Math.round(a.intensity * 100)} onChange={e => update({ intensity: +e.target.value / 100 }, true)} />
        <span className="nx-hint">{t('intensityHint')}</span>
      </label>

      <label className="nx-set">
        <span className="nx-row"><span className="nx-lbl">{t('contrast')}</span><span className="nx-num">{Math.round(a.contrast * 100)}%</span></span>
        <input type="range" min={0} max={100} value={Math.round(a.contrast * 100)} onChange={e => update({ contrast: +e.target.value / 100 }, true)} />
        <span className="nx-hint">{t('contrastHint')}</span>
      </label>

      <div className="nx-set">
        <div className="nx-row">
          <span className="nx-lbl" id="fd-l">{t('focusDim')}</span>
          <button type="button" role="switch" className="nx-sw" aria-checked={a.focusDim} aria-labelledby="fd-l" onClick={() => update({ focusDim: !a.focusDim })} />
        </div>
        <span className="nx-hint">{t('focusDimHint')}</span>
        <div><button type="button" className="nx-btn" disabled={!a.focusDim} onClick={() => { const v = !focusPreview; setFocusPreview(v); publishAppearance({ focusPreview: v }); }}>{focusPreview ? t('stopFocus') : t('tryFocus')}</button></div>
      </div>

      <div className="nx-set">
        <div className="nx-row">
          <span className="nx-lbl">{t('sound')}</span>
          {soundId ? (
            <button type="button" className="nx-btn" onClick={() => {
              sound.current ??= createSoundscape();
              if (playing) { sound.current.stop(); setPlaying(false); } else { sound.current.setVolume(volume); sound.current.play(soundId); setPlaying(true); }
            }}>{playing ? `■ ${t('stop')}` : `▶ ${t('play')}`}</button>
          ) : <span className="nx-hint">{t('noSound')}</span>}
        </div>
        <span className="nx-hint">{t('soundHint')}</span>
        <label className="nx-row"><span className="nx-hint">{t('volume')}</span>
          <input type="range" min={0} max={100} value={Math.round(volume * 100)} onChange={e => { const v = +e.target.value / 100; setVolume(v); sound.current?.setVolume(v); }} />
        </label>
      </div>
    </section>
  );
}

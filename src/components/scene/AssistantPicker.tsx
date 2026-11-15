'use client';

import { useTranslations } from 'next-intl';
import type { SceneId } from '@/lib/scenes';
import { FormArt, FORM_ORDER, FORMS, formFor, type CompanionPref } from '@/components/companion/forms';

/**
 * Settings → Appearance → Assistant. "Match my scene" (default) lets the helper change form with
 * the scene; picking a tile pins that form everywhere. Each tile is the live assistant, sitting.
 */
export function AssistantPicker({ value, scene, sceneChosen, onPick }:
  { value: CompanionPref; scene: SceneId; sceneChosen: boolean; onPick: (v: CompanionPref) => void }) {
  const t = useTranslations('appearance.assistant');
  const tf = useTranslations('nova.forms');
  const now = formFor(scene, value, sceneChosen);
  const matchForm = formFor(scene, 'scene', sceneChosen);
  return (
    <div className="nx-set" role="group" aria-labelledby="assistant-h">
      <span className="nx-lbl" id="assistant-h">{t('title')}</span>
      <span className="nx-hint">{t('hint')}</span>
      <div className="nx-forms">
        <button type="button" className="nx-form-tile" aria-pressed={value === 'scene'} onClick={() => onPick('scene')}
          style={{ ['--tile-glow' as string]: FORMS[matchForm].glow[0] }}>
          <span className="art"><FormArt id={matchForm} pose="sit" /></span>
          <b>{t('match')}</b>
          <small>{t('matchHint')}</small>
        </button>
        {FORM_ORDER.map((id) => (
          <button key={id} type="button" className="nx-form-tile" aria-pressed={value === id} onClick={() => onPick(id)}
            title={`${tf(`${id}.name`)}: ${tf(`${id}.moves`)}`} style={{ ['--tile-glow' as string]: FORMS[id].glow[0] }}>
            {now === id && <span className="tag">{value === id ? t('pinned') : t('current')}</span>}
            <span className="art"><FormArt id={id} pose="sit" /></span>
            <b>{tf(`${id}.name`)}</b>
            <small>{tf(`${id}.scene`)}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

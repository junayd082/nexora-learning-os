'use client';

import { useTranslations } from 'next-intl';
import { SCENE_ORDER, seasonScene, SCENES, type ScenePref, type SceneId } from '@/lib/scenes';
import { useSceneThumb } from './appearance-client';

function Thumb({ id }: { id: SceneId }) {
  const url = useSceneThumb(id);
  // eslint-disable-next-line @next/next/no-img-element
  return <img alt="" src={url || undefined} className="nx-tile-img" style={{ backgroundColor: SCENES[id].base, opacity: url ? 1 : 0 }} />;
}

/** The grid of scenes used by the header switch (compact) and the settings page (with descriptions). */
export function SceneTiles({ value, onPick, detailed = false, only }: { value: ScenePref; onPick: (p: ScenePref) => void; detailed?: boolean; only?: SceneId[] }) {
  const t = useTranslations('appearance');
  const ids = only ?? SCENE_ORDER;
  return (
    <div className="nx-tiles">
      {!only && (
        <button type="button" className="nx-tile nx-tile-season" aria-pressed={value === 'season'} onClick={() => onPick('season')} title={t('scenes.season.desc')}>
          <span className="nx-tile-quad">{(['sakura', 'fireflies', 'autumn', 'snow'] as SceneId[]).map(id => <Thumb key={id} id={id} />)}</span>
          <span className="nx-tile-label">
            {t('scenes.season.name')}
            {detailed && <small>{t('scenes.season.desc')} · {t(`scenes.${seasonScene()}.name`)}</small>}
          </span>
        </button>
      )}
      {ids.map(id => (
        <button key={id} type="button" className="nx-tile" aria-pressed={value === id} onClick={() => onPick(id)} title={t(`scenes.${id}.desc`)}>
          <Thumb id={id} />
          <span className="nx-tile-label">
            {t(`scenes.${id}.name`)}
            {detailed && <small>{t(`scenes.${id}.desc`)}</small>}
          </span>
        </button>
      ))}
    </div>
  );
}

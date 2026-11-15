'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { SCENE_ORDER, type SceneId } from '@/lib/scenes';
import { setClassAppearance } from '@/lib/appearance-actions';

/** Teacher side of a class: whether photo icons are allowed, and an optional scene lock (e.g. Calm on test day). */
export function ClassAppearanceForm({ classId, allowCustomIcons, lockScene }: { classId: string; allowCustomIcons: boolean; lockScene: SceneId | null }) {
  const t = useTranslations('appearance');
  const [allow, setAllow] = useState(allowCustomIcons);
  const [lock, setLock] = useState<string>(lockScene ?? '');
  const [msg, setMsg] = useState('');
  const [busy, start] = useTransition();
  const save = (patch: { allowCustomIcons?: boolean; lockScene?: string | null }) => start(async () => {
    const r = await setClassAppearance(classId, patch);
    setMsg('error' in r && r.error ? '!' : t('teacher.saved'));
    setTimeout(() => setMsg(''), 1800);
  });
  return (
    <div className="space-y-3 text-sm">
      <label className="flex items-start gap-2.5">
        <input type="checkbox" className="mt-0.5 accent-[rgb(var(--nx-ember))]" checked={allow} disabled={busy}
          onChange={(e) => { setAllow(e.target.checked); save({ allowCustomIcons: e.target.checked }); }} />
        <span>{t('teacher.allowPhotos')}</span>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs text-muted">{t('teacher.lock')}</span>
        <select className="input h-9 w-full" value={lock} disabled={busy}
          onChange={(e) => { setLock(e.target.value); save({ lockScene: e.target.value || null }); }}>
          <option value="">{t('teacher.lockNone')}</option>
          {SCENE_ORDER.map((id) => <option key={id} value={id}>{t(`scenes.${id}.name`)}</option>)}
        </select>
      </label>
      <p className="text-2xs text-faint">{t('teacher.lockHint')}</p>
      <p className="h-4 text-2xs text-ok" role="status">{msg}</p>
    </div>
  );
}

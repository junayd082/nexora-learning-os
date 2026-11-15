'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Compass, RotateCcw } from 'lucide-react';

/** Settings → Guide me: replay the tour, or bring back the one-time tool tips. */
export function GuideMe() {
  const t = useTranslations('tour');
  const [reset, setReset] = useState(false);
  return (
    <div className="space-y-3">
      <p className="max-w-xl text-sm text-muted">{t('settingsHint')}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary btn-sm" onClick={() => window.dispatchEvent(new CustomEvent('nexora:tour', { detail: 'main' }))}>
          <Compass size={14} aria-hidden />{t('settingsStart')}
        </button>
        <button type="button" className="btn btn-sm" onClick={() => { window.dispatchEvent(new CustomEvent('nexora:tour', { detail: 'reset-tips' })); setReset(true); }}>
          <RotateCcw size={14} aria-hidden />{t('settingsReset')}
        </button>
      </div>
      {reset && <p role="status" className="text-xs text-ok">{t('settingsResetDone')}</p>}
    </div>
  );
}

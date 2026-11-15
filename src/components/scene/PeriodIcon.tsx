'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { SCENE_ORDER, SCENES } from '@/lib/scenes';
import { PALETTES, SYMBOL_ORDER, SYMBOLS, gradientCSS, loadImage, cropSquare, drawCrop, type PeriodIcon as Icon, type SymbolId } from '@/lib/period-icons';
import { setPeriodIcon, uploadPeriodIcon } from '@/lib/appearance-actions';
import { useSceneThumb } from './appearance-client';
import { SceneTiles } from './SceneTiles';

function Symbol({ id, size = 24 }: { id: SymbolId; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: SYMBOLS[id] }} />;
}

function Face({ icon, size, symbolSize }: { icon: Icon; size: number; symbolSize: number }) {
  const thumb = useSceneThumb(icon.kind === 'scene' ? icon.scene : 'calm');
  const bg = icon.kind === 'color' || icon.kind === 'symbol' ? gradientCSS(icon.palette) : icon.kind === 'scene' ? SCENES[icon.scene].base : '#111';
  return (
    <span className="nx-picon-face" style={{ width: size, height: size, background: bg }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {icon.kind === 'scene' && thumb && <img alt="" src={thumb} />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {icon.kind === 'image' && <img alt="" src={icon.url} />}
      {icon.kind === 'symbol' && <Symbol id={icon.symbol} size={symbolSize} />}
    </span>
  );
}

/**
 * A class-period icon the student can customize. Click it to open the editor.
 * Pass `fallback` (e.g. a symbol chosen from the class subject) for students who haven't picked one.
 */
export function PeriodIcon({ classId, className, period, icon, fallback, allowImages = true, size = 52 }: {
  classId: string; className: string; period?: number | string; icon?: Icon | null; fallback: Icon; allowImages?: boolean; size?: number;
}) {
  const t = useTranslations('appearance');
  const [current, setCurrent] = useState<Icon>(icon ?? fallback);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="nx-picon" onClick={() => setOpen(true)} aria-label={`${t('icon.customize')}: ${className}`}>
        <Face icon={current} size={size} symbolSize={Math.round(size * 0.48)} />
        {period !== undefined && <span className="nx-picon-p">P{period}</span>}
      </button>
      {open && <IconEditor classId={classId} className={className} period={period} value={current} fallback={fallback} allowImages={allowImages}
        onClose={() => setOpen(false)} onSaved={ic => { setCurrent(ic); setOpen(false); }} />}
    </>
  );
}

type Tab = 'scenes' | 'colors' | 'symbols' | 'upload';

function IconEditor({ classId, className, period, value, fallback, allowImages, onClose, onSaved }: {
  classId: string; className: string; period?: number | string; value: Icon; fallback: Icon; allowImages: boolean; onClose: () => void; onSaved: (i: Icon) => void;
}) {
  const t = useTranslations('appearance');
  const [draft, setDraft] = useState<Icon>(value);
  const [tab, setTab] = useState<Tab>(value.kind === 'scene' ? 'scenes' : value.kind === 'image' ? 'upload' : value.kind === 'color' ? 'colors' : 'symbols');
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState({ zoom: 1, ox: 0, oy: 0 });
  const [err, setErr] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();
  const big = useRef<HTMLCanvasElement>(null), mini = useRef<HTMLCanvasElement>(null), file = useRef<HTMLInputElement>(null), dialog = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const pal = draft.kind === 'color' || draft.kind === 'symbol' ? draft.palette : 0;

  useEffect(() => { dialog.current?.focus(); const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, [onClose]);
  useEffect(() => {
    if (!img) return;
    if (big.current) drawCrop(big.current.getContext('2d')!, img, 360, crop.zoom, crop.ox, crop.oy);
    if (mini.current) drawCrop(mini.current.getContext('2d')!, img, 168, crop.zoom, crop.ox, crop.oy);
  }, [img, crop, tab]);

  async function take(f?: File | null) {
    if (!f) return;
    try { setImg(await loadImage(f)); setCrop({ zoom: 1, ox: 0, oy: 0 }); setErr(null); }
    catch (e) { setErr((e as Error).message === 'too-big' ? t('icon.tooBig') : t('icon.badFile')); }
  }

  function save() {
    startBusy(async () => {
      if (tab === 'upload') {
        if (!img) return;
        const blob = await cropSquare(img, crop.zoom, crop.ox, crop.oy);
        const fd = new FormData();
        fd.set('classId', classId);
        fd.set('file', new File([blob], 'icon.' + (blob.type === 'image/webp' ? 'webp' : 'jpg'), { type: blob.type }));
        const res = await uploadPeriodIcon(fd);
        if ('error' in res && res.error) { setErr(res.error === 'not-allowed' ? t('icon.notAllowed') : t('icon.uploadFailed')); return; }
        onSaved({ kind: 'image', url: ('url' in res && res.url) || URL.createObjectURL(blob) });
      } else {
        if (draft.kind === 'image') return;
        await setPeriodIcon(classId, draft);
        onSaved(draft);
      }
    });
  }
  function reset() { startBusy(async () => { await setPeriodIcon(classId, null); onSaved(fallback); }); }

  const tabs: Tab[] = allowImages ? ['scenes', 'colors', 'symbols', 'upload'] : ['scenes', 'colors', 'symbols'];
  return (
    <>
      <div className="nx-scrim" onClick={onClose} />
      <div className="nx-modal" role="dialog" aria-modal="true" aria-label={t('icon.title')} tabIndex={-1} ref={dialog}>
        <div className="nx-ed-top">
          <span className="nx-picon nx-picon-lg">
            {tab === 'upload' && img
              ? <span className="nx-picon-face" style={{ width: 84, height: 84, background: '#111' }}><canvas ref={mini} width={168} height={168} /></span>
              : <Face icon={draft} size={84} symbolSize={40} />}
            {period !== undefined && <span className="nx-picon-p">P{period}</span>}
          </span>
          <div><span className="nx-eyebrow">{t('icon.title')}</span><h2>{className}</h2><span className="nx-hint">{t('icon.private')}</span></div>
        </div>

        <div className="nx-tabs" role="tablist">
          {tabs.map(k => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setErr(null); }}>{t(`icon.tab.${k}`)}</button>)}
        </div>

        {tab === 'scenes' && <SceneTiles value={draft.kind === 'scene' ? draft.scene : ('none' as never)} onPick={p => p !== 'season' && setDraft({ kind: 'scene', scene: p })} only={SCENE_ORDER} />}
        {tab === 'colors' && (
          <div className="nx-swatches">{PALETTES.map((_, i) => <button key={i} type="button" style={{ background: gradientCSS(i) }} aria-pressed={draft.kind === 'color' && draft.palette === i} aria-label={`${t('icon.color')} ${i + 1}`} onClick={() => setDraft({ kind: 'color', palette: i })} />)}</div>
        )}
        {tab === 'symbols' && (<>
          <div className="nx-swatches">{SYMBOL_ORDER.map(s => <button key={s} type="button" style={{ background: gradientCSS(pal) }} aria-pressed={draft.kind === 'symbol' && draft.symbol === s} aria-label={s} onClick={() => setDraft({ kind: 'symbol', symbol: s, palette: pal })}><Symbol id={s} size={22} /></button>)}</div>
          <span className="nx-hint">{t('icon.background')}</span>
          <div className="nx-swatches nx-swatches-wide">{PALETTES.map((_, i) => <button key={i} type="button" style={{ background: gradientCSS(i) }} aria-pressed={pal === i} aria-label={`${t('icon.color')} ${i + 1}`} onClick={() => setDraft(draft.kind === 'symbol' ? { ...draft, palette: i } : { kind: 'symbol', symbol: 'compass', palette: i })} />)}</div>
        </>)}
        {tab === 'upload' && (img ? (
          <div className="nx-crop">
            <canvas ref={big} width={360} height={360} aria-label={t('icon.dragHint')}
              onPointerDown={e => { drag.current = { x: e.clientX, y: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId); }}
              onPointerMove={e => {
                if (!drag.current || !img) return;
                const k = 360 / e.currentTarget.getBoundingClientRect().width;
                const s = (360 / Math.min(img.naturalWidth, img.naturalHeight)) * crop.zoom;
                const mx = (img.naturalWidth * s - 360) / 2, my = (img.naturalHeight * s - 360) / 2;
                const dx = (e.clientX - drag.current.x) * k, dy = (e.clientY - drag.current.y) * k;
                drag.current = { x: e.clientX, y: e.clientY };
                setCrop(c => ({ ...c, ox: mx > 0 ? Math.max(-1, Math.min(1, c.ox - dx / mx)) : 0, oy: my > 0 ? Math.max(-1, Math.min(1, c.oy - dy / my)) : 0 }));
              }}
              onPointerUp={() => { drag.current = null; }} />
            <div className="nx-col">
              <label className="nx-lbl" htmlFor="nx-zoom">{t('icon.zoom')}</label>
              <input id="nx-zoom" type="range" min={100} max={300} value={Math.round(crop.zoom * 100)} onChange={e => setCrop(c => ({ ...c, zoom: +e.target.value / 100 }))} />
              <span className="nx-hint">{t('icon.dragHint')}</span>
              <button type="button" className="nx-btn" onClick={() => file.current?.click()}>{t('icon.choose')}</button>
            </div>
          </div>
        ) : (
          <div className="nx-drop" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void take(e.dataTransfer.files?.[0]); }}>
            <button type="button" className="nx-btn nx-btn-primary" onClick={() => file.current?.click()}>{t('icon.choose')}</button>
            <span className="nx-hint">{t('icon.drop')}</span>
          </div>
        ))}
        {tab === 'upload' && <span className="nx-hint">{t('icon.rules')}</span>}
        {err && <span className="nx-err" role="alert">{err}</span>}
        <input ref={file} type="file" accept="image/*,.heic,.heif" hidden onChange={e => void take(e.target.files?.[0])} />

        <div className="nx-actions">
          <button type="button" className="nx-btn" onClick={reset} disabled={busy}>{t('icon.useDefault')}</button>
          <span style={{ flex: 1 }} />
          <button type="button" className="nx-btn" onClick={onClose}>{t('cancel')}</button>
          <button type="button" className="nx-btn nx-btn-primary" onClick={save} disabled={busy || (tab === 'upload' && !img)}>{t('save')}</button>
        </div>
      </div>
    </>
  );
}

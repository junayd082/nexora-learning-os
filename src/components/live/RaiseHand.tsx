'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Check, Hand, HelpCircle, Laptop, LifeBuoy, MessageCircle, X } from 'lucide-react';
import { bellState } from '@/lib/bell';
import { chime } from '@/lib/chime';
import { handPosition, lowerHand, raiseHand, type HandKind } from '@/lib/live';
import { soundOn } from '@/components/companion/sound';
import { lightFor } from '@/components/Living';
import { cn } from '@/lib/util';
import { useLive } from './LiveProvider';

const KINDS: { k: HandKind; icon: typeof HelpCircle }[] = [
  { k: 'question', icon: HelpCircle }, { k: 'stuck', icon: LifeBuoy }, { k: 'tech', icon: Laptop }, { k: 'other', icon: MessageCircle },
];

/** The class a student most likely means: the one in session now, the page they're on, or their first. */
function useDefaultClass(prefer?: string) {
  const live = useLive();
  const path = usePathname();
  const mine = useMemo(() => (live?.classes ?? []).filter((c) => !c.teacher), [live?.classes]);
  return useMemo(() => {
    if (prefer && mine.some((c) => c.id === prefer)) return prefer;
    const onPage = path.match(/^\/classes\/([0-9a-f-]{36})/)?.[1];
    if (onPage && mine.some((c) => c.id === onPage)) return onPage;
    const now = bellState(Date.now()).current?.period;
    return mine.find((c) => c.period === now)?.id ?? mine[0]?.id ?? '';
  }, [prefer, mine, path]);
}

/** Opens the raise-hand sheet. Used in the assistant panel and on class pages. */
export function RaiseHandButton({ classId, className, label }: { classId?: string; className?: string; label?: string }) {
  const live = useLive();
  const t = useTranslations('live');
  const up = live?.myHands.some((h) => !classId || h.class_id === classId);
  if (!live || live.isEducator && !live.classes.some((c) => !c.teacher)) return null;
  return (
    <button type="button" onClick={() => live.openHand(classId)} aria-haspopup="dialog"
      className={cn('inline-flex items-center gap-1.5', className, up && 'border-ember/60 ember-text')}>
      <Hand size={15} aria-hidden className={up ? 'nx-hand-wave' : undefined} />
      {label ?? (up ? t('handIsUp') : t('raiseHand'))}
    </button>
  );
}

/**
 * The raise-hand sheet. Pick the class (pre-selected), say what kind of help, add a note if you
 * like, and raise. The page you're on is shared with the teacher so they can see where you are.
 */
export function HandSheet() {
  const live = useLive();
  const t = useTranslations('live');
  const path = usePathname();
  const open = !!live?.handSheet.open;
  const preferred = useDefaultClass(live?.handSheet.classId);
  const [classId, setClassId] = useState('');
  const [kind, setKind] = useState<HandKind>('question');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const mine = (live?.classes ?? []).filter((c) => !c.teacher);
  const existing = live?.myHands.find((h) => h.class_id === classId);

  useEffect(() => {
    if (!open) return;
    setClassId(preferred); setErr(null); setSent(false); setBusy(false);
    const h = live?.myHands.find((x) => x.class_id === preferred);
    setKind(h?.kind ?? 'question'); setNote(h?.note ?? '');
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') live?.closeHand(); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open || !live || typeof document === 'undefined') return null;
  // What the teacher sees as "On: …": the page's heading, else the tab title without the site name.
  const heading = document.querySelector('main h1')?.textContent?.trim();
  const tabTitle = document.title.replace(/^\(\d+\)\s*/, '').replace(/\s*[·|–—-]\s*NEXORA.*$/i, '').replace(/^NEXORA\s*[·|–—-].*$/i, '').trim();
  const pageTitle = (heading || tabTitle).slice(0, 120);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!classId) return;
    setBusy(true); setErr(null);
    const { error } = await raiseHand(classId, kind, note.trim(), path, pageTitle);
    setBusy(false);
    if (error) { setErr(/too many/.test(error.message) ? t('tooMany') : t('raiseFailed')); return; }
    setSent(true);
    setTimeout(() => live?.closeHand(), 1400);
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/55 backdrop-blur-[2px] sm:items-center sm:p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) live.closeHand(); }}>
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="hand-h"
        className="nx-sheet w-full max-w-md rounded-t-2xl border border-line p-5 shadow-2xl sm:rounded-2xl"
        style={{ background: 'rgb(var(--panel))', paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ember/15 ember-text"><Hand size={22} aria-hidden className="nx-hand-wave" /></span>
          <div className="min-w-0 flex-1">
            <h2 id="hand-h" className="text-lg font-semibold">{existing ? t('handIsUp') : t('raiseTitle')}</h2>
            <p className="text-sm text-muted">{existing ? t('updateHint') : t('raiseHint')}</p>
          </div>
          <button type="button" className="btn-ghost btn-sm" onClick={live.closeHand} aria-label={t('close')}><X size={16} aria-hidden /></button>
        </div>

        {sent ? (
          <div className="mt-6 flex items-center gap-3 rounded-lg border border-ok/40 bg-ok/10 p-4 text-sm" role="status">
            <Check size={18} className="text-ok" aria-hidden />{t('raised')}
          </div>
        ) : mine.length === 0 ? (
          <p className="mt-5 text-sm text-muted">{t('noClasses')}</p>
        ) : (
          <>
            {mine.length > 1 && (
              <fieldset className="mt-5">
                <legend className="mb-2 text-xs font-medium text-muted">{t('whichClass')}</legend>
                <div className="grid gap-1.5">
                  {mine.map((c) => (
                    <label key={c.id} className={cn('flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors',
                      classId === c.id ? 'border-ember/60 bg-ember/[0.08]' : 'border-line hover:border-ember/30')}>
                      <input type="radio" name="hand-class" value={c.id} checked={classId === c.id} onChange={() => setClassId(c.id)} className="sr-only" />
                      <span className="h-6 w-1 rounded-full" style={{ background: `rgb(${lightFor(c.id)})` }} aria-hidden />
                      {c.period != null && <span className="w-7 text-xs font-bold tabular-nums text-muted">P{c.period}</span>}
                      <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
                      {live.myHands.some((h) => h.class_id === c.id) && <Hand size={14} className="ember-text" aria-label={t('handIsUp')} />}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            <fieldset className="mt-5">
              <legend className="mb-2 text-xs font-medium text-muted">{t('whatKind')}</legend>
              <div className="grid grid-cols-2 gap-1.5">
                {KINDS.map(({ k, icon: Icon }) => (
                  <label key={k} className={cn('flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors',
                    kind === k ? 'border-ember/60 bg-ember/[0.08] text-ink' : 'border-line text-muted hover:text-ink')}>
                    <input type="radio" name="hand-kind" value={k} checked={kind === k} onChange={() => { setKind(k); noteRef.current?.focus(); }} className="sr-only" />
                    <Icon size={15} aria-hidden />{t(`kind.${k}`)}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="mt-5 block">
              <span className="mb-2 block text-xs font-medium text-muted">{t('noteLabel')}</span>
              <textarea ref={noteRef} value={note} onChange={(e) => setNote(e.target.value)} maxLength={280} rows={2}
                placeholder={t('notePlaceholder')} className="textarea min-h-[64px] text-sm" />
              <span className="mt-1 flex justify-between text-2xs text-faint">
                <span className="truncate">{pageTitle ? t('sharesPage', { page: pageTitle }) : ''}</span>
                <span className="tabular-nums">{note.length}/280</span>
              </span>
            </label>

            {err && <p role="alert" className="mt-3 text-sm text-bad">{err}</p>}
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button type="submit" disabled={busy || !classId} className="btn-primary btn-lg flex-1 justify-center">
                <Hand size={17} aria-hidden />{existing ? t('updateHand') : t('raiseMyHand')}
              </button>
              {existing && (
                <button type="button" className="btn btn-lg" disabled={busy}
                  onClick={async () => { setBusy(true); await lowerHand(existing.id); setBusy(false); live.closeHand(); }}>
                  {t('lowerHand')}
                </button>
              )}
            </div>
          </>
        )}
      </form>
    </div>,
    document.body,
  );
}

/**
 * Student: a small pill while a hand is up — place in line, then "on the way" when the teacher
 * taps it, and a short "marked done" note when it's resolved. Tap to edit; × to lower.
 */
export function MyHandPill() {
  const live = useLive();
  const t = useTranslations('live');
  const hands = live?.myHands ?? [];
  const [pos, setPos] = useState<Record<string, number | null>>({});
  const [doneNote, setDoneNote] = useState(false);
  const prev = useRef<Map<string, string>>(new Map());
  const lowering = useRef<Set<string>>(new Set());

  useEffect(() => {
    const now = new Map(hands.map((h) => [h.id, h.status]));
    for (const [id, st] of prev.current) {
      if (!now.has(id) && !lowering.current.has(id)) { setDoneNote(true); setTimeout(() => setDoneNote(false), 7000); }
      if (now.get(id) === 'seen' && st === 'raised' && soundOn()) chime('seen');
    }
    prev.current = now;
    hands.forEach((h) => { if (h.status === 'raised') void handPosition(h.id).then((p) => setPos((o) => ({ ...o, [h.id]: p }))); });
  }, [hands]);

  if (!live || (hands.length === 0 && !doneNote)) return null;
  const ordinal = (n: number) => t('inLine', { n });
  return (
    <div className="fixed bottom-4 left-4 z-[45] flex max-w-[calc(100vw-2rem)] flex-col gap-2 sm:max-w-sm" style={{ marginBottom: 'env(safe-area-inset-bottom)' }} aria-live="polite">
      {doneNote && hands.length === 0 && (
        <div className="flex items-center gap-2 rounded-full border border-ok/40 bg-[rgb(var(--panel))] px-4 py-2 text-sm shadow-xl"><Check size={15} className="text-ok" aria-hidden />{t('markedDone')}</div>
      )}
      {hands.map((h) => {
        const seen = h.status === 'seen';
        return (
          <div key={h.id} className={cn('flex items-center gap-2 rounded-full border bg-[rgb(var(--panel))] py-1.5 pl-2 pr-1.5 shadow-xl', seen ? 'border-ok/50' : 'border-ember/50')}>
            <button type="button" onClick={() => live.openHand(h.class_id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
              <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', seen ? 'bg-ok/15 text-ok' : 'bg-ember/15 ember-text')}>
                {seen ? <Check size={16} aria-hidden /> : <Hand size={16} aria-hidden className="nx-hand-wave" />}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{seen ? t('onTheWay') : t('handIsUp')}</span>
                <span className="block truncate text-2xs text-muted">
                  {h.class?.section ?? h.class?.name}{!seen && pos[h.id] ? ` · ${ordinal(pos[h.id]!)}` : ''}
                </span>
              </span>
            </button>
            <button type="button" className="btn-ghost btn-sm h-8 w-8 justify-center rounded-full p-0" aria-label={t('lowerHand')} title={t('lowerHand')}
              onClick={() => { lowering.current.add(h.id); void lowerHand(h.id); }}>
              <X size={15} aria-hidden />
            </button>
          </div>
        );
      })}
    </div>
  );
}

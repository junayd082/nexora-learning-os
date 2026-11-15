'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CalendarDays, Timer } from 'lucide-react';
import { cn } from '@/lib/util';

export const TAGS = ['do_now', 'lecture', 'activity', 'homework', 'exit_ticket', 'resource'] as const;
export type Tag = (typeof TAGS)[number];

/** Local calendar date as YYYY-MM-DD (the browser's day, which is the classroom's day). */
export function localDay(offsetDays = 0) {
  const d = new Date(); d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** ISO timestamp → value for <input type="datetime-local"> in the browser's time zone. */
export function toLocalInput(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * "When is this used?" — lesson day, what it is (Do Now, Lecture…), and an optional due date.
 * Nova reads these to answer "what are we doing today?".
 * Field names: lesson_date, tag, due_at, tz_offset.
 */
export function ScheduleFields({ defaultDay = 'today', defaultTag = '', defaultDue = '', showDue = true, compact = false, idPrefix = 's', defaultTimer = null, defaultTimerMode = null }:
  { defaultDay?: 'today' | 'none' | string; defaultTag?: string; defaultDue?: string | null; showDue?: boolean; compact?: boolean; idPrefix?: string;
    defaultTimer?: number | null; defaultTimerMode?: string | null }) {
  const t = useTranslations('nova');
  const [tag, setTag] = useState(defaultTag);
  const [day, setDay] = useState(defaultDay === 'none' ? '' : defaultDay === 'today' ? '' : defaultDay);
  const [tz, setTz] = useState('0');
  const [due, setDue] = useState('');
  useEffect(() => {
    setTz(String(new Date().getTimezoneOffset()));
    if (defaultDay === 'today') setDay(localDay());
    setDue(toLocalInput(defaultDue));
  }, [defaultDay, defaultDue]);
  const today = typeof window === 'undefined' ? '' : localDay();
  const tomorrow = typeof window === 'undefined' ? '' : localDay(1);
  return (
    <fieldset className={cn('rounded-lg border border-line bg-sunk/40 p-3', compact && 'p-0 border-0 bg-transparent')}>
      {!compact && <legend className="flex items-center gap-1.5 px-1 text-xs font-medium text-muted"><CalendarDays size={13} aria-hidden />{t('whenLegend')}</legend>}
      <input type="hidden" name="tz_offset" value={tz} />
      <div className={cn('grid gap-3', showDue ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
        <div>
          <label className="label" htmlFor={`${idPrefix}-tag`}>{t('tagLabel')}</label>
          <select id={`${idPrefix}-tag`} name="tag" className="input" value={tag} onChange={(e) => setTag(e.target.value)}>
            <option value="">{t('tagNone')}</option>
            {TAGS.map((k) => <option key={k} value={k}>{t(`tags.${k}`)}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor={`${idPrefix}-day`}>{t('dayLabel')}</label>
          <input id={`${idPrefix}-day`} name="lesson_date" type="date" value={day} onChange={(e) => setDay(e.target.value)} className="input" />
          <div className="mt-1 flex gap-1.5 text-2xs">
            <button type="button" className={cn('chip', day === today && 'border-ember/60 ember-text')} onClick={() => setDay(today)}>{t('today')}</button>
            <button type="button" className={cn('chip', day === tomorrow && 'border-ember/60 ember-text')} onClick={() => setDay(tomorrow)}>{t('tomorrow')}</button>
            <button type="button" className={cn('chip', !day && 'border-ember/60 ember-text')} onClick={() => setDay('')}>{t('noDay')}</button>
          </div>
        </div>
        {showDue && (
          <div>
            <label className="label" htmlFor={`${idPrefix}-due`}>{t('dueLabel')}</label>
            <input id={`${idPrefix}-due`} name="due_at" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className="input" />
          </div>
        )}
      </div>
      <input type="hidden" name="timer_present" value="1" />
      {(tag === 'do_now' || tag === 'exit_ticket') && (
        <TimerSetting idPrefix={idPrefix} tag={tag} defaultMinutes={defaultTimer} defaultMode={defaultTimerMode} />
      )}
    </fieldset>
  );
}

/**
 * Optional timer for a Do Now or Exit ticket — the teacher's choice:
 * no timer, "I'll start it" (from the timer button), or "Start with the bell"
 * (Do Now: first N minutes of the period · Exit ticket: last N minutes).
 */
export function TimerSetting({ idPrefix, tag, defaultMinutes, defaultMode, standalone = false }: { idPrefix: string; tag: string; defaultMinutes: number | null; defaultMode: string | null; standalone?: boolean }) {
  const t = useTranslations('live');
  const [mode, setMode] = useState<'' | 'manual' | 'bell'>(defaultMode === 'manual' || defaultMode === 'bell' ? defaultMode : '');
  const [mins, setMins] = useState(defaultMinutes ?? (tag === 'do_now' ? 5 : 3));
  const opts: { v: '' | 'manual' | 'bell'; label: string }[] = [{ v: '', label: t('timerOff') }, { v: 'manual', label: t('timerManual') }, { v: 'bell', label: t('timerBell') }];
  return (
    <div className="mt-3 rounded-md border border-line p-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted"><Timer size={13} aria-hidden />{t('timerSetting')}</div>
      <input type="hidden" name="timer_mode" value={mode} />
      {standalone && <input type="hidden" name="timer_present" value="1" />}
      <div className="flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label={t('timerSetting')} className="flex flex-wrap gap-1">
          {opts.map((o) => (
            <button key={o.v || 'off'} type="button" role="radio" aria-checked={mode === o.v} onClick={() => setMode(o.v)}
              className={cn('chip h-7 px-2.5 text-xs', mode === o.v && 'border-ember/60 ember-text')}>{o.label}</button>
          ))}
        </div>
        {mode && (
          <label className="flex items-center gap-1.5 text-xs text-muted">
            <select id={`${idPrefix}-timer`} name="timer_minutes" value={mins} onChange={(e) => setMins(Number(e.target.value))} className="input h-8 w-[78px] py-0 text-sm">
              {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20, 25, 30].map((n) => <option key={n} value={n}>{t('timerChip', { n })}</option>)}
            </select>
          </label>
        )}
      </div>
      {mode && (
        <p className="mt-2 text-2xs text-faint">
          {mode === 'bell' ? (tag === 'do_now' ? t('timerBellDoNow', { n: mins }) : t('timerBellExit', { n: mins })) : t('timerManualHint')}
        </p>
      )}
    </div>
  );
}

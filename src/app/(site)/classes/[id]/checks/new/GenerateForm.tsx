'use client';
import { TimerSetting } from '@/components/ScheduleFields';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';
import { BookOpen, ClipboardPaste, Cpu, FilePlus2, FolderOpen, Library, Loader2, Minus, Plus, Sparkles, Upload } from 'lucide-react';
import { generateCheck } from '@/lib/checks';
import { QTYPES, type QType } from '@/lib/engine/types';
import { FormMessage } from '@/components/forms';
import { Uploader, type Uploaded } from '@/components/files/Uploader';
import { localDay } from '@/components/ScheduleFields';
import { QTypeIcon } from '@/components/checks/icons';
import { cn } from '@/lib/util';

type Src = 'material' | 'upload' | 'paste' | 'experience' | 'blank';
const DEFAULTS: Record<string, Partial<Record<QType, number>>> = {
  do_now: { multiple_choice: 2, true_false: 1, short_answer: 1 },
  exit_ticket: { multiple_choice: 2, fill_blank: 1, short_answer: 1 },
  quiz: { multiple_choice: 4, true_false: 2, fill_blank: 2, matching: 1, short_answer: 1 },
};
const PRESETS: Record<'quick' | 'standard' | 'mixed', Partial<Record<QType, number>>> = {
  quick: { multiple_choice: 2, short_answer: 1 },
  standard: { multiple_choice: 2, true_false: 1, fill_blank: 1, short_answer: 1 },
  mixed: { multiple_choice: 3, true_false: 1, fill_blank: 1, matching: 1, ordering: 1, short_answer: 1 },
};

function Go({ blank }: { blank: boolean }) {
  const t = useTranslations('checks');
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="submit" className="btn-primary" disabled={pending} aria-busy={pending}>
        {pending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : blank ? <FilePlus2 size={16} aria-hidden /> : <Sparkles size={16} aria-hidden />}
        {blank ? t('createBlank') : t('generate')}
      </button>
      {pending && !blank && <span className="text-sm text-muted" role="status">{t('generating')}</span>}
    </div>
  );
}

export function GenerateForm({ classId, userId, kind: kind0, materials, experiences, source, ai, focus = '', demo = false }: {
  classId: string; userId: string; kind: string; ai: boolean; source: string | null; focus?: string; demo?: boolean;
  materials: { id: string; label: string; kind: string }[]; experiences: { id: string; label: string }[];
}) {
  const t = useTranslations('checks');
  const [state, action] = useActionState(generateCheck, null);
  const [kind, setKind] = useState(kind0);
  const [src, setSrc] = useState<Src>(source || materials.length ? 'material' : demo ? 'paste' : 'upload');
  const fromSummary = !!focus;
  const [counts, setCounts] = useState<Partial<Record<QType, number>>>(DEFAULTS[kind0] ?? DEFAULTS.do_now);
  const [file, setFile] = useState<Uploaded | null>(null);
  const [tz, setTz] = useState('0');
  const [today, setToday] = useState('');
  useEffect(() => { setTz(String(new Date().getTimezoneOffset())); setToday(localDay()); }, []);
  const total = useMemo(() => Object.values(counts).reduce((s, n) => s + (n ?? 0), 0), [counts]);
  const set = (k: QType, n: number) => setCounts((c) => ({ ...c, [k]: Math.max(0, Math.min(15, n)) }));

  const srcTabs: { k: Src; icon: typeof Upload }[] = [
    { k: 'material', icon: FolderOpen }, { k: 'upload', icon: Upload }, { k: 'paste', icon: ClipboardPaste },
    { k: 'experience', icon: Library }, { k: 'blank', icon: FilePlus2 },
  ];
  const step = (n: number, title: string) => (
    <h2 className="mb-3 flex items-center gap-2.5 font-semibold"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-ember/15 font-mono text-xs ember-text">{n}</span>{title}</h2>
  );

  return (
    <form action={action} className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <input type="hidden" name="class_id" value={classId} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="source" value={src} />
      <input type="hidden" name="tz_offset" value={tz} />
      {src !== 'blank' && QTYPES.map((q) => <input key={q} type="hidden" name={`n_${q}`} value={counts[q] ?? 0} />)}

      <div className="space-y-6">
        <section className="card p-5">
          {step(1, t('step1'))}
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup">
            {(['do_now', 'exit_ticket', 'quiz'] as const).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => { setKind(k); setCounts(DEFAULTS[k]); }}
                className={cn('rounded-lg border px-4 py-3 text-left transition', kind === k ? 'border-ember/60 bg-ember/10' : 'border-line hover:border-ember/30')}>
                <div className="font-semibold">{t(`kinds.${k}`)}</div>
                <div className="mt-0.5 text-xs text-muted">{t(`kindHelp.${k}`)}</div>
              </button>
            ))}
          </div>
        </section>

        <section className="card p-5">
          {step(2, t('step2'))}
          <div className="mb-4 flex flex-wrap gap-1.5" role="tablist">
            {srcTabs.map(({ k, icon: Icon }) => (
              <button key={k} type="button" role="tab" aria-selected={src === k} onClick={() => setSrc(k)}
                className={cn('chip px-3 py-1.5 text-xs', src === k ? 'border-ember/60 bg-ember/10 text-ink' : 'hover:text-ink')}>
                <Icon size={13} aria-hidden />{t(`src.${k}`)}
              </button>
            ))}
          </div>
          {src === 'material' && (materials.length ? (
            <div><label className="label" htmlFor="g-mat">{t('pickMaterial')}</label>
              <select id="g-mat" name="material_id" className="input" defaultValue={source ?? materials[0]?.id} required>
                {materials.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select></div>
          ) : <p className="text-sm text-muted">{t('noMaterials')}</p>)}
          {src === 'upload' && demo && <p className="rounded-lg border border-warn/40 bg-warn/10 px-3 py-2.5 text-sm">{t('demoUpload')}</p>}
          {src === 'upload' && !demo && (
            <>
              <Uploader bucket="experience-files" folder={`${userId}/checks`} onChange={(fs) => setFile(fs[0] ?? null)} />
              <input type="hidden" name="file_path" value={file?.path ?? ''} />
              <input type="hidden" name="file_name" value={file?.name ?? ''} />
              <input type="hidden" name="file_mime" value={file?.mime ?? ''} />
            </>
          )}
          {src === 'paste' && (
            <div><label className="label" htmlFor="g-text">{t('pasteHint')}</label>
              <textarea id="g-text" name="text" required maxLength={60000} className="textarea min-h-[180px]" /></div>
          )}
          {src === 'experience' && (
            <div><label className="label" htmlFor="g-exp">{t('pickExperience')}</label>
              <select id="g-exp" name="experience_id" className="input" required defaultValue="">
                <option value="" disabled>—</option>
                {experiences.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
              </select></div>
          )}
          {src === 'blank' && <p className="text-sm text-muted">{t('blankHint')}</p>}
        </section>

        {src !== 'blank' && (
          <section className="card p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              {step(3, t('step3'))}
              <div className="flex gap-1.5">
                {(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map((p) => (
                  <button key={p} type="button" className="chip text-2xs hover:text-ink" onClick={() => setCounts(PRESETS[p])}>{t(`presets.${p}`)}</button>
                ))}
              </div>
            </div>
            <ul className="divide-y divide-line">
              {QTYPES.map((q) => (
                <li key={q} className="flex items-center gap-3 py-2.5">
                  <QTypeIcon type={q} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{t(`types.${q}`)}</div>
                    <div className="text-xs text-muted">{t(`typeHelp.${q}`)}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" className="btn-ghost btn-sm h-8 w-8 justify-center p-0" aria-label={`− ${t(`types.${q}`)}`} onClick={() => set(q, (counts[q] ?? 0) - 1)}><Minus size={14} aria-hidden /></button>
                    <input aria-label={t(`types.${q}`)} inputMode="numeric" value={counts[q] ?? 0} onChange={(e) => set(q, parseInt(e.target.value, 10) || 0)}
                      className={cn('input h-8 w-12 px-0 text-center font-mono', (counts[q] ?? 0) > 0 && 'border-ember/50 ember-text')} />
                    <button type="button" className="btn-ghost btn-sm h-8 w-8 justify-center p-0" aria-label={`+ ${t(`types.${q}`)}`} onClick={() => set(q, (counts[q] ?? 0) + 1)}><Plus size={14} aria-hidden /></button>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-right font-mono text-xs text-muted">{t('total', { count: total })}</p>
          </section>
        )}
      </div>

      <aside className="space-y-6">
        {src !== 'blank' && (
          <section className="card space-y-3 p-5">
            {step(4, t('step4'))}
            <div><label className="label" htmlFor="g-lang">{t('language')}</label>
              <select id="g-lang" name="language" className="input" defaultValue="en">
                {(['en', 'es', 'both'] as const).map((l) => <option key={l} value={l} disabled={!ai && l !== 'en'}>{t(`langs.${l}`)}</option>)}
              </select>
              {!ai && <p className="mt-1 text-2xs text-faint">{t('langAiOnly')}</p>}</div>
            <div><label className="label" htmlFor="g-lvl">{t('level')}</label>
              <select id="g-lvl" name="level" className="input" defaultValue="on grade level for high school (grades 9–12)">
                <option value="supported: simple words and short sentences for English learners and students who need support">{t('levels.support')}</option>
                <option value="on grade level for high school (grades 9–12)">{t('levels.grade')}</option>
                <option value="advanced: deeper reasoning, application and analysis">{t('levels.advanced')}</option>
              </select></div>
            <div><label className="label" htmlFor="g-focus">{t('focus')}</label>
              <input id="g-focus" name="focus" maxLength={300} placeholder={t('focusPh')} defaultValue={focus} className="input" />
              {fromSummary && <p className="mt-1 text-2xs violet-text">{t('focusFromSummary')}</p>}</div>
            <div><label className="label" htmlFor="g-pages">{t('pages')}</label>
              <input id="g-pages" name="pages" maxLength={60} placeholder={t('pagesPh')} inputMode="numeric" className="input" />
              <p className="mt-1 text-2xs text-faint">{t('pagesHint')}</p></div>
          </section>
        )}
        <section className="card space-y-3 p-5">
          {step(src === 'blank' ? 3 : 5, t('step5'))}
          <div><label className="label" htmlFor="g-title">{t('titleLabel')}</label><input id="g-title" name="title" maxLength={200} className="input" /></div>
          <div><label className="label" htmlFor="g-day">{t('lessonDay')}</label><input id="g-day" name="lesson_date" type="date" defaultValue={today} key={today} className="input" /></div>
          <div><label className="label" htmlFor="g-due">{t('due')}</label><input id="g-due" name="due_at" type="datetime-local" className="input" /></div>
          {kind !== 'quiz' && <TimerSetting key={kind} idPrefix="g" tag={kind} defaultMinutes={null} defaultMode={null} standalone />}
        </section>
        {src !== 'blank' && (
          <p className={cn('flex gap-2 rounded-lg border px-3 py-2.5 text-xs', ai ? 'border-violet/40 bg-violet/10' : 'border-line text-muted')}>
            {ai ? <Sparkles size={15} className="mt-0.5 shrink-0 violet-text" aria-hidden /> : <Cpu size={15} className="mt-0.5 shrink-0" aria-hidden />}
            {ai ? t('engineAi') : t('engineBuiltin')}
          </p>
        )}
        <Go blank={src === 'blank'} />
        <FormMessage state={state} />
        <p className="flex items-center gap-1.5 text-2xs text-faint"><BookOpen size={12} aria-hidden />{t('kindHelp.' + kind as 'kindHelp.do_now')}</p>
      </aside>
    </form>
  );
}

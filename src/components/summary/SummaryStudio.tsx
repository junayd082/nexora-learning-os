'use client';

import Link from 'next/link';
import { useActionState, useEffect, useMemo, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';
import {
  BadgeCheck, BookOpenText, Check, ClipboardPaste, Cpu, Eye, FolderOpen, Library, Loader2, LogIn, LogOut, Megaphone,
  NotebookPen, PencilLine, RefreshCw, Send, Sparkles, Upload, UserRound, Users,
} from 'lucide-react';
import { draftSummary, publishSummary, type SummaryDraft } from '@/lib/summary';
import { Markdown } from '@/components/files/markdown';
import { Uploader, type Uploaded } from '@/components/files/Uploader';
import { FormMessage } from '@/components/forms';
import { localDay } from '@/components/ScheduleFields';
import { cn } from '@/lib/util';

type Src = 'material' | 'upload' | 'paste' | 'experience';
export interface SummaryMaterial { id: string; label: string; kind: string; lessonDate: string | null; tag: string | null }

function Go() {
  const t = useTranslations('summary');
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="submit" className="btn-primary" disabled={pending} aria-busy={pending}>
        {pending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Sparkles size={16} aria-hidden />}{t('generate')}
      </button>
      {pending && <span className="text-sm text-muted" role="status">{t('working')}</span>}
    </div>
  );
}

/**
 * Teacher → Session summary. Pick what you taught today (a class material, a PDF, pasted notes or a
 * library lesson), NEXORA reads it with the same teaching-core engine as Do Now / Exit tickets and
 * folds in today's check results. Review and edit the student summary and private teacher notes,
 * publish it to the class for that day, then build tomorrow's Do Now / the next Exit ticket from it.
 */
export function SummaryStudio({ classId, userId, className, materials, experiences, source, ai, demo = false }: {
  classId: string; userId: string; className: string; ai: boolean; source: string | null; demo?: boolean;
  materials: SummaryMaterial[]; experiences: { id: string; label: string }[];
}) {
  const t = useTranslations('summary');
  const [state, action] = useActionState(draftSummary, null);
  const [src, setSrc] = useState<Src>(source || materials.length ? 'material' : demo ? 'paste' : 'upload');
  const [file, setFile] = useState<Uploaded | null>(null);
  const [today, setToday] = useState('');
  const [date, setDate] = useState('');
  useEffect(() => { const d = localDay(); setToday(d); setDate(d); }, []);

  // Default to what was scheduled for the chosen day (lecture first), else the newest material.
  const ordered = useMemo(() => {
    const rank = (m: SummaryMaterial) => (m.id === source ? 0 : m.lessonDate === date ? (m.tag === 'lecture' ? 1 : 2) : 3);
    return [...materials].sort((a, b) => rank(a) - rank(b));
  }, [materials, date, source]);
  const draft = state?.ok ? state.data : undefined;

  const step = (n: number, title: string) => (
    <h2 className="mb-3 flex items-center gap-2.5 font-semibold"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-ember/15 font-mono text-xs ember-text">{n}</span>{title}</h2>
  );
  const srcTabs: { k: Src; icon: typeof Upload }[] = [
    { k: 'material', icon: FolderOpen }, { k: 'upload', icon: Upload }, { k: 'paste', icon: ClipboardPaste }, { k: 'experience', icon: Library },
  ];

  return (
    <div className="mt-8 space-y-8">
      <form action={action} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <input type="hidden" name="class_id" value={classId} />
        <input type="hidden" name="source" value={src} />
        <div className="min-w-0 space-y-6">
          <section className="card p-5">
            {step(1, t('step1'))}
            <div className="mb-4 flex flex-wrap gap-1.5" role="tablist">
              {srcTabs.map(({ k, icon: Icon }) => (
                <button key={k} type="button" role="tab" aria-selected={src === k} onClick={() => setSrc(k)}
                  className={cn('chip px-3 py-1.5 text-xs', src === k ? 'border-ember/60 bg-ember/10 text-ink' : 'hover:text-ink')}>
                  <Icon size={13} aria-hidden />{t(`src.${k}`)}
                </button>
              ))}
            </div>
            {src === 'material' && (materials.length ? (
              <div><label className="label" htmlFor="s-mat">{t('pickMaterial')}</label>
                <select id="s-mat" name="material_id" className="input" key={ordered[0]?.id} defaultValue={ordered[0]?.id} required>
                  {ordered.map((m) => <option key={m.id} value={m.id}>{m.lessonDate === date ? '● ' : ''}{m.label}</option>)}
                </select>
                <p className="mt-1 text-2xs text-faint">{t('pickHint')}</p></div>
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
              <div><label className="label" htmlFor="s-text">{t('pasteHint')}</label>
                <textarea id="s-text" name="text" required maxLength={60000} className="textarea min-h-[180px]" /></div>
            )}
            {src === 'experience' && (
              <div><label className="label" htmlFor="s-exp">{t('pickExperience')}</label>
                <select id="s-exp" name="experience_id" className="input" required defaultValue="">
                  <option value="" disabled>—</option>
                  {experiences.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
                </select></div>
            )}
          </section>

          <section className="card p-5">
            {step(2, t('step2'))}
            <label className="flex items-start gap-3 rounded-lg border border-line p-3">
              <input type="checkbox" name="use_results" defaultChecked className="mt-1 accent-[rgb(var(--nx-ember))]" />
              <span><span className="block text-sm font-medium">{t('useResults')}</span><span className="block text-xs text-muted">{t('useResultsHint')}</span></span>
            </label>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div><label className="label" htmlFor="s-focus">{t('focus')}</label>
                <input id="s-focus" name="focus" maxLength={400} placeholder={t('focusPh')} className="input" /></div>
              <div><label className="label" htmlFor="s-pages">{t('pages')}</label>
                <input id="s-pages" name="pages" maxLength={60} placeholder="3–6" inputMode="numeric" className="input" /></div>
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card space-y-3 p-5">
            {step(3, t('step3'))}
            <div><label className="label" htmlFor="s-day">{t('day')}</label>
              <input id="s-day" name="lesson_date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
              {date && today && date !== today && <p className="mt-1 text-2xs text-faint">{t('notToday')}</p>}</div>
            <div><label className="label" htmlFor="s-lang">{t('language')}</label>
              <select id="s-lang" name="language" className="input" defaultValue="en">
                <option value="en">English</option><option value="es">Español</option>
              </select></div>
            <div><label className="label" htmlFor="s-lvl">{t('level')}</label>
              <select id="s-lvl" name="level" className="input" defaultValue="on grade level for high school (grades 9–12)">
                <option value="supported: simple words and short sentences for English learners and students who need support">{t('levels.support')}</option>
                <option value="on grade level for high school (grades 9–12)">{t('levels.grade')}</option>
                <option value="advanced: deeper reasoning, application and analysis">{t('levels.advanced')}</option>
              </select></div>
          </section>
          <p className={cn('flex gap-2 rounded-lg border px-3 py-2.5 text-xs', ai ? 'border-violet/40 bg-violet/10' : 'border-line text-muted')}>
            {ai ? <Sparkles size={15} className="mt-0.5 shrink-0 violet-text" aria-hidden /> : <Cpu size={15} className="mt-0.5 shrink-0" aria-hidden />}
            {ai ? t('engineAi') : t('engineBuiltin')}
          </p>
          <Go />
          {state?.error && <FormMessage state={state} />}
        </aside>
      </form>

      {draft && <SummaryReview key={draft.date + draft.summary.topic + draft.student.length} classId={classId} className={className} draft={draft} />}
    </div>
  );
}

// ---------------------------------------------------------------------------- review + publish
export function SummaryReview({ classId, className, draft }: { classId: string; className: string; draft: SummaryDraft }) {
  const t = useTranslations('summary');
  const s = draft.summary;
  const [tab, setTab] = useState<'student' | 'teacher'>('student');
  const [mode, setMode] = useState<'preview' | 'edit'>('preview');
  const [title, setTitle] = useState(t('defaultTitleTopic', { topic: s.topic, date: draft.date }).slice(0, 200));
  const [student, setStudent] = useState(draft.student);
  const [teacher, setTeacher] = useState(draft.teacher);
  const [publish, setPublish] = useState(true);
  const [announce, setAnnounce] = useState(true);
  const [saveTeacher, setSaveTeacher] = useState(true);
  const [saved, setSaved] = useState<{ materialId: string; notesId: string | null } | null>(null);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const verified = s.concepts.filter((c) => c.verified && c.evidence).length;

  useEffect(() => { document.getElementById('summary-review')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, []);

  const save = () => start(async () => {
    setError('');
    const r = await publishSummary({ classId, date: draft.date, title, body: student, teacherBody: teacher, publish, announce, saveTeacher });
    if (r.ok) setSaved({ materialId: r.materialId, notesId: r.notesId }); else setError(r.error);
  });

  const nextHref = (kind: 'do_now' | 'exit_ticket', sourceId: string | null, focus: string) => {
    const q = new URLSearchParams({ kind });
    if (sourceId) q.set('source', sourceId);
    if (focus) q.set('focus', focus);
    return `/classes/${classId}/checks/new?${q}`;
  };

  return (
    <section id="summary-review" aria-labelledby="sr-h" className="scroll-mt-24 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted">{t('reviewKicker', { date: draft.date })}</p>
          <h2 id="sr-h" className="display mt-1 text-2xl">{s.topic}</h2>
          <p className="mt-1 text-sm text-muted">{t('fromSource', { title: draft.sourceTitle })}</p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-2xs">
          <span className={cn('chip', s.engine === 'ai' ? 'border-violet/40 violet-text' : '')}>{s.engine === 'ai' ? <Sparkles size={12} aria-hidden /> : <Cpu size={12} aria-hidden />}{s.engine === 'ai' ? t('madeAi') : t('madeBuiltin')}</span>
          {s.engine === 'ai' && s.concepts.length > 0 && <span className="chip text-ok"><BadgeCheck size={12} aria-hidden />{t('verified', { n: verified, total: s.concepts.length })}</span>}
        </div>
      </div>
      {draft.notes.includes('ai_failed') && <p className="rounded-lg border border-line px-3 py-2 text-xs text-muted">{t('aiFellBack')}</p>}

      {/* Today's checks → what the summary and tomorrow's checks build on */}
      <div className="card p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Users size={15} aria-hidden />{t('resultsTitle')}</h3>
        {draft.results.length === 0 ? <p className="text-sm text-muted">{t('noResults')}</p> : (
          <div className="grid gap-3 md:grid-cols-2">
            {draft.results.map((r, i) => (
              <div key={i} className="rounded-lg border border-line p-3">
                <div className="flex items-center gap-2 text-2xs font-semibold uppercase tracking-[0.08em] text-muted">
                  {r.kind === 'do_now' ? <LogIn size={12} aria-hidden /> : <LogOut size={12} aria-hidden />}{t(`kind.${r.kind}`)}
                </div>
                <div className="mt-0.5 truncate text-sm font-semibold">{r.title}</div>
                <div className="mt-1 text-xs text-muted">{t('answered', { n: r.answered, total: r.roster })}{r.avg != null && <> · <span className="text-ink">{t('avg', { pct: r.avg })}</span></>}</div>
                <ul className="mt-3 space-y-1.5">
                  {r.questions.map((q, j) => (
                    <li key={j} className="text-xs">
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono text-faint">Q{j + 1}</span>
                        <span className="min-w-0 flex-1 truncate text-muted" title={q.prompt}>{q.prompt}</span>
                        <span className={cn('tabular-nums', q.pct != null && q.pct < 70 ? 'font-semibold text-ink' : 'text-muted')}>{q.pct == null ? t('manual') : `${q.pct}%`}</span>
                      </div>
                      <span className="relative mt-1 block h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                        {q.pct != null && <span className={cn('absolute inset-y-0 left-0 rounded-full', q.pct < 50 ? 'bg-bad' : q.pct < 70 ? 'bg-ember' : 'bg-ok')} style={{ width: `${Math.max(3, q.pct)}%` }} />}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="card min-w-0 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
            <div role="tablist" className="flex gap-1">
              {(['student', 'teacher'] as const).map((k) => (
                <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                  className={cn('chip px-3 py-1.5 text-xs', tab === k ? 'border-ember/60 bg-ember/10 text-ink' : 'hover:text-ink')}>
                  {k === 'student' ? <UserRound size={13} aria-hidden /> : <NotebookPen size={13} aria-hidden />}{t(k === 'student' ? 'tabStudent' : 'tabTeacher')}
                </button>
              ))}
            </div>
            <button type="button" className="btn-ghost btn-sm" onClick={() => setMode((m) => (m === 'edit' ? 'preview' : 'edit'))}>
              {mode === 'edit' ? <><Eye size={14} aria-hidden />{t('preview')}</> : <><PencilLine size={14} aria-hidden />{t('edit')}</>}
            </button>
          </div>
          {tab === 'teacher' && <p className="border-b border-line bg-white/[0.02] px-4 py-2 text-2xs text-muted">{t('teacherPrivate')}</p>}
          <div className="p-5">
            {mode === 'edit' ? (
              <textarea aria-label={t(tab === 'student' ? 'tabStudent' : 'tabTeacher')} className="textarea min-h-[480px] font-mono text-xs leading-relaxed"
                value={tab === 'student' ? student : teacher} maxLength={20000}
                onChange={(e) => (tab === 'student' ? setStudent : setTeacher)(e.target.value)} />
            ) : (
              <Markdown text={tab === 'student' ? student : teacher} className="max-w-3xl text-[15px]" />
            )}
          </div>
        </div>

        <aside className="space-y-4">
          {!saved ? (
            <section className="card space-y-3 p-5">
              <h3 className="font-semibold">{t('publishTitle')}</h3>
              <div><label className="label" htmlFor="sr-title">{t('titleLabel')}</label>
                <input id="sr-title" className="input" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} /></div>
              {[
                { v: publish, set: setPublish, label: t('optPublish'), hint: t('optPublishHint'), icon: BookOpenText },
                { v: announce && publish, set: setAnnounce, label: t('optAnnounce'), hint: t('optAnnounceHint'), icon: Megaphone, disabled: !publish },
                { v: saveTeacher, set: setSaveTeacher, label: t('optNotes'), hint: t('optNotesHint'), icon: NotebookPen },
              ].map((o) => (
                <label key={o.label} className={cn('flex items-start gap-3 rounded-lg border border-line p-3', o.disabled && 'opacity-50')}>
                  <input type="checkbox" checked={o.v} disabled={o.disabled} onChange={(e) => o.set(e.target.checked)} className="mt-1 accent-[rgb(var(--nx-ember))]" />
                  <span className="min-w-0"><span className="flex items-center gap-1.5 text-sm font-medium"><o.icon size={13} aria-hidden />{o.label}</span><span className="block text-2xs text-muted">{o.hint}</span></span>
                </label>
              ))}
              <button type="button" className="btn-primary w-full justify-center" disabled={pending} onClick={save}>
                {pending ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Send size={15} aria-hidden />}{publish ? t('saveAndPublish') : t('saveDraft')}
              </button>
              {error && <p role="alert" className="text-xs text-bad">{error}</p>}
              <p className="flex items-center gap-1.5 text-2xs text-faint"><RefreshCw size={11} aria-hidden />{t('regenHint')}</p>
            </section>
          ) : (
            <section className="card space-y-3 border-ok/40 p-5" role="status">
              <h3 className="flex items-center gap-2 font-semibold text-ok"><Check size={16} aria-hidden />{publish ? t('published') : t('savedDraft')}</h3>
              <p className="text-xs text-muted">{publish ? t('publishedHint', { className }) : t('savedDraftHint')}</p>
              <div className="flex flex-wrap gap-2">
                <Link href={`/classes/${classId}/m/${saved.materialId}`} className="btn btn-sm"><Eye size={13} aria-hidden />{t('viewPage')}</Link>
                {saved.notesId && <Link href={`/classes/${classId}/m/${saved.notesId}`} className="btn btn-sm"><NotebookPen size={13} aria-hidden />{t('viewNotes')}</Link>}
              </div>
            </section>
          )}

          {/* Collaborate with the Do Now / Exit ticket engine */}
          <section className="card space-y-3 p-5">
            <h3 className="flex items-center gap-2 font-semibold"><Sparkles size={15} className="violet-text" aria-hidden />{t('nextTitle')}</h3>
            <p className="text-xs text-muted">{t('nextHint')}</p>
            <Link href={nextHref('do_now', saved?.materialId ?? draft.materialId, draft.doNowFocus)} className={cn('block rounded-lg border p-3 transition hover:border-ember/50', !saved && 'pointer-events-none opacity-50')} aria-disabled={!saved}>
              <span className="flex items-center gap-2 text-sm font-semibold"><LogIn size={14} aria-hidden />{t('nextDoNow')}</span>
              <span className="mt-1 line-clamp-3 block text-2xs text-muted">{draft.doNowFocus || t('nextDoNowHint')}</span>
            </Link>
            <Link href={nextHref('exit_ticket', draft.materialId ?? saved?.materialId ?? null, draft.exitFocus)} className={cn('block rounded-lg border p-3 transition hover:border-ember/50', !saved && 'pointer-events-none opacity-50')} aria-disabled={!saved}>
              <span className="flex items-center gap-2 text-sm font-semibold"><LogOut size={14} aria-hidden />{t('nextExit')}</span>
              <span className="mt-1 line-clamp-3 block text-2xs text-muted">{draft.exitFocus || t('nextExitHint')}</span>
            </Link>
            {!saved && <p className="text-2xs text-faint">{t('nextAfterSave')}</p>}
          </section>
        </aside>
      </div>
    </section>
  );
}

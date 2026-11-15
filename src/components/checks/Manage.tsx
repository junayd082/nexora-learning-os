'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { Download, Eye, Lock, LockOpen, Radio, RotateCcw, Send, Trash2, Undo2 } from 'lucide-react';
import { browserClient } from '@/lib/supabase/browser';
import { deleteCheck, gradeAttempt, releaseResults, resetAttempt, saveSettings, setCheckStatus } from '@/lib/checks';
import { BLANK, type Opt } from '@/lib/engine/types';
import { FormMessage, SubmitButton } from '@/components/forms';
import { TimerSetting, toLocalInput } from '@/components/ScheduleFields';
import { csv, cn } from '@/lib/util';
import type { QRow } from './Editor';

export interface QuizFull {
  id: string; class_id: string; kind: string; title: string; instructions: string | null; status: string; lesson_date: string | null; due_at: string | null;
  timer_minutes?: number | null; timer_mode?: string | null;
  results_mode: string; released: boolean; shuffle_options: boolean; allow_retake: boolean; time_limit_minutes: number | null; language: string;
}

// ---------------------------------------------------------------------------- publish bar
export function StatusActions({ quiz }: { quiz: QuizFull }) {
  const t = useTranslations('checks');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState('');
  const run = (s: 'draft' | 'published' | 'closed') => start(async () => {
    setErr('');
    const r = await setCheckStatus(quiz.id, s);
    if (r?.error) setErr(r.error); else { if (s === 'published') window.dispatchEvent(new Event('nexora:celebrate')); router.refresh(); }
  });
  return (
    <div className="flex flex-wrap items-center gap-2">
      {quiz.status === 'draft' && <button type="button" className="btn-primary" disabled={pending} onClick={() => run('published')}><Send size={15} aria-hidden />{t('publish')}</button>}
      {quiz.status === 'published' && <>
        <button type="button" className="btn" disabled={pending} onClick={() => run('closed')}><Lock size={15} aria-hidden />{t('close')}</button>
        <button type="button" className="btn-ghost" disabled={pending} onClick={() => run('draft')}><Undo2 size={15} aria-hidden />{t('unpublish')}</button>
      </>}
      {quiz.status === 'closed' && <button type="button" className="btn" disabled={pending} onClick={() => run('published')}><LockOpen size={15} aria-hidden />{t('reopen')}</button>}
      {err && <p role="alert" className="text-sm text-bad">{err}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------- settings
export function SettingsForm({ quiz }: { quiz: QuizFull }) {
  const t = useTranslations('checks');
  const tc = useTranslations('common');
  const [state, action] = useActionState(saveSettings, null);
  const [tz, setTz] = useState('0');
  const [due, setDue] = useState('');
  const [pending, start] = useTransition();
  const router = useRouter();
  useEffect(() => { setTz(String(new Date().getTimezoneOffset())); setDue(toLocalInput(quiz.due_at)); }, [quiz.due_at]);
  return (
    <div className="max-w-2xl space-y-6">
      <form action={action} className="card grid gap-4 p-5">
        <input type="hidden" name="id" value={quiz.id} />
        <input type="hidden" name="tz_offset" value={tz} />
        <div><label className="label" htmlFor="s-title">{t('titleLabel').replace(/\s*\(.*\)/, '')}</label><input id="s-title" name="title" defaultValue={quiz.title} maxLength={200} className="input" required /></div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div><label className="label" htmlFor="s-kind">{t('step1')}</label>
            <select id="s-kind" name="kind" defaultValue={quiz.kind} className="input">{(['do_now', 'exit_ticket', 'quiz'] as const).map((k) => <option key={k} value={k}>{t(`kinds.${k}`)}</option>)}</select></div>
          <div><label className="label" htmlFor="s-day">{t('lessonDay')}</label><input id="s-day" name="lesson_date" type="date" defaultValue={quiz.lesson_date ?? ''} className="input" /></div>
          <div><label className="label" htmlFor="s-due">{t('due')}</label><input id="s-due" name="due_at" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className="input" /></div>
        </div>
        {quiz.kind !== 'quiz' && <TimerSetting idPrefix="s" tag={quiz.kind} defaultMinutes={quiz.timer_minutes ?? null} defaultMode={quiz.timer_mode ?? null} standalone />}
        <div><label className="label" htmlFor="s-ins">{t('instructions')}</label><textarea id="s-ins" name="instructions" defaultValue={quiz.instructions ?? ''} className="textarea" /></div>
        <fieldset>
          <legend className="label">{t('resultsLabel')}</legend>
          <div className="space-y-1.5">
            {(['answers', 'score', 'none'] as const).map((m) => (
              <label key={m} className="flex items-center gap-2 text-sm"><input type="radio" name="results_mode" value={m} defaultChecked={quiz.results_mode === m} className="accent-[rgb(var(--nx-ember))]" />{t(`resultsModes.${m}`)}</label>
            ))}
          </div>
        </fieldset>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="shuffle_options" defaultChecked={quiz.shuffle_options} className="accent-[rgb(var(--nx-ember))]" />{t('shuffle')}</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="allow_retake" defaultChecked={quiz.allow_retake} className="accent-[rgb(var(--nx-ember))]" />{t('retake')}</label>
        <div className="max-w-[200px]"><label className="label" htmlFor="s-limit">{t('timeLimit')}</label><input id="s-limit" name="time_limit_minutes" type="number" min={1} max={240} defaultValue={quiz.time_limit_minutes ?? ''} className="input" /></div>
        <div className="flex items-center gap-3"><SubmitButton>{tc('save')}</SubmitButton><FormMessage state={state} /></div>
      </form>
      <button type="button" className="btn-ghost text-bad" disabled={pending}
        onClick={() => { if (window.confirm(t('confirmDelete'))) start(async () => { await deleteCheck(quiz.id); router.refresh(); }); }}>
        <Trash2 size={15} aria-hidden />{t('deleteCheck')}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------- results
export interface AttemptRow {
  id: string; student_id: string; answers: Record<string, unknown>; per_question: Record<string, { points: number | null; max: number }>;
  score: number | null; max_score: number | null; status: string; late: boolean; submitted_at: string; feedback: string | null;
}

/** New answers appear without refreshing (Supabase Realtime). */
function LiveRefresh({ quizId }: { quizId: string }) {
  const router = useRouter();
  const last = useRef(0);
  useEffect(() => {
    const sb = browserClient();
    const ch = sb.channel(`check-${quizId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_attempts', filter: `quiz_id=eq.${quizId}` }, () => {
        const now = Date.now();
        if (now - last.current > 1500) { last.current = now; router.refresh(); } else setTimeout(() => router.refresh(), 1500);
      })
      .subscribe();
    const iv = setInterval(() => router.refresh(), 30_000);
    return () => { void sb.removeChannel(ch); clearInterval(iv); };
  }, [quizId, router]);
  return null;
}

export function Results({ quiz, questions, roster, attempts, absent = [] }:
  { quiz: QuizFull; questions: QRow[]; roster: { id: string; name: string }[]; attempts: AttemptRow[]; absent?: string[] }) {
  const t = useTranslations('checks');
  const ta = useTranslations('attendance');
  const away = new Set(absent);
  // Absent students who haven't answered are not "missing" — they weren't there.
  const missingHere = roster.filter((r) => !away.has(r.id) && !attempts.some((a) => a.student_id === r.id)).length;
  const f = useFormatter();
  const [pending, start] = useTransition();
  const router = useRouter();
  const gradable = questions.filter((q) => q.type !== 'text' && q.type !== 'page_break');
  const byStudent = new Map(attempts.map((a) => [a.student_id, a]));
  const names = new Map(roster.map((r) => [r.id, r.name]));
  // Students who answered but are no longer on the roster still show up.
  const people = [...roster, ...attempts.filter((a) => !names.has(a.student_id)).map((a) => ({ id: a.student_id, name: '—' }))];
  const scored = attempts.filter((a) => a.score != null && a.max_score);
  const avg = scored.length ? Math.round((scored.reduce((s, a) => s + Number(a.score) / Number(a.max_score), 0) / scored.length) * 100) : null;
  const toGrade = attempts.filter((a) => a.status === 'submitted').length;
  const stat = (qid: string) => {
    const vals = attempts.map((a) => a.per_question?.[qid]).filter((v) => v && v.points != null && v.max > 0) as { points: number; max: number }[];
    return vals.length ? Math.round((vals.reduce((s, v) => s + v.points / v.max, 0) / vals.length) * 100) : null;
  };
  const csvData = () => csv([
    [t('colStudent'), t('colScore'), 'Max', '%', t('colStatus'), t('late'), t('colTime'), ...gradable.map((q, i) => `Q${i + 1}`)],
    ...people.map((p) => {
      const a = byStudent.get(p.id);
      return [p.name, a?.score ?? '', a?.max_score ?? '', a?.score != null && a.max_score ? Math.round((Number(a.score) / Number(a.max_score)) * 100) : '',
        a ? t(`attemptStatus.${a.status as 'graded'}`) : t('notYet'), a?.late ? 'yes' : '', a?.submitted_at ?? '',
        ...gradable.map((q) => a?.per_question?.[q.id]?.points ?? '')];
    }),
  ]);

  return (
    <div className="space-y-6">
      <LiveRefresh quizId={quiz.id} />
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="card p-4"><div className="eyebrow flex items-center gap-1.5"><Radio size={12} className="ember-text" aria-hidden />{t('live')}</div><div className="mt-1 text-lg font-semibold">{t('turnedIn', { done: attempts.length, total: roster.length })}</div>
          {away.size > 0 && <div className="mt-0.5 text-xs text-muted">{ta('absentN', { count: away.size })}{missingHere > 0 ? ` · ${t('notYet').toLowerCase()}: ${missingHere}` : ''}</div>}</div>
        <div className="card p-4"><div className="eyebrow">{t('average')}</div><div className="mt-1 font-mono text-2xl font-semibold">{avg != null ? `${avg}%` : '—'}</div></div>
        <div className="card p-4"><div className="eyebrow">{t('grade')}</div><div className={cn('mt-1 text-lg font-semibold', toGrade > 0 && 'ember-text')}>{t('needsGrading', { count: toGrade })}</div></div>
        <div className="card flex flex-col justify-center gap-2 p-4">
          <button type="button" className="btn btn-sm" onClick={() => { const url = URL.createObjectURL(new Blob([csvData()], { type: 'text/csv' })); Object.assign(document.createElement('a'), { href: url, download: `${quiz.title}.csv` }).click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }}>
            <Download size={14} aria-hidden />{t('exportCsv')}
          </button>
          {quiz.results_mode !== 'answers' && (
            <button type="button" className="btn btn-sm" disabled={pending} onClick={() => start(async () => { await releaseResults(quiz.id, !quiz.released); router.refresh(); })}>
              <Eye size={14} aria-hidden />{quiz.released ? t('unrelease') : t('release')}
            </button>
          )}
        </div>
      </div>

      {gradable.length > 0 && (
        <section className="card p-5">
          <h3 className="eyebrow mb-3">{t('byQuestion')}</h3>
          <ul className="space-y-2.5">
            {gradable.map((q, i) => {
              const p = stat(q.id);
              return (
                <li key={q.id} className="grid grid-cols-[2rem_minmax(0,1fr)_7rem] items-center gap-3 text-sm">
                  <span className="font-mono text-xs text-muted">Q{i + 1}</span>
                  <div className="min-w-0">
                    <div className="truncate">{q.prompt.replaceAll(BLANK, '___') || t(`types.${q.type as 'text'}`)}</div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/10">
                      <div className={cn('h-full rounded-full', p == null ? '' : p >= 75 ? 'bg-ok' : p >= 50 ? 'bg-warn' : 'bg-bad')} style={{ width: `${p ?? 0}%` }} />
                    </div>
                  </div>
                  <span className="text-right font-mono text-xs text-muted">{p != null ? t('pctCorrect', { pct: p }) : '—'}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="card overflow-hidden">
        <h3 className="eyebrow px-5 pb-2 pt-4">{t('students')}</h3>
        {attempts.length === 0 && <p className="px-5 pb-3 text-sm text-muted">{t('waiting')}</p>}
        <ul className="divide-y divide-line">
          {people.map((p) => {
            const a = byStudent.get(p.id);
            return (
              <li key={p.id}>
                {a ? (
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3 hover:bg-ink/[0.03]">
                      <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                      {a.late && <span className="chip text-2xs text-warn">{t('late')}</span>}
                      <span className={cn('chip text-2xs', a.status === 'submitted' && 'border-ember/50 ember-text')}>{t(`attemptStatus.${a.status as 'graded'}`)}</span>
                      <span className="w-24 text-right font-mono text-sm">{a.score ?? '—'} / {a.max_score ?? '—'}</span>
                      <span className="hidden w-28 text-right text-xs text-muted sm:block">{f.dateTime(new Date(a.submitted_at), { hour: 'numeric', minute: '2-digit' })}</span>
                    </summary>
                    <GradePanel quiz={quiz} questions={gradable} attempt={a} />
                  </details>
                ) : (
                  <div className="flex items-center gap-3 px-5 py-3 text-muted"><span className="flex-1">{p.name}</span>{away.has(p.id) ? <span className="chip text-2xs text-bad">{ta('absentTag')}</span> : <span className="text-xs">{t('notYet')}</span>}</div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function GradePanel({ quiz, questions, attempt }: { quiz: QuizFull; questions: QRow[]; attempt: AttemptRow }) {
  const t = useTranslations('checks');
  const router = useRouter();
  const [state, action] = useActionState(gradeAttempt, null);
  const [pending, start] = useTransition();
  useEffect(() => { if (state?.ok) router.refresh(); }, [state, router]);
  const show = (q: QRow, v: unknown) => {
    const o = new Map([...((q.data.options as Opt[]) ?? []), ...((q.data.items as Opt[]) ?? []), ...((q.data.right as Opt[]) ?? [])].map((x) => [x.id, x.text]));
    if (v == null || v === '') return t('noAnswer');
    if (q.type === 'true_false') return v ? t('true') : t('false');
    if (Array.isArray(v)) return q.type === 'fill_blank' ? v.join(' · ') : v.map((id) => o.get(String(id)) ?? id).join(q.type === 'ordering' ? ' → ' : ', ');
    if (typeof v === 'object') return ((q.data.left as Opt[]) ?? []).map((l) => `${l.text} → ${o.get((v as Record<string, string>)[l.id]) ?? '—'}`).join('; ');
    return String(v);
  };
  return (
    <form action={action} className="space-y-3 border-t border-line bg-sunk/40 px-5 py-4">
      <input type="hidden" name="quiz_id" value={quiz.id} />
      <input type="hidden" name="attempt_id" value={attempt.id} />
      <ol className="space-y-3">
        {questions.map((q, i) => {
          const pq = attempt.per_question?.[q.id];
          const max = pq?.max ?? q.points;
          const full = pq?.points != null && Number(pq.points) >= Number(max);
          return (
            <li key={q.id} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_7rem]">
              <div className="min-w-0">
                <div className="text-xs text-muted">Q{i + 1} · {t(`types.${q.type as 'text'}`)}</div>
                <div className="text-sm font-medium">{q.prompt.replaceAll(BLANK, '___')}</div>
                <div className={cn('mt-1 whitespace-pre-line rounded-md border px-2.5 py-1.5 text-sm', q.type === 'short_answer' ? 'border-violet/40 bg-violet/5' : full ? 'border-ok/40 text-ok' : 'border-bad/30')}>{show(q, attempt.answers[q.id])}</div>
                {q.type === 'short_answer' && !!q.key.sample && <p className="mt-1 text-xs text-muted">{t('sample')}: {String(q.key.sample)}</p>}
              </div>
              <label className="flex items-center gap-1.5 self-start text-xs text-muted sm:justify-end">
                <input name={`pts_${q.id}`} type="number" min={0} max={max} step={0.5} defaultValue={pq?.points ?? ''} placeholder="?"
                  className={cn('input h-8 w-16 px-1 text-center font-mono', pq?.points == null && 'border-ember/60')} aria-label={`${t('points')} Q${i + 1}`} />
                / {max}
              </label>
            </li>
          );
        })}
      </ol>
      <div><label className="label" htmlFor={`fb-${attempt.id}`}>{t('feedback')}</label>
        <textarea id={`fb-${attempt.id}`} name="feedback" defaultValue={attempt.feedback ?? ''} className="textarea min-h-[60px]" maxLength={4000} /></div>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>{t('saveGrade')}</SubmitButton>
        <button type="button" className="btn-ghost btn-sm" disabled={pending} onClick={() => start(async () => { await resetAttempt(quiz.id, attempt.id); router.refresh(); })}>
          <RotateCcw size={13} aria-hidden />{t('reset')}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}


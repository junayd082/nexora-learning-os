'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, CheckCircle2, Clock, Loader2, RotateCcw, Send, Volume2, VolumeX, XCircle } from 'lucide-react';
import { submitCheck } from '@/lib/checks';
import { BLANK, type Opt } from '@/lib/engine/types';
import { cn } from '@/lib/util';

export interface TakeQ { id: string; type: string; prompt: string; data: Record<string, unknown>; points: number; position: number }
export interface TakeQuiz {
  id: string; class_id: string; kind: string; title: string; instructions: string | null; status: string; due_at: string | null;
  time_limit_minutes: number | null; language: string; allow_retake: boolean; results_mode: string; released: boolean;
}
type Answers = Record<string, unknown>;

const store = {
  get: (k: string) => { try { return JSON.parse(localStorage.getItem(k) ?? 'null'); } catch { return null; } },
  set: (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* */ } },
};

/** Students answer a Do Now / Exit Ticket right on the page. */
export function TakeCheck({ quiz, questions, preview = false }: { quiz: TakeQuiz; questions: TakeQ[]; preview?: boolean }) {
  const t = useTranslations('checks');
  const f = useFormatter();
  const router = useRouter();
  const KEY = `nexora-check-${quiz.id}`;
  const [answers, setAnswers] = useState<Answers>({});
  const [page, setPage] = useState(0);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const [speaking, setSpeaking] = useState<string | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const submitted = useRef(false);

  useEffect(() => { if (!preview) { const saved = store.get(KEY); if (saved?.answers) setAnswers(saved.answers); } }, [KEY, preview]);
  const set = (id: string, v: unknown) => setAnswers((a) => { const next = { ...a, [id]: v }; if (!preview) store.set(KEY, { ...store.get(KEY), answers: next }); return next; });

  const pages = useMemo(() => {
    const out: TakeQ[][] = [[]];
    for (const q of questions) { if (q.type === 'page_break') { if (out[out.length - 1].length) out.push([]); } else out[out.length - 1].push(q); }
    return out.filter((p) => p.length);
  }, [questions]);
  const gradable = questions.filter((q) => q.type !== 'text' && q.type !== 'page_break');
  const numberOf = new Map(gradable.map((q, i) => [q.id, i + 1]));

  // Ordering answers default to the order on screen.
  const withDefaults = (a: Answers) => {
    const out = { ...a };
    for (const q of gradable) if (q.type === 'ordering' && !Array.isArray(out[q.id])) out[q.id] = ((q.data.items as Opt[]) ?? []).map((o) => o.id);
    return out;
  };
  const unanswered = gradable.filter((q) => {
    const v = answers[q.id];
    if (q.type === 'ordering') return false;
    if (v == null || v === '') return true;
    if (Array.isArray(v)) return v.length === 0 || v.every((x) => x === '' || x == null);
    if (typeof v === 'object') return Object.keys(v as object).length < ((q.data.left as Opt[]) ?? []).length;
    return false;
  }).length;

  const doSubmit = (force = false) => {
    if (preview || submitted.current) return;
    if (!force && unanswered && !window.confirm(t('confirmUnanswered', { count: unanswered }))) return;
    submitted.current = true;
    setError('');
    start(async () => {
      const r = await submitCheck(quiz.id, withDefaults(answers));
      if (r.error) { setError(r.error); submitted.current = false; return; }
      store.del(KEY);
      window.dispatchEvent(new Event('nexora:celebrate'));
      router.refresh();
    });
  };

  // Optional time limit, kept across reloads on this device.
  useEffect(() => {
    if (!quiz.time_limit_minutes || preview) return;
    const saved = store.get(KEY) ?? {};
    const startedAt = saved.startedAt ?? Date.now();
    if (!saved.startedAt) store.set(KEY, { ...saved, startedAt });
    const end = startedAt + quiz.time_limit_minutes * 60_000;
    const tick = () => {
      const s = Math.max(0, Math.round((end - Date.now()) / 1000));
      setLeft(s);
      if (s === 0 && !submitted.current) { setError(t('timeUp')); doSubmit(true); }
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [quiz.time_limit_minutes, preview]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { if (typeof window !== 'undefined') window.speechSynthesis?.cancel(); }, []);
  const speak = (q: TakeQ) => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    if (speaking === q.id) { synth.cancel(); setSpeaking(null); return; }
    synth.cancel();
    const parts = [q.prompt.replaceAll(BLANK, '…')];
    for (const o of [...((q.data.options as Opt[]) ?? []), ...((q.data.items as Opt[]) ?? [])]) parts.push(o.text);
    if (q.type === 'true_false') parts.push(`${t('true')}, ${t('false')}`);
    const u = new SpeechSynthesisUtterance(parts.join('. '));
    u.lang = quiz.language === 'es' ? 'es-US' : 'en-US';
    u.rate = 0.95;
    u.onend = () => setSpeaking(null);
    setSpeaking(q.id);
    synth.speak(u);
  };

  const closed = quiz.status === 'closed';
  const current = pages[page] ?? [];
  const mm = left != null ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : '';

  return (
    <div className="mx-auto max-w-3xl">
      {preview && <p className="mb-4 rounded-lg border border-violet/40 bg-violet/10 px-3 py-2 text-sm">{t('previewNote')}</p>}
      <div className="mb-5 flex flex-wrap items-center gap-2 text-sm text-muted">
        <span className="chip border-ember/50 ember-text">{t(`kinds.${quiz.kind as 'do_now'}`)}</span>
        {quiz.due_at && <span>{t('dueAt', { when: f.dateTime(new Date(quiz.due_at), { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) })}</span>}
        {left != null && <span className={cn('chip ml-auto font-mono', left < 60 && 'border-bad/60 text-bad')}><Clock size={12} aria-hidden />{t('timeLeft', { time: mm })}</span>}
      </div>
      {quiz.instructions && <p className="mb-5 whitespace-pre-line rounded-lg border border-line bg-sunk/50 p-4 text-[15px]">{quiz.instructions}</p>}
      {closed && <p className="mb-5 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-warn">{t('closedNote')}</p>}

      <ol className="space-y-4">
        {current.map((q) => (
          <li key={q.id} className="card p-5">
            {q.type === 'text' ? <p className="whitespace-pre-line text-[15px] leading-relaxed">{q.prompt}</p> : (
              <>
                <div className="mb-3 flex items-start gap-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ember/15 font-mono text-xs font-semibold ember-text">{numberOf.get(q.id)}</span>
                  <div className="min-w-0 flex-1 text-[16px] font-medium leading-snug">
                    {q.type === 'fill_blank' ? <FillPrompt q={q} value={(answers[q.id] as string[]) ?? []} onChange={(v) => set(q.id, v)} disabled={closed} /> : <span className="whitespace-pre-line">{q.prompt}</span>}
                  </div>
                  <button type="button" onClick={() => speak(q)} className="btn-ghost btn-sm shrink-0" aria-pressed={speaking === q.id}
                    aria-label={speaking === q.id ? t('stop') : t('listen')} title={speaking === q.id ? t('stop') : t('listen')}>
                    {speaking === q.id ? <VolumeX size={15} aria-hidden /> : <Volume2 size={15} aria-hidden />}
                  </button>
                  <span className="shrink-0 pt-1 font-mono text-2xs text-faint">{t('pts', { n: q.points })}</span>
                </div>
                <Answer q={q} value={answers[q.id]} onChange={(v) => set(q.id, v)} disabled={closed} />
              </>
            )}
          </li>
        ))}
      </ol>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {pages.length > 1 && <span className="font-mono text-xs text-muted">{page + 1} / {pages.length}</span>}
        {page > 0 && <button type="button" className="btn" onClick={() => { setPage(page - 1); window.scrollTo({ top: 0 }); }}><ArrowLeft size={15} aria-hidden />{t('back')}</button>}
        {page < pages.length - 1
          ? <button type="button" className="btn-primary" onClick={() => { setPage(page + 1); window.scrollTo({ top: 0 }); }}>{t('next')}<ArrowRight size={15} aria-hidden /></button>
          : !preview && !closed && (
            <button type="button" className="btn-primary" disabled={pending} onClick={() => doSubmit()}>
              {pending ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Send size={15} aria-hidden />}{pending ? t('submitting') : t('submit')}
            </button>
          )}
        {error && <p role="alert" className="text-sm text-bad">{error}</p>}
      </div>
      {!preview && !closed && <p className="mt-3 text-2xs text-faint">{t('draftNote')}</p>}
    </div>
  );
}

function FillPrompt({ q, value, onChange, disabled }: { q: TakeQ; value: string[]; onChange: (v: string[]) => void; disabled: boolean }) {
  const t = useTranslations('checks');
  const parts = q.prompt.split(BLANK);
  return (
    <span className="leading-[2.2]">
      {parts.map((p, i) => (
        <span key={i}>
          <span className="whitespace-pre-line">{p}</span>
          {i < parts.length - 1 && (
            <input value={value[i] ?? ''} disabled={disabled} aria-label={`${t('typeAnswer')} ${i + 1}`} autoComplete="off" spellCheck={false}
              onChange={(e) => { const v = [...value]; while (v.length < parts.length - 1) v.push(''); v[i] = e.target.value; onChange(v); }}
              className="mx-1 inline-block h-8 w-36 rounded-md border border-ember/40 bg-sunk px-2 text-center text-[15px] font-semibold text-ink outline-none focus:border-ember" />
          )}
        </span>
      ))}
    </span>
  );
}

function Answer({ q, value, onChange, disabled }: { q: TakeQ; value: unknown; onChange: (v: unknown) => void; disabled: boolean }) {
  const t = useTranslations('checks');
  const choice = (on: boolean) => cn('flex w-full items-center gap-3 rounded-lg border px-3.5 py-3 text-left text-[15px] transition',
    on ? 'border-ember/70 bg-ember/10' : 'border-line hover:border-ember/30', disabled && 'pointer-events-none opacity-70');

  if (q.type === 'true_false') {
    return (
      <div className="grid grid-cols-2 gap-2" role="radiogroup">
        {[true, false].map((v) => (
          <button key={String(v)} type="button" role="radio" aria-checked={value === v} className={choice(value === v)} onClick={() => onChange(v)}>
            <span className={cn('h-4 w-4 rounded-full border-2', value === v ? 'border-ember bg-ember' : 'border-faint')} aria-hidden />{v ? t('true') : t('false')}
          </button>
        ))}
      </div>
    );
  }
  if (q.type === 'multiple_choice') {
    const opts = (q.data.options as Opt[]) ?? [];
    const multi = !!q.data.multi;
    const sel = (Array.isArray(value) ? value : []) as string[];
    return (
      <div className="space-y-2" role={multi ? 'group' : 'radiogroup'}>
        {multi && <p className="text-xs text-muted">{t('selectAll')}</p>}
        {opts.map((o, i) => {
          const on = sel.includes(o.id);
          return (
            <button key={o.id} type="button" role={multi ? 'checkbox' : 'radio'} aria-checked={on} className={choice(on)}
              onClick={() => onChange(multi ? (on ? sel.filter((x) => x !== o.id) : [...sel, o.id]) : [o.id])}>
              <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center border font-mono text-xs', multi ? 'rounded' : 'rounded-full', on ? 'border-ember bg-ember text-accent-ink' : 'border-line text-muted')} aria-hidden>{String.fromCharCode(65 + i)}</span>
              {o.text}
            </button>
          );
        })}
      </div>
    );
  }
  if (q.type === 'ordering') {
    const items = (q.data.items as Opt[]) ?? [];
    const order = (Array.isArray(value) ? value : items.map((o) => o.id)) as string[];
    const byId = new Map(items.map((o) => [o.id, o]));
    const move = (i: number, d: number) => { const a = [...order]; [a[i], a[i + d]] = [a[i + d], a[i]]; onChange(a); };
    return (
      <ol className="space-y-2">
        {order.map((id, i) => (
          <li key={id} className="flex items-center gap-2 rounded-lg border border-line bg-sunk/50 px-3 py-2">
            <span className="w-5 text-center font-mono text-xs text-muted">{i + 1}</span>
            <span className="flex-1 text-[15px]">{byId.get(id)?.text}</span>
            <button type="button" className="btn-ghost btn-sm" disabled={disabled || i === 0} onClick={() => move(i, -1)} aria-label={`${t('moveUp')}: ${byId.get(id)?.text}`}><ArrowUp size={15} aria-hidden /></button>
            <button type="button" className="btn-ghost btn-sm" disabled={disabled || i === order.length - 1} onClick={() => move(i, 1)} aria-label={`${t('moveDown')}: ${byId.get(id)?.text}`}><ArrowDown size={15} aria-hidden /></button>
          </li>
        ))}
      </ol>
    );
  }
  if (q.type === 'matching') {
    const left = (q.data.left as Opt[]) ?? [];
    const right = (q.data.right as Opt[]) ?? [];
    const sel = (value && typeof value === 'object' && !Array.isArray(value) ? value : {}) as Record<string, string>;
    return (
      <div className="space-y-2">
        {left.map((l) => (
          <div key={l.id} className="grid items-center gap-2 sm:grid-cols-[1fr_1.4fr]">
            <span className="font-medium">{l.text}</span>
            <select className="input" value={sel[l.id] ?? ''} disabled={disabled} aria-label={l.text} onChange={(e) => onChange({ ...sel, [l.id]: e.target.value })}>
              <option value="">{t('choose')}</option>
              {right.map((r) => <option key={r.id} value={r.id}>{r.text}</option>)}
            </select>
          </div>
        ))}
      </div>
    );
  }
  if (q.type === 'short_answer') {
    return <textarea className="textarea min-h-[110px] text-[15px]" rows={Number(q.data.lines) || 4} value={String(value ?? '')} disabled={disabled}
      placeholder={t('typeAnswer')} aria-label={q.prompt} maxLength={5000} onChange={(e) => onChange(e.target.value)} />;
  }
  return null;
}

// ---------------------------------------------------------------------------- result
export interface ResultData {
  attempt: { answers: Record<string, unknown>; status: string; late: boolean; submitted_at: string; feedback: string | null; score: number | null; max_score: number | null } | null;
  reveal: boolean; show_score: boolean;
  questions: { id: string; key: Record<string, unknown>; explanation: string | null; points: number | null; max: number }[];
}

export function ResultView({ quiz, questions, result, onRetake }: { quiz: TakeQuiz; questions: TakeQ[]; result: ResultData; onRetake?: boolean }) {
  const t = useTranslations('checks');
  const a = result.attempt!;
  const keyed = new Map(result.questions.map((r) => [r.id, r]));
  const gradable = questions.filter((q) => q.type !== 'text' && q.type !== 'page_break');
  const pct = a.score != null && a.max_score ? Math.round((Number(a.score) / Number(a.max_score)) * 100) : null;
  const [retaking, setRetaking] = useState(false);
  if (retaking) return <TakeCheck quiz={quiz} questions={questions} />;

  const show = (q: TakeQ, v: unknown): string => {
    const o = new Map([...(q.data.options as Opt[] ?? []), ...(q.data.items as Opt[] ?? []), ...(q.data.right as Opt[] ?? [])].map((x) => [x.id, x.text]));
    if (v == null || v === '') return t('noAnswer');
    if (q.type === 'true_false') return v ? t('true') : t('false');
    if (q.type === 'multiple_choice' || q.type === 'ordering') return (v as string[]).map((id) => o.get(id) ?? id).join(q.type === 'ordering' ? ' → ' : ', ');
    if (q.type === 'fill_blank') return (v as string[]).join(' · ') || t('noAnswer');
    if (q.type === 'matching') return ((q.data.left as Opt[]) ?? []).map((l) => `${l.text} → ${o.get((v as Record<string, string>)[l.id]) ?? '—'}`).join('; ');
    return String(v);
  };
  const correctText = (q: TakeQ, key: Record<string, unknown>): string => {
    if (q.type === 'true_false') return key.answer ? t('true') : t('false');
    if (q.type === 'multiple_choice') return show(q, key.correct);
    if (q.type === 'ordering') return show(q, key.order);
    if (q.type === 'fill_blank') return ((key.answers as string[][]) ?? []).map((x) => x[0]).join(' · ');
    if (q.type === 'matching') return show(q, key.pairs);
    if (q.type === 'short_answer') return String(key.sample ?? '');
    return '';
  };

  return (
    <div className="mx-auto max-w-3xl">
      <section className="card relative overflow-hidden p-6 text-center">
        <div className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-48 w-48 rounded-full bg-ember/25 blur-3xl" aria-hidden />
        <CheckCircle2 size={34} className="mx-auto text-ok" aria-hidden />
        <h2 className="display mt-2 text-2xl">{t('doneTitle')}</h2>
        {result.show_score && a.score != null
          ? <p className="mt-2 text-lg"><span className="font-mono text-3xl font-semibold">{Number(a.score)}</span><span className="text-muted"> / {Number(a.max_score)}</span>{pct != null && <span className="ml-2 chip">{pct}%</span>}</p>
          : <p className="mt-2 text-muted">{t('hidden')}</p>}
        {a.status === 'submitted' && result.show_score && <p className="mt-1 text-sm text-muted">{t('pending')}</p>}
        {a.late && <span className="chip mt-2 text-warn">{t('late')}</span>}
        {a.feedback && <div className="mx-auto mt-4 max-w-lg rounded-lg border border-violet/40 bg-violet/10 p-3 text-left text-sm"><div className="mb-1 text-2xs font-semibold uppercase tracking-wide text-muted">{t('teacherFeedback')}</div><p className="whitespace-pre-line">{a.feedback}</p></div>}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href={`/classes/${quiz.class_id}`} className="btn"><ArrowLeft size={15} aria-hidden />{t('backToClass')}</Link>
          {onRetake && quiz.status === 'published' && <button type="button" className="btn" onClick={() => setRetaking(true)}><RotateCcw size={15} aria-hidden />{t('again')}</button>}
        </div>
      </section>

      {result.reveal && (
        <ol className="mt-6 space-y-3">
          {gradable.map((q, i) => {
            const r = keyed.get(q.id);
            const got = r?.points; const max = r?.max ?? q.points;
            const state = got == null ? 'pending' : Number(got) >= Number(max) ? 'right' : Number(got) > 0 ? 'partly' : 'wrong';
            return (
              <li key={q.id} className={cn('card border-l-4 p-4', state === 'right' ? 'border-l-ok' : state === 'wrong' ? 'border-l-bad' : state === 'partly' ? 'border-l-warn' : 'border-l-violet')}>
                <div className="flex items-start gap-2">
                  <span className="font-mono text-xs text-muted">{i + 1}.</span>
                  <p className="flex-1 font-medium">{q.prompt.replaceAll(BLANK, '_____')}</p>
                  <span className="flex items-center gap-1 text-xs font-semibold">
                    {state === 'right' ? <CheckCircle2 size={14} className="text-ok" aria-hidden /> : state === 'wrong' ? <XCircle size={14} className="text-bad" aria-hidden /> : null}
                    {state !== 'pending' && <span className={state === 'right' ? 'text-ok' : state === 'wrong' ? 'text-bad' : 'text-warn'}>{t(state as 'right')}</span>}
                    <span className="ml-1 font-mono text-faint">{got ?? '—'}/{max}</span>
                  </span>
                </div>
                <dl className="mt-2 grid gap-1 pl-5 text-sm">
                  <div><dt className="inline text-muted">{t('yourAnswer')}: </dt><dd className="inline whitespace-pre-line">{show(q, a.answers[q.id])}</dd></div>
                  {r && state !== 'right' && correctText(q, r.key) && <div><dt className="inline text-muted">{q.type === 'short_answer' ? t('exampleAnswer') : t('rightAnswer')}: </dt><dd className="inline text-ok">{correctText(q, r.key)}</dd></div>}
                  {r?.explanation && <p className="mt-1 text-xs text-muted">{r.explanation}</p>}
                </dl>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

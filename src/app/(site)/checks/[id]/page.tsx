import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { ArrowLeft, CalendarDays, Cpu, Eye, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/data';
import { aiEnabled } from '@/lib/engine/ai';
import { QTYPES } from '@/lib/engine/types';
import { Page } from '@/components/Experience';
import { Editor, type BankRow, type QRow } from '@/components/checks/Editor';
import { Results, SettingsForm, StatusActions, type AttemptRow, type QuizFull } from '@/components/checks/Manage';
import { ResultView, TakeCheck, type ResultData, type TakeQ, type TakeQuiz } from '@/components/checks/Take';
import { cn } from '@/lib/util';
import { getClassAppearance } from '@/lib/appearance';
import { SceneLock } from '@/components/scene/SceneLock';

export const maxDuration = 120;

const TABS = ['questions', 'settings', 'preview', 'results'] as const;
type Tab = (typeof TABS)[number];

export default async function CheckPage({ params, searchParams }:
  { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; made?: string; engine?: string; notes?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=/checks/${id}`);
  const supabase = await createClient();
  const t = await getTranslations('checks');
  const f = await getFormatter();
  const { data: quiz } = await supabase.from('quizzes').select('*, classes(id,name,teacher_id)').eq('id', id).maybeSingle();
  if (!quiz) notFound();
  const cls = quiz.classes as { id: string; name: string; teacher_id: string };
  const { data: teaches } = await supabase.rpc('teaches_class', { cid: cls.id });
  const isTeacher = cls.teacher_id === viewer.id || teaches === true;

  const header = (
    <>
      <Link href={`/classes/${cls.id}?tab=materials`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft size={14} aria-hidden />{cls.name}</Link>
      <h1 className="display text-3xl">{quiz.title}</h1>
    </>
  );

  // ------------------------------------------------------------------ student
  if (!isTeacher) {
    const { data: take, error } = await supabase.rpc('quiz_take', { p_quiz: id });
    if (error || !take) notFound();
    const tq = take as { quiz: TakeQuiz; questions: TakeQ[]; attempt: unknown };
    const done = !!tq.attempt;
    const result = done ? ((await supabase.rpc('quiz_result', { p_quiz: id })).data as ResultData) : null;
    const look = await getClassAppearance(cls.id);
    return (
      <Page>
        <SceneLock scene={look.lockScene} />
        <div className="mx-auto max-w-3xl">{header}</div>
        <div className="mt-6">
          {result?.attempt
            ? <ResultView quiz={tq.quiz} questions={tq.questions} result={result} onRetake={tq.quiz.allow_retake} />
            : <TakeCheck quiz={tq.quiz} questions={tq.questions} />}
        </div>
      </Page>
    );
  }

  // ------------------------------------------------------------------ teacher
  const tab: Tab = (TABS as readonly string[]).includes(sp.tab ?? '') ? (sp.tab as Tab) : 'questions';
  const { data: qData } = await supabase.from('quiz_questions').select('*').eq('quiz_id', id).order('position');
  const questions = (qData ?? []) as QRow[];
  const full = quiz as unknown as QuizFull;
  const gradableCount = questions.filter((q) => q.type !== 'text' && q.type !== 'page_break').length;
  const totalPts = questions.reduce((s, q) => s + Number(q.points || 0), 0);
  const { count: answered } = await supabase.from('quiz_attempts').select('id', { count: 'exact', head: true }).eq('quiz_id', id);

  let body: React.ReactNode = null;
  if (tab === 'questions') {
    const [{ data: bank }, { data: others }, { data: mats }] = await Promise.all([
      supabase.from('bank_questions').select('id,type,prompt,topic,points').eq('owner_id', viewer.id).order('created_at', { ascending: false }).limit(300),
      supabase.from('quizzes').select('id,title,classes!inner(teacher_id)').eq('classes.teacher_id', viewer.id).neq('id', id).order('created_at', { ascending: false }).limit(100),
      supabase.from('class_materials').select('id,title,kind').eq('class_id', cls.id).in('kind', ['file', 'link', 'page', 'experience']).order('created_at', { ascending: false }),
    ]);
    const made = Number(sp.made ?? 0);
    const notes = (sp.notes ?? '').split(',').filter(Boolean);
    const shortTypes = notes.filter((n) => (QTYPES as readonly string[]).includes(n)).map((n) => t(`types.${n as 'true_false'}`));
    body = (
      <>
        {made > 0 && (
          <div className="mb-5 flex gap-3 rounded-lg border border-violet/40 bg-violet/10 p-4 text-sm">
            {sp.engine === 'ai' ? <Sparkles size={18} className="mt-0.5 shrink-0 violet-text" aria-hidden /> : <Cpu size={18} className="mt-0.5 shrink-0 text-muted" aria-hidden />}
            <div className="space-y-1">
              <p>{t('made', { count: made, engine: sp.engine === 'ai' ? 'ai' : 'builtin' })}</p>
              {notes.includes('reviewed') && <p className="text-muted">{t('reviewedNote')}</p>}
              {notes.includes('grounded') && <p className="text-muted">{t('groundedNote')}</p>}
              {notes.find((n) => n.startsWith('ungrounded_')) && <p className="text-warn">{t('ungroundedNote', { count: Number(notes.find((n) => n.startsWith('ungrounded_'))!.split('_')[1]) || 1 })}</p>}
              {notes.includes('pages_empty') && <p className="text-warn">{t('pagesEmpty')}</p>}
              {notes.includes('ai_failed') && <p className="text-muted">{t('aiFailed')}</p>}
              {notes.includes('ai_key') && <p className="font-medium text-warn">{t('aiKey')}</p>}
              {shortTypes.length > 0 && <p className="text-muted">{t('short', { types: shortTypes.join(', ') })}</p>}
            </div>
          </div>
        )}
        <Editor quizId={id} questions={questions} bank={(bank ?? []) as BankRow[]} ai={aiEnabled()}
          others={(others ?? []).map((o) => ({ id: o.id as string, title: o.title as string }))}
          materials={(mats ?? []).map((m) => ({ id: m.id as string, label: m.title as string }))} />
      </>
    );
  } else if (tab === 'settings') {
    body = <SettingsForm quiz={full} />;
  } else if (tab === 'preview') {
    const previewQs: TakeQ[] = questions.map((q) => ({ id: q.id, type: q.type, prompt: q.prompt, data: q.data, points: Number(q.points), position: q.position }));
    body = <TakeCheck preview quiz={{ ...full, class_id: cls.id } as TakeQuiz} questions={previewQs} />;
  } else {
    const [{ data: enr }, { data: att }, { data: abs }] = await Promise.all([
      supabase.from('enrollments').select('user_id, profiles(display_name)').eq('class_id', cls.id).eq('role', 'student'),
      supabase.from('quiz_attempts').select('*').eq('quiz_id', id).order('submitted_at', { ascending: false }),
      full.lesson_date
        ? supabase.from('attendance').select('student_id').eq('class_id', cls.id).eq('day', full.lesson_date).eq('status', 'absent')
        : Promise.resolve({ data: [] as { student_id: string }[] }),
    ]);
    const roster = ((enr ?? []) as unknown as { user_id: string; profiles: { display_name: string } | null }[])
      .map((e) => ({ id: e.user_id, name: e.profiles?.display_name || '—' })).sort((a, b) => a.name.localeCompare(b.name));
    body = <Results quiz={full} questions={questions} roster={roster} attempts={(att ?? []) as AttemptRow[]} absent={((abs ?? []) as { student_id: string }[]).map((r) => r.student_id)} />;
  }

  return (
    <Page wide>
      {header}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
        <span className="chip border-ember/50 ember-text">{t(`kinds.${quiz.kind as 'do_now'}`)}</span>
        <span className={cn('chip', quiz.status === 'published' ? 'border-ok/50 text-ok' : quiz.status === 'closed' ? 'text-warn' : '')}>{t(`status.${quiz.status as 'draft'}`)}</span>
        {quiz.lesson_date && <span className="chip"><CalendarDays size={12} aria-hidden />{f.dateTime(new Date(`${quiz.lesson_date}T12:00:00`), { weekday: 'short', month: 'short', day: 'numeric' })}</span>}
        <span className="font-mono text-xs">{t('total', { count: gradableCount })} · {t('pts', { n: totalPts })}</span>
        {quiz.source_label && <span className="text-xs">· {quiz.source_label}</span>}
        <div className="ml-auto"><StatusActions quiz={full} /></div>
      </div>
      <nav className="mt-6 flex gap-1 overflow-x-auto border-b border-line" aria-label="Check">
        {TABS.map((k) => (
          <Link key={k} href={`/checks/${id}?tab=${k}`} aria-current={tab === k ? 'page' : undefined}
            className={cn('-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold', tab === k ? 'border-ember text-ink' : 'border-transparent text-muted hover:text-ink')}>
            {k === 'preview' && <Eye size={14} aria-hidden />}{t(`tabs.${k}`)}
            {k === 'results' && !!answered && <span className="rounded-full bg-ember/20 px-1.5 font-mono text-2xs ember-text">{answered}</span>}
          </Link>
        ))}
      </nav>
      <div className="mt-6">{body}</div>
    </Page>
  );
}

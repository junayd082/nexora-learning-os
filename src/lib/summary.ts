'use server';

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { createClient } from './supabase/server';
import { getViewer } from './data';
import { readSource } from './lessonSource';
import { aiEnabled } from './engine/ai';
import { studentMarkdown, summarise, teacherMarkdown, weakest, type CheckResult, type SessionSummary } from './engine/summary';

export interface SummaryDraft {
  summary: SessionSummary; student: string; teacher: string; results: CheckResult[];
  sourceTitle: string; materialId: string | null; date: string; notes: string[];
  /** Ready-made focus lines for tomorrow's Do Now / the next Exit ticket. */
  doNowFocus: string; exitFocus: string;
}
type State = { ok?: boolean; error?: string; message?: string; data?: SummaryDraft } | null;

const day = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);

async function ownClass(classId: string) {
  const v = await getViewer();
  if (!v) return null;
  const supabase = await createClient();
  const { data: cls } = await supabase.from('classes').select('id,name,teacher_id').eq('id', classId).maybeSingle();
  return cls && cls.teacher_id === v.id ? { v, cls, supabase } : null;
}

/** Today's Do Now / Exit ticket results for the class: per-question % correct on auto-graded questions. */
async function resultsFor(classId: string, date: string): Promise<CheckResult[]> {
  const supabase = await createClient();
  const { data: quizzes } = await supabase.from('quizzes').select('id,title,kind').eq('class_id', classId).eq('lesson_date', date)
    .in('kind', ['do_now', 'exit_ticket', 'quiz']).order('created_at');
  if (!quizzes?.length) return [];
  const ids = quizzes.map((q) => q.id as string);
  const [{ data: qs }, { data: at }, { count: roster }] = await Promise.all([
    supabase.from('quiz_questions').select('id,quiz_id,prompt,type,position').in('quiz_id', ids).order('position'),
    supabase.from('quiz_attempts').select('quiz_id,per_question,score,max_score,status').in('quiz_id', ids),
    supabase.from('enrollments').select('user_id', { count: 'exact', head: true }).eq('class_id', classId).eq('role', 'student'),
  ]);
  return quizzes.map((q) => {
    const attempts = (at ?? []).filter((a) => a.quiz_id === q.id && a.status !== 'in_progress');
    const questions = (qs ?? []).filter((x) => x.quiz_id === q.id && x.type !== 'page_break' && x.type !== 'text').map((x) => {
      const vals = attempts.map((a) => (a.per_question as Record<string, { points: number | null; max: number }> | null)?.[x.id as string])
        .filter((v): v is { points: number; max: number } => !!v && v.points != null && v.max > 0);
      const pct = vals.length ? Math.round((vals.reduce((s, v) => s + v.points / v.max, 0) / vals.length) * 100) : null;
      return { prompt: String(x.prompt ?? '').replace(/\s+/g, ' ').trim(), pct, n: vals.length };
    });
    const scored = attempts.filter((a) => a.max_score && a.score != null);
    const avg = scored.length ? Math.round((scored.reduce((s, a) => s + Number(a.score) / Number(a.max_score), 0) / scored.length) * 100) : null;
    return { title: q.title as string, kind: q.kind as CheckResult['kind'], answered: attempts.length, roster: roster ?? 0, avg, questions };
  });
}

/** Step 1: read today's lesson (+ today's check results) and draft the summary. Nothing is saved yet. */
export async function draftSummary(_: State, fd: FormData): Promise<State> {
  const t = await getTranslations('summary');
  const classId = String(fd.get('class_id') ?? '');
  const own = await ownClass(classId);
  if (!own) return { error: t('notYourClass') };
  const date = day(String(fd.get('lesson_date') ?? '')) ?? new Date().toISOString().slice(0, 10);
  const src = await readSource(fd, classId);
  if (!src) return { error: t('noSource') };
  if (!src.text.trim() && !(src.binary && aiEnabled())) return { error: t('noText') };
  const results = fd.get('use_results') === 'on' ? await resultsFor(classId, date) : [];
  const language = fd.get('language') === 'es' ? 'es' : 'en';
  let out;
  try {
    out = await summarise(src, {
      language, level: String(fd.get('level') ?? 'on grade level for high school (grades 9–12)').slice(0, 200),
      focus: String(fd.get('focus') ?? '').slice(0, 400), pages: String(fd.get('pages') ?? '').slice(0, 60),
      date, className: own.cls.name as string, results,
    });
  } catch {
    return { error: t('noText') };
  }
  const { summary, notes } = out;
  const weak = weakest(results);
  return {
    ok: true,
    data: {
      summary, results, notes, date, sourceTitle: src.title,
      materialId: fd.get('source') === 'material' ? String(fd.get('material_id') ?? '') || null : null,
      student: studentMarkdown(summary, { date, className: own.cls.name as string, sourceTitle: src.title }),
      teacher: teacherMarkdown(summary, results, { date, className: own.cls.name as string }),
      doNowFocus: [summary.teacher.doNowFocus, ...weak.slice(0, 2).map((w) => w.prompt.slice(0, 90))].filter(Boolean).join(' · ').slice(0, 300),
      exitFocus: [summary.teacher.exitFocus, ...summary.concepts.slice(0, 2).map((c) => c.name)].filter(Boolean).join(' · ').slice(0, 300),
    },
  };
}

/** Step 2: save the (edited) summary as a class page for that lesson day; optional teacher notes and announcement. */
export async function publishSummary(input: {
  classId: string; date: string; title: string; body: string; teacherBody: string;
  publish: boolean; saveTeacher: boolean; announce: boolean;
}): Promise<{ ok: true; materialId: string; notesId: string | null } | { ok: false; error: string }> {
  const t = await getTranslations('summary');
  const own = await ownClass(input.classId);
  if (!own) return { ok: false, error: t('notYourClass') };
  const { v, supabase } = own;
  const date = day(input.date);
  const title = (input.title.trim() || t('defaultTitle', { date: input.date })).slice(0, 200);
  const body = input.body.trim().slice(0, 20000);
  if (!body) return { ok: false, error: t('emptyBody') };
  const { count } = await supabase.from('class_materials').select('id', { count: 'exact', head: true }).eq('class_id', input.classId);
  const base = { class_id: input.classId, kind: 'page', created_by: v.id, lesson_date: date };
  const { data: m, error } = await supabase.from('class_materials')
    .insert({ ...base, title, body, tag: 'resource', published: input.publish, position: (count ?? 0) + 1 }).select('id').single();
  if (error || !m) return { ok: false, error: t('saveFailed') };
  let notesId: string | null = null;
  if (input.saveTeacher && input.teacherBody.trim()) {
    const { data: n } = await supabase.from('class_materials')
      .insert({ ...base, title: `${t('notesPrefix')} — ${title}`.slice(0, 200), body: input.teacherBody.trim().slice(0, 20000), tag: null, published: false, position: (count ?? 0) + 2 })
      .select('id').single();
    notesId = n?.id ?? null;
  }
  if (input.announce && input.publish) {
    await supabase.from('class_updates').insert({ class_id: input.classId, author_id: v.id, body: t('announceBody', { title }).slice(0, 5000) });
  }
  revalidatePath(`/classes/${input.classId}`);
  revalidatePath('/');
  return { ok: true, materialId: m.id as string, notesId };
}

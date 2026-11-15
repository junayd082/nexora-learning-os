'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { createClient } from './supabase/server';
import { getViewer } from './data';
import { generate } from './engine/generate';
import { readSource } from './lessonSource';
import { blank, parseImport, sanitize, QTYPES, type BlockType, type CheckKind, type Counts, type Question } from './engine/types';
import { aiEnabled } from './engine/ai';

type State = { ok?: boolean; error?: string; message?: string; data?: unknown } | null;
const KINDS: CheckKind[] = ['do_now', 'exit_ticket', 'quiz'];

async function viewerOrThrow() {
  const v = await getViewer();
  if (!v) throw new Error('Not signed in.');
  return v;
}
function localToIso(local: string, offsetMinutes: number) {
  if (!local) return null;
  const d = new Date(`${local}:00Z`);
  return Number.isNaN(d.getTime()) ? null : new Date(d.getTime() + offsetMinutes * 60_000).toISOString();
}
const day = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);
const rows = (quizId: string, qs: Question[], start = 0) => qs.map((q, i) => ({
  quiz_id: quizId, position: start + i + 1, type: q.type, prompt: q.prompt, data: q.data, key: q.key, points: q.points, explanation: q.explanation ?? null,
}));

/** Optional Do Now / Exit ticket timer from <TimerSetting> (only for those two kinds). */
function timerFrom(fd: FormData, kind: string): { timer_minutes?: number | null; timer_mode?: string | null } {
  if (!fd.has('timer_present')) return {};
  const mode = String(fd.get('timer_mode') ?? '');
  const mins = parseInt(String(fd.get('timer_minutes') ?? ''), 10);
  const ok = (kind === 'do_now' || kind === 'exit_ticket') && (mode === 'manual' || mode === 'bell') && mins >= 1 && mins <= 60;
  return { timer_minutes: ok ? mins : null, timer_mode: ok ? mode : null };
}

function countsFrom(fd: FormData): Counts {
  const c: Counts = {};
  for (const t of QTYPES) c[t] = Math.max(0, Math.min(15, parseInt(String(fd.get(`n_${t}`) ?? '0'), 10) || 0));
  return c;
}

const WARN_KEYS = ['scanned', 'image', 'old_office', 'media', 'unsupported', 'private', 'unreachable', 'bad_link', 'too_big', 'no_text'];

// ---------------------------------------------------------------------------- create
export async function generateCheck(_: State, fd: FormData): Promise<State> {
  const v = await viewerOrThrow();
  const t = await getTranslations('checks');
  const classId = String(fd.get('class_id') ?? '');
  const kind = (KINDS.includes(String(fd.get('kind')) as CheckKind) ? String(fd.get('kind')) : 'do_now') as CheckKind;
  const supabase = await createClient();
  const { data: cls } = await supabase.from('classes').select('id,teacher_id').eq('id', classId).maybeSingle();
  if (!cls || cls.teacher_id !== v.id) return { error: t('notYourClass') };

  const tz = parseInt(String(fd.get('tz_offset') ?? '0'), 10) || 0;
  const startBlank = fd.get('source') === 'blank';
  let questions: Question[] = [];
  let engine: string = 'manual';
  let notes: string[] = [];
  let label = '';
  let topic = '';
  if (!startBlank) {
    const counts = countsFrom(fd);
    if (!Object.values(counts).some((n) => n && n > 0)) return { error: t('pickCount') };
    const src = await readSource(fd, classId);
    if (!src) return { error: t('noSource') };
    if (!src.text.trim() && !(src.binary && aiEnabled())) {
      const w = src.warning && WARN_KEYS.includes(src.warning) ? src.warning : 'no_text';
      return { error: t(`warn.${w}` as 'warn.no_text') };
    }
    const r = await generate(src, counts, kind, {
      language: String(fd.get('language') ?? 'en'), level: String(fd.get('level') ?? 'on grade level for high school (grades 9–12)'),
      focus: String(fd.get('focus') ?? '').slice(0, 300),
      pages: String(fd.get('pages') ?? '').slice(0, 60),
    });
    if (!r.questions.length) return { error: t('nothingMade') };
    questions = r.questions; engine = r.engine; notes = r.notes; label = src.title; topic = r.topic;
  }

  const title = String(fd.get('title') ?? '').trim().slice(0, 200)
    || `${t(`kinds.${kind}`)} — ${(topic || label || t('untitled')).slice(0, 150)}`;
  const { data: quiz, error } = await supabase.from('quizzes').insert({
    class_id: classId, kind, title, status: 'draft',
    instructions: String(fd.get('instructions') ?? '').trim().slice(0, 4000) || null,
    lesson_date: day(String(fd.get('lesson_date') ?? '')), due_at: localToIso(String(fd.get('due_at') ?? ''), tz),
    language: String(fd.get('language') ?? 'en'), engine, source_label: label || null,
    source_material_id: fd.get('source') === 'material' ? String(fd.get('material_id')) : null,
    results_mode: kind === 'quiz' ? 'score' : 'answers', created_by: v.id,
    ...timerFrom(fd, kind),
  }).select('id').single();
  if (error || !quiz) return { error: t('saveFailed') };
  if (questions.length) await supabase.from('quiz_questions').insert(rows(quiz.id, questions));
  const q = new URLSearchParams({ tab: 'questions' });
  if (!startBlank) { q.set('made', String(questions.length)); q.set('engine', engine); if (notes.length) q.set('notes', notes.join(',')); }
  redirect(`/checks/${quiz.id}?${q}`);
}

/** "✨ Generate more" inside the editor — same engine, appended to the check. */
export async function generateMore(_: State, fd: FormData): Promise<State> {
  await viewerOrThrow();
  const t = await getTranslations('checks');
  const quizId = String(fd.get('quiz_id') ?? '');
  const supabase = await createClient();
  const { data: quiz } = await supabase.from('quizzes').select('*').eq('id', quizId).maybeSingle();
  if (!quiz) return { error: t('notYourClass') };
  const counts = countsFrom(fd);
  if (!Object.values(counts).some((n) => n && n > 0)) return { error: t('pickCount') };
  const src = await readSource(fd, quiz.class_id);
  if (!src || (!src.text.trim() && !src.binary)) return { error: t('noSource') };
  const r = await generate(src, counts, quiz.kind, { language: quiz.language, level: 'on grade level for high school (grades 9–12)', focus: '' });
  if (!r.questions.length) return { error: t('nothingMade') };
  const { count } = await supabase.from('quiz_questions').select('id', { count: 'exact', head: true }).eq('quiz_id', quizId);
  await supabase.from('quiz_questions').insert(rows(quizId, r.questions, (count ?? 0) + 100));
  await renumber(quizId);
  revalidatePath(`/checks/${quizId}`);
  return { ok: true, message: t('addedN', { count: r.questions.length }) };
}

// ---------------------------------------------------------------------------- questions
async function renumber(quizId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from('quiz_questions').select('id,position').eq('quiz_id', quizId).order('position');
  await Promise.all((data ?? []).map((r, i) => (r.position === i + 1 ? null : supabase.from('quiz_questions').update({ position: i + 1 }).eq('id', r.id))));
}

/** Make room at position `pos` (1-based) and return it. */
async function makeRoom(quizId: string, pos: number) {
  const supabase = await createClient();
  const { data } = await supabase.from('quiz_questions').select('id,position').eq('quiz_id', quizId).gte('position', pos).order('position', { ascending: false });
  for (const r of data ?? []) await supabase.from('quiz_questions').update({ position: r.position + 1 }).eq('id', r.id);
  return pos;
}

export async function addQuestion(quizId: string, type: BlockType, after?: number) {
  await viewerOrThrow();
  const supabase = await createClient();
  const { count } = await supabase.from('quiz_questions').select('id', { count: 'exact', head: true }).eq('quiz_id', quizId);
  const pos = after != null ? await makeRoom(quizId, after + 1) : (count ?? 0) + 1;
  const { data } = await supabase.from('quiz_questions').insert({ ...rows(quizId, [blank(type)])[0], position: pos }).select('id').single();
  revalidatePath(`/checks/${quizId}`);
  return data?.id ?? null;
}

export async function saveQuestion(quizId: string, id: string, input: Partial<Question>) {
  await viewerOrThrow();
  const q = sanitize(input);
  if (!q) return { error: 'bad' };
  const supabase = await createClient();
  const { error } = await supabase.from('quiz_questions').update({ type: q.type, prompt: q.prompt, data: q.data, key: q.key, points: q.points, explanation: q.explanation ?? null })
    .eq('id', id).eq('quiz_id', quizId);
  return error ? { error: 'save' } : { ok: true };
}

export async function deleteQuestion(quizId: string, id: string) {
  await viewerOrThrow();
  const supabase = await createClient();
  await supabase.from('quiz_questions').delete().eq('id', id).eq('quiz_id', quizId);
  await renumber(quizId);
  revalidatePath(`/checks/${quizId}`);
}

export async function moveQuestion(quizId: string, id: string, dir: -1 | 1) {
  await viewerOrThrow();
  const supabase = await createClient();
  const { data } = await supabase.from('quiz_questions').select('id,position').eq('quiz_id', quizId).order('position');
  const list = data ?? [];
  const i = list.findIndex((r) => r.id === id); const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  await Promise.all([
    supabase.from('quiz_questions').update({ position: list[j].position }).eq('id', list[i].id),
    supabase.from('quiz_questions').update({ position: list[i].position }).eq('id', list[j].id),
  ]);
  revalidatePath(`/checks/${quizId}`);
}

export async function duplicateQuestion(quizId: string, id: string) {
  await viewerOrThrow();
  const supabase = await createClient();
  const { data: q } = await supabase.from('quiz_questions').select('*').eq('id', id).maybeSingle();
  if (!q) return;
  const { id: _omit, ...rest } = q; void _omit;
  const pos = await makeRoom(quizId, q.position + 1);
  await supabase.from('quiz_questions').insert({ ...rest, position: pos });
  revalidatePath(`/checks/${quizId}`);
}

// ---------------------------------------------------------------------------- bank + import
export async function saveToBank(id: string, topic: string) {
  const v = await viewerOrThrow();
  const supabase = await createClient();
  const { data: q } = await supabase.from('quiz_questions').select('*').eq('id', id).maybeSingle();
  if (!q || q.type === 'page_break') return { error: 'bad' };
  const { error } = await supabase.from('bank_questions').insert({
    owner_id: v.id, type: q.type, prompt: q.prompt, data: q.data, key: q.key, points: q.points, explanation: q.explanation, topic: topic.trim().slice(0, 120) || null,
  });
  return error ? { error: 'save' } : { ok: true };
}

export async function addFromBank(quizId: string, ids: string[]) {
  await viewerOrThrow();
  const supabase = await createClient();
  const { data } = await supabase.from('bank_questions').select('*').in('id', ids.slice(0, 100));
  const qs = (data ?? []).map((b) => sanitize(b as Question)).filter((q): q is Question => !!q);
  const { count } = await supabase.from('quiz_questions').select('id', { count: 'exact', head: true }).eq('quiz_id', quizId);
  if (qs.length) await supabase.from('quiz_questions').insert(rows(quizId, qs, count ?? 0));
  revalidatePath(`/checks/${quizId}`);
  return qs.length;
}

export async function deleteBankQuestion(id: string) {
  await viewerOrThrow();
  const supabase = await createClient();
  await supabase.from('bank_questions').delete().eq('id', id);
}

export async function importQuestions(_: State, fd: FormData): Promise<State> {
  await viewerOrThrow();
  const t = await getTranslations('checks');
  const quizId = String(fd.get('quiz_id') ?? '');
  const supabase = await createClient();
  let qs: Question[] = [];
  const from = String(fd.get('from_check') ?? '');
  if (from) {
    const { data } = await supabase.from('quiz_questions').select('*').eq('quiz_id', from).order('position');
    qs = (data ?? []).map((r) => sanitize(r as Question)).filter((q): q is Question => !!q);
  } else {
    qs = parseImport(String(fd.get('text') ?? '').slice(0, 60_000));
  }
  if (!qs.length) return { error: t('importNone') };
  const { count } = await supabase.from('quiz_questions').select('id', { count: 'exact', head: true }).eq('quiz_id', quizId);
  const { error } = await supabase.from('quiz_questions').insert(rows(quizId, qs, count ?? 0));
  if (error) return { error: t('saveFailed') };
  revalidatePath(`/checks/${quizId}`);
  return { ok: true, message: t('addedN', { count: qs.length }) };
}

// ---------------------------------------------------------------------------- settings + publishing
export async function saveSettings(_: State, fd: FormData): Promise<State> {
  await viewerOrThrow();
  const t = await getTranslations('checks');
  const id = String(fd.get('id') ?? '');
  const tz = parseInt(String(fd.get('tz_offset') ?? '0'), 10) || 0;
  const kind = String(fd.get('kind'));
  const limit = parseInt(String(fd.get('time_limit_minutes') ?? ''), 10);
  const patch = {
    title: String(fd.get('title') ?? '').trim().slice(0, 200) || t('untitled'),
    kind: KINDS.includes(kind as CheckKind) ? kind : 'do_now',
    instructions: String(fd.get('instructions') ?? '').trim().slice(0, 4000) || null,
    lesson_date: day(String(fd.get('lesson_date') ?? '')),
    due_at: localToIso(String(fd.get('due_at') ?? ''), tz),
    results_mode: ['answers', 'score', 'none'].includes(String(fd.get('results_mode'))) ? String(fd.get('results_mode')) : 'answers',
    shuffle_options: fd.get('shuffle_options') === 'on',
    allow_retake: fd.get('allow_retake') === 'on',
    time_limit_minutes: Number.isFinite(limit) && limit > 0 ? Math.min(limit, 240) : null,
    ...timerFrom(fd, kind),
  };
  const supabase = await createClient();
  const { data: quiz, error } = await supabase.from('quizzes').update(patch).eq('id', id).select('*').single();
  if (error || !quiz) return { error: t('saveFailed') };
  await syncMaterial(quiz);
  revalidatePath(`/checks/${id}`);
  return { ok: true, message: (await getTranslations('common'))('saved') };
}

type QuizRow = { id: string; class_id: string; kind: string; title: string; status: string; lesson_date: string | null; due_at: string | null; created_by: string | null; timer_minutes?: number | null; timer_mode?: string | null };

/** Every check lives in the class Materials, so Today, Nova and the course page see it. */
async function syncMaterial(quiz: QuizRow) {
  const supabase = await createClient();
  const { data: m } = await supabase.from('class_materials').select('id').eq('quiz_id', quiz.id).maybeSingle();
  const fields = {
    title: quiz.title, lesson_date: quiz.lesson_date, due_at: quiz.due_at,
    tag: quiz.kind === 'quiz' ? 'activity' : quiz.kind, published: quiz.status !== 'draft',
    timer_minutes: quiz.kind === 'quiz' ? null : quiz.timer_minutes ?? null,
    timer_mode: quiz.kind === 'quiz' ? null : quiz.timer_mode ?? null,
  };
  if (m) await supabase.from('class_materials').update(fields).eq('id', m.id);
  else if (quiz.status !== 'draft') {
    const { count } = await supabase.from('class_materials').select('id', { count: 'exact', head: true }).eq('class_id', quiz.class_id);
    await supabase.from('class_materials').insert({ ...fields, class_id: quiz.class_id, kind: 'quiz', quiz_id: quiz.id, position: (count ?? 0) + 1, created_by: quiz.created_by });
  }
  revalidatePath(`/classes/${quiz.class_id}`);
}

export async function setCheckStatus(id: string, status: 'draft' | 'published' | 'closed') {
  await viewerOrThrow();
  const t = await getTranslations('checks');
  const supabase = await createClient();
  if (status === 'published') {
    const { count } = await supabase.from('quiz_questions').select('id', { count: 'exact', head: true }).eq('quiz_id', id).not('type', 'in', '(text,page_break)');
    if (!count) return { error: t('needQuestion') };
  }
  const { data: quiz } = await supabase.from('quizzes').update({ status, ...(status === 'published' ? { published_at: new Date().toISOString() } : {}) })
    .eq('id', id).select('*').single();
  if (quiz) await syncMaterial(quiz);
  revalidatePath(`/checks/${id}`);
  return { ok: true };
}

export async function releaseResults(id: string, released: boolean) {
  await viewerOrThrow();
  const supabase = await createClient();
  await supabase.from('quizzes').update({ released }).eq('id', id);
  revalidatePath(`/checks/${id}`);
}

export async function deleteCheck(id: string) {
  await viewerOrThrow();
  const supabase = await createClient();
  const { data: q } = await supabase.from('quizzes').select('class_id').eq('id', id).maybeSingle();
  await supabase.from('quizzes').delete().eq('id', id);
  if (q) { revalidatePath(`/classes/${q.class_id}`); redirect(`/classes/${q.class_id}?tab=materials`); }
}

// ---------------------------------------------------------------------------- students + grading
export async function submitCheck(quizId: string, answers: Record<string, unknown>) {
  await viewerOrThrow();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('quiz_submit', { p_quiz: quizId, p_answers: answers });
  if (error) {
    const known = ['You already turned this in.', 'This check is closed.'];
    return { error: known.includes(error.message) ? error.message : (await getTranslations('common'))('somethingWrong') };
  }
  revalidatePath(`/checks/${quizId}`);
  return { ok: true, result: data };
}

export async function gradeAttempt(_: State, fd: FormData): Promise<State> {
  await viewerOrThrow();
  const quizId = String(fd.get('quiz_id') ?? '');
  const points: Record<string, number> = {};
  for (const [k, v] of fd.entries()) if (k.startsWith('pts_') && String(v).trim() !== '') points[k.slice(4)] = Number(v);
  const supabase = await createClient();
  const { error } = await supabase.rpc('quiz_grade', { p_attempt: String(fd.get('attempt_id') ?? ''), p_points: points, p_feedback: String(fd.get('feedback') ?? '') });
  if (error) return { error: (await getTranslations('common'))('somethingWrong') };
  revalidatePath(`/checks/${quizId}`);
  return { ok: true, message: (await getTranslations('common'))('saved') };
}

export async function resetAttempt(quizId: string, attemptId: string) {
  await viewerOrThrow();
  const supabase = await createClient();
  await supabase.from('quiz_attempts').delete().eq('id', attemptId);
  revalidatePath(`/checks/${quizId}`);
}

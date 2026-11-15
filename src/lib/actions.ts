'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getTranslations } from 'next-intl/server';
import { createClient } from './supabase/server';
import { linkClient } from './supabase/link';
import { getFlags, getViewer } from './data';
import { LOCALE_COOKIE, isLocale } from './brand';
import { DEMO_ACCOUNTS, type DemoKind } from './demo';
import { safeUrl, slugify, splitList } from './util';

export type ActionState = { ok?: boolean; error?: string; message?: string; data?: unknown } | null;

const YEAR = 60 * 60 * 24 * 365;

async function origin() {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https');
  return `${proto}://${host}`;
}

/** Translate known database messages; fall back to the generic error. */
async function friendly(err: { message?: string; code?: string } | null | undefined) {
  const t = await getTranslations();
  const m = err?.message ?? '';
  if (/rate limit|too many/i.test(m)) return t('auth.rateLimited');
  if (/duplicate key.*slug/i.test(m)) return t('studio.slugTaken');
  const known = [
    'Add your work before submitting.', 'Links must start with http:// or https://',
    'This work was already returned by your teacher.',
  ];
  if (known.includes(m)) return m;
  return m && process.env.NODE_ENV !== 'production' ? `${t('common.somethingWrong')} (${m})` : t('common.somethingWrong');
}

// ---------------------------------------------------------------------------
// Preferences
// ---------------------------------------------------------------------------
export async function setLocale(locale: string) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: '/', maxAge: YEAR, sameSite: 'lax' });
  const viewer = await getViewer();
  if (viewer) {
    const supabase = await createClient();
    await supabase.from('profiles').update({ locale }).eq('id', viewer.id);
  }
  revalidatePath('/', 'layout');
}

export async function setTheme(theme: string) {
  const store = await cookies();
  if (theme === 'light') store.set('NEXORA_THEME', 'light', { path: '/', maxAge: YEAR, sameSite: 'lax' });
  else store.delete('NEXORA_THEME');
  revalidatePath('/', 'layout');
}

/** Living Interface: motion level and companion visibility (per device, like a display setting). */
export async function setLiving(opts: { motion?: string; companion?: boolean }) {
  const store = await cookies();
  if (opts.motion === 'full' || opts.motion === 'reduced' || opts.motion === 'static') {
    store.set('NEXORA_MOTION', opts.motion, { path: '/', maxAge: YEAR, sameSite: 'lax' });
  }
  if (typeof opts.companion === 'boolean') {
    store.set('NEXORA_COMPANION', opts.companion ? 'on' : 'off', { path: '/', maxAge: YEAR, sameSite: 'lax' });
  }
  revalidatePath('/', 'layout');
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
/**
 * Supabase answers 429 in two very different ways. The per-address request limit clears in
 * seconds, so the form (useQueuedAction) waits its turn and tries again by itself. The hourly
 * cap on sign-up emails does not clear, so say that plainly and don't hammer it.
 */
function limited(t: Awaited<ReturnType<typeof getTranslations>>, error: { code?: string; message?: string }): ActionState {
  if (error.code === 'over_email_send_rate_limit' || /email rate limit/i.test(error.message ?? '')) {
    return { error: (t as (k: string) => string)('emailLimit'), data: 'email-limit' };
  }
  return { error: (t as (k: string) => string)('rateLimited'), data: 'busy' };
}

const nextPath = (v: FormDataEntryValue | null) => {
  const s = typeof v === 'string' ? v : '';
  return s.startsWith('/') && !s.startsWith('//') ? s : '/home';
};

export async function signIn(_: ActionState, fd: FormData): Promise<ActionState> {
  const t = await getTranslations('auth');
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(fd.get('email') ?? '').trim(),
    password: String(fd.get('password') ?? ''),
  });
  if (error) {
    if (/confirm/i.test(error.message)) return { error: t('unconfirmed') };
    if (error.status === 429) return limited(t, error);
    return { error: t('badCredentials') };
  }
  await syncLocaleFromProfile();
  redirect(nextPath(fd.get('next')));
}

export async function signUp(_: ActionState, fd: FormData): Promise<ActionState> {
  const t = await getTranslations('auth');
  const email = String(fd.get('email') ?? '').trim();
  const password = String(fd.get('password') ?? '');
  if (password.length < 8) return { error: t('passwordShort') };
  const role = fd.get('role') === 'teacher' ? 'teacher' : 'student';
  const store = await cookies();
  const locale = isLocale(store.get(LOCALE_COOKIE)?.value) ? store.get(LOCALE_COOKIE)!.value : 'en';
  const next = nextPath(fd.get('next'));
  // linkClient: the confirmation link must work in any browser (Gmail app, phone, school laptop).
  const { data, error } = await linkClient().auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${await origin()}/auth/finish?next=${encodeURIComponent(next)}`,
      data: { display_name: String(fd.get('display_name') ?? '').trim().slice(0, 80), role, locale },
    },
  });
  if (error) return error.status === 429 ? limited(t, error) : { error: await friendly(error) };
  // Supabase answers a sign-up for an email that already has an account with a "success" that
  // sends nothing (so strangers can't probe who has an account). Tell the person who typed it.
  if (data.user && (data.user.identities?.length ?? 0) === 0) return { error: t('alreadyRegistered'), data: 'exists' };
  if (data.session) {
    // "Confirm email" is off: sign them in on this browser straight away.
    await (await createClient()).auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
    redirect(next);
  }
  return { ok: true, message: t('checkEmailBody', { email }) };
}

/** Forgot password: email a link that signs the person in and opens /reset-password. */
export async function requestPasswordReset(_: ActionState, fd: FormData): Promise<ActionState> {
  const t = await getTranslations('auth');
  const email = String(fd.get('email') ?? '').trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: t('emailInvalid') };
  const { error } = await linkClient().auth.resetPasswordForEmail(email, {
    redirectTo: `${await origin()}/auth/finish?next=${encodeURIComponent('/reset-password')}`,
  });
  if (error?.status === 429) return { error: t('rateLimited') };
  // Same answer whether or not the email has an account.
  return { ok: true, message: t('resetSent', { email }) };
}

/** Set a new password (the reset link already signed the person in). */
export async function updatePassword(_: ActionState, fd: FormData): Promise<ActionState> {
  const t = await getTranslations('auth');
  const password = String(fd.get('password') ?? '');
  if (password.length < 8) return { error: t('passwordShort') };
  if (password !== String(fd.get('confirm') ?? '')) return { error: t('passwordMismatch') };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: t('resetExpired') };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: /different from the old/i.test(error.message) ? t('passwordSame') : error.status === 429 ? t('rateLimited') : await friendly(error) };
  redirect('/home');
}

export async function demoSignIn(kind: DemoKind) {
  const flags = await getFlags();
  if (!flags.demo_accounts || !(kind in DEMO_ACCOUNTS)) redirect('/login');
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(DEMO_ACCOUNTS[kind]);
  if (error) redirect('/login?error=demo');
  redirect('/home');
}

/** After the browser signs someone in itself (see auth-client.ts): apply their saved language. */
export async function finishSignIn() {
  await syncLocaleFromProfile();
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}

async function syncLocaleFromProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data } = await supabase.from('profiles').select('locale').eq('id', user.id).single();
  const store = await cookies();
  const cookieLocale = store.get(LOCALE_COOKIE)?.value;
  // A language chosen on the login screen wins and is saved to the profile.
  if (isLocale(cookieLocale) && cookieLocale !== data?.locale) {
    await supabase.from('profiles').update({ locale: cookieLocale }).eq('id', user.id);
  } else if (data && isLocale(data.locale)) {
    store.set(LOCALE_COOKIE, data.locale, { path: '/', maxAge: YEAR, sameSite: 'lax' });
  }
}

async function requireViewer() {
  const v = await getViewer();
  if (!v) redirect('/login');
  return v;
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------
export async function updateProfile(_: ActionState, fd: FormData): Promise<ActionState> {
  const v = await requireViewer();
  const t = await getTranslations('common');
  const supabase = await createClient();
  const { error } = await supabase.from('profiles').update({
    display_name: String(fd.get('display_name') ?? '').trim().slice(0, 80) || v.profile.display_name,
    bio: String(fd.get('bio') ?? '').trim().slice(0, 600) || null,
  }).eq('id', v.id);
  if (error) return { error: await friendly(error) };
  revalidatePath('/', 'layout');
  return { ok: true, message: t('saved') };
}

// ---------------------------------------------------------------------------
// Library
// ---------------------------------------------------------------------------
export async function toggleFavorite(experienceId: string, on: boolean) {
  const v = await requireViewer();
  const supabase = await createClient();
  if (on) await supabase.from('favorites').upsert({ user_id: v.id, experience_id: experienceId });
  else await supabase.from('favorites').delete().eq('user_id', v.id).eq('experience_id', experienceId);
  revalidatePath('/library');
}

export async function recordLaunch(experienceId: string) {
  const v = await getViewer();
  if (!v) return;
  const supabase = await createClient();
  await supabase.rpc('record_launch', { p_experience_id: experienceId });
}

export async function remixExperience(experienceId: string) {
  await requireViewer();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('remix_experience', { p_experience_id: experienceId });
  if (error || !data) redirect('/teach?error=remix');
  redirect(`/teach/${data}?remixed=1`);
}

const experienceSchema = z.object({
  title_en: z.string().trim().min(1).max(200),
  title_es: z.string().trim().max(200).optional(),
  type: z.enum(['lesson', 'lecture', 'website', 'simulation', 'lab', 'project', 'game', 'quiz', 'video', 'tool', 'career', 'coding', 'cad', 'assessment', 'field_trip', 'other',
    'document', 'presentation', 'spreadsheet', 'image', 'audio', 'model3d', 'file', 'app']),
  visibility: z.enum(['private', 'organization', 'public']),
  status: z.enum(['draft', 'published', 'archived']),
  difficulty: z.enum(['', 'Beginner', 'Intermediate', 'Advanced']),
});

export async function saveExperience(_: ActionState, fd: FormData): Promise<ActionState> {
  const v = await requireViewer();
  if (!v.isEducator) return { error: (await getTranslations('common'))('somethingWrong') };
  const get = (k: string) => String(fd.get(k) ?? '').trim();
  const parsed = experienceSchema.safeParse({
    title_en: get('title_en'), title_es: get('title_es'), type: get('type') || 'website',
    visibility: get('visibility') || 'private', status: get('status') || 'draft', difficulty: get('difficulty'),
  });
  if (!parsed.success) return { error: (await getTranslations('common'))('somethingWrong') };
  const p = parsed.data;
  const source = ['link', 'file', 'app'].includes(get('source')) ? get('source') : 'link';
  const url = safeUrl(get('resource_url'));
  const duration = parseInt(get('duration_minutes'), 10);
  const worldId = get('world_id') || null;
  // A file must sit in this teacher's own storage folder (the storage policy enforces the same).
  const filePath = source === 'file' ? get('file_path') : '';
  if (source === 'file' && (!filePath || !filePath.startsWith(`${v.id}/`))) return { error: (await getTranslations('files'))('chooseFile') };
  let appId: string | null = null; let launchMode = 'embed'; let appUrl: string | null = null;
  if (source === 'app') {
    const supa = await createClient();
    const { data: app } = await supa.from('apps').select('id,url,launch_mode').eq('id', get('app_id')).maybeSingle();
    if (!app) return { error: (await getTranslations('apps'))('choose') };
    appId = app.id; launchMode = app.launch_mode; appUrl = url ?? app.url;
  }
  const row = {
    source,
    file_path: source === 'file' ? filePath : null,
    file_name: source === 'file' ? get('file_name').slice(0, 200) : null,
    file_mime: source === 'file' ? get('file_mime').slice(0, 120) || null : null,
    file_size: source === 'file' ? parseInt(get('file_size'), 10) || null : null,
    app_id: appId,
    launch_mode: source === 'app' ? launchMode : get('launch_mode') === 'newtab' ? 'newtab' : 'embed',
    type: p.type, visibility: p.visibility, status: p.status,
    difficulty: p.difficulty || null,
    subject: get('subject') || null,
    grade_range: get('grade_range') || null,
    duration_minutes: Number.isFinite(duration) && duration > 0 ? Math.min(duration, 10000) : null,
    resource_url: source === 'app' ? appUrl : source === 'link' ? url : null,
    embed_url: source === 'link' ? url : null,
    worksheet_url: safeUrl(get('worksheet_url')),
    world_id: worldId,
    tags: splitList(get('tags')),
    skills: splitList(get('skills')),
  };
  const supabase = await createClient();
  let id = get('id');
  let slug = get('slug');
  if (id) {
    const { error } = await supabase.from('experiences').update(row).eq('id', id);
    if (error) return { error: await friendly(error) };
  } else {
    slug = `${slugify(p.title_en)}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await supabase.from('experiences')
      .insert({ ...row, slug, creator_id: v.id, creator_name: v.profile.display_name, default_locale: 'en' })
      .select('id').single();
    if (error || !data) return { error: await friendly(error) };
    id = data.id;
  }
  const translations = [
    { experience_id: id, locale: 'en', title: p.title_en, short_description: get('short_en') || null,
      learning_objective: get('objective_en') || null, student_instructions: get('instructions_en') || null },
  ];
  if (p.title_es) {
    translations.push({ experience_id: id, locale: 'es', title: p.title_es, short_description: get('short_es') || null,
      learning_objective: get('objective_es') || null, student_instructions: get('instructions_es') || null });
  } else {
    await supabase.from('experience_translations').delete().eq('experience_id', id).eq('locale', 'es');
  }
  const { error: te } = await supabase.from('experience_translations').upsert(translations, { onConflict: 'experience_id,locale' });
  if (te) return { error: await friendly(te) };
  await supabase.from('experience_teacher_notes').upsert({ experience_id: id, locale: 'en', notes: get('notes') });
  await supabase.rpc('log_event', { p_name: get('id') ? 'experience.updated' : 'experience.created', p_entity_type: 'experience', p_entity_id: id });
  revalidatePath('/teach');
  revalidatePath('/discover');
  redirect(`/x/${slug}`);
}

export async function deleteExperience(id: string) {
  await requireViewer();
  const supabase = await createClient();
  await supabase.from('experiences').delete().eq('id', id);
  revalidatePath('/teach');
  redirect('/teach');
}

export async function snapshotExperience(id: string, slug: string) {
  await requireViewer();
  const supabase = await createClient();
  const { data } = await supabase.from('experiences').select('version').eq('id', id).single();
  await supabase.rpc('snapshot_experience', { p_experience_id: id, p_note: null });
  // Bump the minor version after each saved snapshot: 1.0 → 1.1.
  const [maj, min] = String(data?.version ?? '1.0').split('.').map((n) => parseInt(n, 10) || 0);
  await supabase.from('experiences').update({ version: `${maj}.${min + 1}` }).eq('id', id);
  revalidatePath(`/teach/${slug}`);
}

// ---------------------------------------------------------------------------
// Classes
// ---------------------------------------------------------------------------
export async function createClass(_: ActionState, fd: FormData): Promise<ActionState> {
  const v = await requireViewer();
  const name = String(fd.get('name') ?? '').trim().slice(0, 120);
  if (!v.isEducator || !name) return { error: (await getTranslations('common'))('somethingWrong') };
  const supabase = await createClient();
  const { data, error } = await supabase.from('classes').insert({
    teacher_id: v.id, name,
    section: String(fd.get('section') ?? '').trim() || null,
    subject: String(fd.get('subject') ?? '').trim() || null,
    description: String(fd.get('description') ?? '').trim() || null,
  }).select('id').single();
  if (error || !data) return { error: await friendly(error) };
  await supabase.rpc('log_event', { p_name: 'class.created', p_entity_type: 'class', p_entity_id: data.id });
  redirect(`/classes/${data.id}`);
}

export async function setClassArchived(id: string, archived: boolean) {
  await requireViewer();
  const supabase = await createClient();
  await supabase.from('classes').update({ archived }).eq('id', id);
  revalidatePath(`/classes/${id}`);
  revalidatePath('/classes');
}

export async function regenerateCode(id: string) {
  await requireViewer();
  const supabase = await createClient();
  await supabase.rpc('regenerate_join_code', { p_class_id: id });
  revalidatePath(`/classes/${id}`);
}

export async function removeFromClass(classId: string, userId: string) {
  const v = await requireViewer();
  const supabase = await createClient();
  await supabase.from('enrollments').delete().eq('class_id', classId).eq('user_id', userId);
  if (userId === v.id) redirect('/classes');
  revalidatePath(`/classes/${classId}`);
}

export async function joinByCode(_: ActionState, fd: FormData): Promise<ActionState> {
  const v = await getViewer();
  const code = String(fd.get('code') ?? '').trim();
  if (!v) redirect(`/login?next=${encodeURIComponent(`/join/${code}`)}`);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('join_by_code', { p_code: code });
  if (error) return { error: await friendly(error) };
  const r = data as { kind: string; id?: string; experience_slug?: string };
  if (r.kind === 'session' && r.experience_slug) redirect(`/x/${r.experience_slug}/play?session=${r.id}`);
  if (r.kind === 'class' && r.id) redirect(`/classes/${r.id}?joined=1`);
  return { error: (await getTranslations('classes'))('badCode') };
}

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------
export async function createAssignment(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireViewer();
  const classId = String(fd.get('class_id') ?? '');
  const title = String(fd.get('title') ?? '').trim().slice(0, 200);
  if (!classId || !title) return { error: (await getTranslations('common'))('somethingWrong') };
  const due = String(fd.get('due_at') ?? '');
  const tz = String(fd.get('tz_offset') ?? '0');
  const points = parseInt(String(fd.get('points') ?? ''), 10);
  const type = String(fd.get('submission_type') ?? 'text_or_url');
  const supabase = await createClient();
  const { data, error } = await supabase.from('assignments').insert({
    class_id: classId, title,
    instructions: String(fd.get('instructions') ?? '').trim() || null,
    experience_id: String(fd.get('experience_id') ?? '') || null,
    due_at: due ? localToIso(due, parseInt(tz, 10) || 0) : null,
    points: Number.isFinite(points) ? Math.max(0, Math.min(points, 10000)) : null,
    submission_type: ['text', 'url', 'text_or_url', 'file', 'any', 'none'].includes(type) ? type : 'text_or_url',
    status: fd.get('intent') === 'draft' ? 'draft' : 'published',
    created_by: (await getViewer())!.id,
    lesson_date: parseSchedule(fd).lesson_date, tag: parseSchedule(fd).tag,
    timer_minutes: parseSchedule(fd).timer_minutes ?? null, timer_mode: parseSchedule(fd).timer_mode ?? null,
  }).select('id').single();
  if (error || !data) return { error: await friendly(error) };
  await supabase.rpc('log_event', { p_name: 'assignment.created', p_entity_type: 'assignment', p_entity_id: data.id });
  const back = String(fd.get('return_to') ?? '');
  if (back.startsWith('/x/')) return { ok: true, message: (await getTranslations('experience'))('assignDone') };
  redirect(`/assignments/${data.id}`);
}

const TAGS = ['do_now', 'lecture', 'activity', 'homework', 'exit_ticket', 'resource'];

/** Lesson day, tag and due date from <ScheduleFields>. */
function parseSchedule(fd: FormData) {
  const day = String(fd.get('lesson_date') ?? '').trim();
  const tag = String(fd.get('tag') ?? '').trim();
  const due = String(fd.get('due_at') ?? '').trim();
  const tz = parseInt(String(fd.get('tz_offset') ?? '0'), 10) || 0;
  // Optional Do Now / Exit ticket timer (only when the form carried the timer setting).
  const timer: { timer_minutes?: number | null; timer_mode?: string | null } = {};
  if (fd.has('timer_present')) {
    const mode = String(fd.get('timer_mode') ?? '');
    const mins = parseInt(String(fd.get('timer_minutes') ?? ''), 10);
    const ok = (tag === 'do_now' || tag === 'exit_ticket') && (mode === 'manual' || mode === 'bell') && mins >= 1 && mins <= 60;
    timer.timer_minutes = ok ? mins : null;
    timer.timer_mode = ok ? mode : null;
  }
  return {
    lesson_date: /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null,
    tag: TAGS.includes(tag) ? tag : null,
    due_at: due ? localToIso(due, tz) : null,
    ...timer,
  };
}

/** Schedule dialog: change day / tag / due date of a material or assignment. */
export async function scheduleItem(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireViewer();
  const type = String(fd.get('type') ?? '');
  const id = String(fd.get('id') ?? '');
  const classId = String(fd.get('class_id') ?? '');
  const sch: Partial<ReturnType<typeof parseSchedule>> = parseSchedule(fd);
  if (!fd.has('due_at')) delete sch.due_at; // assignments keep their own due date
  const supabase = await createClient();
  const { error } = type === 'assignment'
    ? await supabase.from('assignments').update(sch).eq('id', id).select('id').single()
    : await supabase.from('class_materials').update(sch).eq('id', id).select('id').single();
  if (error) return { error: await friendly(error) };
  revalidatePath(`/classes/${classId}`);
  if (type === 'assignment') revalidatePath(`/assignments/${id}`);
  return { ok: true, message: (await getTranslations('common'))('saved') };
}

/** One-click menu shortcuts: "Today's Do Now", "Today's lecture", "Remove from a day". */
export async function quickSchedule(type: 'material' | 'assignment', id: string, classId: string, patch: { lesson_date: string | null; tag?: string | null }) {
  await requireViewer();
  const clean: Record<string, unknown> = {
    lesson_date: patch.lesson_date && /^\d{4}-\d{2}-\d{2}$/.test(patch.lesson_date) ? patch.lesson_date : null,
  };
  if (patch.tag !== undefined) clean.tag = patch.tag && TAGS.includes(patch.tag) ? patch.tag : null;
  const supabase = await createClient();
  await (type === 'assignment' ? supabase.from('assignments') : supabase.from('class_materials')).update(clean).eq('id', id);
  revalidatePath(`/classes/${classId}`);
}

/** Everything Nova needs to answer "what are we doing today?" (RLS-checked RPC). */
export async function getNovaBrief() {
  const v = await getViewer();
  if (!v) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('nova_brief');
  if (error || !data) return null;
  const full = (v.profile.display_name || '').trim();
  const first = full.split(/\s+/)[0] ?? '';
  // "Mr. C" stays "Mr. C"; "Alex Rivera" becomes "Alex".
  const name = /^(mr|mrs|ms|mx|dr|prof|sr|sra|srta)\.?$/i.test(first) ? full : first;
  return { ...(data as Record<string, unknown>), name: name || null, educator: v.isEducator } as unknown;
}

/** <input type="datetime-local"> gives wall-clock time; the browser sends its UTC offset in minutes. */
function localToIso(local: string, offsetMinutes: number) {
  const d = new Date(`${local}:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() + offsetMinutes * 60_000).toISOString();
}

export async function publishAssignment(id: string) {
  await requireViewer();
  const supabase = await createClient();
  await supabase.from('assignments').update({ status: 'published' }).eq('id', id);
  revalidatePath(`/assignments/${id}`);
}

export async function deleteAssignment(id: string, classId: string) {
  await requireViewer();
  const supabase = await createClient();
  await supabase.from('assignments').delete().eq('id', id);
  redirect(`/classes/${classId}`);
}

export async function submitAssignment(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireViewer();
  const id = String(fd.get('assignment_id') ?? '');
  const supabase = await createClient();
  const { error } = await supabase.rpc('submit_assignment', {
    p_assignment_id: id,
    p_body: String(fd.get('body') ?? '').slice(0, 20000),
    p_url: String(fd.get('url') ?? '').trim(),
    p_files: parseFiles(fd.get('files')),
  });
  if (error) return { error: await friendly(error) };
  revalidatePath(`/assignments/${id}`);
  revalidatePath('/home');
  return { ok: true, message: (await getTranslations('common'))('saved') };
}

function parseFiles(v: FormDataEntryValue | null) {
  try {
    const arr = JSON.parse(String(v ?? '[]'));
    if (!Array.isArray(arr)) return [];
    return arr.slice(0, 10).map((f) => ({
      path: String(f.path ?? ''), name: String(f.name ?? '').slice(0, 200),
      mime: String(f.mime ?? '').slice(0, 120), size: Number(f.size) || 0,
    }));
  } catch { return []; }
}

export async function gradeSubmission(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireViewer();
  const id = String(fd.get('submission_id') ?? '');
  const raw = String(fd.get('score') ?? '').trim();
  const score = raw === '' ? null : Number(raw);
  const supabase = await createClient();
  const { error } = await supabase.rpc('grade_submission', {
    p_submission_id: id,
    p_score: score !== null && Number.isFinite(score) ? score : null,
    p_feedback: String(fd.get('feedback') ?? '').slice(0, 5000),
  });
  if (error) return { error: await friendly(error) };
  revalidatePath(`/assignments/${fd.get('assignment_id')}`);
  return { ok: true, message: (await getTranslations('assignment'))('returned') };
}

export async function reopenSubmission(submissionId: string, assignmentId: string) {
  await requireViewer();
  const supabase = await createClient();
  await supabase.rpc('reopen_submission', { p_submission_id: submissionId });
  revalidatePath(`/assignments/${assignmentId}`);
}

// ---------------------------------------------------------------------------
// Portfolio
// ---------------------------------------------------------------------------
export async function addPortfolioItem(_: ActionState, fd: FormData): Promise<ActionState> {
  const v = await requireViewer();
  const title = String(fd.get('title') ?? '').trim().slice(0, 200);
  if (!title) return { error: (await getTranslations('common'))('somethingWrong') };
  const vis = String(fd.get('visibility') ?? 'private');
  const supabase = await createClient();
  const { error } = await supabase.from('portfolio_items').insert({
    user_id: v.id, title,
    description: String(fd.get('description') ?? '').trim() || null,
    url: safeUrl(String(fd.get('url') ?? '')),
    reflection: String(fd.get('reflection') ?? '').trim() || null,
    skills: splitList(String(fd.get('skills') ?? '')),
    tools: splitList(String(fd.get('tools') ?? '')),
    completed_on: String(fd.get('completed_on') ?? '') || null,
    submission_id: String(fd.get('submission_id') ?? '') || null,
    experience_id: String(fd.get('experience_id') ?? '') || null,
    visibility: ['private', 'teachers', 'public'].includes(vis) ? vis : 'private',
  });
  if (error) return { error: await friendly(error) };
  await supabase.rpc('log_event', { p_name: 'portfolio.item_added', p_entity_type: 'portfolio_item', p_entity_id: null });
  revalidatePath('/portfolio');
  if (fd.get('submission_id')) return { ok: true, message: (await getTranslations('assignment'))('addedToPortfolio') };
  redirect('/portfolio');
}

export async function setPortfolioVisibility(id: string, visibility: string) {
  await requireViewer();
  if (!['private', 'teachers', 'public'].includes(visibility)) return;
  const supabase = await createClient();
  await supabase.from('portfolio_items').update({ visibility }).eq('id', id);
  revalidatePath('/portfolio');
}

export async function deletePortfolioItem(id: string) {
  await requireViewer();
  const supabase = await createClient();
  await supabase.from('portfolio_items').delete().eq('id', id);
  revalidatePath('/portfolio');
}

// ---------------------------------------------------------------------------
// Live sessions
// ---------------------------------------------------------------------------
export async function startSession(fd: FormData) {
  await requireViewer();
  const slug = String(fd.get('slug') ?? '');
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('start_session', {
    p_experience_id: String(fd.get('experience_id') ?? ''),
    p_class_id: String(fd.get('class_id') ?? '') || null,
    p_locale_mode: String(fd.get('locale_mode') ?? 'en'),
  });
  if (error || !data) redirect(`/present/${slug}?error=1`);
  redirect(`/present/${slug}?s=${(data as { id: string }).id}`);
}

export async function endSession(sessionId: string, slug: string) {
  await requireViewer();
  const supabase = await createClient();
  await supabase.rpc('end_session', { p_session_id: sessionId });
  redirect(`/x/${slug}`);
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------
export async function adminSetRole(userId: string, role: string) {
  await requireViewer();
  if (!['student', 'teacher', 'admin'].includes(role)) return;
  const supabase = await createClient();
  await supabase.rpc('admin_set_role', { p_user_id: userId, p_role: role });
  revalidatePath('/admin');
}

export async function adminSetFlag(key: string, enabled: boolean) {
  await requireViewer();
  const supabase = await createClient();
  await supabase.rpc('admin_set_flag', { p_key: key, p_enabled: enabled });
  revalidatePath('/admin');
}

/** NEXORA Live: rebuild the demo class so it shows "today" (platform admins only; see 0016_demo_live_class.sql). */
export async function adminResetDemo(): Promise<{ ok: boolean; day?: string }> {
  await requireViewer();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('demo_live_reset');
  revalidatePath('/', 'layout');
  const r = (data ?? {}) as { ok?: boolean; day?: string };
  return { ok: !error && !!r.ok, day: r.day };
}

// ---------------------------------------------------------------------------
// Search (command palette)
// ---------------------------------------------------------------------------
export interface SearchHit { kind: 'experience' | 'world' | 'class'; title: string; sub?: string; href: string }

export async function searchAll(q: string): Promise<SearchHit[]> {
  const term = q.trim().slice(0, 100);
  if (!term) return [];
  const store = await cookies();
  const locale = isLocale(store.get(LOCALE_COOKIE)?.value) ? store.get(LOCALE_COOKIE)!.value : 'en';
  const supabase = await createClient();
  const safe = term.replace(/[^\p{L}\p{N} &'-]+/gu, ' ').trim();
  const like = `%${safe}%`;
  const [hits, worlds, classes] = await Promise.all([
    supabase.rpc('search_experiences', { q: term, max_results: 8 }),
    supabase.from('worlds').select('slug,name,name_es').or(`name.ilike.${like},name_es.ilike.${like}`).limit(4),
    (await getViewer()) ? supabase.from('classes').select('id,name,section').ilike('name', like).limit(4) : Promise.resolve({ data: [] }),
  ]);
  const ids = ((hits.data ?? []) as { experience_id: string }[]).map((h) => h.experience_id);
  let exps: SearchHit[] = [];
  if (ids.length) {
    const { data } = await supabase.from('experiences')
      .select('id,slug,type,experience_translations(locale,title)').in('id', ids);
    const byId = new Map((data ?? []).map((x) => [x.id, x]));
    exps = ids.map((id) => byId.get(id)).filter(Boolean).map((x) => {
      const tr = x!.experience_translations as { locale: string; title: string }[];
      const title = (tr.find((r) => r.locale === locale) ?? tr[0])?.title ?? x!.slug;
      return { kind: 'experience' as const, title, sub: x!.type, href: `/x/${x!.slug}` };
    });
  }
  return [
    ...exps,
    ...(worlds.data ?? []).map((w) => ({ kind: 'world' as const, title: locale === 'es' && w.name_es ? w.name_es : w.name, href: `/worlds/${w.slug}` })),
    ...((classes.data ?? []) as { id: string; name: string; section: string | null }[]).map((c) => ({ kind: 'class' as const, title: c.name, sub: c.section ?? undefined, href: `/classes/${c.id}` })),
  ];
}

export async function exportMyData() {
  await requireViewer();
  const supabase = await createClient();
  const { data } = await supabase.rpc('export_my_data');
  return data;
}

// ---------------------------------------------------------------------------
// Course materials (Schoology-style folders), course updates, App Center
// ---------------------------------------------------------------------------
export async function addMaterial(_: ActionState, fd: FormData): Promise<ActionState> {
  const v = await requireViewer();
  const get = (k: string) => String(fd.get(k) ?? '').trim();
  const classId = get('class_id');
  const kind = get('kind');
  const tf = await getTranslations('files');
  if (!['folder', 'experience', 'link', 'file', 'page', 'app'].includes(kind)) return { error: tf('failedGeneric') };
  const supabase = await createClient();
  const row: Record<string, unknown> = {
    class_id: classId, parent_id: get('parent_id') || null, kind,
    title: get('title').slice(0, 200), body: get('body').slice(0, 20000) || null,
    color: get('color') || null, created_by: v.id, published: get('published') !== 'false',
  };
  if (kind !== 'folder') Object.assign(row, parseSchedule(fd));
  if (kind === 'link') {
    const url = safeUrl(get('url'));
    if (!url || url.startsWith('/')) return { error: tf('badLink') };
    row.url = url;
  }
  if (kind === 'file') {
    const path = get('file_path');
    if (!path.startsWith(`${v.id}/`)) return { error: tf('chooseFile') };
    Object.assign(row, { file_path: path, file_name: get('file_name').slice(0, 200), file_mime: get('file_mime') || null, file_size: parseInt(get('file_size'), 10) || null });
    if (!row.title) row.title = get('file_name').slice(0, 200);
  }
  if (kind === 'experience') {
    const { data: x } = await supabase.from('experiences').select('id,experience_translations(locale,title)').eq('id', get('experience_id')).maybeSingle();
    if (!x) return { error: tf('failedGeneric') };
    row.experience_id = x.id;
    if (!row.title) row.title = ((x.experience_translations as { title: string }[])[0]?.title ?? 'Experience').slice(0, 200);
  }
  if (kind === 'app') {
    const { data: a } = await supabase.from('apps').select('id,name').eq('id', get('app_id')).maybeSingle();
    if (!a) return { error: tf('failedGeneric') };
    row.app_id = a.id;
    const url = safeUrl(get('url'));
    if (url && !url.startsWith('/')) row.url = url;
    if (!row.title) row.title = a.name;
  }
  if (!row.title) return { error: tf('needTitle') };
  const { count } = await supabase.from('class_materials').select('id', { count: 'exact', head: true }).eq('class_id', classId);
  row.position = (count ?? 0) + 1;
  const { error } = await supabase.from('class_materials').insert(row);
  if (error) return { error: await friendly(error) };
  revalidatePath(`/classes/${classId}`);
  return { ok: true, message: (await getTranslations('common'))('saved') };
}

export async function updateMaterial(id: string, classId: string, patch: { title?: string; published?: boolean; parent_id?: string | null }) {
  await requireViewer();
  const supabase = await createClient();
  const clean: Record<string, unknown> = {};
  if (typeof patch.title === 'string' && patch.title.trim()) clean.title = patch.title.trim().slice(0, 200);
  if (typeof patch.published === 'boolean') clean.published = patch.published;
  if (patch.parent_id !== undefined && patch.parent_id !== id) clean.parent_id = patch.parent_id || null;
  await supabase.from('class_materials').update(clean).eq('id', id);
  revalidatePath(`/classes/${classId}`);
}

export async function deleteMaterial(id: string, classId: string) {
  await requireViewer();
  const supabase = await createClient();
  await supabase.from('class_materials').delete().eq('id', id);
  revalidatePath(`/classes/${classId}`);
}

export async function postUpdate(_: ActionState, fd: FormData): Promise<ActionState> {
  const v = await requireViewer();
  const classId = String(fd.get('class_id') ?? '');
  const body = String(fd.get('body') ?? '').trim().slice(0, 5000);
  if (!body) return { error: (await getTranslations('files'))('needTitle') };
  const supabase = await createClient();
  const { error } = await supabase.from('class_updates').insert({ class_id: classId, author_id: v.id, body, pinned: fd.get('pinned') === 'on' });
  if (error) return { error: await friendly(error) };
  revalidatePath(`/classes/${classId}`);
  return { ok: true };
}

export async function deleteUpdate(id: string, classId: string) {
  await requireViewer();
  const supabase = await createClient();
  await supabase.from('class_updates').delete().eq('id', id);
  revalidatePath(`/classes/${classId}`);
}

export async function createApp(_: ActionState, fd: FormData): Promise<ActionState> {
  const v = await requireViewer();
  const ta = await getTranslations('apps');
  if (!v.isEducator) return { error: ta('educatorsOnly') };
  const name = String(fd.get('name') ?? '').trim().slice(0, 80);
  const url = safeUrl(String(fd.get('url') ?? ''));
  if (!name || !url || !url.startsWith('https://')) return { error: ta('needHttps') };
  const color = /^#[0-9a-f]{6}$/i.test(String(fd.get('color'))) ? String(fd.get('color')) : '#8758FF';
  const category = ['lms', 'cad', 'google', 'productivity', 'create', 'media', 'engage', 'math', 'science', 'learn', 'cte', 'research', 'games', 'other']
    .includes(String(fd.get('category'))) ? String(fd.get('category')) : 'other';
  const supabase = await createClient();
  const { error } = await supabase.from('apps').insert({
    slug: `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`, name, url, color, category,
    launch_mode: fd.get('launch_mode') === 'embed' ? 'embed' : 'newtab',
    description: String(fd.get('description') ?? '').trim().slice(0, 300) || null,
    owner_id: v.id, visibility: fd.get('visibility') === 'public' ? 'public' : 'private',
  });
  if (error) return { error: await friendly(error) };
  revalidatePath('/apps');
  return { ok: true, message: ta('added') };
}

export async function deleteApp(id: string) {
  await requireViewer();
  const supabase = await createClient();
  await supabase.from('apps').delete().eq('id', id);
  revalidatePath('/apps');
}

export async function pinApp(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireViewer();
  const classId = String(fd.get('class_id') ?? '');
  const appId = String(fd.get('app_id') ?? '');
  const override = safeUrl(String(fd.get('url_override') ?? ''));
  const supabase = await createClient();
  const { error } = await supabase.from('class_apps').upsert({
    class_id: classId, app_id: appId, url_override: override && override.startsWith('https://') ? override : null,
  });
  if (error) return { error: await friendly(error) };
  revalidatePath(`/classes/${classId}`);
  revalidatePath('/apps');
  return { ok: true, message: (await getTranslations('apps'))('pinned') };
}

export async function unpinApp(classId: string, appId: string) {
  await requireViewer();
  const supabase = await createClient();
  await supabase.from('class_apps').delete().eq('class_id', classId).eq('app_id', appId);
  revalidatePath(`/classes/${classId}`);
}

/** Short-lived links so teachers and students can open private submission files. */
export async function signSubmissionFiles(paths: string[]) {
  await requireViewer();
  if (!paths.length) return {};
  const supabase = await createClient();
  const { data } = await supabase.storage.from('submission-files').createSignedUrls(paths.slice(0, 50), 60 * 60);
  return Object.fromEntries((data ?? []).filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
}

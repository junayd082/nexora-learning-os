'use client';

import { browserClient } from '@/lib/supabase/browser';
import { linkClient } from '@/lib/supabase/link';
import { finishSignIn } from '@/lib/actions';
import type { ActionState } from '@/lib/actions';

/**
 * Sign in and sign up from the student's own browser, not from NEXORA's server.
 *
 * Supabase limits sign-ups and sign-ins per internet address (about 30 per 5 minutes). When the
 * server makes the call, every student on the planet arrives from the same few Vercel addresses
 * and shares one allowance. From the browser, each student arrives from their own address and has
 * their own. The session cookie is the same one the server already reads, so nothing else changes.
 *
 * Both functions return the same shape the old server actions did, so the forms, the queue
 * (useQueuedAction) and the messages are unchanged: data 'busy' means "wait and retry",
 * data 'email-limit' means the hourly email cap (no retry).
 */
type T = (key: string, values?: Record<string, string | number>) => string;

const nextPath = (v: FormDataEntryValue | null) => {
  const s = typeof v === 'string' ? v : '';
  return s.startsWith('/') && !s.startsWith('//') ? s : '/home';
};

type AuthErr = { status?: number; code?: string; message?: string };

function limited(t: T, err: AuthErr): ActionState {
  if (err.code === 'over_email_send_rate_limit' || /email rate limit/i.test(err.message ?? '')) return { error: t('emailLimit'), data: 'email-limit' };
  return { error: t('rateLimited'), data: 'busy' };
}

export async function signInInBrowser(fd: FormData, t: T): Promise<ActionState> {
  const { error } = await browserClient().auth.signInWithPassword({
    email: String(fd.get('email') ?? '').trim(),
    password: String(fd.get('password') ?? ''),
  });
  if (error) {
    if (error.status === 429) return limited(t, error);
    if (/confirm/i.test(error.message)) return { error: t('unconfirmed') };
    return { error: t('badCredentials') };
  }
  try { await finishSignIn(); } catch { /* the language preference is a nicety; never block a sign-in on it */ }
  window.location.assign(nextPath(fd.get('next')));
  return { ok: true, message: t('finishWorking') };
}

export async function signUpInBrowser(fd: FormData, t: T, tc: T): Promise<ActionState> {
  const email = String(fd.get('email') ?? '').trim();
  const password = String(fd.get('password') ?? '');
  if (password.length < 8) return { error: t('passwordShort') };
  const role = fd.get('role') === 'teacher' ? 'teacher' : 'student';
  const next = nextPath(fd.get('next'));
  const locale = document.cookie.match(/NEXORA_LOCALE=(en|es)/)?.[1] ?? 'en';
  // linkClient: the confirmation link must work in any browser (Gmail app, phone, school laptop).
  const { data, error } = await linkClient().auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/finish?next=${encodeURIComponent(next)}`,
      data: { display_name: String(fd.get('display_name') ?? '').trim().slice(0, 80), role, locale },
    },
  });
  if (error) {
    if (error.status === 429) return limited(t, error);
    if (error.code === 'weak_password') return { error: t('passwordShort') };
    if (error.code === 'email_address_invalid') return { error: t('emailInvalid') };
    if (error.code === 'user_already_exists') return { error: t('alreadyRegistered'), data: 'exists' };
    return { error: tc('somethingWrong') };
  }
  // Supabase answers a sign-up for an email that already has an account with a "success" that
  // sends nothing (so strangers can't probe who has an account). Tell the person who typed it.
  if (data.user && (data.user.identities?.length ?? 0) === 0) return { error: t('alreadyRegistered'), data: 'exists' };
  if (data.session) {
    // "Confirm email" is off: sign them in on this browser straight away.
    const { error: setErr } = await browserClient().auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
    if (setErr) return { error: tc('somethingWrong') };
    try { await finishSignIn(); } catch { /* see above */ }
    window.location.assign(next);
    return { ok: true, message: t('finishWorking'), data: 'signed-in' };
  }
  return { ok: true, message: t('checkEmailBody', { email }) };
}

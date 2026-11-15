'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { browserClient } from '@/lib/supabase/browser';

function safeNext(v: string | null) {
  return v && v.startsWith('/') && !v.startsWith('//') ? v : '/home';
}

/**
 * Reads what the email link brought back and signs the person in:
 *  - #access_token=…&refresh_token=…  (implicit links: work in any browser)
 *  - ?code=…                          (older PKCE links: only in the browser that asked)
 *  - #error=…&error_code=otp_expired  (used or expired link)
 */
export function Finish() {
  const t = useTranslations('auth');
  const [state, setState] = useState<'working' | 'failed'>('working');
  const [isReset, setIsReset] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
    const next = safeNext(url.searchParams.get('next'));
    const reset = next.startsWith('/reset-password') || hash.get('type') === 'recovery';
    setIsReset(reset);
    const go = () => window.location.replace(reset ? '/reset-password' : next);
    const fail = () => {
      history.replaceState(null, '', url.pathname + url.search);
      setState('failed');
    };
    const supabase = browserClient();
    (async () => {
      const access_token = hash.get('access_token');
      const refresh_token = hash.get('refresh_token');
      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        return error ? fail() : go();
      }
      const code = url.searchParams.get('code');
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        return error ? fail() : go();
      }
      // Already signed in (e.g. the page was refreshed after success)?
      const { data } = await supabase.auth.getUser();
      return data.user ? go() : fail();
    })();
  }, []);

  if (state === 'working') return <p className="text-sm text-muted" aria-live="polite">{t('finishWorking')}</p>;
  return (
    <div role="alert" className="space-y-4 text-sm">
      <p className="text-bad">{isReset ? t('resetLinkUsed') : t('confirmLinkUsed')}</p>
      <div className="flex flex-wrap gap-3">
        {isReset
          ? <Link href="/forgot-password" className="nx-btn nx-btn-primary">{t('sendReset')}</Link>
          : <Link href="/login" className="nx-btn nx-btn-primary">{t('backToSignIn')}</Link>}
        {isReset && <Link href="/login" className="nx-btn">{t('backToSignIn')}</Link>}
      </div>
    </div>
  );
}

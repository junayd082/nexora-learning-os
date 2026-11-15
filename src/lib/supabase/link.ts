import { createClient as createPlain } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './env';

/**
 * Client used only to SEND emails (sign-up confirmation, password reset).
 * It uses the "implicit" link style: the email link carries the sign-in itself, so it works in
 * any browser — including Gmail's / Outlook's in-app browser or a different device. (The default
 * PKCE style only works in the exact browser that asked for the email, which is why reset links
 * opened from the Gmail app failed with "invalid or expired".) /auth/finish completes the sign-in.
 */
export function linkClient() {
  return createPlain(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { flowType: 'implicit', persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

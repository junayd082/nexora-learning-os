// Explicit configuration prevents preview and local builds from silently using production.
// These are publishable client credentials, but the target database still matters for isolation.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

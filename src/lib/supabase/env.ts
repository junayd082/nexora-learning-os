// The project URL and publishable key are public by design (row-level security protects the data),
// so NEXORA ships with its own project as the default. Override with .env.local to point elsewhere.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vdrdfcodtccfvctdmmyq.supabase.co';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_kjls2qjenXMIiLJUDwzcBA_vSRfRaZh';
export const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// Shared demo accounts (see supabase/migrations/0004_demo_accounts.sql). Sample data only.
export const DEMO_ACCOUNTS = {
  teacher: { email: 'demo.teacher@nexora.demo', password: 'nexora-demo-teacher' },
  student: { email: 'demo.student@nexora.demo', password: 'nexora-demo-student' },
} as const;
export type DemoKind = keyof typeof DEMO_ACCOUNTS;

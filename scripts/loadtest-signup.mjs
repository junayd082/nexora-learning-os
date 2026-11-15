// NEXORA class-day rehearsal: N students sign up, join a class and sign in again, from ONE
// internet address (your laptop), like a classroom behind one school network.
// It uses the same "busy -> wait, then try again" schedule the app's forms now use, and reports
// how many got in on the first try, how many got in eventually, and how long the room took.
//
// BEFORE YOU RUN IT
//  1. In Supabase turn "Confirm email" OFF (Authentication > Sign In / Providers > Email).
//     The script checks this with one probe account and stops if it is still on.
//  2. Make a throwaway class in NEXORA (teacher account) and copy its join code.
//  3. Use a Gmail address you own; fake students are your-name+lt1@gmail.com, +lt2, ...
//
//   export NEXT_PUBLIC_SUPABASE_URL="https://vdrdfcodtccfvctdmmyq.supabase.co"
//   export NEXT_PUBLIC_SUPABASE_ANON_KEY="sb_publishable_kjls2qjenXMIiLJUDwzcBA_vSRfRaZh"
//   export TEST_EMAIL="you@gmail.com"     # your address; fake accounts are you+lt<N>@gmail.com
//   export CODE="NXR-1234"                # the throwaway class's join code
//   node loadtest-signup.mjs 130          # 130 students, all at once
//   WAVE=30 GAP=60 node loadtest-signup.mjs 130   # waves of 30, one minute apart
//
// Tell me when it is done and I will delete the fake accounts and the throwaway class.
import { createClient } from '@supabase/supabase-js';

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BASE = process.env.TEST_EMAIL;
// CODE may be one join code or several separated by commas: students are dealt round-robin,
// so 120 students and 4 codes means 30 per class.
const CODES = (process.env.CODE || '').split(',').map((s) => s.trim()).filter(Boolean);
const CODE = CODES.join(', ');
if (!URL_ || !KEY || !BASE || !BASE.includes('@')) { console.error('Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and TEST_EMAIL first (see the top of this file).'); process.exit(1); }

const N = Number(process.argv[2] || 130);
const WAVE = Number(process.env.WAVE || N);
const GAP = Number(process.env.GAP || 0);
const DELAYS = [4, 6, 9, 13, 18, 24, 30, 30, 30, 30]; // same schedule as the app's forms
const [local, domain] = BASE.split('@');
const emailOf = (i) => `${local}+lt${i}@${domain}`;
const PASSWORD = 'LoadTest-pass-9';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pct = (a, p) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return Math.round(s[Math.min(s.length - 1, Math.floor(p * s.length))]); };
const mk = () => createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

// Run one auth call; on "busy" (429) wait and retry like the app does. Returns the outcome.
async function withQueue(call) {
  const t0 = Date.now(); let tries = 0, busy = 0;
  for (let i = 0; i <= DELAYS.length; i++) {
    tries++;
    const r = await call();
    const err = r.error;
    if (!err) return { ok: true, tries, busy, ms: Date.now() - t0, data: r.data };
    if (err.status === 429) {
      if (err.code === 'over_email_send_rate_limit' || /email rate limit/i.test(err.message)) return { ok: false, why: 'EMAIL-CAP', tries, busy, ms: Date.now() - t0 };
      busy++;
      if (i === DELAYS.length) break;
      await sleep(Math.max(2, Math.round(DELAYS[i] * (0.6 + Math.random() * 0.8))) * 1000);
      continue;
    }
    return { ok: false, why: `${err.status || ''} ${err.code || err.message}`.trim().slice(0, 80), tries, busy, ms: Date.now() - t0 };
  }
  return { ok: false, why: 'still busy after the last try', tries, busy, ms: Date.now() - t0 };
}

// Probe: is "Confirm email" really off?
console.log('Probe: creating one account to check "Confirm email" is off ...');
{
  const probe = mk();
  const r = await withQueue(() => probe.auth.signUp({ email: emailOf(0), password: PASSWORD, options: { data: { display_name: 'LoadTest Probe', role: 'student' } } }));
  if (!r.ok) { console.error('Probe failed:', r.why); process.exit(1); }
  if (!r.data?.session) { console.error('\nSTOP: "Confirm email" is still ON (the probe got no session and one email went to your inbox).\nTurn it off in Supabase > Authentication > Sign In / Providers > Email, then run again.'); process.exit(1); }
  console.log('Probe ok: sign-up returns a session straight away.\n');
}

const results = [];
const t0 = Date.now();
console.log(`Phase 1: ${N} students sign up${CODE ? ' and join ' + CODE : ''} (${WAVE >= N ? 'all at once' : `waves of ${WAVE}, ${GAP}s apart`}) ...`);
const runStudent = async (i) => {
  const sb = mk();
  const su = await withQueue(() => sb.auth.signUp({ email: emailOf(i), password: PASSWORD, options: { data: { display_name: `LoadTest ${i}`, role: 'student' } } }));
  let joined = null;
  if (su.ok && CODE && su.data?.session) {
    const j = await sb.rpc('join_by_code', { p_code: CODES[(i - 1) % CODES.length] });
    joined = !j.error && j.data?.kind === 'class';
  }
  results.push({ i, ...su, joined });
};
const waves = [];
for (let s = 1; s <= N; s += WAVE) {
  const ids = Array.from({ length: Math.min(WAVE, N - s + 1) }, (_, k) => s + k);
  waves.push(Promise.all(ids.map(runStudent)));
  if (s + WAVE <= N && GAP) await sleep(GAP * 1000);
}
await Promise.all(waves);
const signupSecs = Math.round((Date.now() - t0) / 1000);

console.log('Phase 2: everyone signs in again (like the next morning) ...');
const t1 = Date.now(); const signins = [];
const created = results.filter((r) => r.ok).map((r) => r.i);
await Promise.all(created.map(async (i) => {
  const sb = mk();
  signins.push(await withQueue(() => sb.auth.signInWithPassword({ email: emailOf(i), password: PASSWORD })));
}));
const signinSecs = Math.round((Date.now() - t1) / 1000);

const stat = (rows) => ({
  ok: rows.filter((r) => r.ok).length,
  first: rows.filter((r) => r.ok && r.tries === 1).length,
  busy: rows.reduce((a, r) => a + r.busy, 0),
  p50: pct(rows.filter((r) => r.ok).map((r) => r.ms / 1000), 0.5),
  p95: pct(rows.filter((r) => r.ok).map((r) => r.ms / 1000), 0.95),
  why: [...new Set(rows.filter((r) => !r.ok).map((r) => r.why))],
});
const a = stat(results), b = stat(signins);
const joinedN = results.filter((r) => r.joined).length;
console.log('\n===== RESULT =====');
console.log(`SIGN-UP   in ${signupSecs}s: ${a.ok}/${N} got in (${a.first} on the first try, ${a.busy} busy answers absorbed); time to get in p50 ${a.p50}s, p95 ${a.p95}s`);
if (CODE) console.log(`JOIN CLASS: ${joinedN}/${a.ok} joined the class`);
console.log(`SIGN-IN   in ${signinSecs}s: ${b.ok}/${N} got in (${b.first} on the first try, ${b.busy} busy answers absorbed); p50 ${b.p50}s, p95 ${b.p95}s`);
if (a.why.length || b.why.length) console.log('what went wrong:', [...a.why, ...b.why]);
const pass = a.ok / N >= 0.99 && b.ok / N >= 0.99 && (!CODE || joinedN === a.ok) && signupSecs < 360;
console.log(pass ? '\nPASS: the whole room got in without anyone intervening.' : '\nFAIL: see numbers above.');
console.log(`\nFake accounts left behind: ${local}+lt0 ... +lt${N}@${domain}. Tell Claude and they will be deleted.`);
process.exit(pass ? 0 : 2);

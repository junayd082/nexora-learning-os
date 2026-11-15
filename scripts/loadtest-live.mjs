// NEXORA live-connection load test.
// Opens N fake "student tabs". Each tab holds one realtime connection with 3 live channels,
// the same shape a student's browser uses (hands, hall passes, timers).
// It signs nobody in, reads nothing and writes nothing, so it cannot touch real data.
//
// Run from the nexora project folder (so @supabase/supabase-js is found):
//   set -a; source .env.local; set +a
//   node loadtest-live.mjs 300            # 300 tabs
//   SITE=https://nexoraclass.vercel.app node loadtest-live.mjs 300   # also hit the website
//
// Pass criteria printed at the end: >= 99% of tabs subscribed, join p95 under 3000 ms, zero drops.
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!URL_ || !KEY) { console.error('Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (source .env.local first).'); process.exit(1); }

const N = Number(process.argv[2] || 300);
const HOLD_S = Number(process.env.HOLD || 60);
const RAMP_S = Number(process.env.RAMP || 20);
const SITE = process.env.SITE || '';
const classId = randomUUID(); // a class that does not exist: nothing real can match
const tables = ['help_requests', 'hall_passes', 'class_timers'];

const pct = (a, p) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return Math.round(s[Math.min(s.length - 1, Math.floor(p * s.length))]); };
const clients = [];
const joinMs = [];
let subscribed = 0, failed = 0, dropped = 0;
const errors = {};

function openTab(i) {
  return new Promise((resolve) => {
    const sb = createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false }, realtime: { params: { eventsPerSecond: 10 } } });
    clients.push(sb);
    const t0 = Date.now();
    let ok = 0, done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    const timer = setTimeout(() => { failed++; errors['timeout (no SUBSCRIBED in 20s)'] = (errors['timeout (no SUBSCRIBED in 20s)'] || 0) + 1; finish(); }, 20000);
    for (const table of tables) {
      sb.channel(`${table}:${classId}:${i}`)
        .on('postgres_changes', { event: '*', schema: 'public', table, filter: `class_id=eq.${classId}` }, () => {})
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            if (++ok === tables.length && !done) { clearTimeout(timer); subscribed++; joinMs.push(Date.now() - t0); finish(); }
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            const k = `${status}${err?.message ? ': ' + String(err.message).slice(0, 80) : ''}`;
            errors[k] = (errors[k] || 0) + 1;
            if (!done) { clearTimeout(timer); failed++; finish(); } else dropped++;
          } else if (status === 'CLOSED' && done) { dropped++; }
        });
    }
  });
}

console.log(`Opening ${N} student tabs x ${tables.length} channels over ${RAMP_S}s, then holding ${HOLD_S}s ...`);
const gap = (RAMP_S * 1000) / N;
const opening = [];
for (let i = 0; i < N; i++) { opening.push(openTab(i)); await new Promise((r) => setTimeout(r, gap)); }
await Promise.all(opening);
console.log(`Connected: ${subscribed}/${N} tabs live, ${failed} failed.`);

let site = null;
if (SITE) {
  console.log(`Hitting ${SITE}/login with ${N} requests at once ...`);
  const lat = []; const codes = {};
  await Promise.all(Array.from({ length: N }, async () => {
    const t = Date.now();
    try { const r = await fetch(`${SITE}/login`, { redirect: 'manual' }); codes[r.status] = (codes[r.status] || 0) + 1; await r.arrayBuffer(); }
    catch { codes.error = (codes.error || 0) + 1; }
    lat.push(Date.now() - t);
  }));
  site = { p50: pct(lat, 0.5), p95: pct(lat, 0.95), max: Math.max(...lat), codes };
}

console.log(`Holding ${HOLD_S}s to watch for drops ...`);
await new Promise((r) => setTimeout(r, HOLD_S * 1000));
for (const sb of clients) { try { await sb.removeAllChannels(); } catch {} }

const p95 = pct(joinMs, 0.95);
const rate = subscribed / N;
console.log('\n===== RESULT =====');
console.log(`tabs requested      ${N}`);
console.log(`tabs subscribed     ${subscribed} (${(rate * 100).toFixed(1)}%)`);
console.log(`join time p50/p95   ${pct(joinMs, 0.5)} ms / ${p95} ms`);
console.log(`dropped while held  ${dropped}`);
if (site) console.log(`website p50/p95/max  ${site.p50} / ${site.p95} / ${site.max} ms  status ${JSON.stringify(site.codes)}`);
if (Object.keys(errors).length) console.log('errors:', errors);
const pass = rate >= 0.99 && p95 < 3000 && dropped === 0 && (!site || (site.p95 < 5000 && !site.codes.error));
console.log(pass ? '\nPASS' : '\nFAIL - see numbers above');
process.exit(pass ? 0 : 2);

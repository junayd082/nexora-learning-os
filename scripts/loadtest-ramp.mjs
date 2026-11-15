// NEXORA breaking-point test: add student tabs in steps until something fails.
// Each "user" is one browser tab: one realtime connection with the 3 live channels a student
// uses (hands, hall passes, timers). Nobody signs in; nothing is read or written.
//
// Run from the nexora folder:
//   export NEXT_PUBLIC_SUPABASE_URL="https://vdrdfcodtccfvctdmmyq.supabase.co"
//   export NEXT_PUBLIC_SUPABASE_ANON_KEY="sb_publishable_kjls2qjenXMIiLJUDwzcBA_vSRfRaZh"
//   node loadtest-ramp.mjs                 # +25 users per step, up to 700
//   STEP=10 MAX=300 node loadtest-ramp.mjs # finer steps
//
// A step is HEALTHY when >= 98% of its new tabs connect and no already-connected tab is dropped.
// The first unhealthy step stops the test. Your answer = the last healthy level.
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!URL_ || !KEY) { console.error('Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY first.'); process.exit(1); }

const STEP = Number(process.env.STEP || 25);
const MAX = Number(process.env.MAX || 700);
const SETTLE_S = Number(process.env.SETTLE || 10);
const classId = randomUUID(); // does not exist: nothing real can match
const tables = ['help_requests', 'hall_passes', 'class_timers'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pct = (a, p) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return Math.round(s[Math.min(s.length - 1, Math.floor(p * s.length))]); };

const tabs = [];
let ending = false;
const reasons = {};
const note = (k) => { reasons[k] = (reasons[k] || 0) + 1; };

function openTab(i) {
  const tab = { state: 'connecting', ok: 0, t0: Date.now(), ms: 0 };
  tabs.push(tab);
  tab.sb = createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false }, realtime: { params: { eventsPerSecond: 10 } } });
  for (const table of tables) {
    tab.sb.channel(`${table}:${classId}:${i}`)
      .on('postgres_changes', { event: '*', schema: 'public', table, filter: `class_id=eq.${classId}` }, () => {})
      .subscribe((status, err) => {
        if (ending) return;
        if (status === 'SUBSCRIBED') {
          if (tab.state === 'connecting' && ++tab.ok === tables.length) { tab.state = 'live'; tab.ms = Date.now() - tab.t0; }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          const why = `${status}${err?.message ? ': ' + String(err.message).slice(0, 60) : ''}`;
          if (tab.state === 'connecting') { tab.state = 'failed'; note(why); }
          else if (tab.state === 'live') { tab.state = 'dropped'; note(why); }
        }
      });
  }
}

console.log(`Ramping +${STEP} users per step (each step settles ${SETTLE_S}s), up to ${MAX}.\n`);
console.log('users  live  new-failed  dropped  join p95   verdict');
let lastHealthy = 0, firstBad = null, prevDropped = 0;
while (tabs.length < MAX) {
  const before = tabs.length;
  for (let i = 0; i < STEP; i++) { openTab(before + i); await sleep(100); }
  await sleep(SETTLE_S * 1000);
  const fresh = tabs.slice(before);
  const newFailed = fresh.filter((t) => t.state !== 'live').length;
  const dropped = tabs.filter((t) => t.state === 'dropped').length;
  const newDrops = dropped - prevDropped; prevDropped = dropped;
  const live = tabs.filter((t) => t.state === 'live').length;
  const p95 = pct(fresh.filter((t) => t.ms).map((t) => t.ms), 0.95);
  const healthy = newFailed <= Math.floor(STEP * 0.02) && newDrops === 0;
  console.log(`${String(tabs.length).padStart(5)}  ${String(live).padStart(4)}  ${String(newFailed).padStart(10)}  ${String(dropped).padStart(7)}  ${String(p95).padStart(6)} ms  ${healthy ? 'ok' : 'TROUBLE'}`);
  if (healthy) lastHealthy = tabs.length;
  else { firstBad = tabs.length; break; }
}

ending = true;
for (const t of tabs) { try { await t.sb.removeAllChannels(); } catch {} }

console.log('\n===== RESULT =====');
if (firstBad == null) {
  console.log(`No failure up to ${lastHealthy} users (the MAX you set). Raise MAX to keep going.`);
} else {
  console.log(`Last fully healthy level : ${lastHealthy} users`);
  console.log(`First trouble            : ${firstBad} users`);
  console.log(`Suggested safe number    : about ${Math.floor(lastHealthy * 0.7)} users at once (70% of the healthy level, leaves headroom)`);
  if (Object.keys(reasons).length) console.log('What broke:', reasons);
}
console.log('\n"Users" = people online at the same moment, not total students.');

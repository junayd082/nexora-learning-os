'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { browserClient } from '@/lib/supabase/browser';

/**
 * Live classroom data: raised hands and class timers.
 * Each hook loads once, then listens for database changes (Supabase Realtime, filtered by the
 * same row-level security as normal reads) and re-checks every 30 s in case a socket drops
 * (school Wi-Fi). Writes go through security-definer functions or RLS-checked updates.
 */

export type HandKind = 'question' | 'stuck' | 'tech' | 'other';
export type HandStatus = 'raised' | 'seen' | 'resolved' | 'lowered';
export interface Hand {
  id: string; class_id: string; student_id: string; kind: HandKind; note: string | null;
  page_path: string | null; page_title: string | null; status: HandStatus;
  created_at: string; seen_at: string | null; closed_at: string | null;
  student?: { display_name: string } | null;
  class?: { name: string; section: string | null } | null;
}

export interface ClassTimer {
  id: string; class_id: string; kind: 'do_now' | 'exit_ticket' | 'manual'; label: string;
  item_type: 'material' | 'assignment' | null; item_id: string | null;
  duration_s: number; ends_at: string | null; remaining_s: number | null;
  status: 'running' | 'paused' | 'done' | 'cancelled'; show_students: boolean; created_at: string;
}

const LIVE_EVENT = 'nexora:live-refresh';
/** Ask every live hook on the page to reload now (after a write from this tab). */
export const pokeLive = () => window.dispatchEvent(new Event(LIVE_EVENT));

function useLiveTable<T>(table: string, key: string | null, load: () => Promise<T[]>, filter?: string) {
  const [rows, setRows] = useState<T[]>([]);
  const [ready, setReady] = useState(false);
  const loadRef = useRef(load);
  loadRef.current = load;
  const reload = useCallback(async () => {
    try { setRows(await loadRef.current()); } catch { /* offline: keep what we have */ }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!key) return;
    void reload();
    const sb = browserClient();
    let t: ReturnType<typeof setTimeout> | null = null;
    const soon = () => { if (t) clearTimeout(t); t = setTimeout(() => void reload(), 250); };
    // Unique per hook instance: two components watching the same thing (the class card and the
    // full-screen board) must not share a channel — realtime-js returns the existing one and throws.
    // A live-update problem must never break the page: fall back to the 30-second refresh.
    let ch: ReturnType<typeof sb.channel> | null = null;
    try {
      ch = sb.channel(`${table}:${key}:${Math.random().toString(36).slice(2, 10)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) }, soon)
        .subscribe();
    } catch (e) { console.warn('Live updates unavailable for', table, e); }
    const iv = setInterval(() => void reload(), 30_000);
    const vis = () => { if (document.visibilityState === 'visible') void reload(); };
    document.addEventListener('visibilitychange', vis);
    window.addEventListener(LIVE_EVENT, soon);
    return () => {
      if (ch) void sb.removeChannel(ch); clearInterval(iv); if (t) clearTimeout(t);
      document.removeEventListener('visibilitychange', vis); window.removeEventListener(LIVE_EVENT, soon);
    };
  }, [table, key, filter, reload]);
  return { rows, ready, reload };
}

const HAND_COLS = 'id,class_id,student_id,kind,note,page_path,page_title,status,created_at,seen_at,closed_at';

/** Student: my hands that are still up (any class). */
export function useMyHands(userId: string | null) {
  return useLiveTable<Hand>('help_requests', userId ? `me-${userId}` : null, async () => {
    const { data } = await browserClient().from('help_requests')
      .select(`${HAND_COLS},class:classes(name,section)`)
      .eq('student_id', userId!).in('status', ['raised', 'seen']).order('created_at');
    return (data ?? []) as unknown as Hand[];
  }, userId ? `student_id=eq.${userId}` : undefined);
}

/**
 * Teacher: every open hand in my classes, plus today's closed ones (to show "3rd time today"
 * and a short history). RLS limits rows to classes I teach.
 */
export function useClassHands(enabled: boolean) {
  return useLiveTable<Hand>('help_requests', enabled ? 'teacher' : null, async () => {
    const since = new Date(Date.now() - 14 * 3600_000).toISOString();
    const { data } = await browserClient().from('help_requests')
      .select(`${HAND_COLS},student:profiles!help_requests_student_id_fkey(display_name),class:classes(name,section)`)
      .or(`status.in.(raised,seen),created_at.gte.${since}`)
      .order('created_at', { ascending: true }).limit(200);
    return (data ?? []) as unknown as Hand[];
  });
}

export async function raiseHand(classId: string, kind: HandKind, note: string, pagePath: string, pageTitle: string) {
  const { data, error } = await browserClient().rpc('raise_hand', {
    p_class_id: classId, p_kind: kind, p_note: note || null, p_page_path: pagePath.slice(0, 300), p_page_title: pageTitle.slice(0, 200),
  });
  if (!error) pokeLive();
  return { data: data as { id: string; position: number } | null, error };
}
export async function lowerHand(id: string) { const r = await browserClient().rpc('lower_hand', { p_id: id }); pokeLive(); return r; }
export async function handleHand(id: string, status: 'seen' | 'resolved') { const r = await browserClient().rpc('handle_hand', { p_id: id, p_status: status }); pokeLive(); return r; }
export async function clearHands(classId: string) { const r = await browserClient().rpc('clear_hands', { p_class_id: classId }); pokeLive(); return r; }

/** My place in line for an open hand (1 = next). */
export async function handPosition(id: string) {
  const { data } = await browserClient().rpc('hand_position', { p_id: id });
  return typeof data === 'number' && data > 0 ? data : null;
}

const TIMER_COLS = 'id,class_id,kind,label,item_type,item_id,duration_s,ends_at,remaining_s,status,show_students,created_at';

/** Timers that are running or paused in any of my classes (RLS: teacher's classes, or classes I'm in when shown to students). */
export function useClassTimers(key: string | null) {
  return useLiveTable<ClassTimer>('class_timers', key, async () => {
    const since = new Date(Date.now() - 6 * 3600_000).toISOString();
    const { data } = await browserClient().from('class_timers').select(TIMER_COLS)
      .in('status', ['running', 'paused']).gte('created_at', since).order('created_at', { ascending: false });
    return (data ?? []) as ClassTimer[];
  });
}

/** Seconds left on a timer at `now` (ms). */
export function secondsLeft(tm: Pick<ClassTimer, 'status' | 'ends_at' | 'remaining_s'>, now: number) {
  if (tm.status === 'paused') return Math.max(0, tm.remaining_s ?? 0);
  if (!tm.ends_at) return 0;
  return Math.max(0, Math.ceil((Date.parse(tm.ends_at) - now) / 1000));
}

export function mmss(s: number) {
  const m = Math.floor(s / 60), r = Math.max(0, Math.floor(s % 60));
  return `${m}:${String(r).padStart(2, '0')}`;
}

/** A clock that ticks every second while `active`. */
export function useTick(active: boolean, every = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(id);
  }, [active, every]);
  return now;
}

// ------------------------------------------------------------------ Timer controls (teacher; RLS-checked)
type TimerStart = { classId: string; kind: ClassTimer['kind']; label: string; seconds: number; item?: { type: 'material' | 'assignment'; id: string } | null; show: boolean };

/** Start a class timer. Any other running/paused timer in that class is replaced. */
export async function startTimer(o: TimerStart) {
  const sb = browserClient();
  await sb.from('class_timers').update({ status: 'cancelled' }).eq('class_id', o.classId).in('status', ['running', 'paused']);
  const s = Math.max(5, Math.min(7200, Math.round(o.seconds)));
  const { error } = await sb.from('class_timers').insert({
    class_id: o.classId, kind: o.kind, label: o.label.slice(0, 120), duration_s: s,
    ends_at: new Date(Date.now() + s * 1000).toISOString(), status: 'running', show_students: o.show,
    item_type: o.item?.type ?? null, item_id: o.item?.id ?? null,
  });
  pokeLive();
  return { error };
}

export async function pauseTimer(tm: ClassTimer) {
  const left = secondsLeft(tm, Date.now());
  await browserClient().from('class_timers').update({ status: 'paused', remaining_s: left, ends_at: null }).eq('id', tm.id);
  pokeLive();
}
export async function resumeTimer(tm: ClassTimer) {
  await browserClient().from('class_timers').update({ status: 'running', ends_at: new Date(Date.now() + (tm.remaining_s ?? 0) * 1000).toISOString(), remaining_s: null }).eq('id', tm.id);
  pokeLive();
}
export async function addTime(tm: ClassTimer, seconds: number) {
  const patch = tm.status === 'paused'
    ? { remaining_s: Math.max(0, (tm.remaining_s ?? 0) + seconds), duration_s: Math.max(5, tm.duration_s + seconds) }
    : { ends_at: new Date(Math.max(Date.now(), Date.parse(tm.ends_at ?? '') || Date.now()) + seconds * 1000).toISOString(), duration_s: Math.min(7200, Math.max(5, tm.duration_s + seconds)) };
  await browserClient().from('class_timers').update(patch).eq('id', tm.id);
  pokeLive();
}
export async function endTimer(tm: Pick<ClassTimer, 'id'>, status: 'done' | 'cancelled') {
  await browserClient().from('class_timers').update({ status }).eq('id', tm.id);
  pokeLive();
}

// ------------------------------------------------------------------ Hall passes
export type PassDest = 'restroom' | 'water' | 'nurse' | 'office' | 'other';
export type PassStatus = 'pending' | 'denied' | 'queued' | 'out' | 'back' | 'cancelled' | 'expired';
export const PASS_DESTS: PassDest[] = ['restroom', 'water', 'nurse', 'office', 'other'];

export interface Pass {
  id: string; class_id: string; student_id: string; destination: PassDest; note: string | null; with_classmate: boolean;
  status: PassStatus; requested_at: string; decided_at: string | null; queued_at: string | null; out_at: string | null; back_at: string | null;
  student?: { display_name: string } | null;
  class?: { name: string; section: string | null; pass_minutes: number; pass_max_out: number; passes_on: boolean } | null;
}
export interface BoardRow { id: string; name: string; mine: boolean; student_id?: string | null; destination: PassDest | null; note: string | null; with_classmate: boolean; out_at?: string; queued_at?: string; requested_at?: string; today?: number; week?: number }
export interface Board { class_id: string; name: string; section: string | null; teacher: boolean; on: boolean; max_out: number; minutes: number; out: BoardRow[]; queue: BoardRow[]; pending: BoardRow[]; now: string }

const PASS_COLS = 'id,class_id,student_id,destination,note,with_classmate,status,requested_at,decided_at,queued_at,out_at,back_at';

/** Student: my open pass in any class (pending, in line, or out). */
export function useMyPasses(userId: string | null) {
  return useLiveTable<Pass>('hall_passes', userId ? `mine-${userId}` : null, async () => {
    const since = new Date(Date.now() - 3 * 3600_000).toISOString();
    const { data } = await browserClient().from('hall_passes').select(`${PASS_COLS},class:classes(name,section,pass_minutes,pass_max_out,passes_on)`)
      .eq('student_id', userId!).gte('requested_at', since).order('requested_at', { ascending: false }).limit(10);
    return (data ?? []) as unknown as Pass[];
  }, userId ? `student_id=eq.${userId}` : undefined);
}

/** Teacher: every pass in my classes from the last 16 hours (requests, line, out, and today's log). */
export function useClassPasses(enabled: boolean) {
  return useLiveTable<Pass>('hall_passes', enabled ? 'teacher-passes' : null, async () => {
    const since = new Date(Date.now() - 16 * 3600_000).toISOString();
    const { data } = await browserClient().from('hall_passes')
      .select(`${PASS_COLS},student:profiles!hall_passes_student_id_fkey(display_name),class:classes(name,section,pass_minutes,pass_max_out,passes_on)`)
      .gte('requested_at', since).order('requested_at', { ascending: true }).limit(400);
    return (data ?? []) as unknown as Pass[];
  });
}

/** The class board (filtered by the server: classmates never get destinations or notes). Live via the class pulse. */
export function usePassBoard(classId: string | null) {
  const { rows, ready, reload } = useLiveTable<Board>('class_pulse', classId ? `board-${classId}` : null, async () => {
    const { data, error } = await browserClient().rpc('pass_board', { p_class_id: classId });
    if (error || !data) return [];
    return [data as Board];
  }, classId ? `class_id=eq.${classId}` : undefined);
  return { board: rows[0] ?? null, ready, reload };
}

export async function requestPass(classId: string, destination: PassDest, note: string, withClassmate: boolean) {
  const { data, error } = await browserClient().rpc('request_pass', { p_class_id: classId, p_destination: destination, p_note: note || null, p_with_classmate: withClassmate });
  pokeLive();
  return { data: data as { id: string; status: PassStatus } | null, error };
}
export async function decidePass(id: string, action: 'approve' | 'approve_now' | 'deny') { const r = await browserClient().rpc('decide_pass', { p_id: id, p_action: action }); pokeLive(); return r; }
export async function passBack(id: string) { const r = await browserClient().rpc('pass_back', { p_id: id }); pokeLive(); return r; }
export async function cancelPass(id: string) { const r = await browserClient().rpc('cancel_pass', { p_id: id }); pokeLive(); return r; }
export async function savePassSettings(classId: string, s: { passes_on?: boolean; pass_max_out?: number; pass_minutes?: number }) {
  const r = await browserClient().from('classes').update(s).eq('id', classId);
  pokeLive();
  return r;
}

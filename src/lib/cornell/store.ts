'use client';
/**
 * Where Cornell notebooks live: always on this device (instant, works offline), and in the
 * `cornell_notes` table when it exists so they follow the student to any computer. On load the two
 * are merged, newest copy wins. If the table is missing, everything keeps working locally.
 */
import { browserClient } from '@/lib/supabase/browser';
import { normalizeNote, type CornellNote } from './model';

const key = (userId: string, classId: string) => `nexora-cornell:${userId}:${classId}`;

export function readLocal(userId: string, classId: string, fallback: CornellNote): CornellNote[] {
  try {
    const raw = JSON.parse(localStorage.getItem(key(userId, classId)) ?? '[]');
    return Array.isArray(raw) ? raw.map((r) => normalizeNote(r, { ...fallback, id: r?.id ?? fallback.id })) : [];
  } catch { return []; }
}
export function writeLocal(userId: string, classId: string, notes: CornellNote[]) {
  try { localStorage.setItem(key(userId, classId), JSON.stringify(notes)); } catch { /* storage full or private mode */ }
}

export async function readCloud(classId: string, fallback: CornellNote): Promise<CornellNote[] | null> {
  try {
    const { data, error } = await browserClient().from('cornell_notes').select('id,data,updated_at').eq('class_id', classId).order('updated_at', { ascending: false });
    if (error) return null;
    return (data ?? []).map((r: { id: string; data: unknown; updated_at: string }) => {
      const n = normalizeNote(r.data, { ...fallback, id: r.id });
      return { ...n, id: r.id, updatedAt: Math.max(n.updatedAt, Date.parse(r.updated_at) || 0) };
    });
  } catch { return null; }
}

export async function writeCloud(n: CornellNote): Promise<boolean> {
  try {
    const { error } = await browserClient().from('cornell_notes').upsert({
      id: n.id, class_id: n.classId, title: n.title.slice(0, 200), note_date: /^\d{4}-\d{2}-\d{2}$/.test(n.date) ? n.date : null, data: n,
    });
    return !error;
  } catch { return false; }
}

export async function deleteCloud(id: string) {
  try { await browserClient().from('cornell_notes').delete().eq('id', id); } catch { /* */ }
}

export function merge(local: CornellNote[], cloud: CornellNote[]): CornellNote[] {
  const m = new Map<string, CornellNote>();
  for (const n of [...cloud, ...local]) { const cur = m.get(n.id); if (!cur || n.updatedAt > cur.updatedAt) m.set(n.id, n); }
  return [...m.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

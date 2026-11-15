'use server';

import { createClient } from './supabase/server';
import { getViewer } from './data';
import { isDayKey, isMark, type Mark } from './attendance';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Only the class's teacher may mark; row-level security enforces the same thing in the database. */
async function teacherOf(classId: string) {
  if (!UUID.test(classId)) return null;
  const v = await getViewer();
  if (!v) return null;
  const supabase = await createClient();
  const { data: cls } = await supabase.from('classes').select('id,teacher_id').eq('id', classId).maybeSingle();
  return cls && cls.teacher_id === v.id ? { v, supabase } : null;
}

/**
 * Marks several students on several days at once (one click, "all present", a paste…).
 * `status: null` clears the marks. Returns ok:false when nothing could be saved.
 */
export async function saveMarks(classId: string, changes: { studentId: string; day: string; status: Mark | null }[]): Promise<{ ok: boolean }> {
  const own = await teacherOf(classId);
  if (!own) return { ok: false };
  const clean = changes.filter((c) => UUID.test(c.studentId) && isDayKey(c.day) && (c.status === null || isMark(c.status))).slice(0, 2000);
  if (!clean.length) return { ok: false };
  const { v, supabase } = own;
  const set = clean.filter((c) => c.status);
  const clear = clean.filter((c) => !c.status);
  let ok = true;
  if (set.length) {
    const { error } = await supabase.from('attendance').upsert(
      set.map((c) => ({ class_id: classId, student_id: c.studentId, day: c.day, status: c.status, marked_by: v.id, marked_at: new Date().toISOString() })),
      { onConflict: 'class_id,student_id,day' },
    );
    if (error) ok = false;
  }
  for (const c of clear) {
    const { error } = await supabase.from('attendance').delete().eq('class_id', classId).eq('student_id', c.studentId).eq('day', c.day);
    if (error) ok = false;
  }
  return { ok };
}

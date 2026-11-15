'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { browserClient } from '@/lib/supabase/browser';
import { todayIn } from '@/lib/attendance';

/**
 * Under the projector countdown (teacher's screen only): how many students in the room have turned in
 * today's Do Now / Exit ticket, out of those present, and how many are absent — counts only, never
 * names, because the projector faces the whole class. Refreshes every few seconds.
 */
export function RoomLine({ classId, kind }: { classId: string; kind: 'do_now' | 'exit_ticket' | 'manual' }) {
  const t = useTranslations('attendance');
  const [s, setS] = useState<{ roster: number; marked: number; absent: number; done: number | null } | null>(null);
  useEffect(() => {
    let alive = true;
    const sb = browserClient();
    const load = async () => {
      const day = todayIn();
      const [{ count: roster }, { data: att }, { data: qz }] = await Promise.all([
        sb.from('enrollments').select('user_id', { count: 'exact', head: true }).eq('class_id', classId).eq('role', 'student'),
        sb.from('attendance').select('student_id,status').eq('class_id', classId).eq('day', day),
        kind === 'manual' ? Promise.resolve({ data: [] as { id: string }[] })
          : sb.from('quizzes').select('id').eq('class_id', classId).eq('kind', kind).eq('lesson_date', day).neq('status', 'draft').order('created_at', { ascending: false }).limit(1),
      ]);
      let done: number | null = null;
      const qid = (qz ?? [])[0]?.id;
      if (qid) {
        const { count } = await sb.from('quiz_attempts').select('id', { count: 'exact', head: true }).eq('quiz_id', qid);
        done = count ?? 0;
      }
      const rows = (att ?? []) as { student_id: string; status: string }[];
      if (alive) setS({ roster: roster ?? 0, marked: rows.length, absent: rows.filter((r) => r.status === 'absent').length, done });
    };
    void load();
    const id = setInterval(load, 5000);
    return () => { alive = false; clearInterval(id); };
  }, [classId, kind]);
  if (!s || !s.roster) return null;
  const here = s.marked ? s.roster - s.absent : null;
  const parts: string[] = [];
  if (s.done != null) parts.push(here != null ? t('turnedInHere', { done: s.done, here }) : t('turnedIn', { done: s.done, total: s.roster }));
  if (s.marked && s.absent) parts.push(t('absentN', { count: s.absent }));
  if (!parts.length) return null;
  return (
    <p className="mt-6 flex items-center gap-2.5 text-lg text-ink/80 sm:text-2xl" aria-live="polite">
      <span className="live-dot" aria-hidden />{parts.join(' · ')}
    </p>
  );
}

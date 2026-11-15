'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { browserClient } from '@/lib/supabase/browser';
import { getNovaBrief } from '@/lib/actions';
import { periodOf } from '@/lib/bell';
import { useClassHands, useClassPasses, useClassTimers, useMyHands, useMyPasses, type ClassTimer, type Hand, type Pass } from '@/lib/live';
import type { Brief, BriefItem } from '@/components/companion/brain';

export interface LiveClass { id: string; name: string; section: string | null; period: number | null; teacher: boolean; items: BriefItem[] }

interface LiveCtx {
  userId: string | null;
  isEducator: boolean;
  classes: LiveClass[];
  timers: ClassTimer[];
  hands: Hand[];        // teacher: open + today's closed (not my own)
  myHands: Hand[];      // student: my open hands
  handSheet: { open: boolean; classId?: string };
  passes: Pass[];       // teacher: today's passes in my classes
  myPasses: Pass[];     // student: my recent passes
  passSheet: { open: boolean; classId?: string; view?: 'ask' | 'board' };
  openPass: (classId?: string, view?: 'ask' | 'board') => void;
  closePass: () => void;
  openHand: (classId?: string) => void;
  closeHand: () => void;
  reloadClasses: () => void;
  /** "Just me" timer for the teacher (not shared), kept while moving between pages. */
  localTimer: LocalTimer | null;
  setLocalTimer: (t: LocalTimer | null) => void;
  projecting: string | null;          // timer id (or 'local') shown full screen
  setProjecting: (id: string | null) => void;
}
export interface LocalTimer { label: string; duration_s: number; ends_at: number | null; remaining_s: number | null; status: 'running' | 'paused' }

const Ctx = createContext<LiveCtx | null>(null);
/** For previews and tests only. */
export const LiveContext = Ctx;
export const useLive = () => useContext(Ctx);

/**
 * Wraps the signed-in app. Loads who you are and your classes once, then keeps raised hands and
 * class timers live for every component that needs them (header bell, timer tool, assistant,
 * floating timer), so there is one connection per tab instead of one per widget.
 */
export function LiveProvider({ isEducator, children }: { isEducator: boolean; children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [classes, setClasses] = useState<LiveClass[]>([]);
  const [handSheet, setHandSheet] = useState<{ open: boolean; classId?: string }>({ open: false });
  const [passSheet, setPassSheet] = useState<{ open: boolean; classId?: string; view?: 'ask' | 'board' }>({ open: false });
  const [localTimer, setLocalTimer] = useState<LocalTimer | null>(null);
  const [projecting, setProjecting] = useState<string | null>(null);

  useEffect(() => {
    void browserClient().auth.getSession().then(({ data }: { data: { session: { user: { id: string } } | null } }) => setUserId(data.session?.user.id ?? null));
  }, []);

  const reloadClasses = useCallback(() => {
    void getNovaBrief().then((b) => {
      const brief = b as Brief | null;
      setClasses((brief?.classes ?? []).map((c) => ({ id: c.id, name: c.name, section: c.section, period: periodOf(c.section), teacher: c.teacher, items: c.items })));
    }).catch(() => undefined);
  }, []);
  useEffect(() => {
    if (!userId) return;
    reloadClasses();
    const iv = setInterval(reloadClasses, 5 * 60_000);
    return () => clearInterval(iv);
  }, [userId, reloadClasses]);

  const { rows: timers } = useClassTimers(userId ? `t-${userId}` : null);
  const { rows: teacherHands } = useClassHands(isEducator && !!userId);
  const { rows: myHands } = useMyHands(!isEducator || classes.some((c) => !c.teacher) ? userId : null);
  const hands = useMemo(() => teacherHands.filter((h) => h.student_id !== userId), [teacherHands, userId]);
  const { rows: teacherPasses } = useClassPasses(isEducator && !!userId);
  const { rows: myPasses } = useMyPasses(!isEducator || classes.some((c) => !c.teacher) ? userId : null);
  const passes = useMemo(() => teacherPasses.filter((p) => p.student_id !== userId), [teacherPasses, userId]);

  const value = useMemo<LiveCtx>(() => ({
    userId, isEducator, classes, timers, hands, myHands, handSheet, passes, myPasses, passSheet,
    openHand: (classId) => setHandSheet({ open: true, classId }), closeHand: () => setHandSheet({ open: false }),
    openPass: (classId, view = 'ask') => setPassSheet({ open: true, classId, view }), closePass: () => setPassSheet({ open: false }),
    reloadClasses, localTimer, setLocalTimer, projecting, setProjecting,
  }), [userId, isEducator, classes, timers, hands, myHands, handSheet, passes, myPasses, passSheet, reloadClasses, localTimer, projecting]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

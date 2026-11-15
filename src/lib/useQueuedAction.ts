'use client';

import { useActionState, useState } from 'react';
import type { ActionState } from '@/lib/actions';

/**
 * Class-day sign-in: when 130 students hit Sign up in the same minute, Supabase's per-address
 * limit answers "busy" (429) for most of them. A busy answer is not a failure; it means "queue".
 * This runs the server action, and on a busy answer it waits (growing, jittered delays so the
 * room does not retry in lockstep), shows a countdown, and tries again with the same form
 * values: nobody retypes, nobody hammers the button. Anything else (wrong password, taken
 * email, the hourly email cap) returns at once.
 *
 * Total patience: about 3 to 4 minutes, which covers a full room at the limit's refill rate.
 */
const DELAYS = [4, 6, 9, 13, 18, 24, 30, 30, 30, 30];
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export type QueueWait = { secs: number; attempt: number } | null;

export function useQueuedAction(run: (prev: ActionState, fd: FormData) => Promise<ActionState>) {
  const [wait, setWait] = useState<QueueWait>(null);
  const [state, action] = useActionState<ActionState, FormData>(async (prev, fd) => {
    let last: ActionState = null;
    for (let i = 0; i <= DELAYS.length; i++) {
      last = await run(prev, fd);
      if (!last || last.data !== 'busy' || i === DELAYS.length) break;
      const secs = Math.max(2, Math.round(DELAYS[i] * (0.6 + Math.random() * 0.8)));
      for (let s = secs; s > 0; s--) { setWait({ secs: s, attempt: i + 1 }); await sleep(1000); }
    }
    setWait(null);
    return last;
  }, null);
  return { state, action, wait };
}

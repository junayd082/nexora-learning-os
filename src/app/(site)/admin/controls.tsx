'use client';

import { useState, useTransition } from 'react';
import { adminResetDemo, adminSetFlag, adminSetRole } from '@/lib/actions';

export function RoleSelect({ userId, role, labels, disabled }: { userId: string; role: string; labels: Record<string, string>; disabled?: boolean }) {
  const [pending, start] = useTransition();
  return (
    <select defaultValue={role} disabled={pending || disabled} aria-label="Role" className="input h-7 w-auto py-0 text-xs"
      onChange={(e) => { const v = e.target.value; start(async () => { await adminSetRole(userId, v); }); }}>
      {['student', 'teacher', 'admin'].map((r) => <option key={r} value={r}>{labels[r]}</option>)}
    </select>
  );
}

export function FlagToggle({ k, enabled, labels }: { k: string; enabled: boolean; labels: { on: string; off: string } }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" role="switch" aria-checked={enabled} disabled={pending}
      onClick={() => start(async () => { await adminSetFlag(k, !enabled); })}
      className={`btn btn-sm w-16 ${enabled ? 'border-ok text-ok' : 'text-muted'}`}>
      {enabled ? labels.on : labels.off}
    </button>
  );
}

export function ResetDemo({ labels }: { labels: { button: string; busy: string; done: string; failed: string } }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      {msg && <span role="status" className="text-xs text-muted">{msg}</span>}
      <button type="button" disabled={pending} className="btn btn-sm"
        onClick={() => start(async () => { const r = await adminResetDemo(); setMsg(r.ok ? labels.done.replace('{day}', r.day ?? '') : labels.failed); })}>
        {pending ? labels.busy : labels.button}
      </button>
    </span>
  );
}

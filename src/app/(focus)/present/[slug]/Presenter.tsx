'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import QRCode from 'qrcode';
import { Maximize, Megaphone, Pause, Play, RotateCcw, Square, Users, X } from 'lucide-react';
import { browserClient } from '@/lib/supabase/browser';
import { endSession } from '@/lib/actions';
import { Mark } from '@/components/Logo';
import type en from '../../../../../messages/en';
import { cn } from '@/lib/util';

type Labels = (typeof en)['present'] | Record<string, string>;
type Content = { title: string; objective: string | null; instructions: string | null };
type Mode = 'en' | 'es' | 'both';

function plural(template: string, count: number) {
  // Minimal ICU plural for this one message: {count, plural, =0 {...} one {...} other {...}}
  const m = template.match(/=0 \{([^}]*)\} one \{([^}]*)\} other \{([^}]*)\}/);
  if (!m) return String(count);
  return (count === 0 ? m[1] : count === 1 ? m[2] : m[3]).replace('#', String(count));
}

export function Presenter({ sessionId, code, status, slug, origin, initialMode, content, labels, uiLocale }: {
  sessionId: string; code: string; status: string; slug: string; origin: string; initialMode: string;
  content: { en: Content; es: Content }; labels: { en: Labels; es: Labels }; uiLocale: 'en' | 'es';
}) {
  const [mode, setMode] = useState<Mode>((['en', 'es', 'both'].includes(initialMode) ? initialMode : 'en') as Mode);
  const [qr, setQr] = useState('');
  const [names, setNames] = useState<string[]>([]);
  const [showNames, setShowNames] = useState(false);
  const [seconds, setSeconds] = useState(10 * 60);
  const [running, setRunning] = useState(false);
  const [announce, setAnnounce] = useState('');
  const [shown, setShown] = useState('');
  const [ending, start] = useTransition();
  const joinUrl = `${origin}/join/${code}`;
  const ui = labels[uiLocale] as Record<string, string>;

  useEffect(() => {
    QRCode.toDataURL(joinUrl, { margin: 1, width: 480, color: { dark: '#181a1f', light: '#ffffff' } }).then(setQr).catch(() => {});
  }, [joinUrl]);

  const loadParticipants = useCallback(async () => {
    const { data } = await browserClient().from('session_participants').select('display_name,joined_at').eq('session_id', sessionId).order('joined_at');
    if (data) setNames(data.map((d: { display_name: string }) => d.display_name));
  }, [sessionId]);

  // Realtime: students appear as they join. One initial load, then pushed changes only.
  useEffect(() => {
    loadParticipants();
    const ch = browserClient()
      .channel(`session:${sessionId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'session_participants', filter: `session_id=eq.${sessionId}` },
        (p: { new: { display_name: string } }) => setNames((n) => [...n, p.new.display_name]))
      .subscribe((s: string) => { if (s === 'SUBSCRIBED') loadParticipants(); });
    return () => { browserClient().removeChannel(ch); };
  }, [sessionId, loadParticipants]);

  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!running) return;
    tick.current = setInterval(() => setSeconds((s) => (s <= 1 ? (setRunning(false), 0) : s - 1)), 1000);
    return () => { if (tick.current) clearInterval(tick.current); };
  }, [running]);

  const L = (key: string) => {
    const a = (labels.en as Record<string, string>)[key]; const b = (labels.es as Record<string, string>)[key];
    if (mode === 'both') return <>{a}<span className="text-faint"> / </span><span className="text-muted">{b}</span></>;
    return mode === 'es' ? b : a;
  };
  const C = (key: keyof Content, cls = '') => {
    const a = content.en[key]; const b = content.es[key];
    if (mode === 'both' && b && b !== a) {
      return <div className="space-y-2"><p className={cls} lang="en">{a}</p><p className={cn(cls, 'text-muted')} lang="es">{b}</p></div>;
    }
    const v = mode === 'es' ? b ?? a : a;
    return v ? <p className={cls} lang={mode === 'es' ? 'es' : 'en'}>{v}</p> : null;
  };
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  if (status !== 'live') {
    return <div className="flex min-h-screen items-center justify-center"><p className="text-muted">{ui.ended} <Link className="text-accent" href={`/x/${slug}`}>{ui.exit}</Link></p></div>;
  }

  return (
    <div className="flex min-h-screen flex-col"
      style={{ background: 'radial-gradient(70% 90% at 0% 100%, rgb(var(--nx-ember) / 0.14), transparent 60%), radial-gradient(60% 80% at 100% 0%, rgb(var(--nx-violet) / 0.12), transparent 60%), rgb(var(--bg))' }}>
      <header className="flex items-center gap-3 border-b border-line px-5 py-3">
        <Mark size={20} />
        <span className="font-mono text-xs tracking-[0.2em] text-muted">NEXORA · {ui.title.toUpperCase()}</span>
        <div className="ml-auto flex items-center gap-1">
          <div className="mr-2 inline-flex rounded border border-line p-0.5" role="group" aria-label={ui.langLabel}>
            {(['en', 'es', 'both'] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)} aria-pressed={mode === m}
                className={cn('h-7 rounded-sm px-2.5 font-mono text-2xs', mode === m ? 'bg-ink text-bg' : 'text-muted')}>
                {m === 'both' ? ui.both.toUpperCase() : m.toUpperCase()}
              </button>
            ))}
          </div>
          <button className="btn-ghost btn-sm" onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})} aria-label={ui.fullscreen}><Maximize size={15} aria-hidden /></button>
          <button className="btn btn-sm" disabled={ending} onClick={() => start(async () => { await endSession(sessionId, slug); })}><Square size={13} aria-hidden />{ui.end}</button>
        </div>
      </header>

      {shown && (
        <div className="flex items-center gap-4 border-b border-accent/30 bg-accent/10 px-8 py-4 text-2xl font-medium" role="status">
          <Megaphone className="shrink-0 text-accent" aria-hidden />{shown}
          <button className="btn-ghost btn-sm ml-auto" onClick={() => setShown('')} aria-label={ui.hide}><X size={16} aria-hidden /></button>
        </div>
      )}

      <div className="grid flex-1 gap-0 lg:grid-cols-[1fr_420px]">
        <section className="flex flex-col justify-center gap-10 px-8 py-10 lg:px-16">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight xl:text-6xl">
            {mode === 'both' && content.es.title !== content.en.title
              ? <>{content.en.title}<span className="mt-2 block text-3xl text-muted xl:text-4xl">{content.es.title}</span></>
              : mode === 'es' ? content.es.title : content.en.title}
          </h1>
          {(content.en.objective || content.es.objective) && (
            <div className="border-l-4 border-accent pl-6">
              <div className="eyebrow text-sm">{L('objective')}</div>
              <div className="mt-2">{C('objective', 'text-2xl leading-snug xl:text-3xl')}</div>
            </div>
          )}
          {(content.en.instructions || content.es.instructions) && (
            <div>
              <div className="eyebrow text-sm">{L('instructions')}</div>
              <div className="mt-2">{C('instructions', 'text-xl text-ink/85 xl:text-2xl')}</div>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Link href={`/x/${slug}/play`} target="_blank" className="btn-primary btn-lg"><Play size={16} aria-hidden />{L('launch')}</Link>
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setShown(announce.trim()); }}>
              <input value={announce} onChange={(e) => setAnnounce(e.target.value)} placeholder={ui.announcePlaceholder} aria-label={ui.announce} className="input h-11 w-64" maxLength={140} />
              <button className="btn btn-lg" type="submit"><Megaphone size={15} aria-hidden />{ui.show}</button>
            </form>
          </div>
        </section>

        <aside className="flex flex-col gap-6 border-t border-line bg-sunk/70 px-8 py-10 lg:border-l lg:border-t-0">
          <div className="text-center">
            <div className="eyebrow text-sm">{L('join')}</div>
            <div className="mt-1 break-all font-mono text-lg">{origin.replace(/^https?:\/\//, '')}/join</div>
            <div className="mt-4 font-mono text-6xl font-semibold tracking-wider">{code}</div>
            <div className="mt-4 eyebrow">{L('orScan')}</div>
            {qr ? <img src={qr} alt={`QR code for ${joinUrl}`} className="mx-auto mt-2 w-60 rounded border border-line" /> : <div className="mx-auto mt-2 h-60 w-60 rounded border border-line bg-sunk" />}
          </div>
          <button className="flex items-center justify-center gap-2 rounded border border-line py-3 text-lg" onClick={() => setShowNames((s) => !s)} aria-expanded={showNames}>
            <Users size={18} aria-hidden /><span aria-live="polite">{plural(mode === 'es' ? (labels.es as Record<string, string>).joined : (labels.en as Record<string, string>).joined, names.length)}</span>
          </button>
          {showNames && names.length > 0 && (
            <ul className="max-h-40 overflow-y-auto text-sm text-muted">{names.map((n, i) => <li key={`${n}-${i}`}>{n || '—'}</li>)}</ul>
          )}
          <div className="mt-auto rounded border border-line p-4 text-center">
            <div className="eyebrow">{L('timer')}</div>
            <div className={cn('mt-1 font-mono text-5xl tabular-nums', seconds === 0 && 'text-bad')} aria-live="off">{mm}:{ss}</div>
            <div className="mt-3 flex justify-center gap-2">
              <button className="btn btn-sm" onClick={() => setSeconds((s) => Math.max(60, s - 60))}>−1</button>
              <button className="btn btn-sm" onClick={() => setRunning((r) => !r)}>{running ? <Pause size={13} aria-hidden /> : <Play size={13} aria-hidden />}{running ? ui.pause : ui.start}</button>
              <button className="btn btn-sm" onClick={() => { setRunning(false); setSeconds(10 * 60); }} aria-label={ui.reset}><RotateCcw size={13} aria-hidden /></button>
              <button className="btn btn-sm" onClick={() => setSeconds((s) => s + 60)}>+1</button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

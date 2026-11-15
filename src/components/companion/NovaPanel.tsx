'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import {
  ArrowUp, Bone, ChevronRight, CircleDot, EyeOff, Hand, HandHeart, Moon, Search, Sparkles, Ticket, Timer, Volume2, VolumeX, X,
} from 'lucide-react';
import { TagChip } from '@/components/TagChip';
import { cn } from '@/lib/util';
import { answer, detect, type Answer, type Brief, type Intent } from './brain';
import { setSound, soundOn } from './sound';
import { FormArt, type FormId } from './forms';
import { useLive } from '@/components/live/LiveProvider';
import { AskTeacherMenu } from '@/components/live/HallPass';

type Msg = { id: number; from: 'nova' | 'me'; text?: string; a?: Answer };
export type PlayKind = 'pet' | 'treat' | 'ball' | 'trick' | 'howl';

/**
 * "Ask Nova": a small class-helper chat. Quick questions first (most students tap),
 * free text second. Answers link straight to the Do Now, the lecture, the assignment.
 */
export function NovaPanel({ name, formId = 'nova', brief, loading, isEducator, onClose, onPlay, onHide }: {
  name: string; formId?: FormId; brief: Brief | null; loading: boolean; isEducator: boolean;
  onClose: () => void; onPlay: (k: PlayKind) => void; onHide: () => void;
}) {
  const t = useTranslations('nova');
  const tl = useTranslations('live');
  const f = useFormatter();
  const live = useLive();
  const canRaise = !!live && live.classes.some((c) => !c.teacher);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [sound, setSoundState] = useState(false);
  const idRef = useRef(1);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const tt = t as unknown as (k: string, v?: Record<string, string | number>) => string;
  const fmtDay = (d: string) => f.dateTime(new Date(`${d}T12:00:00`), { weekday: 'long', month: 'short', day: 'numeric' });

  useEffect(() => { setSoundState(soundOn()); }, []);

  // Opening line: today's plan, or what's due when nothing is posted.
  const greeted = useRef(false);
  useEffect(() => {
    if (loading || greeted.current) return;
    greeted.current = true;
    const first = brief?.name ? brief.name : null;
    if (!brief || !brief.classes.length) {
      push({ from: 'nova', a: answer('today', brief, '', tt, fmtDay) });
      return;
    }
    const any = brief.classes.some((c) => c.items.length);
    if (any) {
      push({ from: 'nova', text: first ? t('greet', { name: first }) : t('greetAnon') });
      push({ from: 'nova', a: answer('today', brief, '', tt, fmtDay) });
    } else {
      push({ from: 'nova', text: first ? t('greetNothing', { name: first }) : t('greetAnon') });
      const due = answer('due', brief, '', tt, fmtDay);
      if (due.groups?.length) push({ from: 'nova', a: due });
    }
  }, [loading, brief]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show the start of Nova's newest answer (not the bottom of it).
  useEffect(() => {
    const box = listRef.current; if (!box) return;
    const last = box.lastElementChild as HTMLElement | null; if (!last) return;
    const firstNew = msgs.length <= 2 ? (box.firstElementChild as HTMLElement) : last.previousElementSibling?.classList.contains('me-bubble') ? (last.previousElementSibling as HTMLElement) : last;
    box.scrollTo({ top: Math.max(0, firstNew.offsetTop - 8), behavior: msgs.length <= 2 ? 'auto' : 'smooth' });
  }, [msgs]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, [onClose]);

  function teacherTool(k: 'start_timer' | 'see_hands' | 'see_passes') {
    if (k === 'start_timer') window.dispatchEvent(new Event('nexora:open-timer'));
    else window.dispatchEvent(new CustomEvent('nexora:open-bell', { detail: k === 'see_passes' ? 'passes' : 'hands' }));
  }
  const handsWaiting = (live?.hands ?? []).filter((h) => h.status === 'raised' || h.status === 'seen').length;
  const passesWaiting = (live?.passes ?? []).filter((p) => p.status === 'pending' || p.status === 'out').length;

  function push(m: Omit<Msg, 'id'>) { setMsgs((list) => [...list, { ...m, id: idRef.current++ }]); }

  function ask(q: string, forced?: Intent) {
    const intent = forced ?? detect(q);
    push({ from: 'me', text: q });
    if (intent === 'tour') {
      setTimeout(() => push({ from: 'nova', text: tt('tourStart') }), 200);
      setTimeout(() => { onClose(); window.dispatchEvent(new CustomEvent('nexora:tour', { detail: 'main' })); }, 700);
      return;
    }
    if (isEducator && (intent === 'start_timer' || intent === 'see_hands' || intent === 'see_passes')) {
      setTimeout(() => push({ from: 'nova', text: intent === 'start_timer' ? tl('assistantTimer') : tl('assistantBell') }), 200);
      setTimeout(() => { onClose(); teacherTool(intent); }, 450);
      return;
    }
    if (!isEducator && intent === 'see_passes' && canRaise) {
      setTimeout(() => push({ from: 'nova', text: tl('assistantBoard') }), 200);
      setTimeout(() => live!.openPass(undefined, 'board'), 450);
      return;
    }
    if (intent === 'hall_pass' && canRaise) {
      setTimeout(() => push({ from: 'nova', text: tl('assistantPass') }), 200);
      setTimeout(() => live!.openPass(undefined, 'ask'), 450);
      return;
    }
    if (intent === 'raise_hand' && canRaise) {
      setTimeout(() => push({ from: 'nova', text: tl('assistantRaising') }), 200);
      setTimeout(() => live!.openHand(), 450);
      return;
    }
    const a = answer(intent, brief, q, tt, fmtDay, { name, animal: tt(`forms.${formId}.animal`) });
    if (a.play) { play(a.play); return; }
    setTimeout(() => push({ from: 'nova', a }), 260);
  }

  // The trick and the call are each animal's own (claw snap, hoot, croak, ping, beep…).
  const REPLY: Record<PlayKind, string> = { pet: 'r.hehe', treat: 'r.yum', ball: 'r.gotIt', trick: `forms.${formId}.trick`, howl: `forms.${formId}.call` };
  const playLabel = (k: PlayKind) => (k === 'howl' ? tt(`forms.${formId}.callLabel`) : t(k));
  function play(k: PlayKind) {
    onPlay(k);
    if (k !== 'ball') setTimeout(() => push({ from: 'nova', text: tt(REPLY[k]) }), k === 'treat' ? 900 : 300);
  }

  const chips: Intent[] = useMemo(() => isEducator
    ? ['today', 'start_timer', 'ungraded', 'add_do_now', 'due', 'missed']
    : [...(canRaise ? ['raise_hand' as Intent, 'hall_pass' as Intent] : []), 'do_now', 'lecture', 'due', 'missed', 'submit', 'where', 'grades'], [isEducator, canRaise]);
  const chipLabel = (i: Intent) => t(`chips.${i === 'today' && isEducator ? 'plan' : i}` as 'chips.today');

  return (
    <div role="dialog" aria-label={t('open', { name })} className="nx-nova-panel surface-3">
      <header className="flex items-center gap-2.5 border-b border-line px-3 py-2.5">
        <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-ember/10"><FormArt id={formId} pose="sit" mood="happy" /></span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{name}</div>
          <div className="text-2xs text-muted">{t('sub')}</div>
        </div>
        {canRaise && <AskTeacherMenu compact className="btn btn-sm" />}
        <button type="button" className="btn-ghost btn-sm" aria-pressed={sound} title={sound ? t('soundOn') : t('soundOff')} aria-label={sound ? t('soundOn') : t('soundOff')}
          onClick={() => { setSound(!sound); setSoundState(!sound); }}>
          {sound ? <Volume2 size={15} aria-hidden /> : <VolumeX size={15} aria-hidden />}
        </button>
        <button type="button" className="btn-ghost btn-sm" onClick={onClose} aria-label={t('close')}><X size={15} aria-hidden /></button>
      </header>

      {isEducator && live && (
        <div className="grid grid-cols-3 gap-1.5 border-b border-line px-3 py-2">
          {([['see_hands', Hand, tl('handsTab'), handsWaiting], ['see_passes', Ticket, tl('passesTab'), passesWaiting], ['start_timer', Timer, tl('timer'), 0]] as const).map(([k, Icon, label, n]) => (
            <button key={k} type="button" onClick={() => { onClose(); teacherTool(k); }}
              className={cn('btn btn-sm justify-center gap-1.5 px-1', n > 0 && 'border-ember/60 ember-text')}>
              <Icon size={14} aria-hidden />{label}{n > 0 && <span className="rounded-full bg-ember/25 px-1.5 text-[10px] tabular-nums">{n}</span>}
            </button>
          ))}
        </div>
      )}

      <div ref={listRef} className="nx-nova-log" aria-live="polite">
        {loading && <p className="nova-bubble text-muted">{t('loading')}</p>}
        {msgs.map((m) => m.from === 'me'
          ? <p key={m.id} className="me-bubble">{m.text}</p>
          : <NovaMsg key={m.id} m={m} onSearch={(q) => { onClose(); window.dispatchEvent(new CustomEvent('nexora:search', { detail: { q } })); }} onNav={onClose} />)}
      </div>

      <div className="flex gap-1.5 overflow-x-auto px-3 pb-2 pt-1 nx-noscroll">
        {chips.map((c) => (
          <button key={c} type="button" className="chip shrink-0 whitespace-nowrap hover:border-ember/50 hover:text-ink" onClick={() => ask(chipLabel(c), c)}>{chipLabel(c)}</button>
        ))}
      </div>

      <form className="flex items-center gap-2 border-t border-line px-3 py-2" onSubmit={(e) => { e.preventDefault(); const q = text.trim(); if (q) { ask(q); setText(''); } }}>
        <label className="sr-only" htmlFor="nova-q">{t('askPlaceholder', { name })}</label>
        <input id="nova-q" ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} maxLength={200} autoComplete="off"
          placeholder={t('askPlaceholder', { name })} className="input h-9 flex-1 text-sm" />
        <button type="submit" className="btn-primary h-9 w-9 justify-center p-0" aria-label={t('send')} disabled={!text.trim()}><ArrowUp size={16} aria-hidden /></button>
      </form>

      <div className="flex items-center gap-1 border-t border-line px-2 py-1.5">
        <span className="whitespace-nowrap px-1 font-mono text-2xs uppercase tracking-[0.1em] text-faint">{t('play', { name })}</span>
        <div className="ml-auto flex items-center">
          {([['pet', HandHeart], ['treat', Bone], ['ball', CircleDot], ['trick', Sparkles], ['howl', Moon]] as const).map(([k, Icon]) => (
            <button key={k} type="button" className="btn-ghost btn-sm" title={playLabel(k)} aria-label={playLabel(k)} onClick={() => play(k)}><Icon size={15} aria-hidden /></button>
          ))}
          <span className="mx-1 h-4 w-px bg-line" aria-hidden />
          <button type="button" className="btn-ghost btn-sm" title={t('search')} aria-label={t('search')} onClick={() => { onClose(); window.dispatchEvent(new Event('nexora:search')); }}><Search size={15} aria-hidden /></button>
          <button type="button" className="btn-ghost btn-sm" title={t('hide', { name })} aria-label={t('hide', { name })} onClick={onHide}><EyeOff size={15} aria-hidden /></button>
        </div>
      </div>
    </div>
  );
}

function NovaMsg({ m, onSearch, onNav }: { m: Msg; onSearch: (q: string) => void; onNav: () => void }) {
  const t = useTranslations('nova');
  const f = useFormatter();
  const a = m.a;
  const status = (s?: string | null, due?: string | null) => {
    if (s === 'returned') return <span className="text-2xs text-ok">{t('a.graded')}</span>;
    if (s === 'submitted') return <span className="text-2xs text-ok">{t('a.done')}</span>;
    if (due && new Date(due) < new Date()) return <span className="text-2xs font-semibold text-bad">{t('a.late')}</span>;
    return null;
  };
  return (
    <div className="nova-bubble space-y-2">
      {m.text && <p className="whitespace-pre-line">{m.text}</p>}
      {a?.text && <p className="whitespace-pre-line">{a.text}</p>}
      {a?.steps && <ol className="list-decimal space-y-0.5 pl-5 text-[13px]">{a.steps.map((s) => <li key={s}>{s}</li>)}</ol>}
      {a?.groups?.map((g, gi) => (
        <div key={gi}>
          <div className="mb-1 text-2xs font-semibold uppercase tracking-wide text-muted">{g.title}</div>
          {g.items.length === 0 ? <p className="text-[13px] text-muted">{g.empty}</p> : (
            <ul className="space-y-1">
              {g.items.map(({ item, href }) => (
                <li key={`${item.type}${item.id}`}>
                  <Link href={href} onClick={onNav} className="group flex items-center gap-2 rounded-md border border-line bg-sunk/60 px-2.5 py-2 hover:border-ember/50">
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        {item.tag && <TagChip tag={item.tag} label={t(`tags.${item.tag}`)} />}
                        {status(item.status, item.due_at)}
                      </span>
                      <span className="mt-0.5 block truncate text-[13px] font-medium">{item.title}</span>
                      {item.due_at && <span className="block text-2xs text-muted">{t('dueShort', { when: f.dateTime(new Date(item.due_at), { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) })}</span>}
                    </span>
                    <ChevronRight size={14} className="text-faint group-hover:text-ember" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
      {(a?.links?.length || a?.search) && (
        <div className="flex flex-wrap gap-1.5">
          {a?.links?.map((l) => <Link key={l.href} href={l.href} onClick={onNav} className="chip hover:border-ember/50 hover:text-ink">{l.label}<ChevronRight size={11} aria-hidden /></Link>)}
          {a?.search && <button type="button" onClick={() => onSearch(a.search!)} className="chip hover:border-ember/50 hover:text-ink"><Search size={11} aria-hidden />{t('a.searchFor', { q: a.search })}</button>}
        </div>
      )}
    </div>
  );
}

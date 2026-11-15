'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  AppWindow, BookOpen, ChevronDown, ClipboardList, FileText, Folder, Link2, NotebookPen, Pin, Plus, Settings2, Sparkles, Upload, X,
} from 'lucide-react';
import { addMaterial, deleteMaterial, deleteUpdate, pinApp, postUpdate, quickSchedule, scheduleItem, unpinApp, updateMaterial } from '@/lib/actions';
import { FormMessage, SubmitButton } from '@/components/forms';
import { Uploader, type Uploaded } from '@/components/files/Uploader';
import { NewAssignmentForm } from '../forms';
import { ScheduleFields, localDay } from '@/components/ScheduleFields';
import { cn } from '@/lib/util';

type Kind = 'folder' | 'file' | 'link' | 'page' | 'experience' | 'app' | 'assignment';
const FOLDER_COLORS = ['#E8634A', '#E59A2F', '#4E7FE0', '#8758FF', '#2F9E73', '#C044B7', '#7A7F8C'];

/** Schoology-style "Add Materials" menu: one control, a panel per material type. */
export function AddMaterials({ classId, folderId, userId, experiences, apps }: {
  classId: string; folderId: string | null; userId: string;
  experiences: { id: string; title: string }[]; apps: { id: string; name: string }[];
}) {
  const t = useTranslations('course');
  const tq = useTranslations('checks');
  const ts = useTranslations('summary');
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const items: { k: Kind; icon: typeof Folder; label: string }[] = [
    { k: 'folder', icon: Folder, label: t('addFolder') },
    { k: 'file', icon: Upload, label: t('addFile') },
    { k: 'link', icon: Link2, label: t('addLink') },
    { k: 'page', icon: FileText, label: t('addPage') },
    { k: 'assignment', icon: ClipboardList, label: t('addAssignment') },
    { k: 'experience', icon: BookOpen, label: t('addExperience') },
    { k: 'app', icon: AppWindow, label: t('addApp') },
  ];
  return (
    <div className="space-y-3">
      <div ref={ref} className="relative inline-block">
        <button type="button" className="btn-primary" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <Plus size={15} aria-hidden />{t('addMaterials')}<ChevronDown size={14} aria-hidden />
        </button>
        {open && (
          <div role="menu" className="surface-3 absolute left-0 z-30 mt-1 w-64 p-1">
            {(['do_now', 'exit_ticket'] as const).map((k) => (
              <Link key={k} role="menuitem" href={`/classes/${classId}/checks/new?kind=${k}`}
                className="flex w-full items-center gap-2.5 rounded px-3 py-2 text-left text-sm hover:bg-ember/10">
                <Sparkles size={15} className="violet-text" aria-hidden />{tq(k === 'do_now' ? 'addDoNow' : 'addExitTicket')}
              </Link>
            ))}
            <Link role="menuitem" href={`/classes/${classId}/summary/new`}
              className="flex w-full items-center gap-2.5 rounded px-3 py-2 text-left text-sm hover:bg-ember/10">
              <NotebookPen size={15} className="violet-text" aria-hidden />{ts('menuItem')}
            </Link>
            <div className="my-1 border-t border-line" />
            {items.map(({ k, icon: Icon, label }) => (
              <button key={k} role="menuitem" type="button" onClick={() => { setKind(k); setOpen(false); }}
                className="flex w-full items-center gap-2.5 rounded px-3 py-2 text-left text-sm hover:bg-ember/10">
                <Icon size={15} className="text-muted" aria-hidden />{label}
              </button>
            ))}
          </div>
        )}
      </div>
      {kind && (
        <div className="card relative p-5">
          <button type="button" onClick={() => setKind(null)} className="btn-ghost btn-sm absolute right-2 top-2" aria-label={t('close')}><X size={14} aria-hidden /></button>
          <h3 className="mb-4 text-sm font-semibold">{items.find((i) => i.k === kind)?.label}</h3>
          {kind === 'assignment'
            ? <NewAssignmentForm classId={classId} experiences={experiences} />
            : <MaterialForm key={kind} kind={kind} classId={classId} folderId={folderId} userId={userId} experiences={experiences} apps={apps} onDone={() => setKind(null)} />}
        </div>
      )}
    </div>
  );
}

function MaterialForm({ kind, classId, folderId, userId, experiences, apps, onDone }: {
  kind: Exclude<Kind, 'assignment'>; classId: string; folderId: string | null; userId: string;
  experiences: { id: string; title: string }[]; apps: { id: string; name: string }[]; onDone: () => void;
}) {
  const t = useTranslations('course');
  const [state, action] = useActionState(addMaterial, null);
  const [file, setFile] = useState<Uploaded | null>(null);
  const [color, setColor] = useState(FOLDER_COLORS[2]);
  useEffect(() => { if (state?.ok) onDone(); }, [state, onDone]);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="class_id" value={classId} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="parent_id" value={folderId ?? ''} />
      {kind === 'file' && (
        <>
          <Uploader bucket="experience-files" folder={`${userId}/c-${classId.slice(0, 8)}`} onChange={(fs) => setFile(fs[0] ?? null)} />
          <input type="hidden" name="file_path" value={file?.path ?? ''} />
          <input type="hidden" name="file_name" value={file?.name ?? ''} />
          <input type="hidden" name="file_mime" value={file?.mime ?? ''} />
          <input type="hidden" name="file_size" value={file?.size ?? ''} />
        </>
      )}
      {kind === 'experience' && (
        <div><label className="label" htmlFor="m-exp">{t('fromLibrary')}</label>
          <select id="m-exp" name="experience_id" className="input" required defaultValue="">
            <option value="" disabled>—</option>
            {experiences.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select></div>
      )}
      {kind === 'app' && (
        <div><label className="label" htmlFor="m-app">{t('app')}</label>
          <select id="m-app" name="app_id" className="input" required defaultValue="">
            <option value="" disabled>—</option>
            {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select></div>
      )}
      <div><label className="label" htmlFor="m-title">{t('title')}{kind === 'file' || kind === 'experience' || kind === 'app' ? ` (${t('optional')})` : ''}</label>
        <input id="m-title" name="title" maxLength={200} required={kind === 'folder' || kind === 'link' || kind === 'page'} className="input" /></div>
      {(kind === 'link' || kind === 'app') && (
        <div><label className="label" htmlFor="m-url">{kind === 'app' ? t('appLink') : t('url')}</label>
          <input id="m-url" name="url" type="url" required={kind === 'link'} placeholder="https://" className="input" /></div>
      )}
      {(kind === 'page' || kind === 'link' || kind === 'file') && (
        <div><label className="label" htmlFor="m-body">{kind === 'page' ? t('pageBody') : t('description')}</label>
          <textarea id="m-body" name="body" className={cn('textarea', kind === 'page' && 'min-h-[200px] font-mono text-xs')} placeholder={kind === 'page' ? t('pagePlaceholder') : ''} /></div>
      )}
      {kind === 'folder' && (
        <div>
          <span className="label">{t('color')}</span>
          <div className="flex gap-2">
            {FOLDER_COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setColor(c)} aria-label={c} aria-pressed={color === c}
                className={cn('h-7 w-7 rounded-md border-2', color === c ? 'border-white' : 'border-transparent')} style={{ background: c }} />
            ))}
          </div>
          <input type="hidden" name="color" value={color} />
        </div>
      )}
      {kind !== 'folder' && <ScheduleFields idPrefix="m" defaultTag={kind === 'page' ? 'do_now' : kind === 'file' ? 'lecture' : ''} />}
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="published" value="false" className="accent-[rgb(var(--nx-ember))]" />{t('hideFromStudents')}</label>
      <div className="flex items-center gap-3"><SubmitButton>{t('add')}</SubmitButton><FormMessage state={state} /></div>
    </form>
  );
}

/** Gear menu on each item (teacher only): schedule for a day, rename, publish/unpublish, move, delete. */
export function MaterialMenu({ id, classId, title, published, folders, type = 'material', lessonDate = null, tag = null, dueAt = null, canGenerate = false, timerMinutes = null, timerMode = null }:
  { id: string; classId: string; title: string; published: boolean; folders: { id: string; title: string }[];
    type?: 'material' | 'assignment'; lessonDate?: string | null; tag?: string | null; dueAt?: string | null; canGenerate?: boolean;
    timerMinutes?: number | null; timerMode?: string | null }) {
  const t = useTranslations('course');
  const tq = useTranslations('checks');
  const ts = useTranslations('summary');
  const tn = useTranslations('nova');
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const run = (fn: () => Promise<unknown>) => { setOpen(false); start(async () => { await fn(); }); };
  const item = 'w-full rounded px-3 py-1.5 text-left hover:bg-ember/10';
  const isAssignment = type === 'assignment';
  return (
    <div ref={ref} className="relative">
      <button type="button" className={cn('btn-ghost btn-sm', pending && 'opacity-50')} aria-label={t('options')} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Settings2 size={14} aria-hidden /><ChevronDown size={12} aria-hidden />
      </button>
      {open && (
        <div role="menu" className="surface-3 absolute right-0 z-30 mt-1 w-60 p-1 text-sm">
          <div className="px-3 pb-1 pt-1.5 text-2xs font-mono uppercase tracking-wider text-faint">{tn('forToday')}</div>
          <button role="menuitem" className={item} onClick={() => run(() => quickSchedule(type, id, classId, { lesson_date: localDay(), tag: 'do_now' }))}>{tn('makeDoNow')}</button>
          <button role="menuitem" className={item} onClick={() => run(() => quickSchedule(type, id, classId, { lesson_date: localDay(), tag: 'lecture' }))}>{tn('makeLecture')}</button>
          <button role="menuitem" className={item} onClick={() => run(() => quickSchedule(type, id, classId, { lesson_date: localDay() }))}>{tn('addToToday')}</button>
          <button role="menuitem" className={item} onClick={() => { setOpen(false); setDialog(true); }}>{tn('scheduleMore')}</button>
          {lessonDate && <button role="menuitem" className={item} onClick={() => run(() => quickSchedule(type, id, classId, { lesson_date: null }))}>{tn('removeDay')}</button>}
          {canGenerate && <Link role="menuitem" href={`/classes/${classId}/checks/new?source=${id}`} className={cn(item, 'flex items-center gap-2')}><Sparkles size={13} className="violet-text" aria-hidden />{tq('fromThis')}</Link>}
          {canGenerate && <Link role="menuitem" href={`/classes/${classId}/summary/new?source=${id}`} className={cn(item, 'flex items-center gap-2')}><NotebookPen size={13} className="violet-text" aria-hidden />{ts('fromThis')}</Link>}
          {!isAssignment && <>
            <div className="my-1 border-t border-line" />
            <button role="menuitem" className={item} onClick={() => {
              const next = window.prompt(t('rename'), title); if (next && next.trim()) run(() => updateMaterial(id, classId, { title: next }));
            }}>{t('rename')}</button>
            <button role="menuitem" className={item} onClick={() => run(() => updateMaterial(id, classId, { published: !published }))}>
              {published ? t('unpublish') : t('publish')}
            </button>
            {folders.length > 0 && <div className="px-3 pb-1 pt-2 text-2xs font-mono uppercase tracking-wider text-faint">{t('moveTo')}</div>}
            {folders.length > 0 && (
              <button role="menuitem" className={item} onClick={() => run(() => updateMaterial(id, classId, { parent_id: null }))}>— {t('top')}</button>
            )}
            {folders.filter((f) => f.id !== id).map((f) => (
              <button key={f.id} role="menuitem" className={cn(item, 'flex items-center gap-2')} onClick={() => run(() => updateMaterial(id, classId, { parent_id: f.id }))}>
                <Folder size={13} aria-hidden />{f.title}
              </button>
            ))}
            <div className="my-1 border-t border-line" />
            <button role="menuitem" className="w-full rounded px-3 py-1.5 text-left text-bad hover:bg-bad/10" onClick={() => {
              if (window.confirm(t('deleteConfirm', { title }))) run(() => deleteMaterial(id, classId));
            }}>{t('delete')}</button>
          </>}
        </div>
      )}
      {dialog && <ScheduleDialog id={id} classId={classId} type={type} title={title} lessonDate={lessonDate} tag={tag} dueAt={dueAt} timerMinutes={timerMinutes} timerMode={timerMode} onClose={() => setDialog(false)} />}
    </div>
  );
}

function ScheduleDialog({ id, classId, type, title, lessonDate, tag, dueAt, timerMinutes, timerMode, onClose }:
  { id: string; classId: string; type: 'material' | 'assignment'; title: string; lessonDate: string | null; tag: string | null; dueAt: string | null;
    timerMinutes: number | null; timerMode: string | null; onClose: () => void }) {
  const tn = useTranslations('nova');
  const t = useTranslations('course');
  const [state, action] = useActionState(scheduleItem, null);
  useEffect(() => { if (state?.ok) onClose(); }, [state, onClose]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k);
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form action={action} role="dialog" aria-modal="true" aria-label={tn('scheduleTitle')} className="w-full max-w-xl space-y-4 rounded-xl border border-line p-5 text-left shadow-2xl" style={{ background: 'rgb(var(--panel))' }}>
        <div className="flex items-start justify-between gap-3">
          <div><h3 className="font-semibold">{tn('scheduleTitle')}</h3><p className="text-sm text-muted">{title}</p></div>
          <button type="button" onClick={onClose} className="btn-ghost btn-sm" aria-label={t('close')}><X size={14} aria-hidden /></button>
        </div>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="class_id" value={classId} />
        <input type="hidden" name="type" value={type} />
        <ScheduleFields compact idPrefix={`d-${id.slice(0, 6)}`} defaultDay={lessonDate ?? 'none'} defaultTag={tag ?? ''} defaultDue={dueAt} showDue={type === 'material'} defaultTimer={timerMinutes} defaultTimerMode={timerMode} />
        {type === 'assignment' && <p className="text-xs text-muted">{tn('assignmentDueHint')}</p>}
        <div className="flex items-center gap-3"><SubmitButton>{tn('save')}</SubmitButton><FormMessage state={state} /></div>
      </form>
    </div>,
    document.body,
  );
}

export function UpdateForm({ classId }: { classId: string }) {
  const t = useTranslations('course');
  const [state, action] = useActionState(postUpdate, null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) form.current?.reset(); }, [state]);
  return (
    <form ref={form} action={action} className="card space-y-3 p-4">
      <input type="hidden" name="class_id" value={classId} />
      <label className="sr-only" htmlFor="u-body">{t('writeUpdate')}</label>
      <textarea id="u-body" name="body" required maxLength={5000} placeholder={t('writeUpdate')} className="textarea min-h-[80px]" />
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" name="pinned" className="accent-[rgb(var(--nx-ember))]" /><Pin size={13} aria-hidden />{t('pin')}</label>
        <div className="flex items-center gap-3"><FormMessage state={state?.error ? state : null} /><SubmitButton>{t('post')}</SubmitButton></div>
      </div>
    </form>
  );
}

export function DeleteUpdateButton({ id, classId }: { id: string; classId: string }) {
  const t = useTranslations('course');
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} className="btn-ghost btn-sm text-faint hover:text-bad" aria-label={t('delete')}
      onClick={() => { if (window.confirm(t('deleteUpdate'))) start(async () => { await deleteUpdate(id, classId); }); }}>
      <X size={13} aria-hidden />
    </button>
  );
}

export function PinAppForm({ classId, apps }: { classId: string; apps: { id: string; name: string }[] }) {
  const t = useTranslations('course');
  const [state, action] = useActionState(pinApp, null);
  return (
    <form action={action} className="card grid gap-3 p-4 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
      <input type="hidden" name="class_id" value={classId} />
      <div><label className="label" htmlFor="pa-app">{t('app')}</label>
        <select id="pa-app" name="app_id" className="input" required defaultValue="">
          <option value="" disabled>—</option>
          {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select></div>
      <div><label className="label" htmlFor="pa-url">{t('courseLink')}</label>
        <input id="pa-url" name="url_override" type="url" placeholder="https://schoology.springisd.org/course/…" className="input" /></div>
      <SubmitButton>{t('pinApp')}</SubmitButton>
      <div className="sm:col-span-3"><FormMessage state={state} /></div>
    </form>
  );
}

export function UnpinButton({ classId, appId }: { classId: string; appId: string }) {
  const t = useTranslations('course');
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button type="button" disabled={pending} className="btn-ghost btn-sm text-faint hover:text-bad" aria-label={t('unpin')}
      onClick={() => start(async () => { await unpinApp(classId, appId); router.refresh(); })}>
      <X size={13} aria-hidden />
    </button>
  );
}

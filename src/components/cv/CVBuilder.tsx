'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocale, useTranslations } from 'next-intl';
import {
  Briefcase, Check, ChevronDown, Download, Eye, EyeOff, FileText, GraduationCap, Languages, Plus, Sparkles, Trash2, UserRound, Wand2, X,
  Award, CalendarClock, Users, Star, Loader2, FolderInput,
} from 'lucide-react';
import { browserClient } from '@/lib/supabase/browser';
import { ACCENTS, ACTIVITY_SUGGESTIONS, CERT_SUGGESTIONS, SKILL_SUGGESTIONS, SOFT_SUGGESTIONS, normalizeCV, uid,
  type CV, type CVExperience, type CVGoal } from '@/lib/cv/model';
import { cvAssist } from '@/lib/cv/actions';
import { cn } from '@/lib/util';
import { CVDocument, PAGE_H, PAGE_W, type CVLabels } from './CVDocument';

export interface PortfolioPick { id: string; title: string; description: string | null; reflection: string | null; skills: string[]; tools: string[]; completed_on: string | null }

type Group = { group: string; items: string[] };

/** Chips + type-ahead with grouped suggestions (the "dropdown for suggestions"). */
function ChipPicker({ values, onChange, groups, placeholder, max = 24, id }:
  { values: string[]; onChange: (v: string[]) => void; groups: Group[]; placeholder: string; max?: number; id: string }) {
  const t = useTranslations('cv');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close); return () => document.removeEventListener('mousedown', close);
  }, []);
  const lower = new Set(values.map((v) => v.toLowerCase()));
  const filtered = groups.map((g) => ({ group: g.group, items: g.items.filter((i) => !lower.has(i.toLowerCase()) && i.toLowerCase().includes(q.trim().toLowerCase())) })).filter((g) => g.items.length);
  const flat = filtered.flatMap((g) => g.items);
  const add = (v: string) => {
    const s = v.trim().slice(0, 60);
    if (!s || lower.has(s.toLowerCase()) || values.length >= max) return;
    onChange([...values, s]); setQ(''); setActive(0);
  };
  return (
    <div ref={box} className="relative">
      <div className="flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-lg border border-line bg-sunk/40 px-2 py-1.5 focus-within:border-ember/60">
        {values.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-full border border-line bg-[rgb(var(--panel))] py-0.5 pl-2.5 pr-1 text-xs">
            {v}<button type="button" className="rounded-full p-0.5 text-muted hover:text-ink" aria-label={t('remove', { item: v })} onClick={() => onChange(values.filter((x) => x !== v))}><X size={12} aria-hidden /></button>
          </span>
        ))}
        <input id={id} value={q} placeholder={values.length ? '' : placeholder} autoComplete="off"
          role="combobox" aria-expanded={open} aria-controls={`${id}-list`} aria-autocomplete="list"
          onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(open && flat[active] && (q.trim() === '' || flat[active].toLowerCase().startsWith(q.trim().toLowerCase())) ? flat[active] : q); }
            else if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(flat.length - 1, a + 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
            else if (e.key === 'Backspace' && !q && values.length) onChange(values.slice(0, -1));
            else if (e.key === 'Escape') setOpen(false);
          }}
          className="min-w-[140px] flex-1 bg-transparent px-1 py-1 text-sm outline-none" />
        <button type="button" className="rounded p-1 text-muted hover:text-ink" aria-label={t('showSuggestions')} onClick={() => setOpen((o) => !o)}><ChevronDown size={15} aria-hidden /></button>
      </div>
      {open && (filtered.length > 0 || q.trim()) && (
        <div id={`${id}-list`} role="listbox" className="absolute inset-x-0 z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-line p-1 shadow-2xl" style={{ background: 'rgb(var(--panel))' }}>
          {q.trim() && !flat.some((f) => f.toLowerCase() === q.trim().toLowerCase()) && (
            <button type="button" role="option" aria-selected={false} onMouseDown={(e) => e.preventDefault()} onClick={() => add(q)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-ember/10">
              <Plus size={14} aria-hidden />{t('addCustom', { item: q.trim() })}
            </button>
          )}
          {filtered.map((g) => (
            <div key={g.group} className="py-1">
              <div className="px-3 pb-1 pt-1.5 text-2xs font-semibold uppercase tracking-[0.08em] text-muted">{g.group}</div>
              {g.items.map((i) => {
                const n = flat.indexOf(i);
                return (
                  <button key={i} type="button" role="option" aria-selected={n === active} onMouseDown={(e) => e.preventDefault()} onClick={() => add(i)} onMouseEnter={() => setActive(n)}
                    className={cn('block w-full rounded-lg px-3 py-1.5 text-left text-sm', n === active ? 'bg-ember/[0.12]' : 'hover:bg-white/[0.04]')}>{i}</button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Section({ icon: Icon, title, hint, shown, onToggle, children, open: open0 = false }:
  { icon: typeof UserRound; title: string; hint?: string; shown?: boolean; onToggle?: () => void; children: React.ReactNode; open?: boolean }) {
  const t = useTranslations('cv');
  const [open, setOpen] = useState(open0);
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ember/12 ember-text"><Icon size={16} aria-hidden /></span>
          <span className="min-w-0"><span className={cn('block font-semibold', shown === false && 'text-muted line-through decoration-faint')}>{title}</span>{hint && <span className="block truncate text-2xs text-muted">{hint}</span>}</span>
          <ChevronDown size={16} className={cn('ml-auto shrink-0 text-muted transition-transform', open && 'rotate-180')} aria-hidden />
        </button>
        {onToggle && (
          <button type="button" onClick={onToggle} className="btn-ghost btn-sm h-8 w-8 justify-center p-0" aria-pressed={shown} title={shown ? t('hideSection') : t('showSection')} aria-label={shown ? t('hideSection') : t('showSection')}>
            {shown ? <Eye size={15} aria-hidden /> : <EyeOff size={15} aria-hidden />}
          </button>
        )}
      </div>
      {open && <div className="space-y-3 border-t border-line px-4 py-4">{children}</div>}
    </section>
  );
}

const Field = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => (
  <label className="block"><span className="label">{label}</span>{children}{hint && <span className="mt-1 block text-2xs text-faint">{hint}</span>}</label>
);

/**
 * Portfolio → My CV. A one-page CV for summer jobs, part-time work, internships, training programs and
 * volunteering. Pre-filled from the student's profile and NEXORA (classes as courses, skills from
 * returned work, portfolio projects). Autosaves; prints/saves as a one-page PDF.
 */
export function CVBuilder({ initial, seed, courses, nexoraSkills, portfolio, userId }:
  { initial: unknown; seed: Partial<CV>; courses: string[]; nexoraSkills: string[]; portfolio: PortfolioPick[]; userId: string }) {
  const t = useTranslations('cv');
  const locale = useLocale();
  const [cv, setCv] = useState<CV>(() => normalizeCV(initial, seed));
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'local' | 'error'>('idle');
  const [fit, setFit] = useState<{ fits: boolean; scale: number }>({ fits: true, scale: 1 });
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const [busy, setBusy] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const first = useRef(true);
  const LS = `nexora-cv-${userId}`;

  // No saved CV in the database yet? Use this device's copy if there is one.
  useEffect(() => {
    if (initial) return;
    try { const raw = localStorage.getItem(LS); if (raw) setCv(normalizeCV(JSON.parse(raw), seed)); } catch { /* private mode */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Autosave (database; falls back to this device if the CV table isn't available).
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setStatus('saving');
    const h = setTimeout(async () => {
      try { localStorage.setItem(LS, JSON.stringify(cv)); } catch { /* private mode */ }
      const { error } = await browserClient().from('cvs').upsert({ user_id: userId, data: cv });
      setStatus(error ? 'local' : 'saved');
    }, 900);
    return () => clearTimeout(h);
  }, [cv, userId, LS]);

  // Printing shows only the CV page (a print-only copy at the top of <body>, unscaled).
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); document.body.classList.add('cv-page'); return () => document.body.classList.remove('cv-page'); }, []);

  const set = <K extends keyof CV>(k: K, v: CV[K]) => setCv((c) => ({ ...c, [k]: v }));
  const setEdu = (k: keyof CV['education'], v: CV['education'][typeof k]) => setCv((c) => ({ ...c, education: { ...c.education, [k]: v } }));
  const setAv = (k: keyof CV['availability'], v: CV['availability'][typeof k]) => setCv((c) => ({ ...c, availability: { ...c.availability, [k]: v } }));
  const toggle = (k: keyof CV['show']) => setCv((c) => ({ ...c, show: { ...c.show, [k]: !c.show[k] } }));
  const setExp = (id: string, patch: Partial<CVExperience>) => setCv((c) => ({ ...c, experience: c.experience.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  const onFit = useCallback((fits: boolean, scale: number) => setFit((f) => (f.fits === fits && f.scale === scale ? f : { fits, scale })), []);

  async function assist(kind: 'statement' | 'bullet', key: string, args: Partial<Parameters<typeof cvAssist>[0]>, apply: (text: string) => void) {
    setBusy(key);
    const r = await cvAssist({ kind, goal: cv.goal, target: cv.target, locale,
      facts: { grade: cv.education.grade, program: cv.education.program, skills: [...cv.skills.technical, ...cv.skills.soft], experience: cv.experience.map((e) => [e.role, e.org].filter(Boolean).join(' at ')) },
      ...args });
    setBusy(null);
    if (r.text) apply(r.text);
  }

  const labels: CVLabels = useMemo(() => ({
    profile: t('doc.profile'), education: t('doc.education'), skills: t('doc.skills'), technical: t('doc.technical'), soft: t('doc.soft'),
    experience: t('doc.experience'), certs: t('doc.certs'), activities: t('doc.activities'), languages: t('doc.languages'), availability: t('doc.availability'),
    references: t('doc.references'), refOnRequest: t('doc.refOnRequest'), transport: t('doc.transport'), present: t('doc.present'), expected: t('doc.expected'),
    gpa: 'GPA', courses: t('doc.courses'), honors: t('doc.honors'), hours: t('doc.hours'), days: t('doc.days'), contact: t('doc.contact'),
    kind: { work: t('kind.work'), volunteer: t('kind.volunteer'), project: t('kind.project'), training: t('kind.training') },
    level: { native: t('level.native'), fluent: t('level.fluent'), conversational: t('level.conversational'), basic: t('level.basic') },
  }), [t]);

  const skillGroups: Group[] = useMemo(() => [
    ...(nexoraSkills.length ? [{ group: t('fromNexora'), items: nexoraSkills }] : []),
    ...SKILL_SUGGESTIONS,
  ], [nexoraSkills, t]);
  const goals: CVGoal[] = ['summer_job', 'part_time', 'internship', 'training', 'volunteer'];

  // ---- Preview scaling (the sheet is 816 px wide; fit it to the column).
  const wrap = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6);
  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(1, el.clientWidth / PAGE_W)));
    ro.observe(el); return () => ro.disconnect();
  }, [tab]);

  const statusText = { idle: '', saving: t('saving'), saved: t('saved'), local: t('savedLocal'), error: t('saveError') }[status];

  const preview = (
    <div className="lg:sticky lg:top-20">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs', fit.fits ? 'border-ok/40 text-ok' : 'border-warn/50 text-warn')} role="status">
          {fit.fits ? <Check size={13} aria-hidden /> : <FileText size={13} aria-hidden />}
          {fit.fits ? (fit.scale < 1 ? t('fitsScaled') : t('fits')) : t('tooLong')}
        </span>
        <span className="text-2xs text-muted" aria-live="polite">{statusText}</span>
        <button type="button" className="btn-primary btn-sm ml-auto" onClick={() => window.print()}><Download size={14} aria-hidden />{t('download')}</button>
      </div>
      <div ref={wrap} className="w-full">
        <div className="overflow-hidden rounded-md shadow-2xl ring-1 ring-black/10" style={{ width: PAGE_W * scale, height: PAGE_H * scale }}>
          <div className="cv-scale" style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: PAGE_W, height: PAGE_H }}>
            <CVDocument cv={cv} labels={labels} onFit={onFit} id="cv-sheet" />
          </div>
        </div>
      </div>
      <p className="mt-2 text-2xs text-faint">{t('printTip')}</p>
    </div>
  );

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-white/[0.04] p-1 text-sm lg:hidden" role="tablist">
        {(['edit', 'preview'] as const).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={cn('rounded-md py-2 font-medium', tab === k ? 'bg-[rgb(var(--panel))] text-ink shadow' : 'text-muted')}>{t(`tab.${k}`)}</button>
        ))}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)]">
        <div className={cn('min-w-0 space-y-3', tab === 'preview' && 'hidden lg:block')}>
          {/* 1. Goal + look */}
          <Section icon={Star} title={t('s.start')} hint={t('s.startHint')} open>
            <div>
              <span className="label">{t('goalLabel')}</span>
              <div className="flex flex-wrap gap-1.5">
                {goals.map((g) => (
                  <button key={g} type="button" aria-pressed={cv.goal === g} onClick={() => set('goal', g)}
                    className={cn('chip h-8 px-3 text-xs', cv.goal === g && 'border-ember/60 ember-text')}>{t(`goal.${g}`)}</button>
                ))}
              </div>
            </div>
            <Field label={t('targetLabel')} hint={t('targetHint')}><input className="input" value={cv.target} maxLength={80} onChange={(e) => set('target', e.target.value)} placeholder={t('targetPh')} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <span className="label">{t('templateLabel')}</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['classic', 'modern'] as const).map((k) => (
                    <button key={k} type="button" aria-pressed={cv.template === k} onClick={() => set('template', k)}
                      className={cn('rounded-lg border px-3 py-2 text-left text-sm', cv.template === k ? 'border-ember/60 bg-ember/[0.08]' : 'border-line')}>
                      <span className="block font-semibold">{t(`template.${k}`)}</span><span className="block text-2xs text-muted">{t(`templateHint.${k}`)}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="label">{t('accentLabel')}</span>
                <div className="flex flex-wrap gap-2 pt-1">
                  {ACCENTS.map((a) => (
                    <button key={a} type="button" aria-pressed={cv.accent === a} aria-label={a} onClick={() => set('accent', a)}
                      className={cn('h-8 w-8 rounded-full ring-offset-2 ring-offset-[rgb(var(--panel))]', cv.accent === a && 'ring-2 ring-[rgb(var(--ink))]')} style={{ background: a }} />
                  ))}
                </div>
              </div>
            </div>
          </Section>

          {/* 2. About you */}
          <Section icon={UserRound} title={t('s.about')} hint={t('s.aboutHint')}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('name')}><input className="input" value={cv.name} maxLength={80} onChange={(e) => set('name', e.target.value)} /></Field>
              <Field label={t('headline')} hint={t('headlineHint')}><input className="input" value={cv.headline} maxLength={90} onChange={(e) => set('headline', e.target.value)} /></Field>
              <Field label={t('email')}><input className="input" type="email" value={cv.email} maxLength={120} onChange={(e) => set('email', e.target.value)} /></Field>
              <Field label={t('phone')}><input className="input" type="tel" value={cv.phone} maxLength={30} onChange={(e) => set('phone', e.target.value)} /></Field>
              <Field label={t('city')} hint={t('cityHint')}><input className="input" value={cv.city} maxLength={60} onChange={(e) => set('city', e.target.value)} placeholder="Houston, TX" /></Field>
              <Field label={t('link')}><input className="input" value={cv.link} maxLength={120} onChange={(e) => set('link', e.target.value)} placeholder={t('linkPh')} /></Field>
            </div>
            <p className="rounded-lg border border-line bg-white/[0.02] p-3 text-2xs text-muted">{t('privacy')}</p>
          </Section>

          {/* 3. Profile statement */}
          <Section icon={Sparkles} title={t('s.statement')} hint={t('s.statementHint')} shown={cv.show.statement} onToggle={() => toggle('statement')}>
            <textarea className="textarea min-h-[96px] text-sm" value={cv.statement} maxLength={600} onChange={(e) => set('statement', e.target.value)} placeholder={t('statementPh')} />
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-sm" disabled={busy === 'st'} onClick={() => void assist('statement', 'st', { text: '' }, (x) => set('statement', x))}>
                {busy === 'st' ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Wand2 size={14} aria-hidden />}{t('writeForMe')}
              </button>
              {cv.statement.trim() && (
                <button type="button" className="btn btn-sm" disabled={busy === 'stp'} onClick={() => void assist('statement', 'stp', { text: cv.statement }, (x) => set('statement', x))}>
                  {busy === 'stp' ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Sparkles size={14} aria-hidden />}{t('polish')}
                </button>
              )}
            </div>
          </Section>

          {/* 4. Education */}
          <Section icon={GraduationCap} title={t('s.education')} hint={cv.education.school || t('s.educationHint')} shown={cv.show.education} onToggle={() => toggle('education')}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('school')}><input className="input" value={cv.education.school} maxLength={90} onChange={(e) => setEdu('school', e.target.value)} /></Field>
              <Field label={t('program')}><input className="input" value={cv.education.program} maxLength={90} onChange={(e) => setEdu('program', e.target.value)} placeholder={t('programPh')} /></Field>
              <Field label={t('grade')}>
                <select className="input" value={cv.education.grade} onChange={(e) => setEdu('grade', e.target.value)}>
                  <option value="">—</option>{['9', '10', '11', '12'].map((g) => <option key={g} value={t('gradeN', { n: g })}>{t('gradeN', { n: g })}</option>)}
                </select>
              </Field>
              <Field label={t('grad')}><input className="input" value={cv.education.grad} maxLength={30} onChange={(e) => setEdu('grad', e.target.value)} placeholder={t('gradPh')} /></Field>
              <Field label={t('gpa')} hint={t('gpaHint')}><input className="input" value={cv.education.gpa} maxLength={12} onChange={(e) => setEdu('gpa', e.target.value)} /></Field>
              <Field label={t('honors')}><input className="input" value={cv.education.honors} maxLength={120} onChange={(e) => setEdu('honors', e.target.value)} placeholder={t('honorsPh')} /></Field>
            </div>
            <div>
              <span className="label">{t('courses')}</span>
              <ChipPicker id="cv-courses" values={cv.education.courses} onChange={(v) => setEdu('courses', v)} max={8}
                groups={[{ group: t('fromNexora'), items: courses }]} placeholder={t('coursesPh')} />
            </div>
          </Section>

          {/* 5. Skills */}
          <Section icon={Star} title={t('s.skills')} hint={t('s.skillsHint')} shown={cv.show.skills} onToggle={() => toggle('skills')} open>
            <div><span className="label">{t('technical')}</span>
              <ChipPicker id="cv-tech" values={cv.skills.technical} onChange={(v) => set('skills', { ...cv.skills, technical: v })} groups={skillGroups} placeholder={t('technicalPh')} max={14} /></div>
            <div><span className="label">{t('soft')}</span>
              <ChipPicker id="cv-soft" values={cv.skills.soft} onChange={(v) => set('skills', { ...cv.skills, soft: v })} groups={[{ group: t('suggested'), items: SOFT_SUGGESTIONS }]} placeholder={t('softPh')} max={10} /></div>
          </Section>

          {/* 6. Experience & projects */}
          <Section icon={Briefcase} title={t('s.experience')} hint={t('s.experienceHint')} shown={cv.show.experience} onToggle={() => toggle('experience')}>
            {cv.experience.map((e, n) => (
              <div key={e.id} className="rounded-xl border border-line p-3">
                <div className="mb-2 flex items-center gap-2">
                  <select className="input h-8 w-auto py-0 text-xs" value={e.kind} onChange={(ev) => setExp(e.id, { kind: ev.target.value as CVExperience['kind'] })} aria-label={t('kindLabel')}>
                    {(['work', 'volunteer', 'project', 'training'] as const).map((k) => <option key={k} value={k}>{t(`kind.${k}`)}</option>)}
                  </select>
                  <span className="text-2xs text-muted">#{n + 1}</span>
                  <button type="button" className="btn-ghost btn-sm ml-auto h-8 w-8 justify-center p-0 text-bad" aria-label={t('removeEntry')} onClick={() => set('experience', cv.experience.filter((x) => x.id !== e.id))}><Trash2 size={14} aria-hidden /></button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input className="input" value={e.role} maxLength={80} onChange={(ev) => setExp(e.id, { role: ev.target.value })} placeholder={t('rolePh')} aria-label={t('role')} />
                  <input className="input" value={e.org} maxLength={80} onChange={(ev) => setExp(e.id, { org: ev.target.value })} placeholder={t('orgPh')} aria-label={t('org')} />
                  <input className="input" value={e.place} maxLength={60} onChange={(ev) => setExp(e.id, { place: ev.target.value })} placeholder={t('placePh')} aria-label={t('place')} />
                  <div className="grid grid-cols-2 gap-2">
                    <input className="input" value={e.start} maxLength={20} onChange={(ev) => setExp(e.id, { start: ev.target.value })} placeholder={t('startPh')} aria-label={t('start')} />
                    <input className="input" value={e.end} maxLength={20} onChange={(ev) => setExp(e.id, { end: ev.target.value })} placeholder={t('endPh')} aria-label={t('end')} />
                  </div>
                </div>
                <div className="mt-2 space-y-1.5">
                  {e.bullets.map((b, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <span className="text-muted" aria-hidden>•</span>
                      <input className="input h-9 flex-1 text-sm" value={b} maxLength={160} placeholder={t('bulletPh')} aria-label={t('bullet', { n: i + 1 })}
                        onChange={(ev) => setExp(e.id, { bullets: e.bullets.map((x, j) => (j === i ? ev.target.value : x)) })} />
                      <button type="button" className="btn-ghost btn-sm h-9 w-9 justify-center p-0" disabled={!b.trim() || busy === `${e.id}-${i}`} title={t('polish')} aria-label={t('polish')}
                        onClick={() => void assist('bullet', `${e.id}-${i}`, { text: b, role: e.role, org: e.org }, (x) => setExp(e.id, { bullets: e.bullets.map((y, j) => (j === i ? x : y)) }))}>
                        {busy === `${e.id}-${i}` ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Sparkles size={14} aria-hidden />}
                      </button>
                      <button type="button" className="btn-ghost btn-sm h-9 w-9 justify-center p-0" aria-label={t('removeBullet')} onClick={() => setExp(e.id, { bullets: e.bullets.filter((_, j) => j !== i) })}><X size={14} aria-hidden /></button>
                    </div>
                  ))}
                  {e.bullets.length < 4 && <button type="button" className="text-xs text-muted hover:text-ink" onClick={() => setExp(e.id, { bullets: [...e.bullets, ''] })}><Plus size={12} className="mr-1 inline" aria-hidden />{t('addBullet')}</button>}
                </div>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-sm" onClick={() => set('experience', [...cv.experience, { id: uid(), kind: 'work', role: '', org: '', place: '', start: '', end: '', bullets: [''] }])}><Plus size={14} aria-hidden />{t('addExperience')}</button>
              {portfolio.length > 0 && <button type="button" className="btn btn-sm" onClick={() => setShowImport((s) => !s)}><FolderInput size={14} aria-hidden />{t('fromPortfolio')}</button>}
            </div>
            {showImport && (
              <ul className="space-y-1.5 rounded-xl border border-line p-2">
                {portfolio.map((p) => {
                  const added = cv.experience.some((e) => e.id === `pf-${p.id}`);
                  return (
                    <li key={p.id} className="flex items-center gap-2 text-sm">
                      <span className="min-w-0 flex-1 truncate">{p.title}</span>
                      <button type="button" className="btn btn-sm" disabled={added} onClick={() => {
                        const bullets = [p.description, p.reflection].filter(Boolean).map((x) => x!.split(/(?<=[.!?])\s/)[0].slice(0, 160)).slice(0, 2);
                        const tools = [...p.tools, ...p.skills].slice(0, 4);
                        if (tools.length) bullets.push(`${t('usedTools')}: ${tools.join(', ')}`);
                        set('experience', [...cv.experience, { id: `pf-${p.id}`, kind: 'project', role: p.title, org: t('classProject'), place: '', start: p.completed_on ? p.completed_on.slice(0, 7) : '', end: p.completed_on ? p.completed_on.slice(0, 7) : '', bullets }]);
                      }}>{added ? <Check size={13} aria-hidden /> : <Plus size={13} aria-hidden />}{added ? t('added') : t('add')}</button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          {/* 7. Certifications & training */}
          <Section icon={Award} title={t('s.certs')} hint={t('s.certsHint')} shown={cv.show.certs} onToggle={() => toggle('certs')}>
            {cv.certs.map((c) => (
              <div key={c.id} className="grid gap-2 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_100px_36px]">
                <input className="input" list="cv-cert-list" value={c.name} maxLength={90} placeholder={t('certPh')} aria-label={t('certName')}
                  onChange={(e) => set('certs', cv.certs.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)))} />
                <input className="input" value={c.issuer} maxLength={60} placeholder={t('issuerPh')} aria-label={t('issuer')}
                  onChange={(e) => set('certs', cv.certs.map((x) => (x.id === c.id ? { ...x, issuer: e.target.value } : x)))} />
                <input className="input" value={c.date} maxLength={20} placeholder={t('datePh')} aria-label={t('date')}
                  onChange={(e) => set('certs', cv.certs.map((x) => (x.id === c.id ? { ...x, date: e.target.value } : x)))} />
                <button type="button" className="btn-ghost btn-sm h-10 w-9 justify-center p-0 text-bad" aria-label={t('removeEntry')} onClick={() => set('certs', cv.certs.filter((x) => x.id !== c.id))}><Trash2 size={14} aria-hidden /></button>
              </div>
            ))}
            <datalist id="cv-cert-list">{CERT_SUGGESTIONS.map((c) => <option key={c} value={c} />)}</datalist>
            <button type="button" className="btn btn-sm" onClick={() => set('certs', [...cv.certs, { id: uid(), name: '', issuer: '', date: '' }])}><Plus size={14} aria-hidden />{t('addCert')}</button>
          </Section>

          {/* 8. Activities & awards */}
          <Section icon={Users} title={t('s.activities')} hint={t('s.activitiesHint')} shown={cv.show.activities} onToggle={() => toggle('activities')}>
            <ChipPicker id="cv-act" values={cv.activities} onChange={(v) => set('activities', v)} groups={[{ group: t('suggested'), items: ACTIVITY_SUGGESTIONS }]} placeholder={t('activitiesPh')} max={10} />
          </Section>

          {/* 9. Languages */}
          <Section icon={Languages} title={t('s.languages')} shown={cv.show.languages} onToggle={() => toggle('languages')}>
            {cv.languages.map((l) => (
              <div key={l.id} className="flex gap-2">
                <input className="input flex-1" list="cv-lang-list" value={l.name} maxLength={40} placeholder={t('languagePh')} aria-label={t('language')}
                  onChange={(e) => set('languages', cv.languages.map((x) => (x.id === l.id ? { ...x, name: e.target.value } : x)))} />
                <select className="input w-40" value={l.level} aria-label={t('levelLabel')} onChange={(e) => set('languages', cv.languages.map((x) => (x.id === l.id ? { ...x, level: e.target.value as typeof l.level } : x)))}>
                  {(['native', 'fluent', 'conversational', 'basic'] as const).map((k) => <option key={k} value={k}>{t(`level.${k}`)}</option>)}
                </select>
                <button type="button" className="btn-ghost btn-sm h-10 w-9 justify-center p-0 text-bad" aria-label={t('removeEntry')} onClick={() => set('languages', cv.languages.filter((x) => x.id !== l.id))}><Trash2 size={14} aria-hidden /></button>
              </div>
            ))}
            <datalist id="cv-lang-list">{['English', 'Spanish', 'Vietnamese', 'Chinese', 'Arabic', 'French', 'Hindi', 'Telugu', 'Urdu', 'Tagalog', 'Portuguese', 'ASL'].map((x) => <option key={x} value={x} />)}</datalist>
            <button type="button" className="btn btn-sm" onClick={() => set('languages', [...cv.languages, { id: uid(), name: '', level: 'fluent' }])}><Plus size={14} aria-hidden />{t('addLanguage')}</button>
          </Section>

          {/* 10. Availability */}
          <Section icon={CalendarClock} title={t('s.availability')} hint={t('s.availabilityHint')} shown={cv.show.availability} onToggle={() => toggle('availability')}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('availStart')}><input className="input" value={cv.availability.start} maxLength={30} onChange={(e) => setAv('start', e.target.value)} placeholder={t('availStartPh')} /></Field>
              <Field label={t('availEnd')}><input className="input" value={cv.availability.end} maxLength={30} onChange={(e) => setAv('end', e.target.value)} placeholder={t('availEndPh')} /></Field>
              <Field label={t('hours')}><input className="input" value={cv.availability.hours} maxLength={20} onChange={(e) => setAv('hours', e.target.value)} placeholder="20–30" /></Field>
              <Field label={t('days')}><input className="input" value={cv.availability.days} maxLength={60} onChange={(e) => setAv('days', e.target.value)} placeholder={t('daysPh')} /></Field>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={cv.availability.transport} onChange={(e) => setAv('transport', e.target.checked)} className="accent-[rgb(var(--nx-ember))]" />{t('transport')}</label>
            <Field label={t('availNote')}><input className="input" value={cv.availability.note} maxLength={100} onChange={(e) => setAv('note', e.target.value)} placeholder={t('availNotePh')} /></Field>
          </Section>

          {/* 11. References */}
          <Section icon={Users} title={t('s.references')} hint={t('s.referencesHint')} shown={cv.show.references} onToggle={() => toggle('references')}>
            <div className="flex flex-wrap gap-1.5">
              {(['on_request', 'list', 'none'] as const).map((m) => (
                <button key={m} type="button" aria-pressed={cv.references.mode === m} onClick={() => set('references', { ...cv.references, mode: m })}
                  className={cn('chip h-8 px-3 text-xs', cv.references.mode === m && 'border-ember/60 ember-text')}>{t(`ref.${m}`)}</button>
              ))}
            </div>
            {cv.references.mode === 'list' && (
              <>
                {cv.references.list.map((r) => (
                  <div key={r.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_36px]">
                    {(['name', 'title', 'contact'] as const).map((k) => (
                      <input key={k} className="input" value={r[k]} maxLength={80} placeholder={t(`refPh.${k}`)} aria-label={t(`refPh.${k}`)}
                        onChange={(e) => set('references', { ...cv.references, list: cv.references.list.map((x) => (x.id === r.id ? { ...x, [k]: e.target.value } : x)) })} />
                    ))}
                    <button type="button" className="btn-ghost btn-sm h-10 w-9 justify-center p-0 text-bad" aria-label={t('removeEntry')} onClick={() => set('references', { ...cv.references, list: cv.references.list.filter((x) => x.id !== r.id) })}><Trash2 size={14} aria-hidden /></button>
                  </div>
                ))}
                {cv.references.list.length < 3 && <button type="button" className="btn btn-sm" onClick={() => set('references', { ...cv.references, list: [...cv.references.list, { id: uid(), name: '', title: '', contact: '' }] })}><Plus size={14} aria-hidden />{t('addReference')}</button>}
                <p className="text-2xs text-faint">{t('refTip')}</p>
              </>
            )}
          </Section>
        </div>

        <div className={cn('min-w-0', tab === 'edit' && 'hidden lg:block')}>{preview}</div>
      </div>
      {mounted && createPortal(<div className="cv-print-root" aria-hidden><CVDocument cv={cv} labels={labels} /></div>, document.body)}
    </div>
  );
}

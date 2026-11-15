'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AppWindow, Link2, Upload } from 'lucide-react';
import { saveExperience } from '@/lib/actions';
import { FormMessage, SubmitButton } from '@/components/forms';
import { Uploader, type Uploaded } from '@/components/files/Uploader';
import { experienceTypeFor, fileKind } from '@/lib/files';
import { toEmbed } from '@/lib/embed';
import { cn } from '@/lib/util';

export interface ExperienceFormValues {
  id?: string; slug?: string; type: string; visibility: string; status: string; difficulty: string; subject: string; grade_range: string;
  duration_minutes: string; resource_url: string; worksheet_url: string; world_id: string; tags: string; skills: string; notes: string;
  source: 'link' | 'file' | 'app'; file?: Uploaded | null; app_id?: string | null;
  en: { title: string; short: string; objective: string; instructions: string };
  es: { title: string; short: string; objective: string; instructions: string };
}

const TYPES = ['website', 'lesson', 'lecture', 'document', 'presentation', 'spreadsheet', 'image', 'video', 'audio', 'simulation', 'lab', 'project', 'game', 'quiz',
  'tool', 'app', 'career', 'coding', 'cad', 'model3d', 'assessment', 'field_trip', 'file', 'other'] as const;

function Field({ id, label, children, hint }: { id: string; label: string; children: React.ReactNode; hint?: string }) {
  return <div><label className="label" htmlFor={id}>{label}</label>{children}{hint && <p className="mt-1 text-2xs text-faint">{hint}</p>}</div>;
}

export function ExperienceForm({ values, worlds, userId, apps }:
  { values: ExperienceFormValues; worlds: { id: string; name: string }[]; userId: string; apps: { id: string; name: string; category: string }[] }) {
  const t = useTranslations('studio');
  const te = useTranslations('experience');
  const tc = useTranslations('common');
  const tf = useTranslations('files');
  const [state, action] = useActionState(saveExperience, null);
  const [source, setSource] = useState(values.source);
  const [file, setFile] = useState<Uploaded | null>(values.file ?? null);
  const [type, setType] = useState(values.type);
  const [link, setLink] = useState(values.resource_url);
  const [title, setTitle] = useState(values.en.title);
  const detected = link.startsWith('http') ? toEmbed(link) : null;
  const tabs = [
    { k: 'link' as const, icon: Link2, label: tf('sourceLink'), hint: tf('sourceLinkHint') },
    { k: 'file' as const, icon: Upload, label: tf('sourceFile'), hint: tf('sourceFileHint') },
    { k: 'app' as const, icon: AppWindow, label: tf('sourceApp'), hint: tf('sourceAppHint') },
  ];
  return (
    <form action={action} className="space-y-8">
      {values.id && <input type="hidden" name="id" value={values.id} />}
      {values.slug && <input type="hidden" name="slug" value={values.slug} />}
      <input type="hidden" name="source" value={source} />
      <fieldset className="card space-y-4 p-5">
        <legend className="px-1 text-sm font-semibold">{tf('whatIsIt')}</legend>
        <div role="tablist" className="grid gap-2 sm:grid-cols-3">
          {tabs.map(({ k, icon: Icon, label, hint }) => (
            <button key={k} type="button" role="tab" aria-selected={source === k} onClick={() => setSource(k)}
              className={cn('flex items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                source === k ? 'border-ember/50 bg-ember/10' : 'border-line hover:border-white/20')}>
              <Icon size={18} className={source === k ? 'ember-text' : 'text-muted'} aria-hidden />
              <span><span className="block text-sm font-semibold">{label}</span><span className="block text-xs text-muted">{hint}</span></span>
            </button>
          ))}
        </div>
        {source === 'link' && (
          <Field id="e-url" label={t('url')} hint={detected ? (detected.embeddable ? tf('willEmbed', { provider: detected.provider }) : tf('willOpen', { provider: detected.provider })) : t('urlHint')}>
            <input id="e-url" name="resource_url" type="text" inputMode="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" className="input" required />
          </Field>
        )}
        {source === 'file' && (
          <>
            <Uploader bucket="experience-files" folder={`${userId}/x`} initial={file ? [file] : []} onChange={(fs) => {
              const f = fs[0] ?? null; setFile(f);
              if (f) { setType(experienceTypeFor(fileKind(f.name, f.mime), f.name)); if (!title) setTitle(f.name.replace(/\.[^.]+$/, '')); }
            }} />
            <input type="hidden" name="file_path" value={file?.path ?? ''} />
            <input type="hidden" name="file_name" value={file?.name ?? ''} />
            <input type="hidden" name="file_mime" value={file?.mime ?? ''} />
            <input type="hidden" name="file_size" value={file?.size ?? ''} />
          </>
        )}
        {source === 'app' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="e-app" label={tf('app')}>
              <select id="e-app" name="app_id" defaultValue={values.app_id ?? ''} className="input" required>
                <option value="" disabled>—</option>
                {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
            <Field id="e-applink" label={tf('deepLink')} hint={tf('deepLinkHint')}>
              <input id="e-applink" name="resource_url" type="text" inputMode="url" defaultValue={values.resource_url} placeholder="https://" className="input" />
            </Field>
          </div>
        )}
      </fieldset>
      <fieldset className="card grid gap-4 p-5 sm:grid-cols-2">
        <legend className="sr-only">English</legend>
        <div className="sm:col-span-2"><Field id="e-ten" label={t('titleEn')}><input id="e-ten" name="title_en" required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} className="input" /></Field></div>
        <div className="sm:col-span-2"><Field id="e-sen" label={t('shortEn')}><input id="e-sen" name="short_en" maxLength={300} defaultValue={values.en.short} className="input" /></Field></div>
        <Field id="e-oen" label={t('objectiveEn')}><textarea id="e-oen" name="objective_en" defaultValue={values.en.objective} className="textarea min-h-[80px]" /></Field>
        <Field id="e-ien" label={t('instructionsEn')}><textarea id="e-ien" name="instructions_en" defaultValue={values.en.instructions} className="textarea min-h-[80px]" /></Field>
      </fieldset>

      <fieldset className="card grid gap-4 p-5 sm:grid-cols-3">
        <legend className="sr-only">{te('details')}</legend>
        <Field id="e-type" label={te('type')}><select id="e-type" name="type" value={type} onChange={(e) => setType(e.target.value)} className="input">{TYPES.map((k) => <option key={k} value={k}>{te(`types.${k}`)}</option>)}</select></Field>
        <Field id="e-world" label={te('world')}><select id="e-world" name="world_id" defaultValue={values.world_id} className="input"><option value="">—</option>{worlds.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></Field>
        <Field id="e-diff" label={te('difficulty')}><select id="e-diff" name="difficulty" defaultValue={values.difficulty} className="input"><option value="">—</option>{(['Beginner', 'Intermediate', 'Advanced'] as const).map((d) => <option key={d} value={d}>{te(`difficulties.${d}`)}</option>)}</select></Field>
        <Field id="e-subj" label={t('subject')}><input id="e-subj" name="subject" defaultValue={values.subject} className="input" /></Field>
        <Field id="e-grade" label={t('gradeRange')}><input id="e-grade" name="grade_range" defaultValue={values.grade_range} placeholder="9–12" className="input" /></Field>
        <Field id="e-dur" label={t('durationMin')}><input id="e-dur" name="duration_minutes" type="number" min={1} max={10000} defaultValue={values.duration_minutes} className="input" /></Field>
        <div className="sm:col-span-3"><Field id="e-skills" label={te('skills')} hint={t('skillsHint')}><input id="e-skills" name="skills" defaultValue={values.skills} className="input" /></Field></div>
        <div className="sm:col-span-2"><Field id="e-tags" label={te('tags')} hint={t('tagsHint')}><input id="e-tags" name="tags" defaultValue={values.tags} className="input" /></Field></div>
        <Field id="e-ws" label={t('worksheetUrl')}><input id="e-ws" name="worksheet_url" defaultValue={values.worksheet_url} placeholder="https://" className="input" /></Field>
        <div className="sm:col-span-3"><Field id="e-notes" label={t('notes')} hint={te('teacherNotesHint')}><textarea id="e-notes" name="notes" defaultValue={values.notes} className="textarea min-h-[64px]" /></Field></div>
      </fieldset>

      <fieldset className="card grid gap-4 p-5 sm:grid-cols-2" lang="es">
        <legend className="px-1 text-sm font-semibold">{t('spanishSection')}</legend>
        <p className="-mt-2 text-xs text-muted sm:col-span-2">{t('spanishHint')}</p>
        <div className="sm:col-span-2"><Field id="e-tes" label={t('titleEs')}><input id="e-tes" name="title_es" maxLength={200} defaultValue={values.es.title} className="input" /></Field></div>
        <div className="sm:col-span-2"><Field id="e-ses" label={t('shortEs')}><input id="e-ses" name="short_es" maxLength={300} defaultValue={values.es.short} className="input" /></Field></div>
        <Field id="e-oes" label={t('objectiveEs')}><textarea id="e-oes" name="objective_es" defaultValue={values.es.objective} className="textarea min-h-[80px]" /></Field>
        <Field id="e-ies" label={t('instructionsEs')}><textarea id="e-ies" name="instructions_es" defaultValue={values.es.instructions} className="textarea min-h-[80px]" /></Field>
      </fieldset>

      <div className="flex flex-wrap items-end gap-3">
        <Field id="e-vis" label={t('visibilityLabel')}>
          <select id="e-vis" name="visibility" defaultValue={values.visibility} className="input">
            {(['private', 'organization', 'public'] as const).map((v) => <option key={v} value={v}>{te(`visibility.${v}`)}</option>)}
          </select>
        </Field>
        <Field id="e-status" label={t('statusLabel')}>
          <select id="e-status" name="status" defaultValue={values.status} className="input">
            {(['draft', 'published', 'archived'] as const).map((v) => <option key={v} value={v}>{te(`status.${v}`)}</option>)}
          </select>
        </Field>
        <SubmitButton>{tc('save')}</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

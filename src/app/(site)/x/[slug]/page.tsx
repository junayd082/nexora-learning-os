import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { ArrowLeft, ArrowRight, BadgeCheck, FileDown, Pencil, Play, Presentation, Shuffle } from 'lucide-react';
import { isLocale, type Locale } from '@/lib/brand';
import { createClient } from '@/lib/supabase/server';
import { getExperience, getFavoriteIds, getSequence, getViewer, listExperiences, worldName } from '@/lib/data';
import { remixExperience } from '@/lib/actions';
import { Cover, Page } from '@/components/Experience';
import { FavoriteButton } from '@/components/FavoriteButton';
import { AssignForm } from './AssignForm';
import { CopyButton } from '@/components/forms';
import { humanSize } from '@/lib/files';
import { headers } from 'next/headers';
import { cn } from '@/lib/util';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const exp = await getExperience((await params).slug, (await getLocale()) as Locale);
  return { title: exp?.t.title ?? 'Experience' };
}

export default async function ExperiencePage({ params, searchParams }:
  { params: Promise<{ slug: string }>; searchParams: Promise<{ content?: string; remixed?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const uiLocale = (await getLocale()) as Locale;
  const contentLocale = isLocale(sp.content) ? sp.content : uiLocale;
  const exp = await getExperience(slug, contentLocale);
  if (!exp) notFound();
  const t = await getTranslations('experience');
  const tc = await getTranslations('common');
  const viewer = await getViewer();
  const supabase = await createClient();

  const [favs, notesRes, classesRes, seq] = await Promise.all([
    viewer ? getFavoriteIds(viewer.id) : Promise.resolve(new Set<string>()),
    viewer?.isEducator ? supabase.from('experience_teacher_notes').select('locale,notes').eq('experience_id', exp.id) : Promise.resolve({ data: [] }),
    viewer?.isEducator ? supabase.from('classes').select('id,name,section').eq('teacher_id', viewer.id).eq('archived', false).order('created_at') : Promise.resolve({ data: [] }),
    getSequence('autocad-for-beginners'),
  ]);
  const notes = (notesRes.data ?? []) as { locale: string; notes: string }[];
  const note = (notes.find((n) => n.locale === contentLocale) ?? notes.find((n) => n.locale === 'en'))?.notes;
  const classes = (classesRes.data ?? []) as { id: string; name: string; section: string | null }[];

  // Previous / next within the learning path.
  let prev: { slug: string; title: string } | null = null;
  let next: { slug: string; title: string } | null = null;
  const pos = seq?.collection_items.find((i) => i.experience_id === exp.id)?.position;
  if (seq && pos !== undefined) {
    const neighbours = seq.collection_items.filter((i) => i.position === pos - 1 || i.position === pos + 1);
    const list = await listExperiences(uiLocale, { ids: neighbours.map((n) => n.experience_id) });
    const byId = new Map(list.map((e) => [e.id, e]));
    const p = neighbours.find((n) => n.position === pos - 1); const n = neighbours.find((n) => n.position === pos + 1);
    if (p && byId.get(p.experience_id)) prev = { slug: byId.get(p.experience_id)!.slug, title: byId.get(p.experience_id)!.t.title };
    if (n && byId.get(n.experience_id)) next = { slug: byId.get(n.experience_id)!.slug, title: byId.get(n.experience_id)!.t.title };
  }

  const isOwner = viewer && exp.creator_id === viewer.id;
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3001';
  const shareUrl = `${h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')}://${host}/x/${exp.slug}`;
  const typeLabel = t(`types.${exp.type}` as 'types.lesson');
  const details: [string, string | null][] = [
    [t('type'), typeLabel],
    [t('world'), exp.worlds ? worldName(exp.worlds, uiLocale) : null],
    [t('grade'), exp.grade_range],
    [t('difficulty'), exp.difficulty ? t(`difficulties.${exp.difficulty}` as 'difficulties.Beginner') : null],
    [t('duration'), exp.duration_minutes ? tc('minutes', { n: exp.duration_minutes }) : null],
    [t('creator'), exp.creator_name],
    [tc('version'), `v${exp.version}`],
    [t('launches'), String(exp.launch_count)],
  ];

  return (
    <Page>
      {sp.remixed && <p role="status" className="mb-4 rounded border border-ok/30 bg-ok/5 px-3 py-2 text-sm text-ok">{t('remixed')}</p>}
      {seq && pos !== undefined && (
        <Link href="/discover?world=autocad" className="mb-4 inline-flex items-center gap-1 text-xs text-muted hover:text-ink">
          <ArrowLeft size={12} aria-hidden />{t('partOf', { name: uiLocale === 'es' && seq.title_es ? seq.title_es : seq.title })}
        </Link>
      )}
      <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          <div className="card overflow-hidden">
            <Cover exp={exp} typeLabel={typeLabel} className="h-32 rounded-none" />
            <div className="p-6">
              <div className="flex flex-wrap items-center gap-1.5">
                {exp.quality && <span className="chip text-ok"><BadgeCheck size={11} aria-hidden />{t(`quality.${exp.quality}` as 'quality.teacher_verified')}</span>}
                {exp.status !== 'published' && <span className="chip text-warn">{t(`status.${exp.status}`)}</span>}
                <span className="chip">{t(`visibility.${exp.visibility}`)}</span>
                {exp.is_demo && <span className="chip text-warn">{tc('demo')}</span>}
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{exp.t.title}</h1>
              {exp.t.short_description && <p className="mt-2 text-[17px] text-muted">{exp.t.short_description}</p>}
              <div className="mt-6 flex flex-wrap gap-2">
                {(exp.embed_url || exp.file_path || (exp.source === 'app' && exp.resource_url)) && <Link href={`/x/${exp.slug}/play`} className="btn-primary"><Play size={15} aria-hidden />{t('launch')}</Link>}
                {exp.worksheet_url && <a href={exp.worksheet_url} className="btn" download><FileDown size={15} aria-hidden />{t('worksheet')}</a>}
                {viewer && <FavoriteButton id={exp.id} initial={favs.has(exp.id)} labels={{ on: t('favorited'), off: t('favorite') }} />}
                {viewer?.isEducator && exp.status === 'published' && <Link href={`/present/${exp.slug}`} className="btn"><Presentation size={15} aria-hidden />{t('present')}</Link>}
                {isOwner && <Link href={`/teach/${exp.slug}`} className="btn"><Pencil size={15} aria-hidden />{tc('edit')}</Link>}
                {viewer?.isEducator && !isOwner && (
                  <form action={remixExperience.bind(null, exp.id)}><button className="btn"><Shuffle size={15} aria-hidden />{t('remix')}</button></form>
                )}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
                <span className="text-2xs font-mono uppercase tracking-[0.14em] text-faint">{(await getTranslations('apps'))('shareTo')}</span>
                <a href={`https://classroom.google.com/share?url=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm">Google Classroom</a>
                <CopyButton text={shareUrl} label={(await getTranslations('apps'))('copyForSchoology')} />
                {exp.file_name && <span className="chip ml-auto">{exp.file_name}{exp.file_size ? ` · ${humanSize(exp.file_size)}` : ''}</span>}
              </div>
              {!viewer && <p className="mt-3 text-xs text-muted"><Link href={`/login?next=/x/${exp.slug}`} className="text-accent hover:underline">{t('signInToSave')}</Link></p>}
            </div>
          </div>

          {exp.available.length > 1 && (
            <div className="mt-6 flex items-center gap-2 text-xs text-muted">
              <span>{t('contentLanguage')}:</span>
              {exp.available.map((l) => (
                <Link key={l} href={`/x/${exp.slug}?content=${l}`} className={cn('chip h-6 px-2', exp.contentLocale === l && 'border-ink text-ink')}>{l.toUpperCase()}</Link>
              ))}
              {exp.t.machine_translated && <span className="text-faint">· {t('machineTranslated')}</span>}
            </div>
          )}

          <div className="mt-6 space-y-6" lang={exp.contentLocale}>
            {exp.t.learning_objective && (
              <section className="border-l-2 border-accent pl-4">
                <h2 className="eyebrow">{t('objective')}</h2>
                <p className="mt-1 text-[16px]">{exp.t.learning_objective}</p>
              </section>
            )}
            {exp.t.student_instructions && (
              <section>
                <h2 className="h2">{t('instructions')}</h2>
                <p className="mt-1 text-muted">{exp.t.student_instructions}</p>
              </section>
            )}
            {exp.t.description && (
              <section>
                <h2 className="h2">{t('about')}</h2>
                <p className="mt-1 whitespace-pre-line text-muted">{exp.t.description}</p>
              </section>
            )}
            {note && (
              <section className="rounded-md border border-warn/30 bg-warn/5 p-4">
                <h2 className="text-sm font-semibold">{t('teacherNotes')}</h2>
                <p className="text-2xs text-muted">{t('teacherNotesHint')}</p>
                <p className="mt-2 whitespace-pre-line text-sm">{note}</p>
              </section>
            )}
          </div>

          {(prev || next) && (
            <nav className="mt-10 grid gap-3 sm:grid-cols-2" aria-label="Learning path">
              {prev ? <Link href={`/x/${prev.slug}`} className="card p-4 hover:bg-white/[0.03]"><div className="eyebrow flex items-center gap-1"><ArrowLeft size={11} aria-hidden />{t('prev')}</div><div className="mt-1 text-sm font-medium">{prev.title}</div></Link> : <span />}
              {next && <Link href={`/x/${next.slug}`} className="card p-4 text-right hover:bg-white/[0.03]"><div className="eyebrow flex items-center justify-end gap-1">{t('next')}<ArrowRight size={11} aria-hidden /></div><div className="mt-1 text-sm font-medium">{next.title}</div></Link>}
            </nav>
          )}
        </div>

        <aside className="space-y-6">
          <section className="card">
            <h2 className="border-b border-line px-4 py-2.5 eyebrow">{t('details')}</h2>
            <dl className="divide-y divide-line text-sm">
              {details.filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 px-4 py-2"><dt className="text-muted">{k}</dt><dd className="text-right">{v}</dd></div>
              ))}
            </dl>
          </section>
          {exp.skills.length > 0 && (
            <section>
              <h2 className="eyebrow pb-2">{t('skills')}</h2>
              <div className="flex flex-wrap gap-1.5">{exp.skills.map((s) => <span key={s} className="chip">{s}</span>)}</div>
            </section>
          )}
          {exp.tags.length > 0 && (
            <section>
              <h2 className="eyebrow pb-2">{t('tags')}</h2>
              <div className="flex flex-wrap gap-1.5">{exp.tags.map((s) => <Link key={s} href={`/discover?q=${encodeURIComponent(s)}`} className="chip hover:text-ink">#{s}</Link>)}</div>
            </section>
          )}
          {viewer?.isEducator && exp.status === 'published' && (
            <section className="card p-4">
              <h2 className="h2">{t('assignTitle')}</h2>
              {classes.length === 0
                ? <p className="mt-2 text-sm text-muted">{t('assignNoClasses')} <Link href="/classes" className="text-accent hover:underline">→</Link></p>
                : <AssignForm experienceId={exp.id} slug={exp.slug} defaultTitle={exp.t.title} classes={classes} />}
            </section>
          )}
          {exp.resource_url && exp.resource_url.startsWith('http') && (
            <a href={exp.resource_url} target="_blank" rel="noopener noreferrer" className="block text-xs text-muted hover:text-ink">{t('openOriginal')} ↗</a>
          )}
        </aside>
      </div>
    </Page>
  );
}

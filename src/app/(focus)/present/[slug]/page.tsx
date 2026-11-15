import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import type { Locale } from '@/lib/brand';
import { createClient } from '@/lib/supabase/server';
import { getExperience, getViewer } from '@/lib/data';
import { startSession } from '@/lib/actions';
import { Logo } from '@/components/Logo';
import { SubmitButton } from '@/components/forms';
import { Presenter } from './Presenter';
import en from '../../../../../messages/en';
import es from '../../../../../messages/es';

export const metadata = { title: 'Presentation Mode' };

export default async function Present({ params, searchParams }:
  { params: Promise<{ slug: string }>; searchParams: Promise<{ s?: string; error?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=/present/${slug}`);
  if (!viewer.isEducator) redirect(`/x/${slug}`);
  const locale = (await getLocale()) as Locale;
  const [expEn, expEs] = await Promise.all([getExperience(slug, 'en'), getExperience(slug, 'es')]);
  if (!expEn || !expEs) notFound();
  const t = await getTranslations('present');
  const supabase = await createClient();

  if (!sp.s) {
    const { data: classes } = await supabase.from('classes').select('id,name,section').eq('teacher_id', viewer.id).eq('archived', false).order('created_at');
    const exp = locale === 'es' ? expEs : expEn;
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <Logo href="/home" />
        <div className="mt-10 eyebrow">{t('title')}</div>
        <h1 className="mt-1 h1">{exp.t.title}</h1>
        {sp.error && <p role="alert" className="mt-4 text-sm text-bad">{(await getTranslations('common'))('somethingWrong')}</p>}
        <form action={startSession} className="mt-8 space-y-4 card p-5">
          <input type="hidden" name="experience_id" value={exp.id} />
          <input type="hidden" name="slug" value={slug} />
          <div>
            <label className="label" htmlFor="pc">{t('forClass')}</label>
            <select id="pc" name="class_id" className="input h-10">
              {(classes ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}{c.section ? ` — ${c.section}` : ''}</option>)}
              <option value="">{t('noClass')}</option>
            </select>
          </div>
          <fieldset>
            <legend className="label">{t('langLabel')}</legend>
            <div className="flex gap-2">
              {(['en', 'es', 'both'] as const).map((m) => (
                <label key={m} className="flex h-9 flex-1 cursor-pointer items-center justify-center gap-2 rounded border border-line text-sm has-[:checked]:border-accent has-[:checked]:bg-accent/5">
                  <input type="radio" name="locale_mode" value={m} defaultChecked={m === locale} className="accent-[rgb(var(--accent))]" />
                  {m === 'both' ? t('both') : m.toUpperCase()}
                </label>
              ))}
            </div>
          </fieldset>
          <SubmitButton className="btn-primary h-10 w-full">{t('startSession')}</SubmitButton>
        </form>
        <Link href={`/x/${slug}`} className="mt-4 inline-block text-sm text-muted hover:text-ink">← {t('exit')}</Link>
      </div>
    );
  }

  const { data: session } = await supabase.from('live_sessions').select('*').eq('id', sp.s).eq('host_id', viewer.id).maybeSingle();
  if (!session) redirect(`/present/${slug}`);
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  const pick = (e: typeof expEn) => ({ title: e.t.title, objective: e.t.learning_objective, instructions: e.t.student_instructions });
  return (
    <Presenter
      sessionId={session.id}
      code={session.code}
      status={session.status}
      slug={slug}
      origin={`${proto}://${host}`}
      initialMode={session.locale_mode}
      content={{ en: pick(expEn), es: pick(expEs) }}
      labels={{ en: en.present, es: es.present }}
      uiLocale={locale}
    />
  );
}

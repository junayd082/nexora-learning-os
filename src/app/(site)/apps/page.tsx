import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { ExternalLink, Play } from 'lucide-react';
import type { Locale } from '@/lib/brand';
import { createClient } from '@/lib/supabase/server';
import { appInitials, getApps, getViewer } from '@/lib/data';
import { Page, PageHeader } from '@/components/Experience';
import { DeleteAppButton, NewAppForm, PinToClass } from './forms';

export const metadata = { title: 'App Center' };

const ORDER = ['lms', 'cad', 'google', 'productivity', 'create', 'media', 'engage', 'math', 'science', 'learn', 'cte', 'research', 'games', 'other'];

export default async function Apps() {
  const viewer = await getViewer();
  const t = await getTranslations('apps');
  const locale = (await getLocale()) as Locale;
  const apps = await getApps();
  let classes: { id: string; name: string }[] = [];
  if (viewer?.isEducator) {
    const supabase = await createClient();
    const { data } = await supabase.from('classes').select('id,name').eq('teacher_id', viewer.id).eq('archived', false).order('created_at');
    classes = data ?? [];
  }
  const mine = viewer ? apps.filter((a) => a.owner_id === viewer.id) : [];
  const cats = ORDER.filter((c) => apps.some((a) => a.category === c && a.owner_id !== viewer?.id));

  const card = (a: (typeof apps)[number]) => (
    <div key={a.id} className="lit lit-edge card flex flex-col gap-3 p-4" style={{ ['--glow' as string]: 'var(--nx-violet)' }}>
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.25)]" style={{ background: a.color }}>{appInitials(a.name)}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{a.name}</div>
          <div className="truncate text-xs text-muted">{new URL(a.url).hostname.replace(/^www\./, '')}</div>
        </div>
        {viewer && a.owner_id === viewer.id && <DeleteAppButton id={a.id} />}
      </div>
      {(locale === 'es' ? a.description_es ?? a.description : a.description) && <p className="line-clamp-2 text-sm text-muted">{locale === 'es' ? a.description_es ?? a.description : a.description}</p>}
      <div className="mt-auto flex flex-wrap items-center gap-2">
        {a.launch_mode === 'embed'
          ? <Link href={`/apps/${a.slug}`} className="btn-primary btn-sm"><Play size={13} aria-hidden />{t('open')}</Link>
          : <a href={a.url} target="_blank" rel="noopener noreferrer" className="btn btn-sm"><ExternalLink size={13} aria-hidden />{t('open')}</a>}
        {viewer?.isEducator && <PinToClass appId={a.id} classes={classes} />}
      </div>
    </div>
  );

  return (
    <Page wide>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      {viewer?.isEducator && (
        <section className="mb-10">
          <h2 className="eyebrow mb-3">{t('yourApps')}</h2>
          {mine.length > 0 && <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{mine.map(card)}</div>}
          <details open={mine.length === 0}>
            <summary className="btn cursor-pointer list-none">{t('addYourOwn')}</summary>
            <div className="mt-3 max-w-3xl"><NewAppForm /></div>
          </details>
        </section>
      )}
      <div className="space-y-10">
        {cats.map((c) => (
          <section key={c}>
            <h2 className="eyebrow mb-3">{t(`cat.${c}` as 'cat.other')}</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{apps.filter((a) => a.category === c && a.owner_id !== viewer?.id).map(card)}</div>
          </section>
        ))}
      </div>
      <p className="mt-10 max-w-3xl text-xs text-faint">{t('trademarks')}</p>
    </Page>
  );
}

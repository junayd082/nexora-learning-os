import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { brand } from '@/lib/brand';
import { getViewer } from '@/lib/data';
import { exportMyData } from '@/lib/actions';
import { Page, PageHeader } from '@/components/Experience';
import { LanguageButtons } from '@/components/LanguageSwitch';
import { ExportMyDataButton } from '@/components/forms';
import { LivingControls, ProfileForm, ThemeButtons } from './forms';
import { getLiving } from '@/lib/living';
import { getAppearance } from '@/lib/appearance';
import { AppearanceSettings } from '@/components/scene/AppearanceSettings';
import { GuideMe } from '@/components/tour/GuideMe';

export const metadata = { title: 'Profile & settings' };

function Section({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="grid scroll-mt-20 gap-4 border-b border-line py-8 md:grid-cols-[220px_1fr]">
      <h2 className="h2">{title}</h2>
      <div>{children}</div>
    </section>
  );
}

export default async function Profile() {
  const viewer = await getViewer();
  if (!viewer) redirect('/login?next=/profile');
  const t = await getTranslations('profile');
  const tc = await getTranslations('common');
  const theme = (await cookies()).get('NEXORA_THEME')?.value === 'light' ? 'light' : 'dark';
  const living = await getLiving();
  const appearance = await getAppearance();
  const tl = await getTranslations('living');
  const tg = await getTranslations('tour');
  const role = viewer.profile.is_platform_admin ? `${tc('teacher')} · ${tc('admin')}` : viewer.isEducator ? tc('teacher') : tc('student');
  return (
    <Page>
      <PageHeader title={t('title')} subtitle={tc('signedInAs', { name: viewer.email ?? viewer.profile.display_name })} />
      <div className="max-w-4xl">
        <Section title={t('account')}>
          <ProfileForm name={viewer.profile.display_name} bio={viewer.profile.bio ?? ''} />
          <p className="mt-4 text-sm text-muted">{t('role')}: {role}</p>
        </Section>
        <Section title={tg('guideMe')} id="guide"><GuideMe /></Section>
        <Section title={t('language')} id="language">
          <LanguageButtons />
          <p className="mt-2 text-sm text-muted">{t('languageHint')}</p>
        </Section>
        <section className="scroll-mt-20 border-b border-line py-8"><AppearanceSettings initial={appearance} /></section>
        <Section title={tl('title')} id="living">
          <LivingControls motion={living.motion} companion={living.companion} name={brand.companion.name} />
        </Section>
        <Section title={t('theme')}><ThemeButtons current={theme} /></Section>
        <Section title={t('shortcuts')}>
          <dl className="grid max-w-sm grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt><span className="kbd">Ctrl/⌘</span> <span className="kbd">K</span></dt><dd>{t('shortcutSearch')}</dd>
            <dt><span className="kbd">g</span> <span className="kbd">h</span></dt><dd>{t('shortcutHome')}</dd>
            <dt><span className="kbd">g</span> <span className="kbd">d</span></dt><dd>{t('shortcutDiscover')}</dd>
          </dl>
        </Section>
        <Section title={t('data')}>
          <p className="mb-3 text-sm text-muted">{t('dataBody')}</p>
          <ExportMyDataButton label={t('exportAll')} action={exportMyData} />
        </Section>
        <Section title={t('aboutNexora')} id="about">
          <dl className="grid max-w-md grid-cols-[120px_1fr] gap-y-2 text-sm">
            <dt className="text-muted">{brand.productName}</dt><dd>{brand.positioning}</dd>
            <dt className="text-muted">{tc('version')}</dt><dd className="font-mono">{brand.version} “{brand.versionName}”</dd>
            <dt className="text-muted">{t('build')}</dt><dd className="font-mono">{brand.build}</dd>
            <dt className="text-muted">{t('founder')}</dt><dd>{brand.founder}</dd>
            <dt className="text-muted">{t('mission')}</dt><dd>{brand.tagline}</dd>
            {brand.supportEmail && <><dt className="text-muted">{t('contact')}</dt><dd><a href={`mailto:${brand.supportEmail}`} className="text-accent hover:underline">{brand.supportEmail}</a></dd></>}
          </dl>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <Link href="/release-notes" className="text-accent hover:underline">{(await getTranslations('footer'))('releases')}</Link>
            <Link href="/about#privacy" className="text-accent hover:underline">{(await getTranslations('footer'))('privacy')}</Link>
            <Link href="/about#accessibility" className="text-accent hover:underline">{(await getTranslations('footer'))('accessibility')}</Link>
          </div>
        </Section>
      </div>
    </Page>
  );
}

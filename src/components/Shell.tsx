import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { brand } from '@/lib/brand';
import { getViewer } from '@/lib/data';
import { Logo } from './Logo';
import { LanguageSwitch } from './LanguageSwitch';
import { CommandPalette, SearchIconButton, SearchTrigger } from './CommandPalette';
import { MobileNav, PublicMobileMenu, SideNav, UserMenu, type NavGroup } from './Nav';
import { AmbientField } from './AmbientField';
import { Companion } from './companion/Companion';
import { getLiving } from '@/lib/living';
import { getAppearance } from '@/lib/appearance';
import { SceneBackground } from './scene/SceneBackground';
import { ThemeSwitch } from './scene/ThemeSwitch';
import { LiveProvider } from './live/LiveProvider';
import { HandsBell } from './live/HandsBell';
import { HandSheet, MyHandPill } from './live/RaiseHand';
import { MyPassPill, PassSheet } from './live/HallPass';
import { TimerPills, TimerTool } from './live/Timers';
import { Tour } from './tour/Tour';

export async function Footer() {
  const t = await getTranslations('footer');
  return (
    <footer className="relative z-10 border-t border-line no-print">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 pr-4 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:pr-28">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-mono tracking-[0.2em] text-ink/80">{brand.productName}</span>
          <span>{t('signature')}</span>
          <span className="text-faint">{t('created', { founder: brand.founder })}</span>
          <span className="font-mono text-faint">v{brand.version}</span>
        </div>
        <nav className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/about" className="hover:text-ink">{t('story')}</Link>
          <Link href="/founder" className="hover:text-ink">{t('founder')}</Link>
          <Link href="/keynote" className="hover:text-ink">{t('keynote')}</Link>
          <Link href="/demo" className="hover:text-ink">{t('live')}</Link>
          <Link href="/release-notes" className="hover:text-ink">{t('releases')}</Link>
          <Link href="/about#privacy" className="hover:text-ink">{t('privacy')}</Link>
          <Link href="/about#accessibility" className="hover:text-ink">{t('accessibility')}</Link>
        </nav>
      </div>
    </footer>
  );
}

async function NovaFor({ isEducator, signedIn = true }: { isEducator: boolean; signedIn?: boolean }) {
  const { motion, companion } = await getLiving();
  if (!companion) return null;
  const t = await getTranslations('companion');
  const name = brand.companion.name;
  return (
    <Companion name={name} motion={motion} appearance={await getAppearance()} isEducator={isEducator} signedIn={signedIn} labels={{
      menu: t('menu', { name }), search: t('search'), explore: t('explore'), continue: t('continue'),
      tasks: t('tasks'), hide: t('hide', { name }), resting: t('resting', { name }),
    }} />
  );
}

export async function Shell({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  const t = await getTranslations('nav');
  const tc = await getTranslations('common');
  const tl = await getTranslations('living');
  const tt = await getTranslations('tour');
  const living = await getLiving();

  if (!viewer) {
    const links = [
      { href: '/discover', label: t('discover') },
      { href: '/worlds', label: t('worlds') },
      { href: '/apps', label: t('apps') },
      { href: '/#educators', label: t('forEducators') },
      { href: '/#schools', label: t('forSchools') },
      { href: '/about', label: t('about') },
    ];
    const appearance = await getAppearance();
    return (
      <div className="relative flex min-h-screen flex-col">
        <SceneBackground initial={appearance} ambient={<AmbientField />} />
        <header className="sticky top-0 z-30 border-b border-line bg-sunk/70 backdrop-blur-md no-print">
          <div className="relative mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
            <Logo />
            <nav className="hidden flex-1 items-center gap-5 text-sm text-muted md:flex">
              {links.map((l) => <Link key={l.href} href={l.href} className="hover:text-ink">{l.label}</Link>)}
            </nav>
            <div className="ml-auto flex items-center gap-1">
              <LanguageSwitch />
              <ThemeSwitch initial={appearance} />
              <Link href="/join" className="btn-ghost btn-sm hidden sm:inline-flex">{t('join')}</Link>
              <Link href="/login" className="btn btn-sm">{t('signIn')}</Link>
              <PublicMobileMenu links={[...links, { href: '/join', label: t('join') }]} menuLabel={t('menu')} />
            </div>
          </div>
        </header>
        <CommandPalette pages={links.map((l) => ({ title: l.label, href: l.href }))} />
        <main id="main" className="relative z-10 flex-1">{children}</main>
        <Footer />
        <NovaFor isEducator={false} signedIn={false} />
      </div>
    );
  }

  const groups: NavGroup[] = [
    {
      label: t('learn'),
      items: [
        { key: 'home', href: '/home', label: t('home') },
        { key: 'discover', href: '/discover', label: t('discover') },
        { key: 'worlds', href: '/worlds', label: t('worlds') },
        { key: 'classrooms', href: '/classes', label: t('classrooms') },
        { key: 'portfolio', href: '/portfolio', label: t('portfolio') },
        { key: 'library', href: '/library', label: t('library') },
        { key: 'apps', href: '/apps', label: t('apps') },
      ],
    },
  ];
  if (viewer.isEducator) groups.push({ label: t('teaching'), items: [{ key: 'teach', href: '/teach', label: t('teach') }] });
  if (viewer.profile.is_platform_admin) groups[groups.length - 1].items.push({ key: 'admin', href: '/admin', label: t('admin') });
  if (!viewer.isEducator) groups[0].items.push({ key: 'join', href: '/join', label: t('join') });

  const roleLabel = viewer.profile.is_platform_admin ? tc('admin') : viewer.isEducator ? tc('teacher') : tc('student');
  const pages = groups.flatMap((g) => g.items.map((i) => ({ title: i.label, href: i.href })))
    .concat([{ title: t('profile'), href: '/profile' }, { title: t('releaseNotes'), href: '/release-notes' }, { title: t('about'), href: '/about' }]);

  const appearance = await getAppearance();
  return (
    <LiveProvider isEducator={viewer.isEducator}>
    <div className="relative flex min-h-screen">
      <SceneBackground initial={appearance} ambient={<AmbientField />} />
      <aside data-sidebar className="sticky top-0 z-20 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-sunk/60 py-5 pl-5 pr-3 backdrop-blur-md lg:flex no-print">
        <div className="px-1 pb-8"><Logo href="/home" gid="side" /></div>
        <SideNav groups={groups} />
        <div className="mt-auto space-y-3 px-2.5">
          <Link href="/profile#living" className="flex items-center gap-2 text-2xs text-muted hover:text-ink">
            <span className={living.motion === 'static' ? 'inline-block h-2 w-2 rounded-full bg-faint' : 'live-dot'} aria-hidden />
            {tl('title')} · {tl(living.motion)}
          </Link>
          <Link href="/about" className="block text-2xs text-faint hover:text-muted">{brand.productName} {brand.version} · {brand.founder}</Link>
        </div>
      </aside>
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-sunk/55 backdrop-blur-md no-print">
          <div className="flex h-14 items-center gap-2 px-4 sm:px-6">
            <MobileNav groups={groups} menuLabel={t('menu')} />
            <div className="lg:hidden"><Logo href="/home" gid="top" /></div>
            <span data-tour="search" className="contents"><SearchTrigger label={t('searchHint')} className="ml-auto hidden w-full max-w-sm md:flex lg:ml-0" /></span>
            <div className="ml-auto flex items-center gap-1">
              <span data-tour="search" className="contents"><SearchIconButton label={t('search')} /></span>
              {viewer.isEducator && <><span data-tour="timer" className="contents"><TimerTool /></span><span data-tour="bell" className="contents"><HandsBell /></span></>}
              {/* Teachers' phones: language lives in the ☰ menu to make room for the timer and bell. */}
              <span className={viewer.isEducator ? 'hidden sm:contents' : 'contents'}><LanguageSwitch /></span>
              <span data-tour="theme" className="contents"><ThemeSwitch initial={appearance} /></span>
              <UserMenu name={viewer.profile.display_name || viewer.email || ''} role={roleLabel} isDemo={viewer.profile.is_demo}
                companionOn={living.companion}
                labels={{ profile: t('profile'), signOut: t('signOut'), releases: t('releaseNotes'), living: tl('title'),
                  companion: brand.companion.name, on: tl('on'), off: tl('off'), guide: tt('guideMe') }} />
            </div>
          </div>
          {viewer.profile.is_demo && (
            <div className="border-t border-line bg-ember/10 px-4 py-1 text-center text-2xs ember-text sm:px-6">{tc('demoContent')} — {viewer.email}</div>
          )}
        </header>
        <CommandPalette pages={pages} />
        <main id="main" className="flex-1 pb-10">{children}</main>
        <Footer />
      </div>
      <NovaFor isEducator={viewer.isEducator} />
      <Tour userId={viewer.id} role={viewer.isEducator ? 'teacher' : 'student'} appearance={appearance} companionOn={living.companion} />
      <TimerPills />
      <HandSheet />
      <MyHandPill />
      <PassSheet />
      <MyPassPill />
    </div>
    </LiveProvider>
  );
}

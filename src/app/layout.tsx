import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import '@fontsource-variable/manrope';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './globals.css';
import './scene.css';
import './companion-forms.css';
import { brand } from '@/lib/brand';
import { getLiving } from '@/lib/living';
import { SCENE_COOKIE } from '@/lib/appearance';
import { isScenePref, resolveScene } from '@/lib/scenes/registry';

export const metadata: Metadata = {
  title: { default: `${brand.productName} — ${brand.tagline}`, template: `%s · ${brand.productName}` },
  description: `${brand.positioning}. ${brand.tagline}`,
  applicationName: brand.productName,
  authors: [{ name: brand.founder }],
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { color: '#090A0D' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  const theme = (await cookies()).get('NEXORA_THEME')?.value;
  const { motion } = await getLiving();
  const sceneCookie = (await cookies()).get(SCENE_COOKIE)?.value;
  const scene = resolveScene(isScenePref(sceneCookie) ? sceneCookie : null);
  return (
    <html lang={locale} data-theme={theme === 'light' ? 'light' : 'dark'} data-motion={motion} data-scene={scene} suppressHydrationWarning>
      <body className="min-h-screen font-sans text-[15px] leading-relaxed">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 btn">Skip to content</a>
        <NextIntlClientProvider locale={locale} messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}

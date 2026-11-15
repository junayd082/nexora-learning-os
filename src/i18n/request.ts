import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { LOCALE_COOKIE, isLocale, type Locale } from '@/lib/brand';
import en from '../../messages/en';
import es from '../../messages/es';

const catalogs = { en, es } as const;

export async function resolveLocale(): Promise<Locale> {
  const c = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(c)) return c;
  const accept = (await headers()).get('accept-language') ?? '';
  return /^es\b/i.test(accept.trim()) ? 'es' : 'en';
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  return { locale, messages: catalogs[locale], timeZone: 'America/Chicago' };
});

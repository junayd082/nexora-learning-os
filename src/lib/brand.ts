// Centralized brand configuration. Founder attribution lives here only — components read from it.
export const brand = {
  productName: 'NEXORA',
  tagline: 'Learn. Build. Explore. Become.',
  positioning: 'The Learning Operating System',
  signature: 'Built from the classroom outward.',
  founder: 'M. Chinnakotla',
  founderTitle: 'Engineering & Architecture Educator',
  copyright: `© ${new Date().getFullYear()} NEXORA`,
  version: '1.5.3',
  versionName: 'Class day',
  build: '2026.10.29',
  supportEmail: '', // Set a public contact address to show it on About and Settings.
  defaultLocale: 'en' as const,
  // The living companion. Name and species are configuration, not code.
  companion: { name: 'Nova', species: 'fox' as const },
  locales: ['en', 'es'] as const,
};

export type Locale = (typeof brand.locales)[number];
export const LOCALE_COOKIE = 'NEXORA_LOCALE';
export const isLocale = (v: unknown): v is Locale => v === 'en' || v === 'es';

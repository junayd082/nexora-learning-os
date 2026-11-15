import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      // App pages may not be framed by other sites.
      { source: '/((?!experiences/).*)', headers: [...securityHeaders, { key: 'X-Frame-Options', value: 'SAMEORIGIN' }] },
      // Lesson files are framed by NEXORA's own player.
      { source: '/experiences/:path*', headers: [...securityHeaders, { key: 'X-Frame-Options', value: 'SAMEORIGIN' }] },
    ];
  },
};

export default withNextIntl(config);

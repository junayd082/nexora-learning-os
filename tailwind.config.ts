import type { Config } from 'tailwindcss';

const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'),
        panel: v('panel'),
        sunk: v('sunk'),
        raise: v('raise'),
        line: 'rgb(var(--line) / var(--line-a))',
        ink: v('ink'),
        muted: v('muted'),
        faint: v('faint'),
        accent: v('accent'),
        'accent-ink': v('accent-ink'),
        ok: v('ok'),
        warn: v('warn'),
        bad: v('bad'),
        ember: v('nx-ember'),
        signal: v('nx-signal'),
        violet: v('nx-violet'),
        magenta: v('nx-magenta'),
        carbon: v('nx-carbon-1'),
      },
      fontFamily: {
        sans: ['"Manrope Variable"', 'Manrope', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: { DEFAULT: '5px', md: '7px', lg: '10px', xl: '14px' },
      fontSize: { '2xs': ['11px', '16px'] },
      transitionTimingFunction: { nx: 'cubic-bezier(0.22, 0.8, 0.24, 1)' },
    },
  },
  plugins: [],
} satisfies Config;

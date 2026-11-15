import { getTranslations } from 'next-intl/server';
import { brand } from '@/lib/brand';
import { getLiving } from '@/lib/living';
import { LanguageButtons } from './LanguageSwitch';
import { Fox } from './companion/Fox';

/** Sign-in / sign-up: atmospheric, calm, with Nova resting on the panel's edge. */
export async function AuthFrame({ title, children }: { title: string; children: React.ReactNode }) {
  const tf = await getTranslations('footer');
  const ta = await getTranslations('auth');
  const { companion } = await getLiving();
  return (
    <div className="glow-pool mx-auto flex max-w-md flex-col px-4 py-12 sm:py-16">
      <div className="mb-8 flex items-center justify-between">
        <span className="eyebrow ember-text">{ta('enter')}</span>
        <LanguageButtons />
      </div>
      <h1 className="display text-4xl">{title}</h1>
      <div className="relative mt-8">
        {companion && <div className="pointer-events-none absolute -top-[54px] right-3 h-[72px] w-[72px]"><Fox pose="lie" /></div>}
        <div className="card p-6 shadow-[var(--shadow-smoke),0_30px_80px_-30px_rgb(var(--nx-ember)/0.35)]">{children}</div>
      </div>
      <p className="mt-12 text-center text-2xs text-faint">{tf('signature')} {tf('created', { founder: brand.founder })}</p>
    </div>
  );
}

import { getTranslations } from 'next-intl/server';
import { JoinPanel } from './JoinPanel';

export const metadata = { title: 'Join' };

export default async function Join() {
  const t = await getTranslations('join');
  return <JoinPanel title={t('title')} body={t('body')} />;
}

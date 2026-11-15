import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/data';
import { Empty, Page, PageHeader } from '@/components/Experience';
import { CreateClassForm, JoinForm } from './forms';
import { PeriodIcon } from '@/components/scene/PeriodIcon';
import { getPeriodIcons } from '@/lib/appearance';
import { defaultIconFor, periodFrom } from '@/lib/period-icons';

export const metadata = { title: 'Classrooms' };

export default async function Classes({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect('/login?next=/classes');
  const sp = await searchParams;
  const t = await getTranslations('classes');
  const supabase = await createClient();
  const [{ data: teaching }, { data: enrolled }] = await Promise.all([
    supabase.from('classes').select('id,name,section,subject,join_code,archived,is_demo,enrollments(count)').eq('teacher_id', viewer.id).order('archived').order('created_at'),
    supabase.from('enrollments').select('classes(id,name,section,subject,is_demo,profiles!classes_teacher_id_fkey(display_name))').eq('user_id', viewer.id),
  ]);
  type E = { id: string; name: string; section: string | null; subject: string | null; is_demo: boolean; profiles: { display_name: string } | null };
  const enrolledList = (enrolled ?? []).map((e) => e.classes as unknown as E).filter(Boolean);
  const icons = await getPeriodIcons(enrolledList.map((c) => c.id)).catch(() => ({} as Awaited<ReturnType<typeof getPeriodIcons>>));

  return (
    <Page>
      <PageHeader title={t('title')} />
      {viewer.isEducator && (
        <section className="mb-10">
          <div className="mb-3 flex items-center justify-between"><h2 className="h2">{t('teaching')}</h2></div>
          {(teaching ?? []).length > 0 && (
            <div className="card mb-4 overflow-x-auto">
              <table className="table">
                <thead><tr><th>{t('name')}</th><th>{t('section')}</th><th className="text-right"><Users size={12} className="inline" aria-label="Students" /></th><th className="text-right">{t('joinCode')}</th></tr></thead>
                <tbody>
                  {(teaching ?? []).map((c) => (
                    <tr key={c.id} className={c.archived ? 'opacity-60' : ''}>
                      <td><Link href={`/classes/${c.id}`} className="font-medium hover:text-accent">{c.name}</Link>
                        {c.archived && <span className="chip ml-2">{t('archived')}</span>}{c.is_demo && <span className="chip ml-2 text-warn">Demo</span>}</td>
                      <td className="text-muted">{c.section}</td>
                      <td className="text-right font-mono text-xs">{(c.enrollments as unknown as { count: number }[])[0]?.count ?? 0}</td>
                      <td className="text-right font-mono text-xs">{c.join_code}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <details open={sp.new === '1' || (teaching ?? []).length === 0}>
            <summary className="btn-primary cursor-pointer list-none">{t('create')}</summary>
            <div className="mt-3 max-w-2xl"><CreateClassForm /></div>
          </details>
        </section>
      )}
      <section>
        <h2 className="mb-3 h2">{t('enrolled')}</h2>
        {enrolledList.length === 0 ? <Empty>{t('empty')}</Empty> : (
          <ul className="card mb-6 divide-y divide-line">
            {enrolledList.map((c) => (
              <li key={c.id} className="flex items-center gap-3 pl-3">
                <PeriodIcon classId={c.id} className={c.name} period={periodFrom(c.section)} icon={icons[c.id]} fallback={defaultIconFor(c.id, c.subject, c.name)} size={44} />
                <Link href={`/classes/${c.id}`} className="block min-w-0 flex-1 px-1 py-3 pr-4 hover:bg-white/[0.03]">
                  <span className="text-sm font-medium">{c.name}</span>{c.is_demo && <span className="chip ml-2 text-warn">Demo</span>}
                  <span className="block text-xs text-muted">{[c.section, c.subject, c.profiles?.display_name].filter(Boolean).join(' · ')}</span>
                </Link></li>
            ))}
          </ul>
        )}
        <div className="mt-6 max-w-md">
          <h3 className="text-sm font-medium">{t('joinTitle')}</h3>
          <p className="mb-3 text-sm text-muted">{t('joinBody')}</p>
          <JoinForm />
        </div>
      </section>
    </Page>
  );
}

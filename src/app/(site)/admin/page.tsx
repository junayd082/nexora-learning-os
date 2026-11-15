import { redirect } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/data';
import { Page, PageHeader } from '@/components/Experience';
import { DownloadButton } from '@/components/forms';
import { csv } from '@/lib/util';
import { FlagToggle, ResetDemo, RoleSelect } from './controls';

export const metadata = { title: 'Admin' };

type U = { id: string; email: string; display_name: string; role: string; is_platform_admin: boolean; is_demo: boolean; created_at: string; last_sign_in_at: string | null };
type L = { id: number; actor: string; action: string; entity_type: string | null; details: Record<string, unknown>; created_at: string };

export default async function Admin() {
  const viewer = await getViewer();
  if (!viewer) redirect('/login?next=/admin');
  if (!viewer.profile.is_platform_admin) redirect('/home');
  const t = await getTranslations('admin');
  const tc = await getTranslations('common');
  const f = await getFormatter();
  const supabase = await createClient();
  const [stats, users, flags, audit] = await Promise.all([
    supabase.rpc('admin_stats'),
    supabase.rpc('admin_list_users'),
    supabase.from('feature_flags').select('*').order('key'),
    supabase.rpc('admin_audit', { p_limit: 50 }),
  ]);
  const s = (stats.data ?? {}) as Record<string, number>;
  const uList = (users.data ?? []) as U[];
  const roleLabels = { student: tc('student'), teacher: tc('teacher'), admin: tc('admin') };
  const tiles: [string, number][] = [
    [t('students'), s.students], [t('educators'), s.educators], [t('classes'), s.classes],
    [t('experiences'), s.experiences], [t('submissions'), s.submissions], [t('launches7d'), s.launches_7d],
  ];
  return (
    <Page wide>
      <PageHeader title={t('title')} />
      <section>
        <h2 className="mb-3 eyebrow">{t('overview')}</h2>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
          {tiles.map(([k, v]) => (
            <div key={k} className="bg-panel p-4"><div className="text-2xs text-muted">{k}</div><div className="mt-1 font-mono text-2xl">{v ?? 0}</div></div>
          ))}
        </div>
        <p className="mt-2 text-2xs text-faint">{t('excludeNote')}</p>
      </section>

      <section className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="h2">{t('users')} <span className="font-mono text-xs font-normal text-muted">{uList.length}</span></h2>
          <DownloadButton filename="nexora-users.csv" mime="text/csv"
            data={csv([['email', 'name', 'role', 'admin', 'demo', 'created', 'last_sign_in'], ...uList.map((u) => [u.email, u.display_name, u.role, u.is_platform_admin ? 'yes' : '', u.is_demo ? 'yes' : '', u.created_at, u.last_sign_in_at])])}>
            {tc('exportCsv')}
          </DownloadButton>
        </div>
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>{t('name')}</th><th>{t('email')}</th><th>{t('role')}</th><th>{t('created')}</th><th>{t('lastSeen')}</th></tr></thead>
            <tbody>
              {uList.map((u) => (
                <tr key={u.id}>
                  <td className="whitespace-nowrap">{u.display_name}{u.is_platform_admin && <span className="chip ml-2">{t('platformAdmin')}</span>}{u.is_demo && <span className="chip ml-2 text-warn">Demo</span>}</td>
                  <td className="text-muted">{u.email}</td>
                  <td><RoleSelect userId={u.id} role={u.role} labels={roleLabels} disabled={u.id === viewer.id || u.is_demo} /></td>
                  <td className="whitespace-nowrap font-mono text-xs text-muted">{f.dateTime(new Date(u.created_at), { dateStyle: 'medium' })}</td>
                  <td className="whitespace-nowrap font-mono text-xs text-muted">{u.last_sign_in_at ? f.relativeTime(new Date(u.last_sign_in_at)) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 h2">{t('flags')}</h2>
          <ul className="card divide-y divide-line">
            {(flags.data ?? []).map((fl) => (
              <li key={fl.key} className="flex items-center gap-4 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-sm">{fl.key}</div>
                  <div className="text-xs text-muted">{fl.description}</div>
                  {fl.key === 'demo_accounts' && fl.enabled && <div className="mt-1 text-xs text-warn">{t('flagDemo')}</div>}
                  {fl.key === 'demo_accounts' && <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">{t('demoLive')}
                    <ResetDemo labels={{ button: t('demoReset'), busy: t('demoResetting'), done: t('demoResetDone'), failed: t('demoResetFailed') }} /></div>}
                </div>
                <FlagToggle k={fl.key} enabled={fl.enabled} labels={{ on: t('enabled'), off: t('disabled') }} />
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="mb-3 h2">{t('audit')}</h2>
          {((audit.data ?? []) as L[]).length === 0 ? <p className="text-sm text-muted">{t('noAudit')}</p> : (
            <div className="card overflow-x-auto">
              <table className="table">
                <thead><tr><th>{t('when')}</th><th>{t('actor')}</th><th>{t('action')}</th><th>{t('details')}</th></tr></thead>
                <tbody>
                  {((audit.data ?? []) as L[]).map((l) => (
                    <tr key={l.id}>
                      <td className="whitespace-nowrap font-mono text-xs text-muted">{f.dateTime(new Date(l.created_at), { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                      <td className="whitespace-nowrap">{l.actor}</td>
                      <td className="font-mono text-xs">{l.action}</td>
                      <td className="max-w-[200px] truncate font-mono text-2xs text-muted">{Object.keys(l.details ?? {}).length ? JSON.stringify(l.details) : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </Page>
  );
}

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/data';
import { Page } from '@/components/Experience';
import { CVBuilder, type PortfolioPick } from '@/components/cv/CVBuilder';
import type { CV } from '@/lib/cv/model';

export const metadata = { title: 'My CV' };

const titleCase = (s: string) => s.replace(/\b([a-z])/g, (m) => m.toUpperCase());

/** Portfolio → My CV. Everything NEXORA already knows is offered; nothing is added without the student. */
export default async function CVPage() {
  const viewer = await getViewer();
  if (!viewer) redirect('/login?next=/portfolio/cv');
  const t = await getTranslations('cv');
  const supabase = await createClient();
  const [cvRes, enr, items, subs, org] = await Promise.all([
    supabase.from('cvs').select('data').eq('user_id', viewer.id).maybeSingle(),
    supabase.from('enrollments').select('classes(name,subject,archived)').eq('user_id', viewer.id),
    supabase.from('portfolio_items').select('id,title,description,reflection,skills,tools,completed_on').eq('user_id', viewer.id).order('completed_on', { ascending: false, nullsFirst: false }).limit(20),
    supabase.from('submissions').select('status,assignments(experiences(skills))').eq('student_id', viewer.id).in('status', ['returned', 'submitted']).limit(200),
    supabase.from('profiles').select('organizations(name)').eq('id', viewer.id).maybeSingle(),
  ]);

  type C = { name: string; subject: string | null; archived: boolean };
  const classes = ((enr.data ?? []).map((e) => e.classes as unknown as C | null).filter((c): c is C => !!c && !c.archived));
  const courses = [...new Set(classes.map((c) => titleCase(c.name.trim())))];
  const text = classes.map((c) => `${c.name} ${c.subject ?? ''}`).join(' ').toLowerCase();
  const program = /architect|construct|drafting|cad/.test(text) ? t('programArch') : /engineer/.test(text) ? t('programEng') : '';
  const pf = (items.data ?? []) as PortfolioPick[];
  const skillSet = new Set<string>();
  ((subs.data ?? []) as unknown as { assignments: { experiences: { skills: string[] } | null } | null }[])
    .forEach((s) => s.assignments?.experiences?.skills?.forEach((k) => skillSet.add(k)));
  pf.forEach((p) => [...(p.skills ?? []), ...(p.tools ?? [])].forEach((k) => skillSet.add(k)));
  const orgName = (org.data as unknown as { organizations: { name?: string } | null } | null)?.organizations?.name;

  const seed: Partial<CV> = {
    name: viewer.profile.display_name || '',
    email: viewer.profile.is_demo ? '' : viewer.email || '',
    headline: [t('studentWord'), program].filter(Boolean).join(' · '),
    education: { school: orgName && !/demo/i.test(orgName) ? orgName : 'Westfield High School', program, grade: '', grad: '', gpa: '', courses: courses.slice(0, 6), honors: '' },
    skills: { technical: [...skillSet].slice(0, 6), soft: [] },
  };

  return (
    <Page wide>
      <Link href="/portfolio" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft size={14} aria-hidden />{t('backPortfolio')}</Link>
      <div className="mb-6">
        <h1 className="display text-3xl sm:text-4xl">{t('title')}</h1>
        <p className="mt-2 max-w-2xl text-muted">{t('subtitle')}</p>
      </div>
      <CVBuilder initial={cvRes.error ? null : cvRes.data?.data ?? null} seed={seed} courses={courses} nexoraSkills={[...skillSet].slice(0, 20)} portfolio={pf} userId={viewer.id} />
    </Page>
  );
}

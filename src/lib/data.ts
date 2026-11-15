import { cache } from 'react';
import { createClient } from './supabase/server';
import { isConfigured } from './supabase/env';
import type { App, Experience, ExperienceRow, Profile, Viewer, World } from './types';
import type { Locale } from './brand';

export const EXPERIENCE_SELECT =
  '*, experience_translations(locale,title,short_description,description,learning_objective,student_instructions,machine_translated), worlds(slug,name,name_es,accent)';

export const getViewer = cache(async (): Promise<Viewer | null> => {
  if (!isConfigured) return null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single<Profile>();
  if (!profile) return null;
  return {
    id: user.id,
    email: user.email ?? null,
    profile,
    isEducator: profile.role !== 'student' || profile.is_platform_admin,
  };
});

/** Pick the translation for the requested content language, falling back to the default, then any. */
export function resolveExperience(row: ExperienceRow, locale: Locale): Experience {
  const list = row.experience_translations ?? [];
  const t =
    list.find((x) => x.locale === locale) ??
    list.find((x) => x.locale === row.default_locale) ??
    list[0] ?? {
      locale: row.default_locale, title: row.slug, short_description: null, description: null,
      learning_objective: null, student_instructions: null, machine_translated: false,
    };
  const { experience_translations, ...rest } = row;
  return { ...rest, t, contentLocale: t.locale, available: list.map((x) => x.locale) };
}

export function worldName(w: Pick<World, 'name' | 'name_es'> | null | undefined, locale: Locale) {
  if (!w) return '';
  return locale === 'es' && w.name_es ? w.name_es : w.name;
}

export async function listExperiences(locale: Locale, opts: { worldId?: string; ids?: string[]; limit?: number; mine?: string } = {}) {
  if (!isConfigured) return [];
  const supabase = await createClient();
  let q = supabase.from('experiences').select(EXPERIENCE_SELECT).neq('status', 'archived');
  if (opts.worldId) q = q.eq('world_id', opts.worldId);
  if (opts.ids) q = q.in('id', opts.ids.length ? opts.ids : ['00000000-0000-0000-0000-000000000000']);
  if (opts.mine) q = q.eq('creator_id', opts.mine);
  else q = q.eq('status', 'published');
  q = q.order('created_at', { ascending: false }).limit(opts.limit ?? 200);
  const { data } = await q.returns<ExperienceRow[]>();
  return (data ?? []).map((r) => resolveExperience(r, locale));
}

export async function getExperience(slug: string, locale: Locale) {
  const supabase = await createClient();
  const { data } = await supabase.from('experiences').select(EXPERIENCE_SELECT).eq('slug', slug).maybeSingle<ExperienceRow>();
  return data ? resolveExperience(data, locale) : null;
}

export async function getWorlds() {
  if (!isConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase.from('worlds').select('*').order('sort_order').returns<World[]>();
  return data ?? [];
}

export async function getFlags(): Promise<Record<string, boolean>> {
  if (!isConfigured) return {};
  const supabase = await createClient();
  const { data } = await supabase.from('feature_flags').select('key,enabled');
  return Object.fromEntries((data ?? []).map((f) => [f.key, f.enabled]));
}

export async function getFavoriteIds(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from('favorites').select('experience_id').eq('user_id', userId);
  return new Set((data ?? []).map((f) => f.experience_id as string));
}

/** Collection order for sequenced playlists (e.g. AutoCAD for Beginners). */
export async function getSequence(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('collections')
    .select('id,slug,title,title_es,description,description_es,is_sequence,collection_items(experience_id,position)')
    .eq('slug', slug)
    .maybeSingle();
  return data as null | {
    id: string; slug: string; title: string; title_es: string | null; description: string | null; description_es: string | null;
    is_sequence: boolean; collection_items: { experience_id: string; position: number }[];
  };
}

export async function getApps() {
  if (!isConfigured) return [] as App[];
  const supabase = await createClient();
  const { data } = await supabase.from('apps').select('*').order('is_builtin', { ascending: false }).order('name');
  return (data ?? []) as App[];
}

export async function getClassApps(classId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from('class_apps').select('url_override,position,apps(*)').eq('class_id', classId).order('position');
  return ((data ?? []) as unknown as { url_override: string | null; apps: App | null }[])
    .filter((r) => r.apps).map((r) => ({ ...r.apps!, url: r.url_override ?? r.apps!.url }));
}

/** Monogram used instead of third-party logos. */
export function appInitials(name: string) {
  const w = name.replace(/[^A-Za-z0-9 ]/g, ' ').trim().split(/\s+/);
  return (w.length > 1 ? w[0][0] + w[1][0] : w[0].slice(0, 2)).toUpperCase();
}

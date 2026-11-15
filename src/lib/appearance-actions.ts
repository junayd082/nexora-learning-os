'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from './supabase/server';
import { MOTION_COOKIE } from './living';
import { SCENE_COOKIE, APPEARANCE_COOKIE, COMPANION_FORM_COOKIE, formatAppearanceCookie, parseAppearanceCookie } from './appearance';
import { FORM_ORDER } from '@/components/companion/forms/registry';
import { SCENE_ORDER } from './scenes/registry';
import { SYMBOL_ORDER, PALETTES } from './period-icons';

const YEAR = 60 * 60 * 24 * 365;
const sceneIds = ['season', ...SCENE_ORDER] as [string, ...string[]];

const AppearanceInput = z.object({
  scene: z.enum(sceneIds).optional(),
  motion: z.enum(['full', 'reduced', 'static']).optional(),
  intensity: z.number().min(0).max(1).optional(),
  contrast: z.number().min(0).max(1).optional(),
  focusDim: z.boolean().optional(),
  companion: z.enum(['scene', ...FORM_ORDER] as [string, ...string[]]).optional(),
});

/** Save any subset of the appearance settings. Cookies first (instant), then the student's row (all devices). */
export async function setAppearance(input: z.infer<typeof AppearanceInput>) {
  const a = AppearanceInput.parse(input);
  const store = await cookies();
  const opts = { path: '/', maxAge: YEAR, sameSite: 'lax' as const };
  if (a.scene) store.set(SCENE_COOKIE, a.scene, opts);
  if (a.motion) store.set(MOTION_COOKIE, a.motion, opts);
  if (a.companion) store.set(COMPANION_FORM_COOKIE, a.companion, opts);
  const rest = { ...parseAppearanceCookie(store.get(APPEARANCE_COOKIE)?.value) };
  if (a.intensity !== undefined) rest.intensity = a.intensity;
  if (a.contrast !== undefined) rest.contrast = a.contrast;
  if (a.focusDim !== undefined) rest.focusDim = a.focusDim;
  store.set(APPEARANCE_COOKIE, formatAppearanceCookie(rest), opts);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase.from('appearance_preferences').upsert({
      user_id: user.id,
      ...(a.scene && { scene: a.scene }),
      ...(a.motion && { motion: a.motion }),
      ...(a.companion && { companion_form: a.companion }),
      intensity: rest.intensity, contrast: rest.contrast, focus_dim: rest.focusDim,
      updated_at: new Date().toISOString(),
    });
  }
  return { ok: true };
}

const IconInput = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('scene'), scene: z.enum(SCENE_ORDER as [string, ...string[]]) }),
  z.object({ kind: z.literal('color'), palette: z.number().int().min(0).max(PALETTES.length - 1) }),
  z.object({ kind: z.literal('symbol'), symbol: z.enum(SYMBOL_ORDER as [string, ...string[]]), palette: z.number().int().min(0).max(PALETTES.length - 1) }),
]);

/** Set (or clear, with null) a student's icon for one class. Images go through uploadPeriodIcon instead. */
export async function setPeriodIcon(classId: string, icon: z.infer<typeof IconInput> | null) {
  const id = z.string().uuid().parse(classId);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'signed-out' };
  const prev = await supabase.from('period_icons').select('image_path').eq('user_id', user.id).eq('class_id', id).maybeSingle();
  if (icon === null) {
    await supabase.from('period_icons').delete().eq('user_id', user.id).eq('class_id', id);
  } else {
    const ic = IconInput.parse(icon);
    await supabase.from('period_icons').upsert({
      user_id: user.id, class_id: id, kind: ic.kind,
      scene: ic.kind === 'scene' ? ic.scene : null,
      palette: ic.kind === 'scene' ? null : ic.palette,
      symbol: ic.kind === 'symbol' ? ic.symbol : null,
      image_path: null, updated_at: new Date().toISOString(),
    });
  }
  if (prev.data?.image_path) await supabase.storage.from('period-icons').remove([prev.data.image_path]);
  revalidatePath('/home'); revalidatePath('/classes');
  return { ok: true };
}

/**
 * Upload a student's own class icon. The browser has already cropped it to 256×256 and
 * re-encoded it (which strips EXIF/GPS), so anything large or not WebP/JPEG is rejected here.
 */
export async function uploadPeriodIcon(form: FormData) {
  const id = z.string().uuid().parse(form.get('classId'));
  const file = form.get('file');
  if (!(file instanceof File)) return { error: 'bad-file' };
  if (!['image/webp', 'image/jpeg'].includes(file.type) || file.size > 300 * 1024) return { error: 'bad-file' };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'signed-out' };

  // Teachers can turn custom images off for a class.
  const { data: policy } = await supabase.from('class_appearance').select('allow_custom_icons').eq('class_id', id).maybeSingle();
  if (policy && policy.allow_custom_icons === false) return { error: 'not-allowed' };

  const path = `${user.id}/${id}-${Date.now()}.${file.type === 'image/webp' ? 'webp' : 'jpg'}`;
  const up = await supabase.storage.from('period-icons').upload(path, file, { contentType: file.type, upsert: false });
  if (up.error) return { error: 'upload-failed' };
  const prev = await supabase.from('period_icons').select('image_path').eq('user_id', user.id).eq('class_id', id).maybeSingle();
  await supabase.from('period_icons').upsert({ user_id: user.id, class_id: id, kind: 'image', scene: null, palette: null, symbol: null, image_path: path, updated_at: new Date().toISOString() });
  if (prev.data?.image_path) await supabase.storage.from('period-icons').remove([prev.data.image_path]);
  const { data: signed } = await supabase.storage.from('period-icons').createSignedUrl(path, 3600);
  revalidatePath('/home'); revalidatePath('/classes');
  return { ok: true, url: signed?.signedUrl };
}

/** Teacher: per-class rules. Row-level security only lets the class's teacher write. */
export async function setClassAppearance(classId: string, input: { allowCustomIcons?: boolean; lockScene?: string | null }) {
  const id = z.string().uuid().parse(classId);
  const v = z.object({ allowCustomIcons: z.boolean().optional(), lockScene: z.enum(SCENE_ORDER as [string, ...string[]]).nullable().optional() }).parse(input);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'signed-out' };
  const { data: cur } = await supabase.from('class_appearance').select('allow_custom_icons, lock_scene').eq('class_id', id).maybeSingle();
  const { error } = await supabase.from('class_appearance').upsert({
    class_id: id,
    allow_custom_icons: v.allowCustomIcons ?? cur?.allow_custom_icons ?? true,
    lock_scene: v.lockScene !== undefined ? v.lockScene : (cur?.lock_scene ?? null),
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: 'not-allowed' };
  revalidatePath(`/classes/${id}`);
  return { ok: true };
}

/**
 * Reading a lesson for the engines (checks, session summaries): a class material, an uploaded file,
 * pasted notes or a library experience. Server-only helper (not a server action).
 */
import { headers } from 'next/headers';
import { createClient } from './supabase/server';
import { getViewer } from './data';
import { markdownToText, readBuffer, readSiteFile, readUrl, type Source } from './engine/extract';

async function viewerOrThrow() {
  const v = await getViewer();
  if (!v) throw new Error('Not signed in.');
  return v;
}
async function origin() {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https');
  return `${proto}://${host}`;
}
// ---------------------------------------------------------------------------- reading a lesson
export async function readSource(fd: FormData, classId: string): Promise<Source | null> {
  const supabase = await createClient();
  const from = String(fd.get('source') ?? '');
  if (from === 'paste') {
    const text = String(fd.get('text') ?? '').trim().slice(0, 60_000);
    return text ? { title: String(fd.get('title') || 'Lesson notes').slice(0, 120), text } : null;
  }
  if (from === 'upload') {
    const path = String(fd.get('file_path') ?? '');
    const v = await viewerOrThrow();
    if (!path.startsWith(`${v.id}/`)) return null;
    const { data } = await supabase.storage.from('experience-files').download(path);
    if (!data) return null;
    return readBuffer(new Uint8Array(await data.arrayBuffer()), String(fd.get('file_mime') ?? data.type ?? ''), String(fd.get('file_name') ?? path));
  }
  if (from === 'material') {
    const { data: m } = await supabase.from('class_materials').select('*').eq('id', String(fd.get('material_id') ?? '')).eq('class_id', classId).maybeSingle();
    if (!m) return null;
    if (m.kind === 'file' && m.file_path) {
      const { data } = await supabase.storage.from('experience-files').download(m.file_path);
      if (!data) return null;
      const src = await readBuffer(new Uint8Array(await data.arrayBuffer()), m.file_mime ?? data.type ?? '', m.file_name ?? m.title);
      return { ...src, title: m.title || src.title };
    }
    if (m.kind === 'page') return { title: m.title, text: markdownToText(m.body ?? '') };
    if (m.kind === 'link' && m.url) return { ...(await readUrl(m.url, m.title)), title: m.title };
    if (m.kind === 'experience' && m.experience_id) return readExperience(m.experience_id);
    return null;
  }
  if (from === 'experience') return readExperience(String(fd.get('experience_id') ?? ''));
  return null;
}

export async function readExperience(id: string): Promise<Source | null> {
  const supabase = await createClient();
  const { data: x } = await supabase.from('experiences').select('*, experience_translations(*)').eq('id', id).maybeSingle();
  if (!x) return null;
  const tr = (x.experience_translations as { locale: string; title: string; description: string | null; learning_objective: string | null; short_description: string | null }[]);
  const t = tr.find((r) => r.locale === 'en') ?? tr[0];
  const intro = [t?.title, t?.learning_objective && `Objective: ${t.learning_objective}`, t?.description ?? t?.short_description].filter(Boolean).join('\n');
  let src: Source = { title: t?.title ?? 'Lesson', text: '' };
  if (x.file_path) {
    const { data } = await supabase.storage.from('experience-files').download(x.file_path);
    if (data) src = await readBuffer(new Uint8Array(await data.arrayBuffer()), x.file_mime ?? '', x.file_name ?? 'file');
  } else {
    const url: string | null = x.embed_url || x.resource_url;
    // AutoCAD lessons: prefer the lecture next to the lesson website.
    const paths = url?.startsWith('/') ? [url.replace(/lesson\.html$/, 'lecture.html'), url] : url ? [url] : [];
    for (const p of [...new Set(paths)]) {
      const r = p.startsWith('/') ? await readSiteFile(p, await origin()) : await readUrl(p);
      if (r.text.trim().length > 200 || r.binary) { src = r; break; }
    }
  }
  return { ...src, title: t?.title ?? src.title, text: [intro, src.text].filter(Boolean).join('\n\n') };
}


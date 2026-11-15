import { SUPABASE_URL } from './supabase/env';

/** What NEXORA does with a file. Viewing happens inside NEXORA wherever the browser can render it. */
export type FileKind =
  | 'pdf' | 'image' | 'video' | 'audio' | 'office' | 'text' | 'code' | 'csv' | 'markdown' | 'html'
  | 'model3d' | 'cad' | 'archive' | 'other';

const EXT: Record<string, FileKind> = {
  pdf: 'pdf',
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', avif: 'image', svg: 'image', bmp: 'image', heic: 'image',
  mp4: 'video', webm: 'video', mov: 'video', m4v: 'video', ogv: 'video',
  mp3: 'audio', wav: 'audio', m4a: 'audio', ogg: 'audio', aac: 'audio', flac: 'audio',
  doc: 'office', docx: 'office', ppt: 'office', pptx: 'office', xls: 'office', xlsx: 'office', odt: 'office', odp: 'office', ods: 'office', rtf: 'office',
  txt: 'text', log: 'text',
  csv: 'csv', tsv: 'csv',
  md: 'markdown', markdown: 'markdown',
  html: 'html', htm: 'html',
  json: 'code', js: 'code', ts: 'code', py: 'code', java: 'code', c: 'code', cpp: 'code', h: 'code', cs: 'code', css: 'code',
  xml: 'code', yaml: 'code', yml: 'code', sql: 'code', sh: 'code', ino: 'code', scad: 'code', gcode: 'code',
  glb: 'model3d', gltf: 'model3d', stl: 'model3d', obj: 'model3d', '3mf': 'model3d', usdz: 'model3d',
  dwg: 'cad', dxf: 'cad', dwf: 'cad', step: 'cad', stp: 'cad', iges: 'cad', igs: 'cad', skp: 'cad', rvt: 'cad', rfa: 'cad', ifc: 'cad', f3d: 'cad', ipt: 'cad', iam: 'cad', sldprt: 'cad',
  zip: 'archive', rar: 'archive', '7z': 'archive', tar: 'archive', gz: 'archive',
};

export const ext = (name: string) => (name.split('.').pop() ?? '').toLowerCase();

export function fileKind(name: string, mime?: string | null): FileKind {
  const e = ext(name);
  if (EXT[e]) return EXT[e];
  if (!mime) return 'other';
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('text/')) return 'text';
  return 'other';
}

/** Experience type to store for an uploaded file (drives labels and covers). */
export function experienceTypeFor(kind: FileKind, name: string) {
  const e = ext(name);
  if (kind === 'office') return ['ppt', 'pptx', 'odp'].includes(e) ? 'presentation' : ['xls', 'xlsx', 'ods'].includes(e) ? 'spreadsheet' : 'document';
  return ({ pdf: 'document', image: 'image', video: 'video', audio: 'audio', text: 'document', code: 'coding', csv: 'spreadsheet',
    markdown: 'document', html: 'website', model3d: 'model3d', cad: 'cad', archive: 'file', other: 'file' } as const)[kind];
}

/** The file formats teachers and students can upload (shown in the file picker). */
export const ACCEPT = Object.keys(EXT).map((e) => `.${e}`).join(',');
export const MAX_BYTES = 50 * 1024 * 1024;

export function publicFileUrl(path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/experience-files/${path.split('/').map(encodeURIComponent).join('/')}`;
}

export function humanSize(bytes?: number | null) {
  if (!bytes && bytes !== 0) return '';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0; let n = bytes;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n < 10 && i > 0 ? n.toFixed(1) : Math.round(n)} ${u[i]}`;
}

/** Storage-safe file name: keeps the extension, strips anything odd. */
export function safeName(name: string) {
  const e = ext(name);
  const base = name.slice(0, name.length - (e ? e.length + 1 : 0))
    .normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'file';
  return e ? `${base}.${e}` : base;
}

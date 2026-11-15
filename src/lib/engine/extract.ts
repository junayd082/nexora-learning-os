/**
 * Reads a lesson in (almost) any format and returns plain text for the question engine.
 * PDF, Word (.docx), PowerPoint (.pptx), Excel (.xlsx), web pages, Markdown, text, CSV,
 * Google Docs / Slides / Sheets / Drive links (shared “anyone with the link”).
 * Scanned PDFs and images are passed to the AI engine as-is when it is switched on.
 */

export interface Source {
  title: string;
  text: string;
  /** Original bytes the AI can read directly (PDF or image). */
  binary?: { data: Uint8Array; mime: string };
  warning?: string;
}

const MAX_TEXT = 60_000;
const MAX_BYTES = 30 * 1024 * 1024;

export function titleFromName(name: string) {
  return name.replace(/\.[a-z0-9]{1,5}$/i, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || 'Lesson';
}

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', hellip: '…' };
export function decodeEntities(s: string) {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
    return ENT[e.toLowerCase()] ?? m;
  });
}

export function htmlToText(html: string) {
  return decodeEntities(html
    .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|br)>|<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}

function tidy(text: string) {
  return text.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_TEXT);
}

async function xmlText(zip: import('jszip'), pattern: RegExp, tag: RegExp) {
  const names = Object.keys(zip.files).filter((n) => pattern.test(n))
    .sort((a, b) => (parseInt(a.match(/(\d+)\.xml$/)?.[1] ?? '0', 10) - parseInt(b.match(/(\d+)\.xml$/)?.[1] ?? '0', 10)));
  const out: { name: string; text: string }[] = [];
  for (const n of names) {
    const xml = await zip.files[n].async('string');
    const parts = [...xml.matchAll(tag)].map((m) => decodeEntities(m[1]));
    out.push({ name: n, text: parts.join(' ').replace(/\s+/g, ' ').trim() });
  }
  return out;
}

/** Read a file's bytes by type. */
export async function readBuffer(buf: Uint8Array, mime: string, name: string): Promise<Source> {
  const title = titleFromName(name);
  const ext = (name.split('.').pop() ?? '').toLowerCase();
  const m = mime.toLowerCase();
  if (buf.byteLength > MAX_BYTES) return { title, text: '', warning: 'too_big' };

  if (m.includes('pdf') || ext === 'pdf') {
    let text = '';
    try {
      const { extractText, getDocumentProxy } = await import('unpdf');
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      // Keep page boundaries (form feed) so the lesson cleaner can find running headers and cite pages.
      const r = await extractText(pdf, { mergePages: false });
      text = Array.isArray(r.text) ? r.text.join('\n\f\n') : r.text;
    } catch { /* scanned or protected */ }
    return { title, text: tidy(text), binary: { data: buf, mime: 'application/pdf' }, warning: text.trim().length < 80 ? 'scanned' : undefined };
  }
  if (ext === 'docx' || m.includes('wordprocessingml')) {
    const mammoth = await import('mammoth');
    const r = await mammoth.extractRawText({ buffer: Buffer.from(buf) });
    return { title, text: tidy(r.value) };
  }
  if (ext === 'pptx' || m.includes('presentationml')) {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(buf);
    const slides = await xmlText(zip, /^ppt\/slides\/slide\d+\.xml$/, /<a:t>([^<]*)<\/a:t>/g);
    const notes = await xmlText(zip, /^ppt\/notesSlides\/notesSlide\d+\.xml$/, /<a:t>([^<]*)<\/a:t>/g);
    const text = slides.map((s, i) => `Slide ${i + 1}: ${s.text}${notes[i]?.text ? `\nNotes: ${notes[i].text}` : ''}`).join('\n');
    return { title, text: tidy(text) };
  }
  if (ext === 'xlsx' || m.includes('spreadsheetml')) {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(buf);
    const shared = await xmlText(zip, /^xl\/sharedStrings\.xml$/, /<t[^>]*>([^<]*)<\/t>/g);
    return { title, text: tidy(shared.map((s) => s.text).join('\n')) };
  }
  if (m.startsWith('image/')) return { title, text: '', binary: { data: buf, mime: m }, warning: 'image' };
  if (m.includes('html') || ext === 'html' || ext === 'htm') {
    const html = new TextDecoder().decode(buf);
    const t = html.match(/<title>([^<]*)<\/title>/i)?.[1];
    return { title: t ? decodeEntities(t).trim().slice(0, 120) : title, text: tidy(htmlToText(html)) };
  }
  if (m.startsWith('text/') || ['txt', 'md', 'markdown', 'csv', 'json', 'rtf'].includes(ext)) {
    return { title, text: tidy(new TextDecoder().decode(buf)) };
  }
  if (['doc', 'ppt', 'xls'].includes(ext)) return { title, text: '', warning: 'old_office' };
  if (['mp4', 'mov', 'webm', 'mp3', 'wav', 'm4a'].includes(ext) || m.startsWith('video/') || m.startsWith('audio/')) return { title, text: '', warning: 'media' };
  return { title, text: '', warning: 'unsupported' };
}

/** Google links → their plain export (works when the file is shared “anyone with the link”). */
export function exportUrl(url: string) {
  const u = new URL(url);
  const id = u.pathname.match(/\/d\/([\w-]{10,})/)?.[1] ?? u.searchParams.get('id');
  if (u.hostname === 'docs.google.com' && id) {
    if (u.pathname.startsWith('/document/')) return { url: `https://docs.google.com/document/d/${id}/export?format=txt`, mime: 'text/plain' };
    if (u.pathname.startsWith('/presentation/')) return { url: `https://docs.google.com/presentation/d/${id}/export/txt`, mime: 'text/plain' };
    if (u.pathname.startsWith('/spreadsheets/')) return { url: `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`, mime: 'text/csv' };
  }
  if (u.hostname === 'drive.google.com' && id) return { url: `https://drive.google.com/uc?export=download&id=${id}`, mime: '' };
  return { url, mime: '' };
}

export async function readUrl(url: string, name?: string): Promise<Source> {
  let u: URL;
  try { u = new URL(url); } catch { return { title: name ?? 'Lesson', text: '', warning: 'bad_link' }; }
  if (!/^https?:$/.test(u.protocol)) return { title: name ?? 'Lesson', text: '', warning: 'bad_link' };
  // Never fetch private or local network addresses.
  if (/^(localhost|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[::1\]$|\[f[cd])/i.test(u.hostname) || u.hostname.endsWith('.internal') || u.hostname.endsWith('.local')) {
    return { title: name ?? 'Lesson', text: '', warning: 'bad_link' };
  }
  if (/youtube\.com|youtu\.be|vimeo\.com|loom\.com/.test(u.hostname)) return { title: name ?? 'Video', text: '', warning: 'media' };
  const ex = exportUrl(url);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch(ex.url, { signal: ctrl.signal, redirect: 'follow', headers: { 'user-agent': 'NEXORA-lesson-reader/1.0' } });
    if (!res.ok) return { title: name ?? u.hostname, text: '', warning: res.status === 401 || res.status === 403 ? 'private' : 'unreachable' };
    const mime = ex.mime || res.headers.get('content-type') || '';
    const buf = new Uint8Array(await res.arrayBuffer());
    if (mime.includes('text/html') && /accounts\.google\.com|ServiceLogin/.test(new TextDecoder().decode(buf.slice(0, 4000)))) {
      return { title: name ?? 'Google file', text: '', warning: 'private' };
    }
    const fname = name ?? decodeURIComponent(u.pathname.split('/').pop() || u.hostname);
    return await readBuffer(buf, mime, fname);
  } catch {
    return { title: name ?? u.hostname, text: '', warning: 'unreachable' };
  } finally {
    clearTimeout(timer);
  }
}

/** Markdown page → plain text. */
export function markdownToText(md: string) {
  return tidy(md.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`#>]+/g, ' '));
}

/** A file shipped with NEXORA itself (e.g. /experiences/autocad/... lesson sites). */
export async function readSiteFile(path: string, origin: string): Promise<Source> {
  const clean = path.split('?')[0].replace(/\.\.+/g, '');
  if (!clean.startsWith('/')) return { title: 'Lesson', text: '', warning: 'bad_link' };
  const name = decodeURIComponent(clean.split('/').filter(Boolean).slice(-2).join(' '));
  try {
    const { readFile } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const buf = await readFile(join(process.cwd(), 'public', clean));
    return await readBuffer(new Uint8Array(buf), clean.endsWith('.html') ? 'text/html' : '', name);
  } catch { /* not bundled with the server — fetch it from the site */ }
  try {
    const res = await fetch(origin + clean);
    if (!res.ok) return { title: name, text: '', warning: 'unreachable' };
    return await readBuffer(new Uint8Array(await res.arrayBuffer()), res.headers.get('content-type') ?? '', name);
  } catch { return { title: name, text: '', warning: 'unreachable' }; }
}

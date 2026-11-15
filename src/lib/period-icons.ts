import type { SceneId } from './scenes/types';

/**
 * Class-period icons a student customizes for themselves. Stored per (student, class).
 * Only the owner ever sees them, which keeps uploaded photos private and out of moderation queues.
 */
export type PeriodIcon =
  | { kind: 'scene'; scene: SceneId }
  | { kind: 'color'; palette: number }
  | { kind: 'symbol'; symbol: SymbolId; palette: number }
  | { kind: 'image'; url: string };

export const PALETTES: [string, string][] = [
  ['#ff7a1a', '#c2185b'], ['#7c4dff', '#2a6cf0'], ['#1fb5a8', '#2a6cf0'], ['#f5c04a', '#e8642c'],
  ['#5cf2a5', '#0f8f6a'], ['#ff6fa8', '#8f3cff'], ['#3b4b63', '#151b26'], ['#e7cf9f', '#c49155'],
  ['#9ad0ff', '#3d6fd8'], ['#ff9a9a', '#d8433f'], ['#c9a8ff', '#5d6bc8'], ['#b9c7da', '#56657c'],
];

export type SymbolId = 'compass' | 'ruler' | 'gear' | 'book' | 'flask' | 'globe' | 'pi' | 'music' | 'palette' | 'code' | 'atom' | 'ball' | 'house' | 'heart' | 'leaf' | 'chat';

/** 24×24 stroke icons (stroke = currentColor). */
export const SYMBOLS: Record<SymbolId, string> = {
  compass: '<circle cx="12" cy="5" r="2"/><path d="M11 7 6 20M13 7l5 13M7.5 15.5h9"/>',
  ruler: '<rect x="2.5" y="8" width="19" height="8" rx="1.5"/><path d="M6 8v3M9.5 8v4M13 8v3M16.5 8v4M20 8v3"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  book: '<path d="M4 5.5C6.5 4 9.5 4 12 5.5 14.5 4 17.5 4 20 5.5V19c-2.5-1.5-5.5-1.5-8 0-2.5-1.5-5.5-1.5-8 0Z"/><path d="M12 5.5V19"/>',
  flask: '<path d="M9.5 3h5M10.5 3v6L5 19a1.3 1.3 0 0 0 1.2 2h11.6a1.3 1.3 0 0 0 1.2-2L13.5 9V3"/><path d="M7.5 15h9"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18"/>',
  pi: '<path d="M4 7h16M9 7v12M15 7v9c0 2 1 3 3 3"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-.9 2-2 0-1.5-1.3-2 0-3.2 1-.8 2.3-.8 4-.8a3 3 0 0 0 3-3A9 9 0 0 0 12 3Z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10.5" cy="7" r="1"/><circle cx="15.5" cy="7.5" r="1"/>',
  code: '<path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>',
  atom: '<circle cx="12" cy="12" r="1.6"/><ellipse cx="12" cy="12" rx="9.5" ry="3.8"/><ellipse cx="12" cy="12" rx="9.5" ry="3.8" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9.5" ry="3.8" transform="rotate(-60 12 12)"/>',
  ball: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3v18M5.6 5.6c3.2 3.6 3.2 9.2 0 12.8M18.4 5.6c-3.2 3.6-3.2 9.2 0 12.8"/>',
  house: '<path d="M3 11 12 4l9 7M5.5 9.5V20h13V9.5M10 20v-5.5h4V20"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.2 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z"/><path d="M4 12h4l1.5-3 3 6 1.5-3h6"/>',
  leaf: '<path d="M5 19c0-9 6-14 15-14 0 9-5 15-14 15"/><path d="M5 19 14 10"/>',
  chat: '<path d="M4 5h16v11H9l-5 4Z"/><path d="M8 9h8M8 12h5"/>',
};

export const SYMBOL_ORDER = Object.keys(SYMBOLS) as SymbolId[];

export function symbolSVG(id: SymbolId, size = 24, stroke = 1.8) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SYMBOLS[id]}</svg>`;
}

export const gradientCSS = (p: number) => { const [a, b] = PALETTES[p % PALETTES.length]; return `linear-gradient(135deg, ${a}, ${b})`; };

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const ICON_PX = 256;

/** Decode an uploaded file into an ImageBitmap-like source, or throw 'bad-file' / 'too-big'. */
export async function loadImage(file: File): Promise<HTMLImageElement> {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('too-big');
  if (!/^image\//.test(file.type) && !/\.(heic|heif)$/i.test(file.name)) throw new Error('bad-file');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } catch {
    throw new Error('bad-file');
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/**
 * Crop a square from the image: zoom ≥ 1 scales beyond "cover", and (ox, oy) in -1..1 pans.
 * Returns a 256×256 WebP (JPEG fallback) Blob. EXIF/GPS data never survives a canvas re-encode.
 */
export async function cropSquare(img: HTMLImageElement, zoom: number, ox: number, oy: number, px = ICON_PX): Promise<Blob> {
  const c = document.createElement('canvas'); c.width = c.height = px;
  const ctx = c.getContext('2d')!;
  drawCrop(ctx, img, px, zoom, ox, oy);
  const blob = await new Promise<Blob | null>(res => c.toBlob(res, 'image/webp', 0.86));
  return blob ?? (await new Promise<Blob>((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('encode'))), 'image/jpeg', 0.88)));
}

export function drawCrop(ctx: CanvasRenderingContext2D, img: HTMLImageElement, px: number, zoom: number, ox: number, oy: number) {
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const s = (px / Math.min(iw, ih)) * zoom;
  const dw = iw * s, dh = ih * s;
  const maxX = (dw - px) / 2, maxY = (dh - px) / 2;
  ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, px, px);
  ctx.drawImage(img, (px - dw) / 2 - ox * maxX, (px - dh) / 2 - oy * maxY, dw, dh);
}

/** A sensible starting icon for a class, from its subject or name, until the student picks their own. */
export function defaultIconFor(classId: string, subject?: string | null, name?: string | null): PeriodIcon {
  const s = `${subject ?? ''} ${name ?? ''}`.toLowerCase();
  const rules: [RegExp, SymbolId][] = [
    [/archit|design|drafting|cad|construct/, 'compass'], [/engineer|robot|manufact|mechan/, 'gear'],
    [/math|algebra|geometry|calculus|statistic/, 'pi'], [/biolog|environment|ecolog|agri/, 'leaf'],
    [/chem/, 'flask'], [/physic/, 'atom'], [/scien/, 'flask'], [/english|reading|literat|writing|ela\b/, 'book'],
    [/spanish|french|language|esl|communicat/, 'chat'], [/histor|geograph|social|govern|econom/, 'globe'],
    [/comput|coding|program|software|cyber/, 'code'], [/art|paint|photo|graphic/, 'palette'],
    [/music|band|choir|orchestra/, 'music'], [/\bpe\b|physical ed|athlet|sport|fitness/, 'ball'],
    [/health|medic|nurs/, 'heart'], [/interior|housing|real estate/, 'house'],
  ];
  const symbol = rules.find(([r]) => r.test(s))?.[1] ?? 'ruler';
  let h = 0; for (let i = 0; i < classId.length; i++) h = (h * 31 + classId.charCodeAt(i)) >>> 0;
  return { kind: 'symbol', symbol, palette: h % PALETTES.length };
}

/** "Period 3", "P3", "3rd period" → 3. Anything else → undefined (the badge is simply left off). */
export function periodFrom(section?: string | null): number | undefined {
  const m = section?.match(/(?:^|\b|p(?:eriod)?\s*)(\d{1,2})(?:st|nd|rd|th)?\b/i);
  return m ? Number(m[1]) : undefined;
}

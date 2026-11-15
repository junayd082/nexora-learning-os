/**
 * Turn a link someone pastes into something NEXORA can show inline.
 * Only well-known, documented embed URL patterns are rewritten. Everything else
 * is shown in a frame when allowed, with an "open in new tab" fallback.
 */
export interface EmbedInfo { src: string; provider: string; embeddable: boolean }

const NEVER_FRAMED = [
  'schoology.com', 'classroom.google.com', 'web.autocad.com', 'autodesk.com', 'tinkercad.com', 'onshape.com',
  'sketchup.com', 'office.com', 'microsoft.com', 'kahoot.it', 'kahoot.com', 'quizlet.com', 'khanacademy.org',
  'ixl.com', 'edpuzzle.com', 'nearpod.com', 'kamihq.com', 'icevonline.com', 'eb.com', 'drive.google.com/drive',
  'accounts.google.com', 'claude.ai',
];

export function toEmbed(raw: string): EmbedInfo {
  let u: URL;
  try { u = new URL(raw, 'https://nexora.local'); } catch { return { src: raw, provider: 'link', embeddable: false }; }
  if (raw.startsWith('/')) return { src: raw, provider: 'nexora', embeddable: true };
  const host = u.hostname.replace(/^www\./, '');
  const path = u.pathname;

  // YouTube
  let m: RegExpMatchArray | null;
  if (host === 'youtu.be' && (m = path.match(/^\/([\w-]{6,})/))) return yt(m[1], u);
  if (host.endsWith('youtube.com')) {
    const v = u.searchParams.get('v') ?? path.match(/^\/(?:shorts|embed|live)\/([\w-]{6,})/)?.[1];
    if (v) return yt(v, u);
  }
  // Vimeo
  if (host === 'vimeo.com' && (m = path.match(/^\/(\d+)/))) return { src: `https://player.vimeo.com/video/${m[1]}`, provider: 'Vimeo', embeddable: true };
  // Google Docs / Slides / Sheets / Drawings / Forms / Drive files
  if (host === 'docs.google.com') {
    if ((m = path.match(/^\/(document|spreadsheets|drawings)\/d\/([\w-]+)/))) return { src: `https://docs.google.com/${m[1]}/d/${m[2]}/preview`, provider: 'Google', embeddable: true };
    if ((m = path.match(/^\/presentation\/d\/([\w-]+)/))) return { src: `https://docs.google.com/presentation/d/${m[1]}/embed?start=false&loop=false`, provider: 'Google Slides', embeddable: true };
    if ((m = path.match(/^\/forms\/d\/(e\/)?([\w-]+)/))) return { src: `https://docs.google.com/forms/d/${m[1] ?? ''}${m[2]}/viewform?embedded=true`, provider: 'Google Forms', embeddable: true };
  }
  if (host === 'drive.google.com' && (m = path.match(/^\/file\/d\/([\w-]+)/))) return { src: `https://drive.google.com/file/d/${m[1]}/preview`, provider: 'Google Drive', embeddable: true };
  // Canva published designs
  if (host === 'canva.com' && (m = path.match(/^\/design\/([\w-]+)\/([\w-]+)?/))) {
    return { src: `https://www.canva.com/design/${m[1]}/${m[2] ? `${m[2]}/` : ''}view?embed`, provider: 'Canva', embeddable: true };
  }
  // Loom, Figma, Sketchfab, PhET, Desmos
  if (host === 'loom.com' && (m = path.match(/^\/share\/(\w+)/))) return { src: `https://www.loom.com/embed/${m[1]}`, provider: 'Loom', embeddable: true };
  if (host === 'figma.com') return { src: `https://www.figma.com/embed?embed_host=nexora&url=${encodeURIComponent(raw)}`, provider: 'Figma', embeddable: true };
  if (host === 'sketchfab.com' && (m = path.match(/-([0-9a-f]{32})$/))) return { src: `https://sketchfab.com/models/${m[1]}/embed`, provider: 'Sketchfab', embeddable: true };
  if (host === 'phet.colorado.edu' && path.includes('/sims/html/')) return { src: raw, provider: 'PhET', embeddable: true };
  if (host === 'desmos.com' && (m = path.match(/^\/calculator\/(\w+)/))) return { src: `https://www.desmos.com/calculator/${m[1]}?embed`, provider: 'Desmos', embeddable: true };

  const blocked = NEVER_FRAMED.some((d) => (host + path).includes(d));
  return { src: raw, provider: host, embeddable: !blocked };
}

function yt(id: string, u: URL): EmbedInfo {
  const t = u.searchParams.get('t') ?? u.searchParams.get('start');
  const start = t ? `?start=${parseInt(t, 10) || 0}` : '';
  return { src: `https://www.youtube-nocookie.com/embed/${id}${start}`, provider: 'YouTube', embeddable: true };
}

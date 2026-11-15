/** A small, safe Markdown renderer (no raw HTML): headings, lists, bold, italic, code, links, quotes, rules. */
function inline(text: string, key: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\((https?:\/\/[^)\s]+)\))/g;
  let last = 0; let m: RegExpExecArray | null; let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    const k = `${key}-${i++}`;
    if (t.startsWith('**')) out.push(<strong key={k}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith('`')) out.push(<code key={k} className="rounded bg-white/10 px-1 font-mono text-[0.9em]">{t.slice(1, -1)}</code>);
    else if (t.startsWith('[')) {
      const label = t.slice(1, t.indexOf(']'));
      out.push(<a key={k} href={m[2]} target="_blank" rel="noopener noreferrer nofollow" className="text-ember underline">{label}</a>);
    } else out.push(<em key={k}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let code: string[] | null = null;
  let para: string[] = [];
  const flushPara = () => { if (para.length) { blocks.push(<p key={blocks.length}>{inline(para.join(' '), `p${blocks.length}`)}</p>); para = []; } };
  const flushList = () => {
    if (!list) return;
    const items = list.items.map((it, i) => {
      const [main, ...quotes] = it.split('\n>');
      return (
        <li key={i}>{inline(main, `l${blocks.length}-${i}`)}
          {quotes.map((q, j) => <blockquote key={j} className="mt-1 border-l-2 border-ember/60 pl-3 text-sm text-muted">{inline(q.trim(), `lq${blocks.length}-${i}-${j}`)}</blockquote>)}
        </li>
      );
    });
    blocks.push(list.ordered ? <ol key={blocks.length} className="list-decimal pl-6">{items}</ol> : <ul key={blocks.length} className="list-disc pl-6">{items}</ul>);
    list = null;
  };
  for (const line of lines) {
    if (code) {
      if (line.startsWith('```')) { blocks.push(<pre key={blocks.length} className="overflow-x-auto rounded-md bg-black/40 p-3 font-mono text-xs">{code.join('\n')}</pre>); code = null; }
      else code.push(line);
      continue;
    }
    if (line.startsWith('```')) { flushPara(); flushList(); code = []; continue; }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    const li = line.match(/^\s*([-*]|\d+\.)\s+(.*)$/);
    const cont = list && line.match(/^\s{2,}>\s?(.*)$/);
    if (cont && list) { list.items[list.items.length - 1] += `\n>${cont[1]}`; continue; }
    if (h) {
      flushPara(); flushList();
      const lvl = h[1].length;
      const cls = ['', 'text-2xl font-bold', 'text-xl font-semibold', 'text-lg font-semibold', 'font-semibold'][lvl];
      blocks.push(<div key={blocks.length} role="heading" aria-level={lvl} className={`${cls} mt-2`}>{inline(h[2], `h${blocks.length}`)}</div>);
    } else if (li) {
      flushPara();
      const ordered = /\d/.test(li[1]);
      if (!list || list.ordered !== ordered) { flushList(); list = { ordered, items: [] }; }
      list.items.push(li[2]);
    } else if (/^>\s?/.test(line)) {
      flushPara(); flushList();
      blocks.push(<blockquote key={blocks.length} className="border-l-2 border-ember/60 pl-3 text-muted">{inline(line.replace(/^>\s?/, ''), `q${blocks.length}`)}</blockquote>);
    } else if (/^(-{3,}|\*{3,})\s*$/.test(line)) {
      flushPara(); flushList(); blocks.push(<hr key={blocks.length} className="border-line" />);
    } else if (!line.trim()) {
      flushPara(); flushList();
    } else {
      flushList(); para.push(line.trim());
    }
  }
  flushPara(); flushList();
  if (code) blocks.push(<pre key={blocks.length} className="overflow-x-auto rounded-md bg-black/40 p-3 font-mono text-xs">{(code as string[]).join('\n')}</pre>);
  return <div className={`space-y-3 leading-relaxed ${className ?? ''}`}>{blocks}</div>;
}

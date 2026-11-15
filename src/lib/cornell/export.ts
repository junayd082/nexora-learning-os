/**
 * Cornell notes → real files, made in the browser (no server, nothing uploaded):
 *  - PDF (jsPDF): drawn like the paper — red margin, blue rules, cue | notes divider, summary strip.
 *    Long pages continue on extra sheets with the cues kept beside their notes.
 *  - Word (.docx, docx): the classic Cornell template as tables (header, cues | notes, summary),
 *    one section per page, editable in Word, Google Docs and Pages.
 */
import { CUE_SHARE, fileBase, prettyDate, type CornellNote } from './model';

export interface ExportLabels {
  heading: string; name: string; class: string; period: string; date: string; topic: string; question: string;
  cues: string; notes: string; summary: string; page: string; of: string; continued: string; untitled: string;
}

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// ---------------------------------------------------------------------------------------------- PDF
export async function downloadPdf(n: CornellNote, L: ExportLabels, locale = 'en-US') {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'letter' }); // 612 × 792
  const W = 612, H = 792, M = 40, RULE = 22;
  const left = M + 8, right = W - M, cueW = (right - left) * CUE_SHARE, divX = left + cueW;
  const pad = 7;
  const ink: [number, number, number] = [24, 24, 28], soft: [number, number, number] = [110, 110, 118];
  const date = prettyDate(n.date, locale);

  // The PDF's built-in fonts cover Western European text (accents, “quotes”, – —, •, …) but not
  // arrows, math or emoji; translate those so nothing prints as the wrong glyph.
  const MAP: Record<string, string> = { '→': '->', '←': '<-', '↑': '^', '↓': 'v', '⇒': '=>', '⇐': '<=', '↔': '<->', '≤': '<=', '≥': '>=', '≠': '!=', '≈': '~', '×': 'x', '÷': '/', '−': '-', '✓': 'v', '✔': 'v', '✗': 'x', '★': '*', '☆': '*', '▪': '•', '◦': '•', '●': '•', '○': 'o', '■': '•', '□': '[ ]', '·': '·', '′': "'", '″': '"', '√': 'sqrt', '∞': 'inf', '°': '°', 'π': 'pi', 'Δ': 'Delta', 'θ': 'theta', 'µ': 'µ' };
  const pdfText = (s: string) => s.replace(/[^\x00-\xff‘’“”–—•…€™Œœ Šš Žž Ÿƒ]/g, (c) => MAP[c] ?? '?');
  const wrap = (raw: string, width: number, size = 11) => {
    const text = pdfText(raw);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(size);
    const out: string[] = [];
    for (const para of text.replace(/\r/g, '').split('\n')) {
      if (!para.trim()) { out.push(''); continue; }
      out.push(...(doc.splitTextToSize(para, width) as string[]));
    }
    while (out.length && !out[out.length - 1].trim()) out.pop();
    return out;
  };

  // Must match drawSheet: how far the body starts below the top margin.
  const headerHeight = (first: boolean) => {
    if (!first) return 14;
    doc.setFont('helvetica', 'italic'); doc.setFontSize(10.5);
    const q = n.question.trim() ? Math.min(2, (doc.splitTextToSize(`${L.question}: ${n.question}`, right - left) as string[]).length) : 0;
    return 18 + 36 + 28 + (q ? 12 + q * 13 : 6) + 4;
  };
  const drawSheet = (first: boolean, pageLabel: string): { bodyTop: number; summaryTop: number } => {
    // margin line (red) like notebook paper
    doc.setDrawColor(226, 108, 108); doc.setLineWidth(0.9); doc.line(M - 6, 0, M - 6, H);
    let y = M;
    doc.setTextColor(...ink);
    if (first) {
      // header strip
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...soft);
      doc.text(L.heading.toUpperCase(), left, y, { charSpace: 1.2 });
      doc.text(pageLabel, right, y, { align: 'right' });
      y += 18;
      const fields: [string, string, number][] = [[L.name, n.name, 0.36], [L.class, n.className, 0.3], [L.period, n.period, 0.12], [L.date, date, 0.22]];
      let x = left;
      for (const [k, v, share] of fields) {
        const w = (right - left) * share;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...soft); doc.text(k, x, y);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(...ink);
        doc.text((doc.splitTextToSize(pdfText(v || ' '), w - 10) as string[])[0] ?? '', x, y + 14);
        doc.setDrawColor(190, 190, 196); doc.setLineWidth(0.5); doc.line(x, y + 18, x + w - 10, y + 18);
        x += w;
      }
      y += 36;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...soft); doc.text(L.topic, left, y);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor(...ink);
      doc.text((doc.splitTextToSize(pdfText(n.title || L.untitled), right - left) as string[])[0], left, y + 20);
      y += 28;
      if (n.question.trim()) {
        doc.setFont('helvetica', 'italic'); doc.setFontSize(10.5); doc.setTextColor(60, 60, 70);
        const q = doc.splitTextToSize(pdfText(`${L.question}: ${n.question}`), right - left) as string[];
        doc.text(q.slice(0, 2), left, y + 12); y += 12 + q.slice(0, 2).length * 13;
      } else y += 6;
    } else {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...ink);
      doc.text((doc.splitTextToSize(pdfText(n.title || L.untitled), (right - left) * 0.7) as string[])[0], left, y);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...soft);
      doc.text(`${date} · ${pageLabel}`, right, y, { align: 'right' });
      y += 10;
    }
    // heavy rule under the header
    doc.setDrawColor(20, 20, 24); doc.setLineWidth(1.6); doc.line(left - 8, y + 4, right, y + 4);
    const bodyTop = y + 4;
    const summaryTop = H - M - RULE * 5 - 8;
    // blue rules
    doc.setDrawColor(168, 196, 220); doc.setLineWidth(0.5);
    for (let ry = bodyTop + RULE; ry < H - M; ry += RULE) { if (Math.abs(ry - summaryTop) > 3) doc.line(M - 6, ry, right, ry); }
    // cue | notes divider, summary rule
    doc.setDrawColor(20, 20, 24); doc.setLineWidth(1.4); doc.line(divX, bodyTop, divX, summaryTop);
    doc.setLineWidth(1.6); doc.line(left - 8, summaryTop, right, summaryTop);
    // area labels
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(150, 150, 158);
    doc.text(L.cues.toUpperCase(), left, bodyTop + 12, { charSpace: 0.8 });
    doc.text(L.notes.toUpperCase(), divX + pad, bodyTop + 12, { charSpace: 0.8 });
    doc.text(L.summary.toUpperCase(), left, summaryTop + 12, { charSpace: 0.8 });
    return { bodyTop, summaryTop };
  };

  // Lay out every Cornell page; a long page spills onto extra sheets (cues stay beside their notes,
  // the summary goes on the last sheet of that page).
  const plans: { pageIdx: number; part: number; parts: number; cues: string[]; notes: string[]; summary: string[] | null; first: boolean }[] = [];
  n.pages.forEach((pg, i) => {
    const cues = wrap(pg.cues, cueW - pad * 2);
    const notes = wrap(pg.notes, right - divX - pad * 2);
    const summary = wrap(pg.summary, right - left - pad);
    const start = plans.length;
    let at = 0;
    for (;;) {
      const first = plans.length === 0;
      const headerH = headerHeight(first);
      const rows = Math.floor((H - M - RULE * 5 - 8 - (M + headerH)) / RULE) - 1;
      const done = at + rows >= Math.max(cues.length, notes.length);
      plans.push({ pageIdx: i, part: plans.length - start + 1, parts: 0, cues: cues.slice(at, at + rows), notes: notes.slice(at, at + rows), summary: done ? summary : null, first });
      at += rows;
      if (done) break;
    }
    for (let k = start; k < plans.length; k++) plans[k].parts = plans.length - start;
  });
  const total = plans.length;

  plans.forEach((p, i) => {
    if (i > 0) doc.addPage();
    const { bodyTop, summaryTop } = drawSheet(p.first, `${L.page} ${p.pageIdx + 1}${p.parts > 1 ? ` (${p.part}/${p.parts})` : ''}`);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(...ink);
    const base = (row: number) => bodyTop + RULE * (row + 1) + RULE - 6;
    p.cues.forEach((line, r) => { doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.text(line, left, base(r)); });
    p.notes.forEach((line, r) => { doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.text(line, divX + pad, base(r)); });
    if (p.summary) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
      p.summary.slice(0, 4).forEach((line, r) => doc.text(line, left, summaryTop + RULE * (r + 1) + RULE - 6 - 4));
    } else {
      doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(...soft);
      doc.text(L.continued, right, summaryTop + RULE - 6, { align: 'right' }); doc.setTextColor(...ink);
    }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(150, 150, 158);
    doc.text(`NEXORA · ${L.heading}`, left, H - 18);
    doc.text(`${i + 1} ${L.of} ${total}`, right, H - 18, { align: 'right' });
  });
  doc.setProperties({ title: `${L.heading}: ${n.title || L.untitled}`, author: n.name, subject: n.className, creator: 'NEXORA' });
  save(doc.output('blob'), `${fileBase(n)}.pdf`);
}

// --------------------------------------------------------------------------------------------- Word
export async function downloadDocx(n: CornellNote, L: ExportLabels, locale = 'en-US') {
  const d = await import('docx');
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType, HeightRule, ShadingType, VerticalAlign } = d;
  const date = prettyDate(n.date, locale);
  const FONT = 'Calibri';
  const TW = 11520; // text width in twips (8.5" − 2 × 0.5")
  const cueW = Math.round(TW * CUE_SHARE), noteW = TW - cueW;
  const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const thick = { style: BorderStyle.SINGLE, size: 14, color: '141418' };
  const rule = { style: BorderStyle.SINGLE, size: 4, color: 'A8C4DC' };
  const label = (t: string) => new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: t.toUpperCase(), font: FONT, size: 15, bold: true, color: '8A8A94', characterSpacing: 20 })] });
  const lines = (text: string, opts: { bold?: boolean; size?: number } = {}) => {
    const rows = text.replace(/\r/g, '').split('\n');
    return (rows.length ? rows : ['']).map((r) => new Paragraph({ spacing: { after: 0, line: 330 }, children: [new TextRun({ text: r, font: FONT, size: opts.size ?? 22, bold: opts.bold })] }));
  };
  const field = (k: string, v: string, w: number) => new TableCell({
    width: { size: w, type: WidthType.DXA }, borders: { top: none, left: none, right: none, bottom: { style: BorderStyle.SINGLE, size: 4, color: 'BEBEC4' } },
    margins: { left: 60, right: 120, bottom: 40 },
    children: [new Paragraph({ children: [new TextRun({ text: k, font: FONT, size: 15, color: '8A8A94' })] }), new Paragraph({ children: [new TextRun({ text: v || ' ', font: FONT, size: 22 })] })],
  });

  const sections = n.pages.map((pg, i) => {
    const children: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [];
    children.push(new Paragraph({ spacing: { after: 80 }, children: [
      new TextRun({ text: L.heading.toUpperCase(), font: FONT, size: 16, bold: true, color: '8A8A94', characterSpacing: 30 }),
      new TextRun({ text: `\t${L.page} ${i + 1} ${L.of} ${n.pages.length}`, font: FONT, size: 16, color: '8A8A94' }),
    ], tabStops: [{ type: 'right' as never, position: TW }] }));
    if (i === 0) {
      children.push(new Table({
        width: { size: TW, type: WidthType.DXA }, columnWidths: [Math.round(TW * 0.36), Math.round(TW * 0.3), Math.round(TW * 0.12), TW - Math.round(TW * 0.36) - Math.round(TW * 0.3) - Math.round(TW * 0.12)],
        borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none },
        rows: [new TableRow({ children: [field(L.name, n.name, Math.round(TW * 0.36)), field(L.class, n.className, Math.round(TW * 0.3)), field(L.period, n.period, Math.round(TW * 0.12)), field(L.date, date, TW - Math.round(TW * 0.78))] })],
      }));
      children.push(new Paragraph({ spacing: { before: 160, after: 20 }, children: [new TextRun({ text: L.topic, font: FONT, size: 15, color: '8A8A94' })] }));
      children.push(new Paragraph({ spacing: { after: n.question.trim() ? 40 : 120 }, children: [new TextRun({ text: n.title || L.untitled, font: FONT, size: 34, bold: true })] }));
      if (n.question.trim()) children.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: `${L.question}: `, font: FONT, size: 21, italics: true, color: '50505A' }), new TextRun({ text: n.question, font: FONT, size: 21, italics: true })] }));
    } else {
      children.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: n.title || L.untitled, font: FONT, size: 24, bold: true }), new TextRun({ text: `   ${date}`, font: FONT, size: 18, color: '8A8A94' })] }));
    }
    const head = (t: string, w: number, lastCol: boolean) => new TableCell({
      width: { size: w, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F6F4EE' },
      borders: { top: thick, bottom: rule, left: none, right: lastCol ? none : thick }, margins: { left: 120, right: 120, top: 60, bottom: 40 },
      children: [label(t)],
    });
    const body = (text: string, w: number, lastCol: boolean, bold: boolean) => new TableCell({
      width: { size: w, type: WidthType.DXA }, verticalAlign: VerticalAlign.TOP,
      borders: { top: rule, bottom: thick, left: none, right: lastCol ? none : thick }, margins: { left: 120, right: 120, top: 80, bottom: 80 },
      children: lines(text, { bold, size: bold ? 21 : 22 }),
    });
    children.push(new Table({
      width: { size: TW, type: WidthType.DXA }, columnWidths: [cueW, noteW],
      borders: { top: thick, bottom: thick, left: none, right: none, insideHorizontal: rule, insideVertical: thick },
      rows: [
        new TableRow({ tableHeader: true, children: [head(L.cues, cueW, false), head(L.notes, noteW, true)] }),
        new TableRow({ height: { value: 9200, rule: HeightRule.ATLEAST }, children: [body(pg.cues, cueW, false, true), body(pg.notes, noteW, true, false)] }),
        new TableRow({ children: [new TableCell({ columnSpan: 2, width: { size: TW, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F6F4EE' }, borders: { top: thick, bottom: rule, left: none, right: none }, margins: { left: 120, right: 120, top: 60, bottom: 40 }, children: [label(L.summary)] })] }),
        new TableRow({ height: { value: 1700, rule: HeightRule.ATLEAST }, children: [new TableCell({ columnSpan: 2, width: { size: TW, type: WidthType.DXA }, borders: { top: rule, bottom: thick, left: none, right: none }, margins: { left: 120, right: 120, top: 80, bottom: 80 }, children: lines(pg.summary) })] }),
      ],
    }));
    children.push(new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { before: 80 }, children: [new TextRun({ text: `NEXORA · ${L.heading}`, font: FONT, size: 15, color: 'A0A0A8' })] }));
    return {
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
      children,
    };
  });

  const doc = new Document({
    creator: n.name || 'NEXORA', title: `${L.heading}: ${n.title || L.untitled}`, description: n.className,
    styles: { default: { document: { run: { font: FONT, size: 22 } } } },
    sections,
  });
  save(await Packer.toBlob(doc), `${fileBase(n)}.docx`);
}

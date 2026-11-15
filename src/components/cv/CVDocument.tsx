'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import type { CV, CVExperience } from '@/lib/cv/model';

/**
 * The one-page CV itself (US Letter, 8.5 × 11 in = 816 × 1056 px at 96 dpi, 0.5 in margins).
 * Used for the live preview and for printing / saving as PDF, so what you see is what prints.
 * Auto-fit: if the content runs long, the type scale steps down (to 82%) until it fits one page;
 * `onFit` reports whether it fits so the editor can say "Fits on one page" or what to trim.
 */
export const PAGE_W = 816, PAGE_H = 1056, MARGIN = 48;

export interface CVLabels {
  profile: string; education: string; skills: string; technical: string; soft: string; experience: string; certs: string;
  activities: string; languages: string; availability: string; references: string; refOnRequest: string; transport: string;
  present: string; expected: string; gpa: string; courses: string; honors: string; hours: string; days: string; contact: string;
  kind: Record<CVExperience['kind'], string>; level: Record<string, string>;
}

export function CVDocument({ cv, labels, onFit, id }: { cv: CV; labels: CVLabels; onFit?: (fits: boolean, scale: number) => void; id?: string }) {
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  // Shrink the type scale until the content fits on one page (re-run on every edit).
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    let s = 1;
    el.style.setProperty('--s', '1');
    const avail = PAGE_H; // the inner box is the full page (padding included), so overflow = content past the page
    while (el.scrollHeight > avail && s > 0.82) { s = Math.round((s - 0.02) * 100) / 100; el.style.setProperty('--s', String(s)); }
    setScale(s);
    onFit?.(el.scrollHeight <= avail + 1, s);
  }, [cv, onFit]);

  const S = (px: number) => `calc(${px}px * var(--s, 1))`;
  const accent = cv.accent;
  const sh = cv.show;
  const exp = cv.experience.filter((e) => e.role || e.org);
  const contact = [cv.email, cv.phone, cv.city, cv.link].filter(Boolean);
  const range = (a: string, b: string) => [a, b || (a ? labels.present : '')].filter(Boolean).join(' – ');
  const serif = cv.template === 'classic' ? 'Georgia, "Iowan Old Style", "Times New Roman", serif' : 'inherit';

  const H = ({ children }: { children: React.ReactNode }) => (
    <h2 style={{ fontSize: S(10.5), letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, color: accent, margin: `${S(14)} 0 ${S(6)}`, paddingBottom: S(3), borderBottom: cv.template === 'classic' ? `1px solid ${accent}55` : 'none' }}>{children}</h2>
  );
  const Bullets = ({ items }: { items: string[] }) => (
    <ul style={{ margin: `${S(3)} 0 0`, paddingLeft: S(14), listStyleType: 'disc', listStylePosition: 'outside' }}>
      {items.filter((b) => b.trim()).map((b, i) => <li key={i} style={{ fontSize: S(10.5), lineHeight: 1.42, marginBottom: S(1.5) }}>{b}</li>)}
    </ul>
  );

  const statement = sh.statement && cv.statement.trim() && (
    <section><H>{labels.profile}</H><p style={{ fontSize: S(11), lineHeight: 1.5, margin: 0 }}>{cv.statement}</p></section>
  );
  const education = sh.education && (cv.education.school || cv.education.program) && (
    <section><H>{labels.education}</H>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: S(11) }}>
        <strong>{cv.education.school}</strong>
        <span style={{ color: '#475569', whiteSpace: 'nowrap' }}>{cv.education.grad ? `${labels.expected} ${cv.education.grad}` : ''}</span>
      </div>
      <div style={{ fontSize: S(10.5), color: '#334155', marginTop: S(1) }}>
        {[cv.education.program, cv.education.grade, cv.education.gpa && `${labels.gpa} ${cv.education.gpa}`].filter(Boolean).join(' · ')}
      </div>
      {cv.education.courses.length > 0 && <div style={{ fontSize: S(10.5), marginTop: S(3) }}><span style={{ fontWeight: 600 }}>{labels.courses}: </span>{cv.education.courses.join(', ')}</div>}
      {cv.education.honors && <div style={{ fontSize: S(10.5), marginTop: S(2) }}><span style={{ fontWeight: 600 }}>{labels.honors}: </span>{cv.education.honors}</div>}
    </section>
  );
  const experience = sh.experience && exp.length > 0 && (
    <section><H>{labels.experience}</H>
      {exp.map((e) => (
        <div key={e.id} style={{ marginBottom: S(8), breakInside: 'avoid' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: S(11) }}>
            <span><strong>{e.role}</strong>{e.org && <> · {e.org}</>}{e.place && <span style={{ color: '#475569' }}> · {e.place}</span>}</span>
            <span style={{ color: '#475569', whiteSpace: 'nowrap', fontSize: S(10.5) }}>{range(e.start, e.end)}</span>
          </div>
          {e.kind !== 'work' && <div style={{ fontSize: S(9.5), color: accent, fontWeight: 600, letterSpacing: '0.04em', marginTop: S(1) }}>{labels.kind[e.kind]}</div>}
          <Bullets items={e.bullets} />
        </div>
      ))}
    </section>
  );
  const skillsBlock = (stacked: boolean) => sh.skills && (cv.skills.technical.length + cv.skills.soft.length > 0) && (
    <section><H>{labels.skills}</H>
      <div style={{ display: stacked ? 'block' : 'grid', gridTemplateColumns: '1fr 1fr', gap: S(10) }}>
        {cv.skills.technical.length > 0 && <div style={{ fontSize: S(10.5), lineHeight: 1.45 }}><div style={{ fontWeight: 700, marginBottom: S(2) }}>{labels.technical}</div>{cv.skills.technical.join(' · ')}</div>}
        {cv.skills.soft.length > 0 && <div style={{ fontSize: S(10.5), lineHeight: 1.45, marginTop: stacked ? S(6) : 0 }}><div style={{ fontWeight: 700, marginBottom: S(2) }}>{labels.soft}</div>{cv.skills.soft.join(' · ')}</div>}
      </div>
    </section>
  );
  const certsBlock = (stacked: boolean) => sh.certs && cv.certs.some((c) => c.name) && (
    <section><H>{labels.certs}</H>
      {cv.certs.filter((c) => c.name).map((c) => stacked ? (
        <div key={c.id} style={{ fontSize: S(10.5), lineHeight: 1.4, marginBottom: S(4) }}>
          <strong style={{ fontWeight: 600 }}>{c.name}</strong>
          {(c.issuer || c.date) && <div style={{ color: '#475569' }}>{[c.issuer, c.date].filter(Boolean).join(' · ')}</div>}
        </div>
      ) : (
        <div key={c.id} style={{ fontSize: S(10.5), lineHeight: 1.45, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <span><strong style={{ fontWeight: 600 }}>{c.name}</strong>{c.issuer && <span style={{ color: '#475569' }}> · {c.issuer}</span>}</span>
          <span style={{ color: '#475569', whiteSpace: 'nowrap' }}>{c.date}</span>
        </div>
      ))}
    </section>
  );
  const activities = sh.activities && cv.activities.length > 0 && (
    <section><H>{labels.activities}</H><p style={{ fontSize: S(10.5), lineHeight: 1.45, margin: 0 }}>{cv.activities.join(' · ')}</p></section>
  );
  const languages = sh.languages && cv.languages.some((l) => l.name) && (
    <section><H>{labels.languages}</H><p style={{ fontSize: S(10.5), margin: 0 }}>{cv.languages.filter((l) => l.name).map((l) => `${l.name} (${labels.level[l.level]})`).join(' · ')}</p></section>
  );
  const av = cv.availability;
  const availability = sh.availability && (av.start || av.end || av.hours || av.days || av.note || av.transport) && (
    <section><H>{labels.availability}</H>
      <p style={{ fontSize: S(10.5), lineHeight: 1.45, margin: 0 }}>
        {[range(av.start, av.end), av.hours && `${av.hours} ${labels.hours}`, av.days, av.transport && labels.transport, av.note].filter(Boolean).join(' · ')}
      </p>
    </section>
  );
  const references = sh.references && cv.references.mode !== 'none' && (
    <section><H>{labels.references}</H>
      {cv.references.mode === 'on_request'
        ? <p style={{ fontSize: S(10.5), margin: 0 }}>{labels.refOnRequest}</p>
        : <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: S(8) }}>{cv.references.list.filter((r) => r.name).map((r) => (
          <div key={r.id} style={{ fontSize: S(10.5), lineHeight: 1.4 }}><strong>{r.name}</strong><br />{r.title}<br /><span style={{ color: '#475569' }}>{r.contact}</span></div>
        ))}</div>}
    </section>
  );

  const header = (center: boolean) => (
    <header style={{ textAlign: center ? 'center' : 'left' }}>
      <h1 style={{ fontFamily: serif, fontSize: S(cv.template === 'classic' ? 28 : 26), lineHeight: 1.1, fontWeight: 700, margin: 0, color: cv.template === 'classic' ? '#0f172a' : accent, letterSpacing: cv.template === 'classic' ? '0.01em' : '-0.01em' }}>{cv.name || ' '}</h1>
      {(cv.headline || cv.target) && <div style={{ fontSize: S(11.5), color: '#334155', marginTop: S(4) }}>{[cv.headline, cv.target].filter(Boolean).join(' · ')}</div>}
      {center && contact.length > 0 && <div style={{ fontSize: S(10.5), color: '#334155', marginTop: S(5) }}>{contact.join('  |  ')}</div>}
    </header>
  );

  return (
    <div id={id} className="cv-sheet" style={{ width: PAGE_W, height: PAGE_H, background: '#fff', color: '#0f172a', overflow: 'hidden', position: 'relative',
      fontFamily: 'Inter, "Helvetica Neue", Arial, sans-serif', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }} data-scale={scale}>
      {cv.template === 'classic' ? (
        <div ref={inner} style={{ padding: MARGIN, height: '100%', boxSizing: 'border-box' }}>
          {header(true)}
          <div style={{ height: 2, background: accent, margin: `${S(10)} 0 ${S(2)}` }} />
          {statement}{experience}{education}{skillsBlock(false)}{certsBlock(false)}{activities}{languages}{availability}{references}
        </div>
      ) : (
        <div ref={inner} style={{ display: 'grid', gridTemplateColumns: '236px 1fr', height: '100%' }}>
          <aside style={{ background: `${accent}12`, borderRight: `3px solid ${accent}`, padding: `${MARGIN}px 22px ${MARGIN}px ${MARGIN - 8}px`, boxSizing: 'border-box' }}>
            {contact.length > 0 && <section><H>{labels.contact}</H>{contact.map((c) => <div key={c} style={{ fontSize: S(10.5), lineHeight: 1.5, overflowWrap: 'anywhere' }}>{c}</div>)}</section>}
            {skillsBlock(true)}{certsBlock(true)}{languages}{availability}
          </aside>
          <main style={{ padding: `${MARGIN}px ${MARGIN}px ${MARGIN}px 28px`, boxSizing: 'border-box', minWidth: 0 }}>
            {header(false)}
            {statement}{experience}{education}{activities}{references}
          </main>
        </div>
      )}
    </div>
  );
}

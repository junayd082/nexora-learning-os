'use client';
/**
 * NEXORA Live — every screen of the demonstration, built with NEXORA's own design classes and the
 * real Lecture 2 content. Each screen is a pure function of (beat, p): p runs 0 → 1 over the beat's
 * narration, so every action lands on its line with either voice. Cursor paths live in CURSOR.
 */
import { brand } from '@/lib/brand';
import { cn } from '@/lib/util';
import '@/components/attendance/attendance.css';
import {
  ArrowRight, Bell, BookOpen, Check, CheckCircle2, ChevronDown, Compass, Download, Eye, FileText, FileType2, FolderOpen, Globe2, GraduationCap, Hand,
  Home, LayoutGrid, Library, Loader2, Megaphone, NotebookPen, PenSquare, Plus, RotateCcw, Search, Sparkles, Ticket, Timer, Upload, Users, Bookmark,
} from 'lucide-react';
import { FormArt } from '@/components/companion/forms';

export const seg = (p: number, a: number, b: number) => Math.max(0, Math.min(1, (p - a) / Math.max(0.0001, b - a)));
const typed = (s: string, p: number, a: number, b: number) => s.slice(0, Math.round(s.length * seg(p, a, b)));
const vis = (on: boolean) => (on ? 'dm-in' : 'dm-in dm-hide');
const pop = (on: boolean) => (on ? 'dm-pop' : 'dm-pop dm-hide');
const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

export const STUDENTS = ['Maya R.', 'Jordan T.', 'Aiden N.', 'Sofia M.', 'Ethan B.', 'Priya P.', 'Liam C.', 'Zoe K.', 'Marcus J.', 'Ava T.', 'Daniel L.', 'Isabella G.',
  'Noah W.', 'Chloe D.', 'Elijah M.', 'Mia H.', 'Lucas W.', 'Amara O.', 'Gabriel S.', 'Hannah S.', 'Ryan M.', 'Leah C.', 'Mateo R.', 'Grace W.'];
const COLORS = ['#ff7a1a', '#e0459c', '#8758ff', '#3fc8ff', '#5cd49a', '#ffb347'];

/** Cursor keyframes per chapter-beat: [p, target key, click?]. */
export const CURSOR: Record<string, [number, string, boolean?][]> = {
  'cold-0': [], 'cold-1': [],
  'morning-0': [[0.15, 'rest-br'], [0.55, 'classnow']], 'morning-1': [[0.1, 'rail-p1'], [0.6, 'rail-p3'], [0.72, 'rail-p3', true], [0.95, 'rail-p3']],
  'morning-2': [[0.15, 'up-due'], [0.5, 'up-news'], [0.85, 'up-missed']],
  'plan-0': [[0.1, 'tab-materials'], [0.32, 'add-btn', true], [0.6, 'menu-library'], [0.74, 'menu-library', true], [0.95, 'lib-L2']],
  'plan-1': [[0.2, 'lib-L2', true], [0.42, 'tag-lecture', true], [0.62, 'day-today', true], [0.78, 'lib-add', true], [1, 'mat-L2']],
  'plan-2': [[0.3, 'mat-web'], [0.6, 'mat-sheet'], [0.95, 'mat-L2']],
  'donow-0': [[0.15, 'kind-donow', true], [0.42, 'src-material', true], [0.66, 'gen-btn'], [0.78, 'gen-btn', true]],
  'donow-1': [[0.5, 'eng-core']],
  'donow-2': [[0.35, 'q2'], [0.62, 'q2-source', true], [0.95, 'q2-pop']],
  'donow-3': [[0.22, 'timer-5', true], [0.5, 'publish', true], [0.9, 'publish']],
  'room-0': [[0.5, 'rest-br']], 'room-1': [[0.18, 'att-all'], [0.3, 'att-all', true], [0.58, 'att-sofia'], [0.68, 'att-sofia', true], [0.9, 'att-foot']], 'room-2': [[0.6, 'resp']],
  'room-3': [[0.2, 'bell', true], [0.55, 'hand-maya'], [0.7, 'hand-coming', true], [0.95, 'hand-coming']],
  'room-4': [[0.3, 'pass-approve'], [0.45, 'pass-approve', true], [0.85, 'board']],
  'notes-0': [[0.08, 'cn-notes', true], [0.95, 'cn-notes']], 'notes-1': [[0.05, 'cn-cues', true], [0.6, 'cn-summary', true], [0.95, 'cn-summary']],
  'notes-2': [[0.15, 'cn-quiz', true], [0.48, 'cn-dl', true], [0.7, 'cn-word'], [0.95, 'cn-word']],
  'exit-0': [[0.3, 'ex-gen', true], [0.75, 'ex-publish', true]], 'exit-1': [[0.55, 'res-q2']], 'exit-2': [[0.3, 'res-q2', true], [0.7, 'mis']],
  'summary-0': [[0.25, 'sum-results', true], [0.55, 'sum-go', true], [0.9, 'sum-go']],
  'summary-1': [[0.3, 'sum-quote'], [0.62, 'sum-tab-teacher', true], [0.92, 'sum-reteach']],
  'summary-2': [[0.2, 'sum-publish', true], [0.52, 'sum-next', true], [0.9, 'focus']],
  'student-0': [[0.5, 'st-missed']], 'student-1': [[0.3, 'st-catch', true], [0.8, 'st-plan']],
  'student-2': [[0.15, 'nova', true], [0.5, 'nova-input'], [0.9, 'nova-answer']],
  'close-0': [], 'close-1': [],
};

// ----------------------------------------------------------------------------------- app chrome
const NAV: [string, typeof Home][] = [['Home', Home], ['Discover', Compass], ['Worlds', Globe2], ['Classrooms', Users], ['Portfolio', FolderOpen], ['Library', Bookmark], ['Apps', LayoutGrid]];
export function AppChrome({ active, teacher, bell = 0, avatar, children }: { active: string; teacher: boolean; bell?: number; avatar: string; children: React.ReactNode }) {
  return (
    <div className="dm-app">
      <aside className="dm-side">
        <div className="mb-6 flex items-center gap-2.5 px-2 pt-1 font-mono text-[12.5px] tracking-[0.28em]">
          <svg width="24" height="24" viewBox="0 0 64 64"><defs><linearGradient id="dmg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FF8A3D" /><stop offset=".55" stopColor="#C044B7" /><stop offset="1" stopColor="#8758FF" /></linearGradient></defs><rect width="64" height="64" rx="14" fill="#14151B" /><path d="M19 46V18l26 28V18" fill="none" stroke="url(#dmg)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          NEXORA
        </div>
        <div className="px-2.5 pb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Learn</div>
        {NAV.map(([n, I]) => <div key={n} className={`dm-nav ${active === n ? 'on' : ''}`}><I size={15} />{n}</div>)}
        {teacher && <><div className="px-2.5 pb-1.5 pt-5 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Teaching</div><div className={`dm-nav ${active === 'Teach' ? 'on' : ''}`}><PenSquare size={15} />Teach</div></>}
        <div className="mt-auto px-2.5 text-[10.5px] text-faint">NEXORA {brand.version.split('.').slice(0, 2).join('.')} · {brand.founder}</div>
      </aside>
      <div className="dm-main">
        <header className="dm-head">
          <div className="dm-search"><Search size={13} />Search NEXORA…<span className="ml-auto rounded border border-white/10 px-1 font-mono text-[10px]">⌘K</span></div>
          <div className="ml-auto flex items-center gap-1">
            {teacher && <span className="dm-icon"><Timer size={17} /></span>}
            {teacher && <span className="dm-icon" data-k="bell"><Bell size={17} />{bell > 0 && <span className="dm-badge">{bell}</span>}</span>}
            <span className="dm-icon text-[11px] font-semibold">EN</span>
            <span className="dm-avatar ml-1">{avatar}</span>
          </div>
        </header>
        <div className="dm-page">{children}</div>
      </div>
    </div>
  );
}

const Eyebrow = ({ children }: { children: React.ReactNode }) => <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted">{children}</div>;
const Toast = ({ on, children }: { on: boolean; children: React.ReactNode }) => <div className={`dm-toast ${on ? '' : 'dm-hide'}`}><CheckCircle2 size={15} className="text-ok" />{children}</div>;

// ----------------------------------------------------------------------------------- 1 · morning
function BellRail({ hl }: { hl: boolean }) {
  const periods = [1, 3, 5, 7];
  return (
    <div className="card mt-4 flex items-center gap-2 p-3">
      <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Thu · odd day</span>
      {periods.map((n) => (
        <div key={n} data-k={`rail-p${n}`} className={`flex-1 rounded-lg border px-3 py-2 text-center transition ${n === 3 && hl ? 'dm-hl border-ember/70 bg-ember/10' : 'border-line'}`}>
          <div className="text-[13px] font-bold">P{n}</div>
          <div className="text-[10.5px] text-muted">{({ 1: '7:05', 3: '8:45', 5: '10:25', 7: '12:55' } as Record<number, string>)[n]}</div>
          <div className="mt-0.5 truncate text-[10.5px]">{({ 1: 'Conference', 3: 'Arch. Design 1', 5: 'Eng. Design', 7: 'Arch. Design 2' } as Record<number, string>)[n]}</div>
        </div>
      ))}
      <div className="rounded-lg border border-line px-3 py-2 text-center"><div className="text-[13px] font-bold">B</div><div className="text-[10.5px] text-muted">lunch</div><div className="mt-0.5 text-[10.5px]">11:55</div></div>
    </div>
  );
}
function Morning({ b, p }: { b: number; p: number }) {
  return (
    <div>
      <div className={vis(true)}><div className="text-[13px] text-muted">Thursday, October 29</div><h1 className="display mt-1 text-[34px]">Good morning, Mr. C.</h1></div>
      <div className="mt-5 grid grid-cols-[1.5fr_1fr] gap-5">
        <div>
          <div data-k="classnow" className="card relative overflow-hidden p-6" style={{ boxShadow: b === 0 && p > 0.5 ? '0 0 0 1px #ff7a1a66' : undefined }}>
            <span className="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-ember/10 blur-3xl" />
            <Eyebrow>Next · Period 3 · in 1 h 47 min</Eyebrow>
            <div className="mt-2 text-[30px] font-bold tracking-tight">Architecture Design 1</div>
            <div className="text-muted">Mr. C · Room 105 · 8:45 – 10:20</div>
            <div className="mt-5 grid grid-cols-3 gap-3 text-[12.5px]">
              <div className="rounded-lg border border-line p-3"><div className="text-faint">Today’s lesson</div><div className="mt-1 font-semibold">Not planned yet</div></div>
              <div className="rounded-lg border border-line p-3"><div className="text-faint">Students</div><div className="mt-1 font-semibold">24 enrolled</div></div>
              <div className="rounded-lg border border-line p-3"><div className="text-faint">Due before class</div><div className="mt-1 font-semibold">Floor plan, sheet 2</div></div>
            </div>
          </div>
          <BellRail hl={b >= 1 && p > 0.7 || b > 1} />
        </div>
        <div className={vis(b >= 2 || (b === 1 && p > 0.95))}>
          <Eyebrow>Upcoming</Eyebrow>
          <ul className="card mt-2 divide-y divide-line overflow-hidden">
            <li data-k="up-due" className="flex items-center gap-3 px-4 py-3"><span className="h-8 w-1 rounded-full bg-ember" /><span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold">Floor plan, sheet 2</span><span className="block text-[11.5px] text-muted">Period 3 · 6 of 24 turned in</span></span><span className="text-[11px] text-muted">Due 8:45</span></li>
            <li data-k="up-news" className="flex gap-3 px-4 py-3"><Megaphone size={15} className="mt-0.5 text-violet" /><span className="text-[12.5px]"><b>You</b> · Field trip forms by Friday</span></li>
            <li data-k="up-missed" className="flex gap-3 px-4 py-3"><RotateCcw size={15} className="mt-0.5 text-muted" /><span className="text-[12.5px]">Missed last class · Wed: <b>Marcus J.</b>, <b>Leah C.</b></span></li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------------- 2 · plan
const LESSONS = ['Lecture 1 · The AutoCAD Workspace', 'Lecture 2 · Units, Coordinates & Precise Lines', 'Lecture 3 · Layers: Organizing the Drawing', 'Lecture 4 · Walls with OFFSET', 'Lecture 5 · Doors, Windows & Labels', 'Lecture 6 · Sheets & Plotting'];
function ClassHeader({ tab = 'Materials' }: { tab?: string }) {
  return (
    <div className="mb-5 flex items-end justify-between">
      <div><Eyebrow>Period 3 · Room 105</Eyebrow><h1 className="mt-1 text-[28px] font-bold tracking-tight">ARCHITECTURE DESIGN 1</h1></div>
      <div className="flex gap-1.5">{['Materials', 'Updates', 'Gradebook', 'Members'].map((t) => <span key={t} data-k={t === 'Materials' ? 'tab-materials' : undefined} className={`rounded-lg px-3 py-1.5 text-[13px] ${t === tab ? 'bg-ember/12 font-semibold text-ink' : 'text-muted'}`}>{t}</span>)}</div>
    </div>
  );
}
function MatRow({ k, on, tag, tagColor, title, sub }: { k: string; on: boolean; tag: string; tagColor: string; title: string; sub: string }) {
  return (
    <li data-k={k} className={`${vis(on)} flex items-center gap-3 px-4 py-3`}>
      <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: `${tagColor}22`, color: tagColor }}><BookOpen size={16} /></span>
      <span className="min-w-0 flex-1"><span className="block text-[13.5px] font-semibold">{title}</span><span className="block text-[11.5px] text-muted">{sub}</span></span>
      <span className="rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider" style={{ background: `${tagColor}22`, color: tagColor }}>{tag}</span>
      <span className="rounded border border-line px-1.5 py-0.5 text-[10.5px] text-muted">Today</span>
    </li>
  );
}
function Plan({ b, p }: { b: number; p: number }) {
  const menu = b === 0 && p > 0.34 && p < 0.78;
  const picker = (b === 0 && p > 0.76) || (b === 1 && p < 0.8);
  const added = b >= 2 || (b === 1 && p > 0.8);
  return (
    <div className="relative h-full">
      <ClassHeader />
      <div className="grid grid-cols-[1fr_260px] gap-5">
        <div>
          <div className="relative mb-3 inline-block">
            <span data-k="add-btn" className="btn-primary btn-sm"><Plus size={14} />Add materials<ChevronDown size={13} /></span>
            <div className={`${pop(menu)} surface-3 absolute left-0 top-10 z-20 w-64 p-1 text-[13px]`}>
              {[['Do Now (written from your lesson)', Sparkles], ['Exit ticket (written from your lesson)', Sparkles], ['Session summary', NotebookPen]].map(([l, I]) => { const Ic = I as typeof Sparkles; return <div key={l as string} className="flex items-center gap-2.5 rounded px-3 py-2"><Ic size={15} className="text-violet" />{l as string}</div>; })}
              <div className="my-1 border-t border-line" />
              {[['Upload a file', Upload], ['Library lesson', Library], ['Page', FileText]].map(([l, I]) => { const Ic = I as typeof Upload; return <div key={l as string} data-k={l === 'Library lesson' ? 'menu-library' : undefined} className={`flex items-center gap-2.5 rounded px-3 py-2 ${l === 'Library lesson' && p > 0.6 ? 'bg-ember/10' : ''}`}><Ic size={15} className="text-muted" />{l as string}</div>; })}
            </div>
          </div>
          <ul className="card divide-y divide-line overflow-hidden">
            <MatRow k="mat-L2" on={added} tag="Lecture" tagColor="#8758ff" title="Lecture 2 · Units, Coordinates & Precise Lines" sub="AutoCAD for Beginners · Mr. C · 90-minute block" />
            <MatRow k="mat-web" on={b >= 2 && p > 0.15 || b > 2} tag="Activity" tagColor="#3fc8ff" title="Lesson 2 website · Practice house outline" sub="Interactive · 30'-0&quot; × 24'-0&quot;" />
            <MatRow k="mat-sheet" on={b >= 2 && p > 0.4 || b > 2} tag="Homework" tagColor="#ff7a1a" title="Lesson 2 worksheet (PDF)" sub="Due Friday 11:59 PM" />
            <li className="px-4 py-3 text-[12px] text-faint">Last class · Lecture 1 · The AutoCAD Workspace</li>
          </ul>
        </div>
        <div className={vis(added)}><div className="card p-4 text-[12.5px]"><Eyebrow>On every student’s Home</Eyebrow><p className="mt-2 text-muted">Scheduled for Thursday, Period 3. Students see it under <b className="text-ink">Today</b>, and absent students find it under <b className="text-ink">Catch up</b>.</p></div></div>
      </div>
      {/* library picker */}
      <div className={`${pop(picker)} absolute inset-x-24 top-16 z-30`}>
        <div className="surface-3 p-5">
          <div className="mb-3 flex items-center gap-2"><Library size={16} className="ember-text" /><b>Add from the NEXORA library</b><span className="ml-auto text-[12px] text-muted">AutoCAD for Beginners · 6 lectures</span></div>
          <div className="grid grid-cols-[1.3fr_1fr] gap-4">
            <ul className="space-y-1">
              {LESSONS.map((l, i) => <li key={l} data-k={i === 1 ? 'lib-L2' : undefined} className={`rounded-lg border px-3 py-2 text-[13px] ${i === 1 && (b === 1 && p > 0.2) ? 'border-ember/70 bg-ember/10 font-semibold' : 'border-line text-muted'}`}>{l}</li>)}
            </ul>
            <div className="space-y-3 text-[12.5px]">
              <div><div className="mb-1 text-faint">Tag</div><div className="flex flex-wrap gap-1.5">{['Do Now', 'Lecture', 'Activity', 'Homework'].map((t) => <span key={t} data-k={t === 'Lecture' ? 'tag-lecture' : undefined} className={`rounded-full border px-2.5 py-1 ${t === 'Lecture' && b === 1 && p > 0.42 ? 'border-violet/70 bg-violet/15 text-ink' : 'border-line text-muted'}`}>{t}</span>)}</div></div>
              <div><div className="mb-1 text-faint">Lesson day</div><div className="flex gap-1.5">{['Today · Thu', 'Fri', 'Mon'].map((t, i) => <span key={t} data-k={i === 0 ? 'day-today' : undefined} className={`rounded-full border px-2.5 py-1 ${i === 0 && b === 1 && p > 0.62 ? 'border-ember/70 bg-ember/10 text-ink' : 'border-line text-muted'}`}>{t}</span>)}</div></div>
              <span data-k="lib-add" className="btn-primary btn-sm mt-2 inline-flex"><Plus size={13} />Add to Period 3</span>
            </div>
          </div>
        </div>
      </div>
      <Toast on={b === 1 && p > 0.82 || (b === 2 && p < 0.3)}>Added for today · Period 3</Toast>
    </div>
  );
}

// ----------------------------------------------------------------------------------- 3 · do now
const DN = [
  { k: 'q1', type: 'Multiple choice', q: 'Why do we set AutoCAD to Architectural units for a house plan?', opts: ['So numbers mean feet and inches', 'So lines draw faster', 'So the grid turns on'], quote: 'Units tell AutoCAD how to read and show numbers.', page: '2.1' },
  { k: 'q2', type: 'Multiple choice', q: 'You need a wall 30 feet long. What do you type?', opts: ['30', "30'", '30"'], quote: 'Typing 30 for a 30-foot wall draws a wall 2\'-6" long.', page: '2.2' },
  { k: 'q3', type: 'True / false', q: 'With Ortho on (F8), the cursor locks to horizontal and vertical.', opts: ['True', 'False'], quote: 'F8 Ortho Locks the cursor to horizontal and vertical', page: '2.3' },
  { k: 'q4', type: 'Short answer', q: 'In your own words: what does @12\',0 tell AutoCAD?', opts: [], quote: '12 feet right of the last point, 0 up', page: '2.4' },
];
function DoNow({ b, p }: { b: number; p: number }) {
  if (b === 0) {
    const busy = p > 0.8;
    return (
      <div>
        <Eyebrow>Architecture Design 1 · New check</Eyebrow><h1 className="mt-1 text-[28px] font-bold">Write a Do Now from your lesson</h1>
        <div className="mt-5 grid grid-cols-[1fr_280px] gap-5">
          <div className="space-y-4">
            <div className="card p-4"><div className="mb-3 text-[13px] font-semibold">1 · What are you making?</div><div className="grid grid-cols-3 gap-2 text-[13px]">{['Do Now', 'Exit ticket', 'Quiz'].map((k, i) => <div key={k} data-k={i === 0 ? 'kind-donow' : undefined} className={`rounded-lg border px-3 py-2.5 ${i === 0 && p > 0.15 ? 'border-ember/60 bg-ember/10 font-semibold' : 'border-line'}`}>{k}<div className="text-[11px] font-normal text-muted">{['5-minute bell-ringer', 'End-of-class check', 'Graded quiz'][i]}</div></div>)}</div></div>
            <div className="card p-4"><div className="mb-3 text-[13px] font-semibold">2 · From which lesson?</div>
              <div className="mb-3 flex gap-1.5 text-[12px]">{['Class material', 'Upload', 'Paste', 'Library'].map((t, i) => <span key={t} data-k={i === 0 ? 'src-material' : undefined} className={`rounded border px-2.5 py-1 font-mono ${i === 0 && p > 0.42 ? 'border-ember/60 bg-ember/10 text-ink' : 'border-line text-muted'}`}>{t}</span>)}</div>
              <div className={`rounded-lg border px-3 py-2 text-[13px] ${p > 0.45 ? 'border-ember/50' : 'border-line text-muted'}`}>{p > 0.45 ? '● Lecture 2 · Units, Coordinates & Precise Lines' : 'Choose a material…'}</div></div>
            <div className="card p-4"><div className="mb-2 text-[13px] font-semibold">3 · Questions</div><div className="flex gap-4 text-[12.5px] text-muted"><span>Multiple choice <b className="text-ink">2</b></span><span>True / false <b className="text-ink">1</b></span><span>Short answer <b className="text-ink">1</b></span></div></div>
          </div>
          <div className="space-y-3">
            <div className="rounded-lg border border-violet/40 bg-violet/10 p-3 text-[12px]"><Sparkles size={14} className="mb-1 text-violet" />Claude reads the whole lesson and quotes it for every answer. NEXORA checks each quote.</div>
            <span data-k="gen-btn" className="btn-primary flex justify-center">{busy ? <Loader2 size={15} className="dm-spin" /> : <Sparkles size={15} />}{busy ? 'Reading the lesson…' : 'Write questions'}</span>
          </div>
        </div>
      </div>
    );
  }
  if (b === 1) {
    const lines: [string, 'cut' | 'core' | ''][] = [['Lessons ☰ · Previous · Next', 'cut'], ['Lecture 2 of 6 · AutoCAD 2026 · 90-minute block', 'cut'], ['2.1 Setting Architectural Units', ''],
      ['Units tell AutoCAD how to read and show numbers. Architecture in the U.S. uses feet and inches, so we use Architectural units.', 'core'],
      ['2.2 Typing Feet and Inches', ''], ['Forgetting the foot mark ( \' ) is the #1 beginner mistake. Typing 30 for a 30-foot wall draws a wall 2\'-6" long.', 'core'],
      ['Practice · Lesson 2 website · Lesson 2 worksheet', 'cut'], ['2.4 Three Ways to Place a Point', ''], ['@12\',0 means 12 feet right of the last point, 0 up. Polar @10\'<90 is 10 feet long at 90°.', 'core'], ['MR. C · AutoCAD for Beginners · page footer', 'cut']];
    return (
      <div className="grid h-full grid-cols-[1.25fr_1fr] items-center gap-6">
        <div className="self-center rounded-xl bg-[#f6f3ee] p-6 text-[13px] leading-relaxed text-[#1b1a19] shadow-2xl">
          {lines.map(([l, k], i) => {
            const cutOn = k === 'cut' && p > 0.12 + i * 0.05; const coreOn = k === 'core' && p > 0.55;
            return <div key={i} className="relative rounded px-2 py-1 transition-colors duration-700" style={{ fontWeight: k === '' ? 700 : 400, color: cutOn ? '#b8b2aa' : undefined, background: coreOn ? 'linear-gradient(90deg,#ffd9b8,#f3d1ff)' : undefined }}>
              {l}{k === 'cut' && <span className="absolute inset-x-1 top-1/2 h-[2px] origin-left bg-[#e4364d] transition-transform duration-500" style={{ transform: `scaleX(${cutOn ? 1 : 0})` }} />}
            </div>;
          })}
        </div>
        <div className="flex flex-col justify-center gap-4">
          <div className="card p-5"><Eyebrow>Reading the lesson</Eyebrow><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.07]"><div className="h-full rounded-full bg-gradient-to-r from-ember to-violet transition-[width] duration-300" style={{ width: `${Math.round(seg(p, 0.05, 0.9) * 100)}%` }} /></div>
            <ul className="mt-4 space-y-2 text-[13px]">
              <li className={vis(p > 0.25)}>✕ Removed: navigation, page header and footer</li>
              <li className={vis(p > 0.38)}>✕ Set aside: 26 headings and 15 fragments (labels, buttons, links)</li>
              <li data-k="eng-core" className={`${vis(p > 0.58)} text-ok`}>✓ Teaching core: 14 passages that explain</li>
              <li className={`${vis(p > 0.75)} text-violet`}>✦ Writing 4 questions, each quoting its passage…</li>
            </ul></div>
        </div>
      </div>
    );
  }
  // b 2–3: the questions
  const published = b === 3 && p > 0.52;
  return (
    <div className="relative grid h-full grid-cols-[1fr_250px] gap-5">
      <div>
        <div className="mb-3 flex items-center gap-3"><h1 className="text-[22px] font-bold">Do Now · Units &amp; coordinates</h1><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${published ? 'bg-ok/15 text-ok' : 'bg-white/10 text-muted'}`}>{published ? 'Published' : 'Draft'}</span></div>
        <div className="space-y-2.5">
          {DN.map((q, i) => (
            <div key={q.k} data-k={q.k} className={`${vis(b === 3 || p > 0.08 + i * 0.12)} card relative p-3.5`}>
              <div className="flex items-center gap-2 text-[11px] text-muted"><span className="font-mono">Q{i + 1}</span>{q.type}<span className="ml-auto inline-flex items-center gap-1 text-ok"><Check size={12} />Quote verified · {q.page}</span></div>
              <div className="mt-1 text-[14px] font-semibold">{q.q}</div>
              {q.opts.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5 text-[12px]">{q.opts.map((o, j) => <span key={o} className={`rounded-md border px-2 py-1 ${(i === 1 ? j === 1 : j === 0) ? 'border-ok/50 text-ink' : 'border-line text-muted'}`}>{o}</span>)}</div>}
              {i === 1 && <span data-k="q2-source" className="absolute bottom-3 right-3 text-[11.5px] text-violet underline decoration-dotted">Show source</span>}
              {i === 1 && <div data-k="q2-pop" className={`${pop(b === 2 && p > 0.64)} surface-3 absolute -bottom-2 right-3 z-20 w-[360px] translate-y-full p-3 text-[12px]`}><Eyebrow>Lecture 2 · section 2.2 · Typing Feet and Inches</Eyebrow><p className="mt-2 border-l-2 border-ember pl-2 italic">“Forgetting the foot mark ( ' ) is the #1 beginner mistake. <mark className="rounded bg-ember/25 px-0.5 text-ink">Typing 30 for a 30-foot wall draws a wall 2'-6" long.</mark>”</p><div className="mt-2 text-ok">✓ Found word for word in the lecture</div></div>}
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <div className="card p-4 text-[12.5px]"><div className="mb-2 font-semibold">Timer</div><div className="flex gap-1.5">{['Off', '3 min', '5 min', 'Bell'].map((t) => <span key={t} data-k={t === '5 min' ? 'timer-5' : undefined} className={`rounded-full border px-2.5 py-1 ${t === '5 min' && b === 3 && p > 0.22 ? 'border-ember/70 bg-ember/10 text-ink' : 'border-line text-muted'}`}>{t}</span>)}</div></div>
        <div className="card p-4 text-[12.5px] text-muted"><div className="mb-1 font-semibold text-ink">Lesson day</div>Thursday · Period 3 · opens at the bell</div>
        <span data-k="publish" className="btn-primary flex justify-center">{published ? <><Check size={15} />Published</> : 'Publish to Period 3'}</span>
      </div>
      <Toast on={b === 3 && p > 0.55}>Do Now is ready · opens at 8:45 with a 5-minute timer</Toast>
    </div>
  );
}

// ----------------------------------------------------------------------------------- 4 · the room
/** The live room. Beat 1 is attendance; the others are the projector, hands and passes. */
function Room({ b, p }: { b: number; p: number }) {
  if (b === 1) return <TakeAttendance p={p} />;
  return <RoomLive b={b > 1 ? b - 1 : b} p={p} />;
}

function RoomLive({ b, p }: { b: number; p: number }) {
  const secs = Math.max(0, Math.round(300 - (b === 0 ? p * 14 : b === 1 ? 14 + p * 90 : 104 + (b - 2) * 40 + p * 40)));
  const answered = b === 0 ? 0 : b === 1 ? Math.round(ease(seg(p, 0.05, 0.85)) * 23) : 23;
  const panel = b >= 2 && (b === 3 || p > 0.22);
  const approved = b === 3 && p > 0.46;
  const C = 2 * Math.PI * 92;
  return (
    <div className="relative grid h-full grid-cols-[1.35fr_1fr] gap-6">
      <div className="card flex flex-col items-center justify-center p-6 text-center">
        <Eyebrow>Projector · Do Now · Units &amp; coordinates</Eyebrow>
        <div className="relative mt-4 h-[220px] w-[220px]">
          <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90"><circle cx="100" cy="100" r="92" fill="none" stroke="#ffffff12" strokeWidth="10" />
            <circle cx="100" cy="100" r="92" fill="none" stroke="url(#dmt)" strokeWidth="10" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - secs / 300)} />
            <defs><linearGradient id="dmt"><stop offset="0" stopColor="#ff7a1a" /><stop offset="1" stopColor="#8758ff" /></linearGradient></defs></svg>
          <div className="absolute inset-0 grid place-items-center text-[52px] font-bold tabular-nums tracking-tight">{Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}</div>
        </div>
        <div data-k="resp" className="mt-5 text-[15px]"><b className="text-[22px] tabular-nums">{answered}</b> <span className="text-muted">of 23 here turned in · 1 absent</span></div>
        <div className="mt-3 flex max-w-[460px] flex-wrap justify-center gap-1">{STUDENTS.map((s, i) => <span key={s} title={s} className="h-3.5 w-3.5 rounded-full transition-colors duration-300" style={{ background: i < answered ? COLORS[i % 6] : '#ffffff14' }} />)}</div>
      </div>
      <div className="space-y-4">
        <div className={`${pop(panel)} surface-3 p-4`}>
          <div className="mb-3 flex gap-2 text-[12.5px]"><span className="rounded-full bg-ember/15 px-2.5 py-1 font-semibold ember-text">Hands 1</span><span className={`rounded-full px-2.5 py-1 ${b === 3 ? 'bg-violet/15 font-semibold text-violet' : 'text-muted'}`}>Passes {b === 3 ? 1 : 0}</span></div>
          <div data-k="hand-maya" className="flex items-center gap-3 rounded-lg border border-line p-3"><Hand size={18} className="ember-text" /><span className="flex-1"><b className="block text-[13.5px]">Maya R.</b><span className="text-[11.5px] text-muted">#1 in line · raised 0:12 ago · “Is 30' the same as 30'-0&quot;?”</span></span>
            <span data-k="hand-coming" className={`rounded-full border px-2.5 py-1 text-[11.5px] ${b >= 2 && p > 0.7 || b > 2 ? 'border-ok/60 text-ok' : 'border-line'}`}>{b >= 2 && p > 0.7 || b > 2 ? '✓ Coming' : 'Coming'}</span></div>
          {b === 3 && <div className={`${vis(p > 0.05)} mt-2 flex items-center gap-3 rounded-lg border border-violet/40 p-3`}><Ticket size={18} className="text-violet" /><span className="flex-1"><b className="block text-[13.5px]">Jordan T. → Restroom</b><span className="text-[11.5px] text-muted">1st pass today · nobody out</span></span>
            <span data-k="pass-approve" className={`rounded-full px-3 py-1 text-[11.5px] font-semibold ${approved ? 'bg-ok/20 text-ok' : 'bg-ember text-[#140a04]'}`}>{approved ? '✓ Approved' : 'Approve'}</span></div>}
        </div>
        <div data-k="board" className={`${vis(b === 3 && p > 0.5)} card p-4`}><Eyebrow>Class pass board · what students see</Eyebrow><div className="mt-3 flex items-center justify-between rounded-lg border border-line px-3 py-2.5 text-[13.5px]"><span><b>Out of room</b></span><span className="tabular-nums ember-text">0:{String(Math.round(seg(p, 0.5, 1) * 40)).padStart(2, '0')}</span></div><div className="mt-2 text-[11.5px] text-muted">One student out at a time · 8-minute limit</div></div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------------- 4b · attendance (the real sheet's look)
const ROSTER = [...STUDENTS].sort((a, b) => a.localeCompare(b));
const DAYS = [{ d: 'M', n: '10/26' }, { d: 'T', n: '10/27', off: true }, { d: 'W', n: '10/28' }, { d: 'T', n: '10/29', today: true }, { d: 'F', n: '10/30', future: true }];
function TakeAttendance({ p }: { p: number }) {
  const filled = p > 0.3 ? Math.min(ROSTER.length, Math.floor(seg(p, 0.3, 0.5) * ROSTER.length + 1)) : 0;
  const sofiaOut = p > 0.68;
  const mark = (name: string, di: number): 'P' | 'A' | '' => {
    if (di === 0) return 'P';
    if (di === 2) return name === 'Marcus J.' || name === 'Leah C.' ? 'A' : 'P';
    if (di === 3) { const i = ROSTER.indexOf(name); if (i >= filled) return ''; return name === 'Sofia M.' && sofiaOut ? 'A' : 'P'; }
    return '';
  };
  const col = (m: string) => (m === 'P' ? { color: '#1f8a4c', background: '#e3f5e9' } : m === 'A' ? { color: '#c2362f', background: '#fde6e4' } : {});
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-end justify-between"><div><h1 className="text-[20px] font-bold leading-tight">Attendance</h1><p className="text-[12px] text-muted">Period 3 meets Mon, Wed, Thu · Architecture Design 1</p></div>
        <span data-k="att-all" className={`btn-primary ${filled ? 'opacity-60' : ''}`}><Check size={14} />{filled >= ROSTER.length ? 'Today is taken' : 'Mark everyone present today'}</span></div>
      <div className="mt-2 flex items-center gap-2 text-[12px]"><span className="btn btn-sm">‹</span><span className="btn btn-sm">📅 Oct 26 – Oct 30, 2026 ▾</span><span className="btn btn-sm">›</span><span className="rounded-md border border-line px-2.5 py-1 font-semibold ember-text">Week</span><span className="rounded-md border border-line px-2.5 py-1 text-muted">Month</span><span className={`${vis(p > 0.72)} ml-auto text-ok`}>✓ Saved · 23 present, Sofia M. absent</span></div>
      <div className="att-paper att-week mt-3 overflow-hidden">
        <table className="att-grid" style={{ fontSize: 11.5 }}>
          <thead>
            <tr><th rowSpan={2} className="att-namehead att-name" style={{ fontSize: 14, minWidth: 150, padding: '2px 12px' }}>Name</th><th colSpan={5} className="att-wk" style={{ padding: '3px 6px', fontSize: 11.5 }}>Oct 26 – Oct 30</th>
              <th rowSpan={2} className="att-sum att-wk">Abs</th><th rowSpan={2} className="att-sum">Term</th></tr>
            <tr>{DAYS.map((x, i) => <th key={i} className={cn(i === 0 && 'att-wk', x.today && 'att-today', x.off && 'att-off', x.future && 'att-future')}><span className="att-day" style={{ minHeight: 22, fontSize: 10.5, padding: '2px 0' }}>{x.d}<small>{x.n}</small></span></th>)}</tr>
          </thead>
          <tbody>
            {ROSTER.map((name, r) => (
              <tr key={name}>
                <td className="att-name" style={{ minWidth: 150, fontSize: 11, lineHeight: '16px' }}><span className="att-num">{r + 1}</span>{name === 'Sofia M.' ? 'Sofia M.' : name}</td>
                {DAYS.map((x, di) => { const m = mark(name, di); return (
                  <td key={di} className={cn(di === 0 && 'att-wk', x.today && 'att-today', x.off && !m && 'att-off', x.future && 'att-future')}>
                    <span data-k={name === 'Sofia M.' && di === 3 ? 'att-sofia' : undefined} className="att-cell" data-m={m ? 'x' : undefined} style={{ height: 16.5, minWidth: 62, fontSize: 10.5, ...col(m) }}>{m}</span>
                  </td>); })}
                <td className="att-sum att-wk">{[0, 1, 2, 3].filter((di) => mark(name, di) === 'A').length}</td>
                <td className="att-sum">{name === 'Sofia M.' ? (sofiaOut ? 2 : 1) : name === 'Marcus J.' || name === 'Leah C.' ? 1 : 0}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td data-k="att-foot" className="att-name" style={{ padding: '3px 12px' }}>Present</td>{DAYS.map((x, i) => <td key={i} className={cn(i === 0 && 'att-wk', x.today && 'att-today')} style={{ padding: '4px 2px' }}>{i === 0 ? '24/24' : i === 2 ? '22/24' : i === 3 && filled >= ROSTER.length ? (sofiaOut ? '23/24' : '24/24') : ''}</td>)}<td className="att-wk" /><td /></tr></tfoot>
        </table>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------------- 5 · cornell notes (student)
function Notes({ b, p }: { b: number; p: number }) {
  const notes = '• Units tell AutoCAD how to read numbers\n• U.S. plans use feet and inches\n• Type 30\' for 30 feet. Plain 30 = 30 inches!\n• @12\',0 = 12 ft right of the last point\n• Polar: @10\'<90 = 10 ft at 90° (up)';
  const cues = 'Why Architectural units?\n\n#1 mistake?\n\nRelative vs. polar?';
  const sum = 'Architectural units make numbers mean feet and inches. Always type the foot mark. Relative input measures from the last point; polar uses a length and an angle.';
  const n = b === 0 ? typed(notes, p, 0.1, 0.95) : notes;
  const c = b === 0 ? '' : b === 1 ? typed(cues, p, 0.08, 0.5) : cues;
  const s = b === 0 ? '' : b === 1 ? typed(sum, p, 0.62, 0.98) : sum;
  const quiz = b === 2 && p > 0.17;
  const dl = b === 2 && p > 0.5;
  const line = { backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0 25px, #bcd3e6 25px 26px)', lineHeight: '26px' };
  return (
    <div className="relative grid h-full grid-cols-[1fr_210px] gap-5">
      <div className="relative mx-auto w-full max-w-[760px] overflow-hidden rounded-md bg-[#fffdf7] p-[14px_20px_12px_52px] text-[#1c1c21] shadow-2xl">
        <span className="absolute inset-y-0 left-[36px] w-[2px] bg-[#e58b8b]" />
        <div className="flex items-center justify-between"><span className="rounded-xl bg-[#f6e3a1] px-3 pb-0.5 text-[24px] font-semibold" style={{ fontFamily: 'Caveat, cursive', transform: 'rotate(-1deg)', display: 'inline-block' }}>Cornell Notes</span><span className="font-mono text-[10px] tracking-[0.14em] text-[#8a8a94]">PAGE 1 OF {b >= 1 && p > 0.3 || b > 1 ? 2 : 1}</span></div>
        <div className="mt-1 grid grid-cols-4 gap-3 text-[11px]">{[['NAME', 'Ava Thompson'], ['CLASS', 'Architecture Design 1'], ['PERIOD', '3'], ['DATE', 'Oct 29, 2026']].map(([k, v]) => <div key={k}><div className="font-mono text-[9px] tracking-wider text-[#8a8a94]">{k}</div><div className="border-b border-[#c9c9cf] pb-0.5">{v}</div></div>)}</div>
        <div className="mt-1.5 text-[17px] font-bold">Lesson 2 · Units, coordinates and precise lines</div>
        <div className="mt-1.5 h-[3px] bg-[#17171b]" />
        <div className="grid grid-cols-[30%_1fr]" style={{ height: 286 }}>
          <div data-k="cn-cues" className="whitespace-pre-wrap border-r-[3px] border-[#17171b] px-2 text-[13.5px] font-semibold" style={line}><span className="block text-[18px] font-semibold text-[#3a3a42]" style={{ fontFamily: 'Caveat, cursive' }}>Questions / Keywords</span>{c}{b === 1 && p < 0.5 && <span className="dm-caret" />}</div>
          <div data-k="cn-notes" className="relative whitespace-pre-wrap px-3 text-[14px]" style={line}><span className="block text-[18px] font-semibold text-[#3a3a42]" style={{ fontFamily: 'Caveat, cursive' }}>Notes</span>{n}{b === 0 && <span className="dm-caret" />}
            <div className="absolute inset-0 top-[26px] flex flex-col items-center justify-center gap-3 text-center text-[13px] text-[#4a4a52] transition-all duration-700" style={{ background: 'repeating-linear-gradient(135deg, #f3efe4 0 12px, #efe9db 12px 24px)', opacity: quiz ? 1 : 0, transform: quiz ? 'none' : 'translateX(24px)' }}>
              <span className="max-w-[240px]">Answer the questions on the left, then reveal your notes.</span><span className="rounded-full bg-[#1c1c21] px-4 py-1.5 text-[12px] font-semibold text-white">Reveal notes</span></div>
          </div>
        </div>
        <div className="h-[3px] bg-[#17171b]" />
        <div data-k="cn-summary" className="px-1 text-[13.5px]" style={line}><span className="block text-[18px] font-semibold text-[#3a3a42]" style={{ fontFamily: 'Caveat, cursive' }}>Summary</span>{s}{b === 1 && p > 0.6 && <span className="dm-caret" />}</div>
      </div>
      <div className="space-y-3 pt-2">
        <span data-k="cn-quiz" className={`btn btn-sm w-full justify-center ${quiz ? 'border-ember/60 ember-text' : ''}`}><Eye size={14} />{quiz ? 'Stop quiz' : 'Quiz myself'}</span>
        <div className="relative"><span data-k="cn-dl" className="btn-primary btn-sm flex w-full justify-center"><Download size={14} />Download<ChevronDown size={13} /></span>
          <div className={`${pop(dl)} surface-3 absolute right-0 top-10 z-20 w-full p-1 text-[13px]`}><div data-k="cn-word" className={`flex items-center gap-2 rounded px-3 py-2 ${p > 0.7 ? 'bg-ember/10' : ''}`}><FileText size={15} className="text-[#2b7cd3]" />Word (.docx)</div><div className="flex items-center gap-2 rounded px-3 py-2"><FileType2 size={15} className="text-[#e5484d]" />PDF</div></div></div>
        <div className={`${vis(b >= 1 && p > 0.3 || b > 1)} card p-3 text-[11.5px] text-muted`}>Page full · continued on page 2</div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------------- 6 · exit ticket
const RES = [{ k: 'res-q1', q: 'Type a 30-foot wall correctly', pct: 91 }, { k: 'res-q2', q: 'Polar input: draw 10 ft straight up', pct: 43 }, { k: 'res-q3', q: 'Which snap finds the exact end of a line?', pct: 78 }];
function Exit({ b, p }: { b: number; p: number }) {
  if (b === 0) return (
    <div className="grid h-full grid-cols-[1fr_260px] gap-5">
      <div><Eyebrow>Exit ticket · written from Lecture 2 · DOK 2–3</Eyebrow><h1 className="mt-1 text-[24px] font-bold">Exit ticket · Precise lines</h1>
        <div className="mt-4 space-y-2.5">{RES.map((r, i) => <div key={r.k} className={`${vis(p > 0.32 + i * 0.1)} card p-3.5`}><div className="text-[11px] text-muted"><span className="font-mono">Q{i + 1}</span> · {['Apply', 'Apply', 'Recall'][i]} · <span className="text-ok">quote verified</span></div><div className="mt-1 text-[14px] font-semibold">{['You need an exterior wall 30 feet long. What exactly do you type at the prompt?', 'From the last point, draw a line 10 feet straight up using polar input. What do you type?', 'Which Object Snap grabs the exact end of a line?'][i]}</div></div>)}</div>
      </div>
      <div className="space-y-3 pt-6"><span data-k="ex-gen" className="btn flex justify-center">{p > 0.3 ? <Check size={15} /> : <Sparkles size={15} />}{p > 0.3 ? 'Written' : 'Write questions'}</span><span data-k="ex-publish" className="btn-primary flex justify-center">{p > 0.76 ? <><Check size={15} />Live for Period 3</> : 'Publish'}</span></div>
      <Toast on={p > 0.78}>Exit ticket is live · 3 questions</Toast>
    </div>
  );
  return (
    <div className="grid h-full grid-cols-[1.3fr_1fr] gap-6">
      <div className="card p-5"><div className="flex items-baseline justify-between"><b className="text-[16px]">Exit ticket · results</b><span className="text-[12.5px] text-muted">23 of 24 answered · class average 71%</span></div>
        <ul className="mt-5 space-y-4">{RES.map((r, i) => {
          const w = b === 1 ? seg(p, 0.15 + i * 0.12, 0.5 + i * 0.12) : 1;
          return <li key={r.k} data-k={r.k} className={`rounded-lg p-2 ${i === 1 && b === 2 ? 'dm-hl' : ''}`}><div className="flex justify-between text-[13px]"><span><span className="font-mono text-faint">Q{i + 1}</span> {r.q}</span><b className={r.pct < 50 ? 'text-bad' : ''}>{Math.round(r.pct * w)}%</b></div>
            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white/[0.07]"><div className="h-full rounded-full" style={{ width: `${r.pct * w}%`, background: r.pct < 50 ? '#f06270' : r.pct < 80 ? '#ff7a1a' : '#5cc48c' }} /></div></li>;
        })}</ul></div>
      <div data-k="mis" className={`${vis(b === 2 && p > 0.4)} card p-5`}><Eyebrow>Q2 · lowest score · show source</Eyebrow>
        <div className="mt-3 text-[13.5px] font-semibold">From the last point, draw a line 10 feet straight up using polar input. What do you type?</div>
        <div className="mt-2 flex gap-2 text-[12px]"><code className="rounded border border-ok/50 px-2 py-0.5 text-ok">@10'&lt;90 ✓</code><span className="text-bad">43% correct</span></div>
        <div className="mt-4 rounded-lg border border-line bg-white/[0.03] p-3 text-[12.5px]"><div className="text-[10.5px] uppercase tracking-[0.12em] text-faint">From the lesson · 2.1 Setting Architectural Units · quote verified</div>
          <p className="mt-1.5 italic">“Angles are measured from 0° pointing right (east), going counterclockwise: 90° is up”</p></div>
        <div className="mt-3 rounded-lg border border-bad/40 bg-bad/10 p-3 text-[12.5px]"><b>Re-teach tomorrow:</b> polar angles. 0° points right; straight up is 90°.</div></div>
    </div>
  );
}

// ----------------------------------------------------------------------------------- 7 · session summary
function Summary({ b, p }: { b: number; p: number }) {
  if (b === 0) return (
    <div><Eyebrow>Architecture Design 1</Eyebrow><h1 className="mt-1 text-[28px] font-bold">Session summary</h1>
      <div className="mt-5 grid grid-cols-[1fr_280px] gap-5">
        <div className="space-y-4"><div className="card p-4"><div className="mb-2 text-[13px] font-semibold">1 · What did you teach today?</div><div className="rounded-lg border border-ember/50 px-3 py-2 text-[13px]">● Lecture 2 · Units, Coordinates &amp; Precise Lines</div></div>
          <div data-k="sum-results" className="card flex items-start gap-3 p-4"><span className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded ${p > 0.25 ? 'bg-ember text-[#140a04]' : 'border border-line'}`}>{p > 0.25 && <Check size={13} />}</span><span><b className="block text-[13.5px]">Use today’s Do Now and Exit ticket results</b><span className="text-[12px] text-muted">So the notes reflect real mistakes. Results stay in your private notes.</span></span></div></div>
        <div className="space-y-3"><div className="card p-4 text-[12.5px] text-muted">Thursday, Oct 29 · English · On grade level</div><span data-k="sum-go" className="btn-primary flex justify-center">{p > 0.56 ? <><Loader2 size={15} className="dm-spin" />Reading the lesson and today’s results…</> : <><Sparkles size={15} />Write the summary</>}</span></div>
      </div>
    </div>
  );
  const teacherTab = b === 1 ? p > 0.62 : b === 2;
  const published = b === 2 && p > 0.22;
  const nextOpen = b === 2 && p > 0.55;
  return (
    <div className="relative grid h-full grid-cols-[1fr_260px] gap-5">
      <div className="card overflow-hidden">
        <div className="flex gap-1.5 border-b border-line px-4 py-2.5 text-[12px]"><span className={`rounded px-2.5 py-1 font-mono ${!teacherTab ? 'border border-ember/60 bg-ember/10' : 'text-muted'}`}>Student summary</span><span data-k="sum-tab-teacher" className={`rounded px-2.5 py-1 font-mono ${teacherTab ? 'border border-ember/60 bg-ember/10' : 'text-muted'}`}>Teacher notes</span></div>
        {!teacherTab ? (
          <div className="space-y-3 p-5 text-[13.5px] leading-relaxed">
            <div className="text-[18px] font-semibold">What we learned</div><p className="text-ink/85">Today we set AutoCAD to Architectural units so numbers mean feet and inches, and learned three ways to place a point exactly.</p>
            <div className="text-[18px] font-semibold">Key ideas</div>
            <ol className="list-decimal space-y-2 pl-5"><li><b>Architectural units</b> — feet and inches, one unit = one inch.<blockquote data-k="sum-quote" className="mt-1 border-l-2 border-ember/60 pl-3 text-[12.5px] text-muted">“Units tell AutoCAD how to read and show numbers.” (2.1) <span className="text-ok">✓</span></blockquote></li>
              <li><b>The foot mark matters</b> — 30 means 30 inches; 30' means 30 feet.</li><li><b>Relative vs. polar</b> — @x,y from the last point; @distance&lt;angle with 0° pointing right.</li></ol>
            <div className="text-[18px] font-semibold">Missed class? Catch up</div><p className="text-ink/85">Read this summary · open Lecture 2 · do the practice house outline · finish the worksheet by Friday.</p>
          </div>
        ) : (
          <div className="space-y-3 p-5 text-[13.5px]"><div className="text-[18px] font-semibold">Today’s checks</div><p className="text-muted">Do Now 23/24 · avg 86% · Exit ticket 23/24 · avg 71%</p>
            <div data-k="sum-reteach" className="rounded-lg border border-bad/40 bg-bad/10 p-3"><b>Re-teach:</b> polar input (Exit Q2, 43%, the hardest question). Show the angle compass: 0° east, 90° north.</div>
            <div className="text-[18px] font-semibold">Tomorrow’s Do Now</div><p className="text-muted">Spiral back to polar angles; preview layers.</p></div>
        )}
      </div>
      <div className="space-y-3">
        <span data-k="sum-publish" className="btn-primary flex justify-center">{published ? <><Check size={15} />Published</> : 'Save and publish'}</span>
        <div className="card space-y-2 p-4 text-[12.5px]"><b className="block text-[13px]">Build the next check</b><span data-k="sum-next" className={`block rounded-lg border p-2.5 ${nextOpen ? 'border-ember/60 bg-ember/10' : 'border-line'}`}><b className="block">Tomorrow’s Do Now</b><span className="text-muted">Spiral back to polar input</span></span><span className="block rounded-lg border border-line p-2.5"><b className="block">Next Exit ticket</b><span className="text-muted">Apply: relative vs polar</span></span></div>
      </div>
      <div className={`${pop(nextOpen && p > 0.6)} surface-3 absolute inset-x-24 top-16 z-30 p-5`}>
        <Eyebrow>New check · Do Now · from your session summary</Eyebrow>
        <div className="mt-3 text-[13px] text-faint">Focus (filled in from today’s results)</div>
        <div data-k="focus" className="mt-1 rounded-lg border border-ember/60 bg-ember/5 px-3 py-2.5 text-[14px]">{typed('Spiral back to polar input: @distance<angle, 0° points right, 90° is up.', p, 0.62, 0.92)}<span className="dm-caret" /></div>
        <div className="mt-2 text-[12px] text-violet">Filled in from your session summary · edit freely</div>
      </div>
      <Toast on={b === 2 && p > 0.24 && p < 0.55}>Summary published to Thursday · Period 3 · announcement posted</Toast>
    </div>
  );
}

// ----------------------------------------------------------------------------------- 8 · student view
function Student({ b, p }: { b: number; p: number }) {
  const ask = b === 2 && p > 0.17;
  return (
    <div className="relative h-full">
      <div className="text-[13px] text-muted">Thursday, 7:40 PM</div><h1 className="display mt-1 text-[32px]">Hi, Sofia.</h1>
      <div className="mt-4 grid grid-cols-[1fr_1.3fr] gap-5">
        <div className="card p-5"><Eyebrow>Your classes · Period 3</Eyebrow><div className="mt-2 text-[24px] font-bold">Architecture Design 1</div><div className="text-muted">Mr. C · next class Monday, 8:45 AM</div>
          <div className="mt-4 flex gap-2 text-[12px]"><span className="rounded-full border border-line px-3 py-1 text-muted">Worksheet due Friday</span></div></div>
        <div data-k="st-missed" className="card overflow-hidden border-bad/30">
          <div className="border-b border-line bg-bad/[0.08] px-4 py-3"><div className="text-[13px] font-semibold">You were absent in Architecture Design 1 (Period 3) today</div><div className="text-[11.5px] text-muted">Here is what you missed. Start with the summary if there is one.</div></div>
          <ul className="divide-y divide-line text-[12.5px]">
            <li data-k="st-catch" className={`flex items-center gap-2.5 px-4 py-2.5 ${b === 1 && p > 0.3 ? 'bg-ember/10' : ''}`}><span className="rounded-full border border-line px-1.5 text-[9.5px] font-semibold uppercase text-muted">Resource</span><span className="flex-1 truncate font-semibold">Session summary · Lecture 2</span><ArrowRight size={13} className="text-faint" /></li>
            <li className="flex items-center gap-2.5 px-4 py-2.5"><span className="rounded-full border border-ember/50 px-1.5 text-[9.5px] font-semibold uppercase ember-text">Do Now</span><span className="flex-1 truncate">Do Now · Units &amp; precise lines</span></li>
            <li className="flex items-center gap-2.5 px-4 py-2.5"><span className="rounded-full border border-violet/50 px-1.5 text-[9.5px] font-semibold uppercase text-violet">Lecture</span><span className="flex-1 truncate">Lecture 2 · Units, Coordinates &amp; Precise Lines</span></li>
            <li className="flex items-center gap-2.5 px-4 py-2.5"><span className="rounded-full border border-[#e0459c]/50 px-1.5 text-[9.5px] font-semibold uppercase text-[#e0459c]">Homework</span><span className="flex-1 truncate">Lesson 2 — Precise lines worksheet</span></li>
          </ul></div>
      </div>
      <div data-k="st-plan" className={`${vis(b === 1 && p > 0.35)} card mt-4 p-4 text-[13px]`}><b>Missed class? Catch up</b><ol className="mt-1.5 list-decimal space-y-0.5 pl-5 text-muted"><li>Read the summary and key ideas</li><li>Open Lecture 2 and the practice house</li><li>Try the Do Now</li><li>Finish the worksheet by Friday</li></ol></div>
      {/* assistant */}
      <div data-k="nova" className="absolute bottom-0 right-2 h-[84px] w-[84px]"><FormArt id="nova" pose="sit" mood={ask ? 'happy' : 'normal'} /></div>
      <div className={`${pop(ask)} surface-3 absolute bottom-24 right-6 w-[380px] p-4 text-[13px]`}>
        <div className="mb-2 font-semibold">Nova</div>
        <div data-k="nova-input" className="ml-auto w-fit rounded-xl bg-ember/20 px-3 py-1.5">{typed('what’s due?', p, 0.2, 0.42)}</div>
        <div data-k="nova-answer" className={`${vis(p > 0.48)} mt-2 rounded-xl bg-white/[0.06] p-3`}>Here’s what’s due:<ul className="mt-1.5 space-y-1"><li>• <b>Lesson 2 — Precise lines worksheet</b> · Fri 11:59 PM</li></ul></div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------------- dispatcher
export const CHAPTER_VIEW: Record<string, { url: string; nav: string; teacher: boolean; avatar: string; bell?: (b: number, p: number) => number }> = {
  morning: { url: '/home', nav: 'Home', teacher: true, avatar: 'MC' },
  plan: { url: '/classes/architecture-design-1', nav: 'Classrooms', teacher: true, avatar: 'MC' },
  donow: { url: '/classes/architecture-design-1/checks/new?kind=do_now', nav: 'Classrooms', teacher: true, avatar: 'MC' },
  room: { url: '/classes/architecture-design-1/live', nav: 'Classrooms', teacher: true, avatar: 'MC', bell: (b, p) => (b < 3 ? 0 : b === 3 && p < 0.25 ? 1 : b === 4 && p < 0.45 ? 1 : 0) },
  notes: { url: '/classes/architecture-design-1/notes', nav: 'Classrooms', teacher: false, avatar: 'AT' },
  exit: { url: '/checks/exit-ticket-precise-lines', nav: 'Classrooms', teacher: true, avatar: 'MC' },
  summary: { url: '/classes/architecture-design-1/summary/new', nav: 'Classrooms', teacher: true, avatar: 'MC' },
  student: { url: '/home', nav: 'Home', teacher: false, avatar: 'SM' },
};
export function Screen({ c, b, p }: { c: string; b: number; p: number }) {
  switch (c) {
    case 'morning': return <Morning b={b} p={p} />;
    case 'plan': return <Plan b={b} p={p} />;
    case 'donow': return <DoNow b={b} p={p} />;
    case 'room': return <Room b={b} p={p} />;
    case 'notes': return <Notes b={b} p={p} />;
    case 'exit': return <Exit b={b} p={p} />;
    case 'summary': return <Summary b={b} p={p} />;
    case 'student': return <Student b={b} p={p} />;
    default: return null;
  }
}

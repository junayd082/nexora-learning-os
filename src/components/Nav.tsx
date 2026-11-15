'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from 'react';
import { createPortal } from 'react-dom';
import {
  Home, Compass, Globe2, Users, FolderOpen, Bookmark, PenSquare, Shield, LogOut, Settings, Menu, X, Sparkles, KeyRound, PawPrint, Newspaper, LayoutGrid,
  BookOpen, Megaphone, GraduationCap, AppWindow, ClipboardCheck,
} from 'lucide-react';
import { cn, initials } from '@/lib/util';
import { setLiving, signOut } from '@/lib/actions';
import { LanguageButtons } from './LanguageSwitch';

const icons = { home: Home, discover: Compass, worlds: Globe2, classrooms: Users, portfolio: FolderOpen, library: Bookmark, teach: PenSquare, admin: Shield, join: KeyRound, apps: LayoutGrid } as const;
export type NavKey = keyof typeof icons;
export interface NavItem { key: NavKey; href: string; label: string }
export interface NavGroup { label: string; items: NavItem[] }

function isActive(path: string, href: string) {
  return path === href || (href !== '/' && path.startsWith(href + '/'));
}

/** Navigation is instant; the companion only reacts (looks toward the item, which glows briefly). */
function guide(e: React.MouseEvent<HTMLAnchorElement>) {
  const el = e.currentTarget;
  el.classList.add('guided');
  setTimeout(() => el.classList.remove('guided'), 900);
  window.dispatchEvent(new Event('nexora:guide'));
}

export function SideNav({ groups }: { groups: NavGroup[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Primary" className="flex flex-col gap-6">
      {groups.map((g) => (
        <div key={g.label}>
          <div className="eyebrow px-2.5 pb-2 text-faint">{g.label}</div>
          <ul className="flex flex-col gap-px">
            {g.items.map((it) => {
              const Icon = icons[it.key];
              const active = isActive(path, it.href) || (it.key === 'discover' && path.startsWith('/x/'));
              return (
                <li key={it.href}>
                  <Link href={it.href} data-tour={`nav-${it.key}`} aria-current={active ? 'page' : undefined} onClick={guide}
                    className={cn('nav-item flex h-9 items-center gap-3 rounded-md px-2.5 text-[13.5px]',
                      active ? 'font-semibold' : 'text-muted hover:text-ink')}>
                    <Icon size={16} aria-hidden strokeWidth={active ? 2.1 : 1.7} />
                    {it.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function UserMenu({ name, role, isDemo, companionOn, labels }:
  { name: string; role: string; isDemo: boolean; companionOn: boolean;
    labels: { profile: string; signOut: string; releases: string; living: string; companion: string; on: string; off: string; guide: string } }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button type="button" data-tour="user" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white ring-1 ring-white/10 [background:linear-gradient(135deg,rgb(var(--nx-ember)),rgb(var(--nx-magenta))_60%,rgb(var(--nx-violet)))]" aria-label={name}>
        {initials(name)}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-2 w-64 surface-3 p-1">
          <div className="px-3 py-2">
            <div className="truncate text-sm font-medium">{name}</div>
            <div className="text-2xs font-mono uppercase tracking-wider text-muted">{role}{isDemo ? ' · demo' : ''}</div>
          </div>
          <div className="my-1 border-t border-line" />
          <Link role="menuitem" href="/profile" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded px-3 py-1.5 text-sm hover:bg-ember/10"><Settings size={14} aria-hidden />{labels.profile}</Link>
 <Link role="menuitem" href="/profile#living" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded px-3 py-1.5 text-sm hover:bg-ember/10"><Sparkles size={14} aria-hidden />{labels.living}</Link>
          <button role="menuitemcheckbox" aria-checked={companionOn} disabled={pending}
            onClick={() => start(async () => { await setLiving({ companion: !companionOn }); router.refresh(); })}
            className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-sm hover:bg-ember/10">
            <PawPrint size={14} aria-hidden /><span className="flex-1">{labels.companion}</span>
            <span className={cn('font-mono text-2xs', companionOn ? 'ember-text' : 'text-muted')}>{companionOn ? labels.on : labels.off}</span>
          </button>
          <button role="menuitem" type="button" onClick={() => { setOpen(false); window.dispatchEvent(new CustomEvent('nexora:tour', { detail: 'main' })); }}
            className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-sm hover:bg-ember/10"><Compass size={14} className="ember-text" aria-hidden />{labels.guide}</button>
          <Link role="menuitem" href="/release-notes" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded px-3 py-1.5 text-sm hover:bg-ember/10"><Newspaper size={14} aria-hidden />{labels.releases}</Link>
          <form action={signOut}>
            <button role="menuitem" className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-sm hover:bg-ember/10"><LogOut size={14} aria-hidden />{labels.signOut}</button>
          </form>
        </div>
      )}
    </div>
  );
}

/* ---------- Class menu in the phone drawer ----------
 * On phones/tablets a classroom's tabs (Materials, Updates, Gradebook, Members, Apps) live in the
 * ☰ drawer instead of taking up the top of the page. The class page registers them here. */
const classIcons = { materials: BookOpen, updates: Megaphone, gradebook: GraduationCap, attendance: ClipboardCheck, members: Users, apps: AppWindow } as const;
export interface ClassMenu {
  title: string;
  section?: string | null;
  items: { key: keyof typeof classIcons; href: string; label: string; active: boolean }[];
  apps: { id: string; name: string; url: string; color: string; initials: string }[];
  appsLabel: string;
}
let classMenu: ClassMenu | null = null;
const classSubs = new Set<() => void>();
const classStore = {
  set(m: ClassMenu | null) { classMenu = m; classSubs.forEach((f) => f()); },
  sub(f: () => void) { classSubs.add(f); return () => { classSubs.delete(f); }; },
  get: () => classMenu,
};

/** Rendered by the class page; puts its tabs into the ☰ drawer while the page is open. */
export function RegisterClassMenu({ menu }: { menu: ClassMenu }) {
  const key = JSON.stringify(menu);
  useEffect(() => {
    classStore.set(JSON.parse(key) as ClassMenu);
    return () => classStore.set(null);
  }, [key]);
  return null;
}

function ClassMenuGroup({ menu, onGo }: { menu: ClassMenu; onGo: () => void }) {
  return (
    <div className="rounded-lg border border-line bg-white/[0.03] p-2">
      <div className="px-2.5 pb-2 pt-1">
        {menu.section && <div className="eyebrow text-faint">{menu.section}</div>}
        <div className="truncate text-sm font-bold uppercase tracking-[0.03em]">{menu.title}</div>
      </div>
      <ul className="flex flex-col gap-px">
        {menu.items.map((it) => {
          const Icon = classIcons[it.key];
          return (
            <li key={it.key}>
              <Link href={it.href} aria-current={it.active ? 'page' : undefined} onClick={onGo}
                className={cn('nav-item flex h-10 items-center gap-3 rounded-md px-2.5 text-[14px]', it.active ? 'font-semibold' : 'text-muted hover:text-ink')}>
                <Icon size={16} aria-hidden strokeWidth={it.active ? 2.1 : 1.7} />{it.label}
              </Link>
            </li>
          );
        })}
      </ul>
      {menu.apps.length > 0 && (
        <>
          <div className="eyebrow px-2.5 pb-1.5 pt-3 text-faint">{menu.appsLabel}</div>
          <ul className="flex flex-col gap-px">
            {menu.apps.map((a) => (
              <li key={a.id}>
                <a href={a.url} target="_blank" rel="noopener noreferrer" onClick={onGo} className="nav-item flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[13px] text-muted hover:text-ink">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[9px] font-bold text-white" style={{ background: a.color }}>{a.initials}</span>
                  <span className="truncate">{a.name}</span>
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function MobileNav({ groups, menuLabel }: { groups: NavGroup[]; menuLabel: string }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  const cls = useSyncExternalStore(classStore.sub, classStore.get, () => null);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', esc);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <>
      <button type="button" data-tour="menu" className="btn-ghost btn-sm lg:hidden" aria-label={menuLabel} aria-expanded={open} onClick={() => setOpen(true)}>
        <Menu size={18} aria-hidden />
      </button>
      {/* Portaled to <body>: the header's backdrop blur would otherwise trap this fixed drawer inside the 56px bar. */}
      {open && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label={menuLabel}>
          <div className="absolute inset-0 bg-ink/30" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col gap-5 overflow-y-auto p-4 pl-6 shadow-xl" style={{ background: 'rgb(var(--sunk))' }}>
            <div className="flex justify-end">
              <button type="button" className="btn-ghost btn-sm" onClick={() => setOpen(false)} aria-label="Close"><X size={18} aria-hidden /></button>
            </div>
            {cls && <ClassMenuGroup menu={cls} onGo={() => setOpen(false)} />}
            <SideNav groups={groups} />
            <div className="mt-auto border-t border-line pt-4"><LanguageButtons /></div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

export function PublicMobileMenu({ links, menuLabel }: { links: { href: string; label: string }[]; menuLabel: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      <button type="button" className="btn-ghost btn-sm" aria-label={menuLabel} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? <X size={18} aria-hidden /> : <Menu size={18} aria-hidden />}
      </button>
      {open && (
        <div className="absolute inset-x-0 top-14 z-40 border-b border-line px-4 py-3 shadow-md" style={{ background: 'rgb(var(--sunk))' }}>
          <ul className="flex flex-col">
            {links.map((l) => (
              <li key={l.href}><Link href={l.href} onClick={() => setOpen(false)} className="block py-2 text-sm">{l.label}</Link></li>
            ))}
          </ul>
          <div className="pt-3"><LanguageButtons /></div>
        </div>
      )}
    </div>
  );
}

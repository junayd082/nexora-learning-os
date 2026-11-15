/**
 * Bell schedules. Pure functions, safe on server and client.
 *
 * NEXORA reads a class's period from its "Period / section" field ("Period 3", "P3", "3rd")
 * and lines it up with the school's bell schedule, so Home can say "You're in Period 1 right
 * now" and show that class first. Times are school-local wall-clock times in the school's
 * time zone — never the device's — so a student whose phone is set to another zone still
 * sees the right class.
 */

export type DayType = 'odd' | 'even' | 'all';
export interface Lunch { letter: string; start: number; end: number }
export interface Slot { period: number; start: number; end: number; lunches?: Lunch[] }
export interface DayPlan { type: DayType; slots: Slot[] }
export interface BellSchedule {
  id: string; school: string; year: string; timezone: string;
  /** 0 = Sunday … 6 = Saturday. Missing days = no school. */
  days: Partial<Record<number, DayPlan>>;
}

/** "7:05" → minutes after midnight (school-local, 24h for afternoon given as 12-hour times below). */
const m = (hhmm: string) => { const [h, mm] = hhmm.split(':').map(Number); return h * 60 + mm; };
const pm = (hhmm: string) => { const [h, mm] = hhmm.split(':').map(Number); return (h === 12 ? 12 : h + 12) * 60 + mm; };

const BLOCK_LUNCHES: Lunch[] = [
  { letter: 'A', start: m('10:30'), end: m('11:00') },
  { letter: 'B', start: m('11:05'), end: m('11:35') },
  { letter: 'C', start: m('11:40'), end: pm('12:10') },
  { letter: 'D', start: pm('12:20'), end: pm('12:50') },
];
const block = (type: 'odd' | 'even'): DayPlan => {
  const [a, b, c, d] = type === 'odd' ? [1, 3, 5, 7] : [2, 4, 6, 8];
  return {
    type,
    slots: [
      { period: a, start: m('7:05'), end: m('8:40') },
      { period: b, start: m('8:45'), end: m('10:20') },
      { period: c, start: m('10:25'), end: pm('12:50'), lunches: BLOCK_LUNCHES },
      { period: d, start: pm('12:55'), end: pm('2:30') },
    ],
  };
};

/** Westfield High School · Spring ISD · 2026–2027 (from the official bell schedule PDF). */
export const WESTFIELD_2026: BellSchedule = {
  id: 'westfield-2026-27',
  school: 'Westfield High School',
  year: '2026–2027',
  timezone: 'America/Chicago',
  days: {
    1: block('odd'),   // Monday   · Block – Odd
    2: block('even'),  // Tuesday  · Block – Even
    3: {               // Wednesday · All class periods
      type: 'all',
      slots: [
        { period: 1, start: m('7:05'), end: m('7:50') },
        { period: 2, start: m('7:55'), end: m('8:40') },
        { period: 3, start: m('8:45'), end: m('9:30') },
        { period: 4, start: m('9:35'), end: m('10:20') },
        { period: 5, start: m('10:25'), end: pm('12:00'), lunches: [
          { letter: 'A', start: m('10:27'), end: m('10:57') },
          { letter: 'B', start: m('10:59'), end: m('11:29') },
          { letter: 'C', start: m('11:30'), end: pm('12:00') },
        ] },
        { period: 6, start: pm('12:05'), end: pm('12:50'), lunches: [{ letter: 'D', start: pm('12:20'), end: pm('12:50') }] },
        { period: 7, start: pm('12:55'), end: pm('1:40') },
        { period: 8, start: pm('1:45'), end: pm('2:30') },
      ],
    },
    4: block('odd'),   // Thursday · Block – Odd
    5: block('even'),  // Friday   · Block – Even
  },
};

export const DEFAULT_SCHEDULE = WESTFIELD_2026;

/** Reads the period number out of a class's section text: "Period 3", "P3", "3rd period", "Per. 7". */
export function periodOf(section?: string | null): number | null {
  if (!section) return null;
  const s = section.trim();
  const hit = s.match(/\bp(?:er(?:iod)?)?\.?\s*(\d{1,2})\b/i) ?? s.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s*(?:period|per\.?)\b/i) ?? s.match(/^(\d{1,2})$/);
  const n = hit ? Number(hit[1]) : NaN;
  return n >= 1 && n <= 12 ? n : null;
}

/** Wall-clock parts of `at` in the school's time zone. */
export function schoolClock(at: number, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, weekday: 'short', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(at));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  const hour = Number(get('hour')) % 24;
  return {
    weekday,
    minutes: hour * 60 + Number(get('minute')) + Number(get('second')) / 60,
    dateKey: `${get('year')}-${get('month')}-${get('day')}`,
  };
}

export type Phase = 'before' | 'in' | 'passing' | 'after' | 'off';
export interface BellState {
  phase: Phase;
  day: DayPlan | null;
  weekday: number;
  minutes: number;
  current: Slot | null;
  next: Slot | null;
  /** Lunch window happening right now (inside a long block), if any. */
  lunch: Lunch | null;
}

export function bellState(at: number, sched: BellSchedule = DEFAULT_SCHEDULE): BellState {
  const { weekday, minutes } = schoolClock(at, sched.timezone);
  const day = sched.days[weekday] ?? null;
  if (!day) return { phase: 'off', day, weekday, minutes, current: null, next: null, lunch: null };
  const current = day.slots.find((s) => minutes >= s.start && minutes < s.end) ?? null;
  const next = day.slots.find((s) => s.start > minutes) ?? null;
  const lunch = current?.lunches?.find((l) => minutes >= l.start && minutes < l.end) ?? null;
  const first = day.slots[0], last = day.slots[day.slots.length - 1];
  const phase: Phase = current ? 'in' : minutes < first.start ? 'before' : minutes >= last.end ? 'after' : 'passing';
  return { phase, day, weekday, minutes, current, next, lunch };
}

/** Which weekdays a period meets on. */
export function meetsOn(period: number, sched: BellSchedule = DEFAULT_SCHEDULE): number[] {
  return Object.entries(sched.days).filter(([, d]) => d?.slots.some((s) => s.period === period)).map(([k]) => Number(k));
}

/**
 * The next time a period meets, starting from `at` (today if it hasn't ended yet).
 * Returns days from today (0 = today) and the slot. Looks up to two weeks ahead.
 */
export function nextMeeting(period: number, at: number, sched: BellSchedule = DEFAULT_SCHEDULE): { inDays: number; weekday: number; slot: Slot } | null {
  const { weekday, minutes } = schoolClock(at, sched.timezone);
  for (let i = 0; i < 14; i++) {
    const wd = (weekday + i) % 7;
    const slot = sched.days[wd]?.slots.find((s) => s.period === period);
    if (slot && (i > 0 || minutes < slot.end)) return { inDays: i, weekday: wd, slot };
  }
  return null;
}

/** 425 → "7:05 AM" / "7:05 a. m." in the viewer's language, independent of the device's zone. */
export function clockLabel(mins: number, locale: string) {
  const d = new Date(Date.UTC(2026, 0, 5, Math.floor(mins / 60), Math.round(mins % 60)));
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-US' : 'en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).format(d);
}

/**
 * Attendance: one mark per student per class day (present · absent · tardy · excused).
 * Pure date helpers shared by the server pages and the client sheet. Days are plain
 * 'YYYY-MM-DD' keys in the school's time zone; all math is done in UTC so it never drifts.
 */
export type Mark = 'present' | 'absent' | 'tardy' | 'excused';
export const MARKS: Mark[] = ['present', 'absent', 'tardy', 'excused'];
export const isMark = (v: unknown): v is Mark => typeof v === 'string' && (MARKS as string[]).includes(v);

/** Click order on the sheet: blank → P → A → T → E → blank. */
export function nextMark(m: Mark | null): Mark | null {
  if (!m) return 'present';
  const i = MARKS.indexOf(m);
  return i === MARKS.length - 1 ? null : MARKS[i + 1];
}

export interface Totals { present: number; absent: number; tardy: number; excused: number }
export const emptyTotals = (): Totals => ({ present: 0, absent: 0, tardy: 0, excused: 0 });

const DAY = 86_400_000;
const parse = (key: string) => Date.parse(`${key}T00:00:00Z`);
const fmt = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export const isDayKey = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parse(s));
export const addDays = (key: string, n: number) => fmt(parse(key) + n * DAY);
/** 0 = Sunday … 6 = Saturday. */
export const weekdayOf = (key: string) => new Date(parse(key)).getUTCDay();
/** The Monday of the week holding `key`. */
export const mondayOf = (key: string) => addDays(key, -((weekdayOf(key) + 6) % 7));
/** Monday–Friday of the week starting `monday`. */
export const schoolDays = (monday: string) => [0, 1, 2, 3, 4].map((i) => addDays(monday, i));

/** Today's key in a time zone. */
export function todayIn(tz = 'America/Chicago', at = new Date()) {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at); }
  catch { return at.toISOString().slice(0, 10); }
}

/** The Mondays of every school week that touches the month of `key` (like a paper monthly register). */
export function monthWeeks(key: string): string[] {
  const first = `${key.slice(0, 7)}-01`;
  const y = Number(key.slice(0, 4)), m = Number(key.slice(5, 7));
  const last = fmt(Date.UTC(y, m, 0));
  const out: string[] = [];
  // A week belongs to the month when one of its school days (Mon–Fri) falls in it.
  for (let mon = mondayOf(first); mon <= last; mon = addDays(mon, 7)) {
    if (schoolDays(mon).some((d) => d >= first && d <= last)) out.push(mon);
  }
  return out;
}

/** The six-week calendar grid (Sunday-first) for the month of `key`, as day keys. */
export function calendarGrid(key: string): string[] {
  const first = `${key.slice(0, 7)}-01`;
  const start = addDays(first, -weekdayOf(first));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export const addMonths = (key: string, n: number) => {
  const y = Number(key.slice(0, 4)), m = Number(key.slice(5, 7)) - 1 + n;
  return fmt(Date.UTC(y, m, 1));
};

/** The most recent day before `today` this class met, by weekday (bell schedule), looking back up to 3 weeks. */
export function previousMeeting(today: string, meetDays: number[]): string | null {
  if (!meetDays.length) return null;
  for (let i = 1; i <= 21; i++) { const d = addDays(today, -i); if (meetDays.includes(weekdayOf(d))) return d; }
  return null;
}

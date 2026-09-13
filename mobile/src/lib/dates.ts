/**
 * Calendar-day arithmetic on "YYYY-MM-DD" strings. The API reads a bare date as midnight IST, so
 * doing the maths on dates rather than Date objects keeps the device's time zone out of it.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function toUtcMs(day: string): number {
  return Date.parse(`${day}T00:00:00Z`);
}

export function addDays(day: string, days: number): string {
  return new Date(toUtcMs(day) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function parts(day: string): { year: number; month: number; date: number } {
  const [year, month, date] = day.split('-').map(Number);
  return { year, month: month - 1, date };
}

/** "4 Mar" */
export function shortDay(day: string): string {
  const { month, date } = parts(day);
  return `${date} ${MONTHS[month]}`;
}

/** First letter of the month, for a year-long axis: "A" for April. */
export function monthInitial(day: string): string {
  return MONTHS[parts(day).month][0];
}

/**
 * A run of days, as compactly as it reads unambiguously: "4 Mar 2025", "1–7 Mar 2025",
 * "25 Feb – 3 Mar 2025", "28 Dec 2024 – 3 Jan 2025". `last` is inclusive.
 */
export function formatDayRange(first: string, last: string): string {
  const a = parts(first);
  const b = parts(last);
  if (first === last) return `${a.date} ${MONTHS[a.month]} ${a.year}`;
  if (a.year !== b.year) {
    return `${a.date} ${MONTHS[a.month]} ${a.year} – ${b.date} ${MONTHS[b.month]} ${b.year}`;
  }
  if (a.month !== b.month) return `${a.date} ${MONTHS[a.month]} – ${b.date} ${MONTHS[b.month]} ${b.year}`;
  return `${a.date}–${b.date} ${MONTHS[a.month]} ${a.year}`;
}

/** The same range for screen readers: "1 to 7 March 2025". */
export function speakDayRange(first: string, last: string): string {
  const a = parts(first);
  const b = parts(last);
  if (first === last) return `${a.date} ${MONTHS_LONG[a.month]} ${a.year}`;
  const start =
    a.year !== b.year
      ? `${a.date} ${MONTHS_LONG[a.month]} ${a.year}`
      : a.month !== b.month
        ? `${a.date} ${MONTHS_LONG[a.month]}`
        : `${a.date}`;
  return `${start} to ${b.date} ${MONTHS_LONG[b.month]} ${b.year}`;
}

/** "4 March 2025" for screen readers. */
export function speakDay(day: string): string {
  return speakDayRange(day, day);
}

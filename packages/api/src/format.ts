import { lagosDate } from './status';

/**
 * Formatting rules from the design: money as `₦8,500`, dates as `20 Oct 2026`.
 */

const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
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

const nairaNumber = new Intl.NumberFormat('en-NG', { maximumFractionDigits: 2 });

/** The minus sign the design uses for money out (U+2212). */
export const MINUS = '−';

/**
 * `₦8,500`. With `sign: true`, adds `+` for money in and `−` for money out: `+₦20,000`, `−₦18,500`.
 * Without it, negative amounts still show `−`.
 */
export function formatNaira(amount: number, options: { sign?: boolean } = {}): string {
  const body = `₦${nairaNumber.format(Math.abs(amount))}`;
  if (amount < 0) return `${MINUS}${body}`;
  if (options.sign && amount > 0) return `+${body}`;
  return body;
}

/** Digits only, for amount inputs: `"₦20,000"` → `20000`. Empty input gives 0. */
export function parseNaira(input: string): number {
  const digits = input.replace(/[^\d]/g, '');
  return digits ? Number(digits) : 0;
}

/**
 * Reads the calendar date of an API value. `YYYY-MM-DD` is taken as written. A timestamp with a
 * zone (`Z` or `+01:00`) is converted to its Lagos date; one without a zone is taken as written.
 */
export function calendarDateOf(value: string): string {
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(value) && value.length > 10) {
    const instant = new Date(value);
    if (!Number.isNaN(instant.getTime())) return lagosDate(instant);
  }
  return value.slice(0, 10);
}

function parts(value: string): [number, number, number] {
  const [y, m, d] = calendarDateOf(value).split('-').map(Number);
  return [y ?? 0, m ?? 1, d ?? 1];
}

/** `20 Oct 2026`. */
export function formatDate(value: string): string {
  const [y, m, d] = parts(value);
  return `${d} ${MONTHS_SHORT[m - 1]} ${y}`;
}

/** `20 Oct`. */
export function formatShortDate(value: string): string {
  const [, m, d] = parts(value);
  return `${d} ${MONTHS_SHORT[m - 1]}`;
}

/** `October 2026`, for grouping payments by month. */
export function formatMonth(value: string): string {
  const [y, m] = parts(value);
  return `${MONTHS_LONG[m - 1]} ${y}`;
}

/** `1 car`, `4 cars`. */
export function plural(count: number, word: string, pluralWord = `${word}s`): string {
  return `${count} ${count === 1 ? word : pluralWord}`;
}

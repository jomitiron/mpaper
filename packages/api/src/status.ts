/**
 * Paper status maths. All dates are calendar dates in Lagos (Africa/Lagos, UTC+1, no daylight
 * saving), whatever time zone the browser is in.
 *
 *   Valid       more than 30 days left
 *   Due soon    0 to 30 days left (a paper expiring today is due, not expired)
 *   Expired     past its expiry date
 *   Not tracked no expiry date on file
 */

export const LAGOS_TIME_ZONE = 'Africa/Lagos';
export const DUE_SOON_DAYS = 30;

export type PaperKind = 'vehicle_license' | 'insurance' | 'roadworthiness';
export const PAPER_KINDS: readonly PaperKind[] = ['vehicle_license', 'insurance', 'roadworthiness'];

export const PAPER_LABELS: Record<PaperKind, { name: string; short: string }> = {
  vehicle_license: { name: 'Vehicle licence', short: 'Licence' },
  insurance: { name: 'Insurance', short: 'Insurance' },
  roadworthiness: { name: 'Roadworthiness', short: 'Road' },
};

export type PaperState = 'valid' | 'due' | 'expired' | 'untracked';

export const STATE_LABELS: Record<PaperState, string> = {
  valid: 'Valid',
  due: 'Due soon',
  expired: 'Expired',
  untracked: 'Not tracked',
};

/** Matches the StatusPill tones in @motopapers/ui. */
export const STATE_TONES: Record<PaperState, 'ok' | 'warn' | 'bad' | 'idle'> = {
  valid: 'ok',
  due: 'warn',
  expired: 'bad',
  untracked: 'idle',
};

/** A car's overall status in words, from the design's car cards. */
export const VEHICLE_STATE_LABELS: Record<PaperState, string> = {
  valid: 'All good',
  due: 'Renewal due',
  expired: 'Expired paper',
  untracked: 'Papers to add',
};

/** Lower is worse. A car with an expired paper outranks one with a paper due, and so on. */
export const STATE_RANK: Record<PaperState, number> = {
  expired: 0,
  due: 1,
  untracked: 2,
  valid: 3,
};

export interface PaperStatus {
  state: PaperState;
  /** Days until expiry: 0 = expires today, negative = days since it expired, null = not tracked. */
  daysLeft: number | null;
  /** `YYYY-MM-DD`, or null when not tracked. */
  expiryDate: string | null;
}

export type DateInput = Date | string;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;
const DAY_MS = 86_400_000;

const lagosDateFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: LAGOS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The calendar date in Lagos at the given instant, as `YYYY-MM-DD`. */
export function lagosDate(instant: Date = new Date()): string {
  const parts = lagosDateFormat.formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** Today in Lagos as `YYYY-MM-DD`. */
export function lagosToday(): string {
  return lagosDate(new Date());
}

/**
 * Reads a calendar date. A `YYYY-MM-DD` string (or a timestamp starting with one) is taken as
 * written; a Date is converted to its Lagos calendar date.
 */
export function toCalendarDate(value: DateInput): string | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : lagosDate(value);
  const match = ISO_DATE.exec(value.trim());
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  // Reject impossible dates such as 2026-02-31.
  if (date.getUTCMonth() !== Number(m) - 1 || date.getUTCDate() !== Number(d)) return null;
  return `${y}-${m}-${d}`;
}

/** Whole days from `from` to `to` (both `YYYY-MM-DD`). Positive when `to` is later. */
export function daysBetween(from: string, to: string): number {
  return Math.round((utcMidnight(to) - utcMidnight(from)) / DAY_MS);
}

/** `YYYY-MM-DD` plus `days` (can be negative). */
export function addDays(date: string, days: number): string {
  return new Date(utcMidnight(date) + days * DAY_MS).toISOString().slice(0, 10);
}

export function paperStatus(
  expiryDate: string | null | undefined,
  today: DateInput = new Date(),
): PaperStatus {
  const expiry = expiryDate ? toCalendarDate(expiryDate) : null;
  const now = toCalendarDate(today);
  if (!expiry || !now) return { state: 'untracked', daysLeft: null, expiryDate: null };
  const daysLeft = daysBetween(now, expiry);
  const state: PaperState = daysLeft < 0 ? 'expired' : daysLeft <= DUE_SOON_DAYS ? 'due' : 'valid';
  return { state, daysLeft, expiryDate: expiry };
}

export function worstState(states: Iterable<PaperState>): PaperState {
  let worst: PaperState = 'valid';
  for (const state of states) if (STATE_RANK[state] < STATE_RANK[worst]) worst = state;
  return worst;
}

interface PaperRef {
  expiry_date: string;
}

export interface VehiclePapers {
  vehicle_license?: PaperRef | null;
  insurance?: PaperRef | null;
  roadworthiness?: PaperRef | null;
}

export interface VehicleStatus {
  /** The worst state across the three papers. */
  state: PaperState;
  papers: Record<PaperKind, PaperStatus>;
}

export function vehicleStatus(
  vehicle: VehiclePapers,
  today: DateInput = new Date(),
): VehicleStatus {
  const papers = {
    vehicle_license: paperStatus(vehicle.vehicle_license?.expiry_date, today),
    insurance: paperStatus(vehicle.insurance?.expiry_date, today),
    roadworthiness: paperStatus(vehicle.roadworthiness?.expiry_date, today),
  };
  return { state: worstState(Object.values(papers).map((p) => p.state)), papers };
}

/** True when the car has an expired paper or one due within 30 days (the nav badge count). */
export function needsAttention(vehicle: VehiclePapers, today: DateInput = new Date()): boolean {
  const { state } = vehicleStatus(vehicle, today);
  return state === 'expired' || state === 'due';
}

function utcMidnight(date: string): number {
  const match = ISO_DATE.exec(date);
  if (!match) throw new RangeError(`Expected a YYYY-MM-DD date, got "${date}"`);
  const [, y, m, d] = match;
  return Date.UTC(Number(y), Number(m) - 1, Number(d));
}

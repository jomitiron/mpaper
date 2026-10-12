import {
  formatDate,
  formatShortDate,
  PAPER_KINDS,
  PAPER_LABELS,
  paperStatus,
  plural,
  STATE_RANK,
  STATE_TONES,
  VEHICLE_STATE_LABELS,
  vehicleStatus,
  type DateInput,
  type PaperKind,
  type PaperState,
  type PaperStatus,
  type Vehicle,
} from '@motopapers/api';

/**
 * How the cars feature (and Home) talks about papers: colours, words and the order things are
 * shown in. Status maths itself comes from @motopapers/api (status.ts).
 */

export type { PaperKind, PaperState };

/** Paper colour classes from the design: sky licence, mint insurance, butter roadworthiness. */
export const PAPER_CLASS: Record<PaperKind, string> = {
  vehicle_license: 'd-licence',
  insurance: 'd-insurance',
  roadworthiness: 'd-road',
};

/** Bar colours on the mini car cards. */
export const PAPER_BAR: Record<PaperKind, string> = {
  vehicle_license: 'var(--sky-b)',
  insurance: 'var(--mint-b)',
  roadworthiness: 'var(--butter-b)',
};

/** The paper as a word inside a sentence: "Your Ford Edge licence expired 13 days ago". */
export const PAPER_NOUN: Record<PaperKind, string> = {
  vehicle_license: 'licence',
  insurance: 'insurance',
  roadworthiness: 'roadworthiness',
};

export const COVER_LABELS: Record<string, string> = {
  third_party: 'Third party',
  comprehensive: 'Comprehensive',
};

export function coverLabel(cover: string | null | undefined): string {
  if (!cover) return '';
  return COVER_LABELS[cover] ?? cover.replace(/_/g, ' ');
}

export function carName(vehicle: Pick<Vehicle, 'brand' | 'model'>): string {
  return [vehicle.brand, vehicle.model].filter(Boolean).join(' ') || 'Your car';
}

/** One paper on one car, ready to show. */
export interface PaperView extends PaperStatus {
  kind: PaperKind;
  name: string;
  short: string;
  /** `third_party` / `comprehensive` for insurance. */
  cover: string | null;
}

export function paperViews(vehicle: Vehicle, today: DateInput = new Date()): PaperView[] {
  return PAPER_KINDS.map((kind) => {
    const record = vehicle[kind];
    return {
      kind,
      ...PAPER_LABELS[kind],
      ...paperStatus(record?.expiry_date, today),
      cover: kind === 'insurance' ? (vehicle.insurance?.cover_type ?? null) : null,
    };
  });
}

/** `9 days`, `1 day`. */
export function days(count: number): string {
  return plural(Math.abs(count), 'day');
}

/** "due in 9 days", "due today", "expired 13 days ago", "expired yesterday". */
export function dueWords(paper: Pick<PaperStatus, 'state' | 'daysLeft'>): string {
  const left = paper.daysLeft;
  if (left === null) return 'not on file';
  if (left < 0) return left === -1 ? 'expired yesterday' : `expired ${days(left)} ago`;
  if (left === 0) return 'due today';
  if (left === 1) return 'due tomorrow';
  return `due in ${days(left)}`;
}

/** The paper that needs action first on a car: most overdue, then soonest due. */
export function mostUrgent(papers: readonly PaperView[]): PaperView | undefined {
  return papers
    .filter((p) => p.state === 'expired' || p.state === 'due')
    .sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0))[0];
}

export interface CarSummary {
  vehicle: Vehicle;
  state: PaperState;
  papers: PaperView[];
  /** The car's status in words: "Licence expired", "Insurance due in 9 days", "All good". */
  statusText: string;
  /** The paper with a Renew button, if any. */
  urgent: PaperView | undefined;
  missing: PaperView[];
}

export function summariseCar(vehicle: Vehicle, today: DateInput = new Date()): CarSummary {
  const papers = paperViews(vehicle, today);
  const { state } = vehicleStatus(vehicle, today);
  const urgent = mostUrgent(papers);
  const missing = papers.filter((p) => p.state === 'untracked');
  let statusText: string = VEHICLE_STATE_LABELS.valid;
  if (urgent?.state === 'expired') statusText = `${urgent.short} expired`;
  else if (urgent) statusText = `${urgent.short} ${dueWords(urgent)}`;
  else if (missing.length) statusText = `${plural(missing.length, 'paper')} to add`;
  return { vehicle, state, papers, statusText, urgent, missing };
}

/** Worst first (expired, due, papers to add, all good); ties keep the API's order. */
export function sortByUrgency<T extends { state: PaperState }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => STATE_RANK[a.state] - STATE_RANK[b.state]);
}

export const tone = (state: PaperState) => STATE_TONES[state];

/** Big number and its unit for a paper card: `9` `days left`, `13` `days ago`, `Today`. */
export function bigDays(paper: Pick<PaperStatus, 'daysLeft'>): { value: string; unit: string } {
  const left = paper.daysLeft;
  if (left === null) return { value: 'Add', unit: '' };
  if (left === 0) return { value: 'Today', unit: '' };
  if (left < 0) return { value: String(-left), unit: left === -1 ? 'day ago' : 'days ago' };
  return { value: String(left), unit: left === 1 ? 'day left' : 'days left' };
}

/** "Expires 20 Oct 2026", "Expired 28 Sep 2026", "Expires today". */
export function expiryLine(paper: Pick<PaperStatus, 'daysLeft' | 'expiryDate'>): string {
  if (!paper.expiryDate || paper.daysLeft === null) return 'Not on file';
  if (paper.daysLeft === 0) return 'Expires today';
  return `${paper.daysLeft < 0 ? 'Expired' : 'Expires'} ${formatDate(paper.expiryDate)}`;
}

export function shortExpiry(paper: Pick<PaperStatus, 'daysLeft' | 'expiryDate'>): string {
  if (!paper.expiryDate || paper.daysLeft === null) return 'Not on file';
  if (paper.daysLeft === 0) return 'Today';
  return formatShortDate(paper.expiryDate);
}

/** Fill for a paper's bar on the mini car cards: expired is full, otherwise a year is full. */
export function barFraction(paper: Pick<PaperStatus, 'state' | 'daysLeft'>): number {
  if (paper.state === 'untracked' || paper.daysLeft === null) return 0;
  if (paper.state === 'expired') return 1;
  return Math.max(0.04, Math.min(1, paper.daysLeft / 365));
}

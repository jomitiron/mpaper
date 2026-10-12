import {
  calendarDateOf,
  daysBetween,
  type PaperKind,
  type Renewal,
  type RenewalStatus,
} from '@motopapers/api';
import { paperWords } from './papers';

/**
 * Where a renewal is, in the words and steps of the design's tracker and the renewal-update email:
 * Paid, Processing, Out for delivery, Delivered.
 */

export const RENEWAL_STATUS_LABELS: Record<RenewalStatus, string> = {
  awaiting_payment: 'Waiting for payment',
  paid: 'Paid',
  processing: 'Processing',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const STEPS = ['paid', 'processing', 'out_for_delivery', 'delivered'] as const;

/** done ✓, current ● (happening now), todo ○, as in emails/README.md. */
export type StepState = 'done' | 'current' | 'todo';

export interface TrackerStep {
  label: string;
  state: StepState;
}

/**
 * The four steps for a status. Paid and Delivered are moments, so they show as done; Processing
 * and Out for delivery take a while, so they're the current step while the renewal is in them.
 */
export function trackerSteps(status: RenewalStatus): TrackerStep[] {
  const at = STEPS.indexOf(status as (typeof STEPS)[number]);
  return STEPS.map((step, index) => {
    let state: StepState = 'todo';
    if (at >= 0 && index < at) state = 'done';
    else if (index === at) state = step === 'paid' || step === 'delivered' ? 'done' : 'current';
    return { label: RENEWAL_STATUS_LABELS[step], state };
  });
}

/** Paid for and on its way: the driver shouldn't renew this paper again. */
export function isInProgress(renewal: Pick<Renewal, 'status'>): boolean {
  return (
    renewal.status === 'paid' ||
    renewal.status === 'processing' ||
    renewal.status === 'out_for_delivery'
  );
}

/** How long a delivered renewal stays on the car panel and the renew page. */
export const DELIVERED_SHOWN_DAYS = 14;
/** How long a renewal waiting for a card payment counts as "still confirming". */
export const AWAITING_SHOWN_DAYS = 1;

function ageInDays(renewal: Pick<Renewal, 'updated_at'>, today: string): number {
  return daysBetween(calendarDateOf(renewal.updated_at), today);
}

/** Renewals worth showing: in progress, or delivered in the last two weeks. */
export function isShown(renewal: Renewal, today: string): boolean {
  if (isInProgress(renewal)) return true;
  return renewal.status === 'delivered' && ageInDays(renewal, today) <= DELIVERED_SHOWN_DAYS;
}

function newestFirst(a: Renewal, b: Renewal): number {
  return b.created_at.localeCompare(a.created_at) || b.id - a.id;
}

/**
 * The renewal to show for each paper on a car (newest first, one per paper), as the car panel and
 * the renew page show them. A newer renewal waiting for payment doesn't hide one in progress.
 */
export function shownRenewals(renewals: readonly Renewal[], today: string): Renewal[] {
  const seen = new Set<string>();
  const out: Renewal[] = [];
  for (const renewal of [...renewals].sort(newestFirst)) {
    const key = `${renewal.vehicle_id}:${renewal.document_type}`;
    if (seen.has(key) || !isShown(renewal, today)) continue;
    seen.add(key);
    out.push(renewal);
  }
  return out;
}

/** The renewal on show for one paper on one car, if any. */
export function renewalFor(
  renewals: readonly Renewal[],
  vehicleId: number,
  kind: PaperKind,
  today: string,
): Renewal | undefined {
  return shownRenewals(
    renewals.filter((r) => r.vehicle_id === vehicleId && r.document_type === kind),
    today,
  )[0];
}

/**
 * A card payment for this paper that Paystack hasn't confirmed yet (from the last day), so the
 * renew page can warn before the driver pays twice.
 */
export function awaitingPaymentFor(
  renewals: readonly Renewal[],
  vehicleId: number,
  kind: PaperKind,
  today: string,
): Renewal | undefined {
  return [...renewals]
    .sort(newestFirst)
    .find(
      (r) =>
        r.vehicle_id === vehicleId &&
        r.document_type === kind &&
        r.status === 'awaiting_payment' &&
        ageInDays(r, today) <= AWAITING_SHOWN_DAYS,
    );
}

/** The tracker's heading: "We're renewing your insurance". */
export function renewalHeadline(status: RenewalStatus, kind: PaperKind): string {
  const paper = paperWords(kind);
  switch (status) {
    case 'awaiting_payment':
      return 'Waiting for your payment';
    case 'paid':
      return `Your ${paper} renewal is paid`;
    case 'processing':
      return `We're renewing your ${paper}`;
    case 'out_for_delivery':
      return `Your new ${paper} is on its way`;
    case 'delivered':
      return `Your new ${paper} has been delivered`;
    case 'cancelled':
      return `This ${paper} renewal was cancelled`;
  }
}

/** The line under it. */
export function renewalNextStep(status: RenewalStatus): string {
  switch (status) {
    case 'awaiting_payment':
      return "Paystack hasn't confirmed your payment yet. We'll email you when it does.";
    case 'paid':
      return "We'll start on it shortly and email you at each step.";
    case 'processing':
      return "We'll email you when it's on its way to you.";
    case 'out_for_delivery':
      return "It's with our delivery team. We'll email you when it's delivered.";
    case 'delivered':
      return "It's on your car's papers, so your reminders start again from its new date.";
    case 'cancelled':
      return 'Call us if you need a hand with it.';
  }
}

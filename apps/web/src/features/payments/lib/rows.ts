import {
  calendarDateOf,
  formatDate,
  formatMonth,
  formatNaira,
  type Transaction,
  type Vehicle,
} from '@motopapers/api';
import type { StatusTone } from '@motopapers/ui';
import { isTopUp } from './filters';

/**
 * A payment as a row on Payments: what it was for, its status pill, the amount with its sign,
 * and what the driver can do about it.
 *
 * With transaction labels (VITE_FLAG_TX_LABELS) we know what each payment was for and which car.
 * Without them we only know money in or out (api-gaps.md): credit → "Wallet top-up",
 * debit → "Payment".
 */

export type PaymentIcon =
  'topup' | 'vehicle_license' | 'insurance' | 'roadworthiness' | 'service' | 'payment';

export interface PaymentRow {
  id: number;
  title: string;
  /** The car's plate, or how it was paid ("Paystack", "Wallet"). */
  sub: string;
  /** The Paystack reference (`MOT-…`) when there is one, else the transaction's own. */
  reference: string;
  icon: PaymentIcon;
  status: { label: string; tone: StatusTone };
  /** `+₦20,000` for money in, `−₦18,500` for money out. */
  amount: string;
  /** `in` for money that arrived, `void` for failed or reversed payments. */
  tone: 'in' | 'void' | '';
  /** `8 Oct 2026`. */
  date: string;
  /** Check status on pending payments, Retry on failed top-ups. */
  action: 'check' | 'retry' | null;
}

export const STATUS_PILLS: Record<string, { label: string; tone: StatusTone }> = {
  success: { label: 'Paid', tone: 'ok' },
  pending: { label: 'Pending', tone: 'warn' },
  failed: { label: 'Failed', tone: 'bad' },
  reversed: { label: 'Reversed', tone: 'idle' },
};

const CATEGORY_TITLES: Record<string, string> = {
  wallet_topup: 'Wallet top-up',
  service_charge: 'Tracking and reminders',
  subscription_charge: 'Subscription',
  renewal: 'Renewal',
};

const PAPER_TYPES = ['vehicle_license', 'insurance', 'roadworthiness'] as const;

function statusPill(status: string): { label: string; tone: StatusTone } {
  return (
    STATUS_PILLS[status] ?? {
      label: status ? status[0]!.toUpperCase() + status.slice(1) : 'Unknown',
      tone: 'idle',
    }
  );
}

function hasLabels(tx: Transaction, useLabels: boolean): boolean {
  return useLabels && Boolean(tx.category || tx.description);
}

/** What the payment was for, in words. */
export function paymentTitle(tx: Transaction, useLabels: boolean): string {
  const fallback = tx.transaction_type === 'credit' ? 'Wallet top-up' : 'Payment';
  if (!hasLabels(tx, useLabels)) return fallback;
  return tx.description || CATEGORY_TITLES[tx.category ?? ''] || fallback;
}

function iconFor(tx: Transaction, useLabels: boolean): PaymentIcon {
  if (isTopUp(tx, useLabels)) return 'topup';
  if (!hasLabels(tx, useLabels)) return 'payment';
  const paper = PAPER_TYPES.find((type) => type === tx.document_type);
  if (paper) return paper;
  return tx.category === 'renewal' ? 'payment' : 'service';
}

export function paymentRow(
  tx: Transaction,
  vehicles: readonly Vehicle[],
  useLabels: boolean,
): PaymentRow {
  const credit = tx.transaction_type === 'credit';
  const labelled = hasLabels(tx, useLabels);
  const plate = labelled ? vehicles.find((v) => v.id === tx.vehicle_id)?.plate_number : undefined;
  const voided = tx.status === 'failed' || tx.status === 'reversed';

  let action: PaymentRow['action'] = null;
  if (tx.status === 'pending') action = 'check';
  else if (tx.status === 'failed' && isTopUp(tx, useLabels)) action = 'retry';

  return {
    id: tx.id,
    title: paymentTitle(tx, useLabels),
    sub: plate ?? (tx.payment ? 'Paystack' : 'Wallet'),
    reference: tx.payment?.reference ?? tx.reference,
    icon: iconFor(tx, useLabels),
    status: statusPill(tx.status),
    amount: formatNaira(credit ? tx.amount : -tx.amount, { sign: true }),
    tone: voided ? 'void' : credit && tx.status === 'success' ? 'in' : '',
    date: formatDate(tx.created_at),
    action,
  };
}

export interface MonthGroup<T> {
  /** `2026-10`. */
  key: string;
  /** `October 2026`. */
  label: string;
  items: T[];
}

/**
 * Payments grouped by the month they were made, in the order given (newest first from the API).
 * A month that shows up again later in the list (it shouldn't) joins its first group.
 */
export function groupByMonth<T extends { created_at: string }>(
  items: readonly T[],
): MonthGroup<T>[] {
  const groups: MonthGroup<T>[] = [];
  const byKey = new Map<string, MonthGroup<T>>();
  for (const item of items) {
    const key = calendarDateOf(item.created_at).slice(0, 7);
    let group = byKey.get(key);
    if (!group) {
      group = { key, label: formatMonth(item.created_at), items: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

/**
 * What's been paid out this calendar year: successful payments out, for renewals only when we
 * have labels (otherwise every payment out, the tracking fee included).
 */
export function paidThisYear(
  transactions: readonly Transaction[],
  year: string,
  useLabels: boolean,
): number {
  return transactions
    .filter(
      (tx) =>
        tx.status === 'success' &&
        tx.transaction_type === 'debit' &&
        calendarDateOf(tx.created_at).startsWith(`${year}-`) &&
        (!useLabels || !tx.category || tx.category === 'renewal'),
    )
    .reduce((sum, tx) => sum + tx.amount, 0);
}

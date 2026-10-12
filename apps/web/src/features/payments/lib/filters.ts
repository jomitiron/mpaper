import type { ListTransactionsParams, Transaction, TransactionPage } from '@motopapers/api';

/**
 * The filter chips on Payments. `GET /transactions` can only filter by status, so:
 *
 *   All       → no status          every payment
 *   Top-ups   → no status          money into the wallet, picked out here
 *   Renewals  → no status          money out (renewals and the tracking fee), picked out here
 *   Pending   → status=pending     filtered by the API
 *
 * The design's "Renewals" chip covers every payment out, the tracking fee included.
 */

export type PaymentFilter = 'all' | 'topups' | 'renewals' | 'pending';

export const PAYMENT_FILTERS: readonly { key: PaymentFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'topups', label: 'Top-ups' },
  { key: 'renewals', label: 'Renewals' },
  { key: 'pending', label: 'Pending' },
];

/** Payments are loaded this many at a time. */
export const PAGE_SIZE = 20;

/** Reads `?filter=` from the address. Anything unknown is All. */
export function parseFilter(value: unknown): PaymentFilter {
  const raw = Array.isArray(value) ? value[0] : value;
  return PAYMENT_FILTERS.some((f) => f.key === raw) ? (raw as PaymentFilter) : 'all';
}

/** What to ask `GET /transactions` for, before paging. */
export function filterQuery(filter: PaymentFilter): Pick<ListTransactionsParams, 'status'> {
  return filter === 'pending' ? { status: 'pending' } : {};
}

/** Whether the API does the filtering (true) or we pick matches out of each page (false). */
export function filteredByApi(filter: PaymentFilter): boolean {
  return filter === 'all' || filter === 'pending';
}

/**
 * Money into the wallet. With transaction labels (VITE_FLAG_TX_LABELS) the category says so;
 * without them, every credit is a top-up (api-gaps.md).
 */
export function isTopUp(tx: Transaction, useLabels: boolean): boolean {
  if (useLabels && tx.category) return tx.category === 'wallet_topup';
  return tx.transaction_type === 'credit';
}

export function matchesFilter(tx: Transaction, filter: PaymentFilter, useLabels: boolean): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'topups':
      return isTopUp(tx, useLabels);
    case 'renewals':
      return !isTopUp(tx, useLabels);
    case 'pending':
      return tx.status === 'pending';
  }
}

/**
 * The numbers on the chips. All comes from the API's total and Pending from a status=pending
 * count. The API can't count top-ups or renewals, so those show only once every payment is loaded
 * (most drivers have one page); otherwise they're left off rather than guessed.
 */
export function filterCounts(
  everything: { pages: readonly TransactionPage[] | null; complete: boolean; pending?: number },
  useLabels: boolean,
): Partial<Record<PaymentFilter, number>> {
  const counts: Partial<Record<PaymentFilter, number>> = {
    all: everything.pages?.[0]?.meta.total,
    pending: everything.pending,
  };
  if (everything.pages && everything.complete) {
    const all = everything.pages.flatMap((page) => page.items);
    counts.topups = all.filter((tx) => isTopUp(tx, useLabels)).length;
    counts.renewals = all.length - counts.topups;
  }
  return counts;
}

/** "No top-ups yet." and friends, for a filter with nothing in it. */
export const EMPTY_FILTER_TEXT: Record<PaymentFilter, string> = {
  all: 'Top-ups and payments for renewals will show here.',
  topups: 'Money you add to your wallet will show here.',
  renewals: 'Payments for renewals and reminders will show here.',
  pending: 'Nothing is waiting for Paystack to confirm.',
};

import {
  calendarDateOf,
  getTransaction,
  lagosToday,
  listTransactions,
  verifyPayment,
  type ListTransactionsParams,
  type Transaction,
  type TransactionPage,
} from '@motopapers/api';
import { infiniteQueryOptions, queryOptions } from '@tanstack/vue-query';
import type { MaybeRef } from 'vue';
import { queryKeys } from '@/lib/queries';
import { PAGE_SIZE } from './filters';
import { paidThisYear } from './rows';

/** Payments' server data. Every key starts with `['transactions']`, so one invalidation covers it. */

/** `GET /transactions`, a page at a time, newest first. */
export function paymentsListQuery(params: MaybeRef<Pick<ListTransactionsParams, 'status'>>) {
  return infiniteQueryOptions({
    queryKey: [...queryKeys.transactions, 'list', params] as const,
    // Vue Query unwraps the ref in the key, so the key holds the current params.
    queryFn: ({ queryKey, pageParam, signal }) =>
      listTransactions(
        {
          ...(queryKey[2] as Pick<ListTransactionsParams, 'status'>),
          page: pageParam,
          per_page: PAGE_SIZE,
        },
        { signal },
      ),
    initialPageParam: 1,
    getNextPageParam: (last: TransactionPage) =>
      last.meta.page < last.meta.page_count ? last.meta.page + 1 : undefined,
    meta: { silent: true },
  });
}

/** How many payments there are (with a status), from the API's page count. */
export function paymentsCountQuery(status?: ListTransactionsParams['status']) {
  return queryOptions({
    queryKey: [...queryKeys.transactions, 'count', status ?? 'all'] as const,
    queryFn: async ({ signal }) =>
      (await listTransactions(status ? { status, per_page: 1 } : { per_page: 1 }, { signal })).meta
        .total,
    meta: { silent: true },
  });
}

const YEAR_PAGE_SIZE = 50;
const YEAR_MAX_PAGES = 10;

/**
 * What's been paid out this year (see `paidThisYear`). Reads successful payments newest first
 * until it reaches last year. Null when there are too many to add up in a few requests.
 */
export function paidThisYearQuery(useLabels: boolean) {
  return queryOptions({
    queryKey: [...queryKeys.transactions, 'paid-this-year', useLabels] as const,
    queryFn: async ({ signal }) => {
      const year = lagosToday().slice(0, 4);
      let total = 0;
      for (let page = 1; page <= YEAR_MAX_PAGES; page += 1) {
        const { items, meta } = await listTransactions(
          { status: 'success', page, per_page: YEAR_PAGE_SIZE },
          { signal },
        );
        total += paidThisYear(items, year, useLabels);
        const oldest = items.at(-1);
        if (
          !oldest ||
          page >= meta.page_count ||
          calendarDateOf(oldest.created_at) < `${year}-01-01`
        ) {
          return total;
        }
      }
      return null;
    },
    meta: { silent: true },
  });
}

/**
 * "Check status" on a pending payment: asks Paystack again (`POST /transactions/:reference/verify`,
 * VITE_FLAG_VERIFY_PAYMENT) or, without that endpoint, reads the payment again from the API.
 */
export async function recheckPayment(tx: Transaction, verify: boolean): Promise<Transaction> {
  if (verify) return verifyPayment(tx.payment?.reference ?? tx.reference);
  return getTransaction(tx.id);
}

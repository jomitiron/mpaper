import { request } from '../client';
import { envelope, pagedEnvelope, type PageMeta } from '../schemas/common';
import {
  initializedTransactionSchema,
  transactionSchema,
  type InitializedTransaction,
  type InitializeTransactionBody,
  type ListTransactionsParams,
  type Transaction,
} from '../schemas/transaction';

interface Options {
  signal?: AbortSignal;
}

/**
 * `POST /transactions/initialize`. Starts a Paystack payment: send the driver to `auth_url`.
 * Paystack returns them to `/payments/callback?reference=`; then call `waitForPayment()`.
 */
export async function initializeTransaction(
  body: InitializeTransactionBody,
  options: Options = {},
): Promise<InitializedTransaction> {
  const res = await request('/transactions/initialize', {
    method: 'POST',
    body,
    schema: envelope(initializedTransactionSchema),
    ...options,
  });
  return res.data;
}

export interface TransactionPage {
  items: Transaction[];
  meta: PageMeta;
}

/** `GET /transactions?page&per_page&status`. Newest first, 20 a page by default. */
export async function listTransactions(
  params: ListTransactionsParams = {},
  options: Options = {},
): Promise<TransactionPage> {
  const res = await request('/transactions', {
    query: { ...params },
    schema: pagedEnvelope(transactionSchema),
    ...options,
  });
  return { items: res.data, meta: res.meta };
}

/** `GET /transactions/:id`. Takes the transaction id, not the payment reference. */
export async function getTransaction(id: number, options: Options = {}): Promise<Transaction> {
  const res = await request(`/transactions/${id}`, {
    schema: envelope(transactionSchema),
    ...options,
  });
  return res.data;
}

/**
 * `POST /transactions/:reference/verify`. **Not built yet** (api-gaps.md, `VITE_FLAG_VERIFY_PAYMENT`):
 * asks Paystack again about a pending payment.
 */
export async function verifyPayment(
  reference: string,
  options: Options = {},
): Promise<Transaction> {
  const res = await request(`/transactions/${encodeURIComponent(reference)}/verify`, {
    method: 'POST',
    schema: envelope(transactionSchema),
    ...options,
  });
  return res.data;
}

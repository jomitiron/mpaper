import { z } from 'zod';

export const transactionStatuses = ['pending', 'success', 'failed', 'reversed'] as const;
export type TransactionStatus = (typeof transactionStatuses)[number];

/** Categories accepted by `POST /transactions/initialize`. */
export const transactionCategories = [
  'service_charge',
  'wallet_transaction',
  'subscription_charge',
] as const;
export type TransactionCategory = (typeof transactionCategories)[number];

/** The Paystack side of a transaction. Its `reference` (`MOT-…`) is what Paystack sends back. */
export const paymentSchema = z.object({
  id: z.number(),
  email: z.string().nullish(),
  amount: z.number(),
  /** `pending`, `success`, `failed` or `reversed`. */
  status: z.string(),
  currency: z.string().nullish(),
  reference: z.string(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});
export type Payment = z.infer<typeof paymentSchema>;

/** Labels the backend is adding (api-gaps.md, `VITE_FLAG_TX_LABELS`). */
export const transactionLabelCategories = [
  'wallet_topup',
  'service_charge',
  'subscription_charge',
  'renewal',
] as const;
export type TransactionLabelCategory = (typeof transactionLabelCategories)[number];

export const transactionSchema = z.object({
  id: z.number(),
  /** Naira. */
  amount: z.number(),
  /** `pending`, `success`, `failed` or `reversed`. */
  status: z.string(),
  currency: z.string().nullish(),
  reference: z.string(),
  /** `credit` (money in) or `debit` (money out). */
  transaction_type: z.string(),
  user_id: z.number().optional(),
  payment: paymentSchema.nullish(),
  created_at: z.string(),
  updated_at: z.string().optional(),
  // Present only once the backend ships transaction labels (VITE_FLAG_TX_LABELS).
  category: z.string().nullish(),
  description: z.string().nullish(),
  vehicle_id: z.number().nullish(),
  document_type: z.string().nullish(),
});
export type Transaction = z.infer<typeof transactionSchema>;

export const initializedTransactionSchema = z.object({
  /** Paystack checkout page. Send the driver here. */
  auth_url: z.string(),
  /** `MOT-…`. Paystack sends it back to `/payments/callback?reference=`. */
  reference: z.string(),
});
export type InitializedTransaction = z.infer<typeof initializedTransactionSchema>;

export interface InitializeTransactionBody {
  /** Naira. */
  amount: number;
  transaction_category: TransactionCategory;
}

export interface ListTransactionsParams {
  page?: number;
  per_page?: number;
  status?: TransactionStatus;
}

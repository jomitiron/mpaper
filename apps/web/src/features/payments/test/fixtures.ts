import type { Payment, Transaction, TransactionPage } from '@motopapers/api';

/** A transaction as `GET /transactions` returns it. Labels are left off unless given. */
export function tx(overrides: Partial<Transaction> = {}): Transaction {
  const id = overrides.id ?? 1;
  return {
    id,
    amount: 20_000,
    status: 'success',
    currency: 'NGN',
    reference: `T${String(id).padStart(32, '0')}`,
    transaction_type: 'credit',
    user_id: 2631,
    payment: payment({
      id,
      amount: overrides.amount ?? 20_000,
      status: overrides.status ?? 'success',
    }),
    created_at: '2026-10-08T10:15:00.000Z',
    updated_at: '2026-10-08T10:15:00.000Z',
    ...overrides,
  };
}

export function payment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 1,
    email: 'ada.okafor@example.com',
    amount: 20_000,
    status: 'success',
    currency: 'NGN',
    reference: 'MOT-7f3a9c21-0000-4000-8000-000000000000',
    created_at: '2026-10-08T10:15:00.000Z',
    updated_at: '2026-10-08T10:15:00.000Z',
    ...overrides,
  };
}

export function page(items: Transaction[], meta: Partial<TransactionPage['meta']> = {}) {
  return {
    items,
    meta: { page: 1, per_page: 20, total: items.length, page_count: 1, ...meta },
  } satisfies TransactionPage;
}

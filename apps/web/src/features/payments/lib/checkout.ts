import { initializeTransaction, type TransactionCategory } from '@motopapers/api';
import { intentStore, type IntentStore, type NewIntent, type PaymentIntent } from './intent';

/**
 * Sends the driver to Paystack:
 *
 *   1. `POST /transactions/initialize` → `auth_url` and `reference`
 *   2. remember what the payment is for, under its reference (lib/intent.ts)
 *   3. go to `auth_url`; Paystack brings them back to `/payments/callback?reference=`
 */

/** Leaving the app. Tests replace `assign`. */
export const navigation = {
  assign(url: string): void {
    window.location.assign(url);
  },
};

export interface CheckoutOptions {
  initialize?: typeof initializeTransaction;
  store?: IntentStore;
  now?: () => number;
}

export async function payOnPaystack(
  payment: { amount: number; category: TransactionCategory; intent: NewIntent },
  options: CheckoutOptions = {},
): Promise<PaymentIntent> {
  const initialize = options.initialize ?? initializeTransaction;
  const store = options.store ?? intentStore();

  const { auth_url, reference } = await initialize({
    amount: payment.amount,
    transaction_category: payment.category,
  });

  const url = new URL(auth_url, window.location.href);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`Unexpected Paystack address: ${url.protocol}`);
  }

  const intent = {
    ...payment.intent,
    reference,
    amount: payment.amount,
    createdAt: (options.now ?? Date.now)(),
  } as PaymentIntent;
  store.remember(intent);
  navigation.assign(url.href);
  return intent;
}

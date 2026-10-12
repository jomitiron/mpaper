import {
  isAbortError,
  isUnauthorized,
  waitForPayment,
  type Payment,
  type PaymentOutcome,
  type Transaction,
} from '@motopapers/api';
import { onScopeDispose, shallowRef } from 'vue';

/**
 * The payment return page, as a state machine:
 *
 *   missing                      no ?reference= in the address
 *   confirming ──success──────▶  paid       receipt (or the car is added)
 *              ──failed───────▶  failed     what happened, Try again
 *              ──reversed─────▶  failed     (reversed: true)
 *              ──timeout──────▶  timeout    "Still confirming. We'll email you", Check again
 *              ──error────────▶  error      couldn't ask at all, Check again
 *   timeout | error ──CHECK───▶  confirming
 *
 * `paid` and `failed` are final: Paystack has decided.
 */

export type ConfirmState =
  | { status: 'missing' }
  | { status: 'confirming' }
  | { status: 'paid'; payment: Payment; transaction?: Transaction }
  | { status: 'failed'; payment: Payment; transaction?: Transaction; reversed: boolean }
  | { status: 'timeout' }
  | { status: 'error' };

export type ConfirmEvent =
  { type: 'CHECK' } | { type: 'OUTCOME'; outcome: PaymentOutcome } | { type: 'ERROR' };

export function initialConfirmState(reference: string | null): ConfirmState {
  return reference ? { status: 'confirming' } : { status: 'missing' };
}

export function confirmTransition(state: ConfirmState, event: ConfirmEvent): ConfirmState {
  switch (event.type) {
    case 'CHECK':
      return state.status === 'timeout' || state.status === 'error'
        ? { status: 'confirming' }
        : state;
    case 'OUTCOME': {
      if (state.status !== 'confirming') return state;
      const outcome = event.outcome;
      if (outcome.status === 'timeout') return { status: 'timeout' };
      if (outcome.status === 'success') {
        return { status: 'paid', payment: outcome.payment, transaction: outcome.transaction };
      }
      return {
        status: 'failed',
        payment: outcome.payment,
        transaction: outcome.transaction,
        reversed: outcome.status === 'reversed',
      };
    }
    case 'ERROR':
      return state.status === 'confirming' ? { status: 'error' } : state;
  }
}

/** Reads `?reference=` (Paystack also sends `trxref`, the same value). */
export function referenceFrom(query: Record<string, unknown>): string | null {
  for (const key of ['reference', 'trxref']) {
    const raw = query[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

/**
 * Waits for Paystack's answer about `reference` with `waitForPayment()` (live stream, then
 * polling). `check()` asks again after a timeout or error. Stops when the page goes away.
 */
export function usePaymentConfirmation(
  reference: string | null,
  options: { wait?: typeof waitForPayment } = {},
) {
  const wait = options.wait ?? waitForPayment;
  const state = shallowRef<ConfirmState>(initialConfirmState(reference));
  let controller: AbortController | null = null;

  async function check(): Promise<void> {
    if (!reference) return;
    if (state.value.status !== 'confirming') {
      const next = confirmTransition(state.value, { type: 'CHECK' });
      if (next === state.value) return;
      state.value = next;
    }
    controller?.abort();
    const current = new AbortController();
    controller = current;
    try {
      const outcome = await wait(reference, { signal: current.signal });
      if (controller === current) {
        state.value = confirmTransition(state.value, { type: 'OUTCOME', outcome });
      }
    } catch (error) {
      // Leaving the page aborts; a 401 has already sent the driver to sign in.
      if (current.signal.aborted || isAbortError(error) || isUnauthorized(error)) return;
      if (controller === current) state.value = confirmTransition(state.value, { type: 'ERROR' });
    }
  }

  onScopeDispose(() => controller?.abort());

  return { state, check };
}

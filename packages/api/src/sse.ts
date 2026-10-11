import { fetchEventSource } from '@microsoft/fetch-event-source';
import { buildUrl, getApiConfig, HttpError, isUnauthorized } from './client';
import { envelope } from './schemas/common';
import { paymentSchema, type Payment, type Transaction } from './schemas/transaction';
import { getTransaction, listTransactions } from './modules/transactions';

/**
 * Waits for Paystack to confirm a payment, after the driver comes back to `/payments/callback`.
 *
 * 1. Opens the API's live stream `GET /transactions/completed-payment/:reference`. The browser's
 *    EventSource can't send the Authorization header, so this uses @microsoft/fetch-event-source.
 * 2. Azure closes idle connections, so if nothing final arrives within 20 seconds (or the stream
 *    fails), it falls back to polling every 3 seconds for up to 2 minutes.
 * 3. Then it gives up with `timeout`: show "Still confirming. We'll email you".
 */

export type SettledStatus = 'success' | 'failed' | 'reversed';

export type PaymentOutcome =
  | {
      status: SettledStatus;
      payment: Payment;
      /** Present when the outcome came from polling a transaction. */
      transaction?: Transaction;
      source: 'stream' | 'poll';
    }
  | { status: 'timeout' };

/** What a poll found: the payment and its current status (`pending` keeps waiting). */
export interface PaymentLookup {
  status: string;
  payment: Payment;
  transaction?: Transaction;
}

export interface WaitForPaymentOptions {
  /** If you know the transaction id, polling uses `GET /transactions/:id`. */
  transactionId?: number;
  signal?: AbortSignal;
  streamTimeoutMs?: number;
  pollIntervalMs?: number;
  pollTimeoutMs?: number;
  /** Test seam: replaces @microsoft/fetch-event-source. */
  openStream?: typeof fetchEventSource;
  /** Test seam: replaces the default poll. */
  lookup?: (signal: AbortSignal | undefined) => Promise<PaymentLookup | null>;
}

export const STREAM_TIMEOUT_MS = 20_000;
export const POLL_INTERVAL_MS = 3_000;
export const POLL_TIMEOUT_MS = 120_000;

const SETTLED: readonly string[] = ['success', 'failed', 'reversed'];

export async function waitForPayment(
  reference: string,
  options: WaitForPaymentOptions = {},
): Promise<PaymentOutcome> {
  const { signal } = options;
  throwIfAborted(signal);

  const streamed = await listen(reference, options);
  if (streamed) return streamed;
  throwIfAborted(signal);

  const lookup = options.lookup ?? defaultLookup(reference, options.transactionId);
  const interval = options.pollIntervalMs ?? POLL_INTERVAL_MS;
  const deadline = Date.now() + (options.pollTimeoutMs ?? POLL_TIMEOUT_MS);

  while (Date.now() < deadline) {
    try {
      const found = await lookup(signal);
      if (found && SETTLED.includes(found.status)) {
        return {
          status: found.status as SettledStatus,
          payment: found.payment,
          transaction: found.transaction,
          source: 'poll',
        };
      }
    } catch (error) {
      // A 401 has already signed the driver out; anything else is retried on the next tick.
      if (isUnauthorized(error) || signal?.aborted) throw error;
    }
    await sleep(Math.min(interval, Math.max(0, deadline - Date.now())), signal);
  }
  return { status: 'timeout' };
}

/** Resolves with a settled outcome from the stream, or null to fall back to polling. */
function listen(reference: string, options: WaitForPaymentOptions): Promise<PaymentOutcome | null> {
  const { baseUrl, getToken, onUnauthorized, fetch } = getApiConfig();
  const openStream = options.openStream ?? fetchEventSource;
  const token = getToken();
  const controller = new AbortController();

  return new Promise((resolve) => {
    let done = false;
    const finish = (outcome: PaymentOutcome | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
      controller.abort();
      resolve(outcome);
    };
    const onAbort = () => finish(null);
    const timer = setTimeout(() => finish(null), options.streamTimeoutMs ?? STREAM_TIMEOUT_MS);
    options.signal?.addEventListener('abort', onAbort);

    openStream(
      buildUrl(baseUrl, `/transactions/completed-payment/${encodeURIComponent(reference)}`),
      {
        signal: controller.signal,
        headers: {
          Accept: 'text/event-stream',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        fetch,
        // Keep listening while the tab is in the background (the driver may switch apps).
        openWhenHidden: true,
        async onopen(response) {
          const type = response.headers.get('content-type') ?? '';
          if (response.ok && type.includes('text/event-stream')) return;
          if (response.status === 401 && token) {
            onUnauthorized(new HttpError(401, 'Unauthorized', undefined));
          }
          throw new Error(`Payment stream unavailable (${response.status})`);
        },
        onmessage(message) {
          const settled = parseStreamMessage(message.data);
          if (settled) finish({ ...settled, source: 'stream' });
        },
        onclose() {
          // The server closed without a final event: stop the library from reconnecting.
          throw new Error('Payment stream closed');
        },
        onerror(error) {
          finish(null);
          throw error; // Rethrowing stops the library's automatic retry.
        },
      },
    ).catch(() => finish(null));
  });
}

const streamPayloadSchema = envelope(paymentSchema);

/** Reads one stream event: `data: {"status":"success","data":{…payment}}`. */
export function parseStreamMessage(
  data: string,
): { status: SettledStatus; payment: Payment } | null {
  let json: unknown;
  try {
    json = JSON.parse(data);
  } catch {
    return null;
  }
  const parsed = streamPayloadSchema.safeParse(json);
  if (!parsed.success) return null;
  const payment = parsed.data.data;
  return SETTLED.includes(payment.status)
    ? { status: payment.status as SettledStatus, payment }
    : null;
}

/**
 * `GET /transactions/:id` needs the transaction id, which `initialize` doesn't return. Without
 * one, look for the payment reference in the latest page of `GET /transactions`.
 */
function defaultLookup(reference: string, transactionId?: number) {
  return async (signal: AbortSignal | undefined): Promise<PaymentLookup | null> => {
    const transaction =
      transactionId !== undefined
        ? await getTransaction(transactionId, { signal })
        : (await listTransactions({ per_page: 20 }, { signal })).items.find(
            (t) => t.payment?.reference === reference || t.reference === reference,
          );
    if (!transaction) return null;
    return {
      status: transaction.payment?.status ?? transaction.status,
      payment: transaction.payment ?? {
        id: transaction.id,
        amount: transaction.amount,
        status: transaction.status,
        reference: transaction.reference,
        currency: transaction.currency,
        created_at: transaction.created_at,
        updated_at: transaction.updated_at,
      },
      transaction,
    };
  };
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

function abortError(): Error {
  const error = new Error('Stopped waiting for the payment');
  error.name = 'AbortError';
  return error;
}

import { HttpError, type PaymentOutcome, type waitForPayment } from '@motopapers/api';
import { describe, expect, it, vi } from 'vitest';
import { effectScope } from 'vue';
import {
  confirmTransition,
  initialConfirmState,
  referenceFrom,
  usePaymentConfirmation,
  type ConfirmState,
} from '../lib/confirm';
import { payment } from './fixtures';

const paid = payment({ status: 'success' });
const declined = payment({ status: 'failed' });

const outcome = (o: PaymentOutcome) => ({ type: 'OUTCOME', outcome: o }) as const;

describe('the payment return state machine', () => {
  it('starts confirming with a reference, and missing without one', () => {
    expect(initialConfirmState('MOT-1')).toEqual({ status: 'confirming' });
    expect(initialConfirmState(null)).toEqual({ status: 'missing' });
  });

  it('settles on what Paystack decided', () => {
    const confirming: ConfirmState = { status: 'confirming' };
    expect(
      confirmTransition(
        confirming,
        outcome({ status: 'success', payment: paid, source: 'stream' }),
      ),
    ).toEqual({ status: 'paid', payment: paid, transaction: undefined });
    expect(
      confirmTransition(
        confirming,
        outcome({ status: 'failed', payment: declined, source: 'poll' }),
      ),
    ).toMatchObject({ status: 'failed', payment: declined, reversed: false });
    expect(
      confirmTransition(
        confirming,
        outcome({ status: 'reversed', payment: declined, source: 'poll' }),
      ),
    ).toMatchObject({ status: 'failed', reversed: true });
    expect(confirmTransition(confirming, outcome({ status: 'timeout' }))).toEqual({
      status: 'timeout',
    });
    expect(confirmTransition(confirming, { type: 'ERROR' })).toEqual({ status: 'error' });
  });

  it('checks again only after a timeout or an error', () => {
    expect(confirmTransition({ status: 'timeout' }, { type: 'CHECK' })).toEqual({
      status: 'confirming',
    });
    expect(confirmTransition({ status: 'error' }, { type: 'CHECK' })).toEqual({
      status: 'confirming',
    });
    const done: ConfirmState = { status: 'paid', payment: paid };
    expect(confirmTransition(done, { type: 'CHECK' })).toBe(done);
    expect(confirmTransition({ status: 'missing' }, { type: 'CHECK' })).toEqual({
      status: 'missing',
    });
  });

  it("doesn't let a late answer change a decided payment", () => {
    const done: ConfirmState = { status: 'paid', payment: paid };
    expect(confirmTransition(done, outcome({ status: 'timeout' }))).toBe(done);
    expect(confirmTransition(done, { type: 'ERROR' })).toBe(done);
  });

  it('reads the reference Paystack sends back (reference, or trxref)', () => {
    expect(referenceFrom({ reference: 'MOT-1', trxref: 'MOT-1' })).toBe('MOT-1');
    expect(referenceFrom({ trxref: 'MOT-2' })).toBe('MOT-2');
    expect(referenceFrom({ reference: ['MOT-3'] })).toBe('MOT-3');
    expect(referenceFrom({ reference: '  ' })).toBeNull();
    expect(referenceFrom({})).toBeNull();
  });
});

describe('usePaymentConfirmation', () => {
  function run(reference: string | null, wait: typeof waitForPayment) {
    const scope = effectScope();
    const confirmation = scope.run(() => usePaymentConfirmation(reference, { wait }))!;
    return { ...confirmation, stop: () => scope.stop() };
  }

  it('shows the receipt once the payment succeeds', async () => {
    const wait = vi.fn<typeof waitForPayment>().mockResolvedValue({
      status: 'success',
      payment: paid,
      source: 'stream',
    });
    const { state, check } = run('MOT-1', wait);
    expect(state.value.status).toBe('confirming');
    await check();
    expect(wait).toHaveBeenCalledWith('MOT-1', { signal: expect.any(AbortSignal) });
    expect(state.value).toMatchObject({ status: 'paid', payment: paid });
  });

  it('shows what went wrong when it fails', async () => {
    const wait = vi.fn<typeof waitForPayment>().mockResolvedValue({
      status: 'failed',
      payment: declined,
      source: 'poll',
    });
    const { state, check } = run('MOT-1', wait);
    await check();
    expect(state.value).toMatchObject({ status: 'failed', reversed: false });
  });

  it('times out, then checks again and finds it paid', async () => {
    const wait = vi
      .fn<typeof waitForPayment>()
      .mockResolvedValueOnce({ status: 'timeout' })
      .mockResolvedValueOnce({ status: 'success', payment: paid, source: 'poll' });
    const { state, check } = run('MOT-1', wait);
    await check();
    expect(state.value.status).toBe('timeout');

    const again = check();
    expect(state.value.status).toBe('confirming');
    await again;
    expect(state.value.status).toBe('paid');
    expect(wait).toHaveBeenCalledTimes(2);
  });

  it("says it couldn't check when waiting fails outright", async () => {
    const wait = vi.fn<typeof waitForPayment>().mockRejectedValue(new Error('boom'));
    const { state, check } = run('MOT-1', wait);
    await check();
    expect(state.value.status).toBe('error');
  });

  it('stays quiet on a 401: the driver is already on the way to sign in', async () => {
    const wait = vi
      .fn<typeof waitForPayment>()
      .mockRejectedValue(new HttpError(401, 'Unauthorized', undefined));
    const { state, check } = run('MOT-1', wait);
    await check();
    expect(state.value.status).toBe('confirming');
  });

  it('stops waiting when the page goes away', async () => {
    let signal: AbortSignal | undefined;
    const wait = vi.fn<typeof waitForPayment>().mockImplementation(
      (_reference, options) =>
        new Promise((_resolve, reject) => {
          signal = options?.signal;
          signal?.addEventListener('abort', () =>
            reject(Object.assign(new Error('stopped'), { name: 'AbortError' })),
          );
        }),
    );
    const { state, check, stop } = run('MOT-1', wait);
    const waiting = check();
    stop();
    await waiting;
    expect(signal?.aborted).toBe(true);
    expect(state.value.status).toBe('confirming');
  });

  it('does nothing without a reference', async () => {
    const wait = vi.fn<typeof waitForPayment>();
    const { state, check } = run(null, wait);
    await check();
    expect(wait).not.toHaveBeenCalled();
    expect(state.value.status).toBe('missing');
  });
});

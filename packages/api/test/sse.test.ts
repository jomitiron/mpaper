import type { fetchEventSource } from '@microsoft/fetch-event-source';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureApi } from '../src/client';
import type { Payment } from '../src/schemas/transaction';
import { parseStreamMessage, waitForPayment, type PaymentLookup } from '../src/sse';

type StreamOptions = Parameters<typeof fetchEventSource>[1];

const REF = 'MOT-f7d04478-7905-4c34-a58c-48554a9aa628';

function payment(status: string): Payment {
  return {
    id: 914,
    amount: 20000,
    status,
    reference: REF,
    currency: 'NGN',
    email: 'ada.okafor@example.com',
  };
}

function event(status: string) {
  return {
    id: '',
    event: REF,
    data: JSON.stringify({
      status: 'success',
      message: 'Payment retrieved successfully',
      data: payment(status),
    }),
  };
}

/** A fake stream that stays open until aborted and lets the test push events. */
function fakeStream() {
  const calls: Array<{ url: string; options: StreamOptions }> = [];
  const open = vi.fn((url: RequestInfo, options: StreamOptions) => {
    calls.push({ url: String(url), options });
    return new Promise<void>((resolve) =>
      options.signal?.addEventListener('abort', () => resolve()),
    );
  });
  return { open: open as unknown as typeof fetchEventSource, calls };
}

beforeEach(() => {
  vi.useFakeTimers();
  configureApi({ baseUrl: 'https://api.test', getToken: () => 'tok' });
});
afterEach(() => {
  vi.useRealTimers();
  configureApi({ baseUrl: '', getToken: () => null });
});

describe('waitForPayment', () => {
  it('resolves from the live stream, sending the token', async () => {
    const stream = fakeStream();
    const lookup = vi.fn();
    const result = waitForPayment(REF, { openStream: stream.open, lookup });
    await vi.advanceTimersByTimeAsync(0);
    expect(stream.calls[0]!.url).toBe(`https://api.test/transactions/completed-payment/${REF}`);
    expect(stream.calls[0]!.options.headers).toMatchObject({ Authorization: 'Bearer tok' });

    stream.calls[0]!.options.onmessage?.(event('pending'));
    stream.calls[0]!.options.onmessage?.(event('success'));
    await expect(result).resolves.toMatchObject({
      status: 'success',
      source: 'stream',
      payment: { amount: 20000 },
    });
    expect(lookup).not.toHaveBeenCalled();
    expect(stream.calls[0]!.options.signal?.aborted).toBe(true);
  });

  it('falls back to polling every 3 s when the stream is quiet for 20 s', async () => {
    const stream = fakeStream();
    const answers: Array<PaymentLookup | null> = [
      null,
      { status: 'pending', payment: payment('pending') },
      { status: 'failed', payment: payment('failed') },
    ];
    const lookup = vi.fn(async () => answers.shift() ?? null);
    const result = waitForPayment(REF, { openStream: stream.open, lookup });

    await vi.advanceTimersByTimeAsync(19_999);
    expect(lookup).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(lookup).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(3_000);
    expect(lookup).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(3_000);
    await expect(result).resolves.toMatchObject({ status: 'failed', source: 'poll' });
    expect(lookup).toHaveBeenCalledTimes(3);
  });

  it('polls straight away if the stream fails to open', async () => {
    const stream = fakeStream();
    const lookup = vi.fn(async () => ({ status: 'success', payment: payment('success') }));
    const result = waitForPayment(REF, { openStream: stream.open, lookup });
    await vi.advanceTimersByTimeAsync(0);
    expect(() => stream.calls[0]!.options.onerror?.(new Error('502'))).toThrow();
    await vi.advanceTimersByTimeAsync(0);
    await expect(result).resolves.toMatchObject({ status: 'success', source: 'poll' });
  });

  it('gives up with a timeout after 2 minutes of polling', async () => {
    const stream = fakeStream();
    const lookup = vi.fn(async () => ({ status: 'pending', payment: payment('pending') }));
    const result = waitForPayment(REF, { openStream: stream.open, lookup });
    await vi.advanceTimersByTimeAsync(20_000 + 120_000);
    await expect(result).resolves.toEqual({ status: 'timeout' });
    expect(lookup.mock.calls.length).toBeGreaterThanOrEqual(40);
    expect(lookup.mock.calls.length).toBeLessThanOrEqual(41);
  });

  it('keeps polling through a failed poll', async () => {
    const stream = fakeStream();
    const lookup = vi
      .fn<() => Promise<PaymentLookup | null>>()
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValue({ status: 'success', payment: payment('success') });
    const result = waitForPayment(REF, { openStream: stream.open, lookup, streamTimeoutMs: 10 });
    await vi.advanceTimersByTimeAsync(3_100);
    await expect(result).resolves.toMatchObject({ status: 'success' });
  });

  it('stops when aborted', async () => {
    const stream = fakeStream();
    const controller = new AbortController();
    const lookup = vi.fn(async () => null);
    const result = waitForPayment(REF, {
      openStream: stream.open,
      lookup,
      signal: controller.signal,
    });
    const assertion = expect(result).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(25_000);
    controller.abort();
    await assertion;
  });
});

describe('parseStreamMessage', () => {
  it('ignores pending and malformed events', () => {
    expect(parseStreamMessage(event('pending').data)).toBeNull();
    expect(parseStreamMessage('not json')).toBeNull();
    expect(parseStreamMessage('{"status":"success"}')).toBeNull();
  });

  it('reads settled payments', () => {
    expect(parseStreamMessage(event('reversed').data)).toMatchObject({ status: 'reversed' });
  });
});

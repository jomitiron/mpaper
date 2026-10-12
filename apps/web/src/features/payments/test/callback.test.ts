import type * as Api from '@motopapers/api';
import { waitForPayment, type Payment, type PaymentOutcome } from '@motopapers/api';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyDraft, type CarDraft } from '../../cars/add/draft';
import { intentStore, type AddCarIntent } from '../lib/intent';
import {
  ada,
  BASE,
  body,
  button,
  click,
  harness,
  mountAt,
  server,
  settle,
  text,
  useHarness,
} from './harness';

/** The payment return page, with the live stream (waitForPayment) mocked. */

vi.mock('@motopapers/api', async (importOriginal) => ({
  ...(await importOriginal<typeof Api>()),
  waitForPayment: vi.fn(),
}));
const wait = vi.mocked(waitForPayment);

useHarness();

/** A Paystack payment as the stream sends it, settled with `status`. */
function settled(amount: number, status: 'success' | 'failed' | 'reversed'): Payment {
  const account = ada();
  const tx = harness.db.addPaystackPayment(account, {
    amount,
    transaction_type: 'credit',
    category: 'wallet_topup',
    description: 'Wallet top-up',
  });
  tx.status = status;
  tx.settleAt = undefined;
  tx.payment!.status = status;
  if (status === 'success') account.walletBalance += amount;
  return tx.payment!;
}

function answer(...outcomes: PaymentOutcome[]) {
  for (const outcome of outcomes) wait.mockResolvedValueOnce(outcome);
}

function rememberTopUp(paid: Payment) {
  intentStore().remember({
    kind: 'top-up',
    reference: paid.reference,
    amount: paid.amount,
    createdAt: Date.now(),
    returnTo: '/payments',
  });
}

function ktuDraft(): CarDraft {
  const draft = emptyDraft();
  Object.assign(draft.car, {
    plate_number: 'KTU 604 XR',
    brand: 'Toyota',
    model: 'Corolla',
    color: 'Grey',
    engine_number: '2ZR-6618023',
    chassis_number: '2T1BURHE0KC184362',
    engine_capacity: '1,798 cc',
  });
  draft.licence = { expiry_date: '2027-03-02', license_pin: 'K7Q2M9XR4D' };
  draft.insurance.expiry_date = '2027-04-18';
  draft.roadworthiness.expiry_date = '2027-01-09';
  return draft;
}

function rememberCar(paid: Payment, extra: Partial<AddCarIntent> = {}) {
  intentStore().remember({
    kind: 'add-car',
    reference: paid.reference,
    amount: paid.amount,
    createdAt: Date.now(),
    returnTo: '/cars/new',
    draft: ktuDraft(),
    ...extra,
  });
}

const ktuCars = () => ada().vehicles.filter((v) => v.plate_number === 'KTU 604 XR');
const heading = () => body().querySelector('h1')?.textContent?.trim();

beforeEach(() => wait.mockReset());

describe('payment return', () => {
  it('confirms a top-up and shows the receipt with the new balance', async () => {
    const paid = settled(20_000, 'success');
    rememberTopUp(paid);
    let release!: (outcome: PaymentOutcome) => void;
    wait.mockReturnValueOnce(new Promise((resolve) => (release = resolve)));

    await mountAt(`/payments/callback?reference=${encodeURIComponent(paid.reference)}&trxref=x`);
    expect(heading()).toBe('Confirming your payment…');
    expect(wait).toHaveBeenCalledWith(paid.reference, { signal: expect.any(AbortSignal) });

    release({ status: 'success', payment: paid, source: 'stream' });
    await settle();
    expect(heading()).toBe('Payment received');
    expect(document.activeElement).toBe(body().querySelector('h1'));
    const receipt = text();
    expect(receipt).toContain('₦20,000');
    expect(receipt).toContain("Thanks, Ada. Here's your receipt.");
    expect(receipt).toContain('ForWallet top-up');
    expect(receipt).toContain(`Reference${paid.reference}`);
    expect(receipt).toContain('Date12 Oct 2026');
    expect(receipt).toContain('Wallet balance₦28,500');
    expect(document.title).toBe('Payment received · MotoPapers');
  });

  it('labels a receipt from the payment itself when there is no intent', async () => {
    const paid = settled(20_000, 'success');
    const transaction = ada().transactions[0]!;
    answer({ status: 'success', payment: paid, transaction, source: 'poll' });
    await mountAt(`/payments/callback?reference=${paid.reference}`);
    expect(heading()).toBe('Payment received');
    expect(text()).toContain('ForWallet top-up');
  });

  it('explains a failed top-up and tries again with the same amount', async () => {
    const failed = settled(10_013, 'failed');
    rememberTopUp(failed);
    answer({ status: 'failed', payment: failed, source: 'stream' });
    const { router } = await mountAt(`/payments/callback?reference=${failed.reference}`);

    expect(heading()).toBe("Your payment didn't go through");
    expect(text()).toContain('₦10,013');
    expect(text()).toContain("For a wallet top-up. Paystack couldn't complete this payment.");
    expect(text()).toContain(`with reference ${failed.reference}`);

    await click('Try again');
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/payments'));
    await settle();
    const input = body().querySelector<HTMLInputElement>('[role="dialog"] input')!;
    expect(input.value).toBe('10,013');
  });

  it('says when a payment was reversed', async () => {
    const reversed = settled(5_000, 'reversed');
    answer({ status: 'reversed', payment: reversed, source: 'poll' });
    await mountAt(`/payments/callback?reference=${reversed.reference}`);
    expect(heading()).toBe('This payment was reversed');
    // Without an intent we don't know what to retry: Payments has Retry on failed top-ups.
    expect(text()).not.toContain('Try again');
    expect(text()).toContain('View payments');
  });

  it('keeps confirming after a timeout, and checks again on request', async () => {
    const paid = settled(20_000, 'success');
    rememberTopUp(paid);
    answer({ status: 'timeout' }, { status: 'success', payment: paid, source: 'poll' });
    await mountAt(`/payments/callback?reference=${paid.reference}`);

    expect(heading()).toBe('Still confirming');
    expect(text()).toContain("Paystack hasn't confirmed this payment yet. We'll email you");
    expect(button('Go to Payments').getAttribute('href')).toBe('/payments');

    await click('Check again');
    await vi.waitFor(() => expect(heading()).toBe('Payment received'));
    expect(wait).toHaveBeenCalledTimes(2);
  });

  it("says when it couldn't check at all", async () => {
    wait.mockRejectedValueOnce(new Error('offline'));
    await mountAt('/payments/callback?reference=MOT-x');
    expect(heading()).toBe("We couldn't check your payment");
    expect(text()).toContain('Check again');
  });

  it('needs a reference', async () => {
    await mountAt('/payments/callback');
    expect(heading()).toBe("We couldn't find that payment");
    expect(wait).not.toHaveBeenCalled();
  });
});

describe('payment return · Add a car paid by card', () => {
  it('adds the car once the payment is confirmed', async () => {
    const paid = settled(2_500, 'success');
    rememberCar(paid);
    answer({ status: 'success', payment: paid, source: 'stream' });
    await mountAt(`/payments/callback?reference=${paid.reference}`);

    await vi.waitFor(() => expect(text()).toContain('KTU 604 XR is all set'));
    expect(text()).toContain("Payment received through Paystack. We'll send your first reminder");
    expect(ktuCars()).toHaveLength(1);
    expect(ktuCars()[0]!.vehicle_licenses).toHaveLength(1);
    expect(ktuCars()[0]!.insurance).toHaveLength(1);
    expect(ktuCars()[0]!.roadworthiness).toHaveLength(1);
    expect(intentStore().recall(paid.reference)).toMatchObject({ done: true });
    expect(intentStore().unfinishedCars()).toEqual([]);
  });

  it('never adds it twice when the page is opened again', async () => {
    const paid = settled(2_500, 'success');
    rememberCar(paid);
    answer({ status: 'success', payment: paid, source: 'stream' });
    const first = await mountAt(`/payments/callback?reference=${paid.reference}`);
    await vi.waitFor(() => expect(text()).toContain('KTU 604 XR is all set'));
    first.wrapper.unmount();

    const created: string[] = [];
    server.events.on('request:start', ({ request }) => {
      if (request.method === 'POST') created.push(new URL(request.url).pathname);
    });
    answer({ status: 'success', payment: paid, source: 'stream' });
    await mountAt(`/payments/callback?reference=${paid.reference}`);
    expect(text()).toContain('KTU 604 XR is all set');
    expect(created).toEqual([]);
    expect(ktuCars()).toHaveLength(1);
  });

  it('picks up where it stopped when a paper failed to save', async () => {
    const paid = settled(2_500, 'success');
    rememberCar(paid);
    let fail = true;
    server.use(
      http.post(`${BASE}/vehicle/:id/insurance`, () =>
        fail
          ? HttpResponse.json({ status: 'error', message: 'Insurance is down' }, { status: 400 })
          : undefined,
      ),
    );
    answer({ status: 'success', payment: paid, source: 'stream' });
    const first = await mountAt(`/payments/callback?reference=${paid.reference}`);
    await vi.waitFor(() =>
      expect(text()).toContain("Your car is added, but we couldn't save its insurance."),
    );
    expect(intentStore().unfinishedCars()).toHaveLength(1);
    first.wrapper.unmount();

    // Coming back later (from the notice on Payments) saves only the insurance.
    fail = false;
    answer({ status: 'success', payment: paid, source: 'stream' });
    await mountAt(`/payments/callback?reference=${paid.reference}`);
    await vi.waitFor(() => expect(text()).toContain('KTU 604 XR is all set'));
    expect(ktuCars()).toHaveLength(1);
    expect(ktuCars()[0]!.insurance).toHaveLength(1);
    expect(ktuCars()[0]!.vehicle_licenses).toHaveLength(1);
  });

  it("explains a plate that's already on the account after paying", async () => {
    const paid = settled(2_500, 'success');
    rememberCar(paid);
    ada().vehicles.push({ ...ada().vehicles[0]!, id: 9999, plate_number: 'KTU 604 XR' });
    answer({ status: 'success', payment: paid, source: 'stream' });
    await mountAt(`/payments/callback?reference=${paid.reference}`);
    await vi.waitFor(() =>
      expect(text()).toContain(
        `Your ₦2,500 payment went through, but KTU 604 XR is already on your account, so we didn't add it again. Call us on +234 802 959 5069 with reference ${paid.reference}`,
      ),
    );
  });

  it('pays again by card for the same car after a failed payment', async () => {
    const failed = settled(2_500, 'failed');
    rememberCar(failed);
    answer({ status: 'failed', payment: failed, source: 'stream' });
    await mountAt(`/payments/callback?reference=${failed.reference}`);

    expect(heading()).toBe("Your payment didn't go through");
    expect(text()).toContain('For tracking and reminders for KTU 604 XR.');
    expect(intentStore().recall(failed.reference)).toMatchObject({ failed: true });

    await click('Try again');
    await vi.waitFor(() => expect(harness.left).toHaveLength(1));
    const reference = new URL(harness.left[0]!).searchParams.get('reference')!;
    expect(reference).not.toBe(failed.reference);
    const retry = intentStore().recall(reference);
    expect(retry).toMatchObject({ kind: 'add-car', amount: 2_500 });
    expect(retry?.kind === 'add-car' && retry.draft.car.plate_number).toBe('KTU 604 XR');
  });

  it('shows a car still being confirmed on Payments', async () => {
    const paid = settled(2_500, 'success');
    rememberCar(paid);
    await mountAt('/payments');
    expect(text()).toContain('Finish adding KTU 604 XR');
    const link = body().querySelector<HTMLAnchorElement>('.pay-notice a')!;
    expect(link.getAttribute('href')).toBe(
      `/payments/callback?reference=${encodeURIComponent(paid.reference)}`,
    );
  });
});

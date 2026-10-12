import { useToast } from '@motopapers/ui';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { intentStore } from '../lib/intent';
import {
  ada,
  addCarToReview,
  APP,
  BASE,
  body,
  button,
  click,
  harness,
  mountAt,
  server,
  settle,
  testFlags,
  text,
  type,
  useHarness,
} from './harness';

/** Payments and Add a car's Review and pay, mounted against the mock API. */

useHarness();

const rows = () => [...body().querySelectorAll<HTMLElement>('.tx')];
const rowTitles = () => rows().map((row) => row.querySelector('b')?.textContent);
const chip = (label: string) =>
  button(label, body().querySelector('[aria-label="Filter payments"]')!);
/** "All 6", "Top-ups" (no count). */
const chips = () =>
  [...body().querySelectorAll('[aria-label="Filter payments"] .chip')].map((c) => {
    const count = c.querySelector('.cnt')?.textContent;
    const label = [...c.childNodes]
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent)
      .join('')
      .trim();
    return count ? `${label} ${count}` : label;
  });
const toasts = () => useToast().items.map((t) => t.message);
const dialog = () => body().querySelector<HTMLElement>('[role="dialog"]');

describe('Payments', () => {
  it('shows the wallet, what was paid this year, and every payment by month', async () => {
    await mountAt('/payments');
    expect(text()).toContain('Wallet balance₦8,500');
    expect(text()).toContain('₦6,500 paid for renewals this year');
    expect(text()).toContain('2 payments pending');

    expect([...body().querySelectorAll('.month')].map((h) => h.textContent)).toEqual([
      'October 2026',
      'September 2026',
      'April 2026',
    ]);
    expect(rowTitles()).toEqual([
      'Licence renewal',
      'Wallet top-up',
      'Roadworthiness renewal',
      'Wallet top-up',
      'Tracking and reminders',
      'Wallet top-up',
    ]);
    const [renewal, topUp, , failed] = rows();
    expect(renewal!.textContent).toContain('EKY 219 GD');
    expect(renewal!.textContent).toContain('Pending');
    expect(renewal!.textContent).toContain('−₦18,500');
    expect(renewal!.textContent).toContain('Check status');
    expect(topUp!.querySelector('.amt.in')?.textContent).toBe('+₦20,000');
    expect(topUp!.textContent).toContain('Paid');
    expect(failed!.querySelector('.amt.void')?.textContent).toContain('+₦10,000');
    expect(failed!.textContent).toContain('Retry');

    expect(chips()).toEqual(['All 6', 'Top-ups 3', 'Renewals 3', 'Pending 2']);
  });

  it('filters by chip and keeps the filter in the address', async () => {
    const statuses: (string | null)[] = [];
    server.events.on('request:start', ({ request }) => {
      const url = new URL(request.url);
      if (url.pathname === '/transactions') statuses.push(url.searchParams.get('status'));
    });
    const { router } = await mountAt('/payments');

    chip('Pending').click();
    await settle();
    expect(router.currentRoute.value.query.filter).toBe('pending');
    expect(statuses).toContain('pending');
    expect(rowTitles()).toEqual(['Licence renewal', 'Wallet top-up']);
    expect(chip('Pending').getAttribute('aria-pressed')).toBe('true');
    expect(chip('Pending').querySelector('.visually-hidden')?.textContent).toBe(' (2 payments)');
    // Clicking the chosen chip again leaves it chosen: the page decides, not the chip.
    chip('Pending').click();
    await settle();
    expect(chip('Pending').getAttribute('aria-pressed')).toBe('true');
    expect(router.currentRoute.value.query.filter).toBe('pending');

    await click('Top-ups');
    expect(router.currentRoute.value.query.filter).toBe('topups');
    expect(rowTitles()).toEqual(['Wallet top-up', 'Wallet top-up', 'Wallet top-up']);

    await click('Renewals');
    expect(rowTitles()).toEqual([
      'Licence renewal',
      'Roadworthiness renewal',
      'Tracking and reminders',
    ]);

    await click('All');
    expect(router.currentRoute.value.query.filter).toBeUndefined();
    expect(rows()).toHaveLength(6);
  });

  it('labels payments by money in or out without transaction labels', async () => {
    testFlags.txLabels = false;
    await mountAt('/payments');
    expect(rowTitles()).toEqual([
      'Payment',
      'Wallet top-up',
      'Payment',
      'Wallet top-up',
      'Payment',
      'Wallet top-up',
    ]);
    expect(text()).toContain('₦11,500 paid this year');
  });

  it('loads older payments a page at a time', async () => {
    const account = ada();
    for (let i = 0; i < 20; i += 1) {
      harness.db.addTransaction(account, {
        amount: 100 + i,
        status: 'success',
        transaction_type: 'credit',
        payment: null,
        category: 'wallet_topup',
        description: 'Wallet top-up',
        vehicle_id: null,
        document_type: null,
      });
    }
    await mountAt('/payments');
    expect(rows()).toHaveLength(20);
    // Top-ups and Renewals can't be counted until everything is loaded.
    expect(chips()).toEqual(['All 26', 'Top-ups', 'Renewals', 'Pending 2']);

    await click('Show more payments');
    await vi.waitFor(() => expect(rows()).toHaveLength(26));
    expect(text()).not.toContain('Show more payments');
    expect(chips()).toEqual(['All 26', 'Top-ups 23', 'Renewals 3', 'Pending 2']);
  });

  it('checks a pending payment with Paystack', async () => {
    await mountAt('/payments');
    await click('Check status');
    await vi.waitFor(() =>
      expect(toasts()).toContain(
        'Checked with Paystack: MOT-0000038a-0000-4000-8000-000000000000 is still waiting for the bank to confirm.',
      ),
    );

    // Paystack confirms the old top-up; checking it updates the list and the wallet.
    const old = ada().transactions.find((t) => t.id === 901)!;
    old.status = 'success';
    old.payment!.status = 'success';
    ada().walletBalance += 1_000;
    await click('Check status', rows().at(-1)!);
    await vi.waitFor(() =>
      expect(toasts()).toContain('Payment confirmed. ₦1,000 is in your wallet.'),
    );
    await vi.waitFor(() => expect(text()).toContain('Wallet balance₦9,500'));
    expect(text()).toContain('1 payment pending');
  });

  it("reads a pending payment again when it can't ask Paystack (no verify endpoint)", async () => {
    testFlags.verifyPayment = false;
    const asked: string[] = [];
    server.events.on('request:start', ({ request }) => asked.push(new URL(request.url).pathname));
    await mountAt('/payments');
    await click('Check status');
    await vi.waitFor(() =>
      expect(toasts()).toContain("Still pending. It'll update here as soon as Paystack confirms."),
    );
    expect(asked).toContain('/transactions/906');
    expect(asked.some((path) => path.endsWith('/verify'))).toBe(false);
  });

  it('says so when a check fails', async () => {
    server.use(
      http.post(`${BASE}/transactions/:reference/verify`, () =>
        HttpResponse.json({ status: 'error', message: 'Paystack is down' }, { status: 400 }),
      ),
    );
    await mountAt('/payments');
    await click('Check status');
    await vi.waitFor(() =>
      expect(toasts()).toContain("We couldn't check this payment. Paystack is down"),
    );
  });
});

describe('Top up', () => {
  it('opens from /payments?topup=1 and tidies the address', async () => {
    const { router } = await mountAt('/payments?topup=1');
    expect(dialog()?.textContent).toContain('Top up your wallet');
    expect(router.currentRoute.value.query.topup).toBeUndefined();
    expect(document.activeElement).toBe(dialog()!.querySelector('input'));
  });

  it('Retry opens it with the failed amount', async () => {
    await mountAt('/payments');
    await click('Retry');
    expect((dialog()!.querySelector('input') as HTMLInputElement).value).toBe('10,000');
    expect(button('Continue to Paystack', dialog()!).textContent).toContain('₦10,000');
  });

  it('needs at least ₦100', async () => {
    await mountAt('/payments?topup=1');
    await type('How much?', '50', dialog()!);
    await click('Continue to Paystack', dialog()!);
    expect(dialog()!.textContent).toContain('Enter at least ₦100.');
    expect(dialog()!.querySelector('input')?.getAttribute('aria-invalid')).toBe('true');
    expect(harness.left).toEqual([]);
  });

  it('formats the amount as it is typed and goes to Paystack, remembering why', async () => {
    await mountAt('/payments');
    await click('Top up wallet');
    await type('How much?', '₦25000.75', dialog()!);
    expect((dialog()!.querySelector('input') as HTMLInputElement).value).toBe('25,000');
    await click('₦5,000', dialog()!);
    expect((dialog()!.querySelector('input') as HTMLInputElement).value).toBe('5,000');

    await click('Continue to Paystack · ₦5,000', dialog()!);
    await vi.waitFor(() => expect(harness.left).toHaveLength(1));
    const url = new URL(harness.left[0]!);
    expect(url.origin + url.pathname).toBe(`${APP}/payments/callback`);
    const reference = url.searchParams.get('reference')!;
    expect(intentStore().recall(reference)).toMatchObject({
      kind: 'top-up',
      amount: 5_000,
      returnTo: '/payments',
    });
    expect(ada().transactions[0]).toMatchObject({
      amount: 5_000,
      status: 'pending',
      category: 'wallet_topup',
    });
  });

  it("says so when Paystack can't be reached", async () => {
    server.use(http.post(`${BASE}/transactions/initialize`, () => HttpResponse.error()));
    await mountAt('/payments?topup=1');
    await click('₦20,000', dialog()!);
    await click('Continue to Paystack', dialog()!);
    await vi.waitFor(() => expect(dialog()!.textContent).toContain("We couldn't open Paystack."));
    expect(harness.left).toEqual([]);
  });
});

describe('Add a car · Review and pay', () => {
  it('shows the price and pays from the wallet by default', async () => {
    await mountAt('/cars/new');
    await addCarToReview();
    expect(text()).toContain('Tracking and reminders, 1 car₦2,500');
    expect(text()).toContain('₦8,500 available');
    const wallet = body().querySelector<HTMLInputElement>('input[value="wallet"]')!;
    expect(wallet.checked).toBe(true);

    await click('Pay ₦2,500 and start');
    await vi.waitFor(() => expect(text()).toContain('KTU 604 XR is all set'));
    expect(text()).toContain("₦2,500 was paid from your wallet. We'll send your first reminder");
    expect(ada().walletBalance).toBe(6_000);
    expect(ada().transactions[0]).toMatchObject({ category: 'service_charge', amount: 2_500 });
  });

  it("can't pay from a wallet that's short, and says why", async () => {
    ada().walletBalance = 1_200;
    await mountAt('/cars/new');
    await addCarToReview();
    const wallet = body().querySelector<HTMLInputElement>('input[value="wallet"]')!;
    expect(wallet.disabled).toBe(true);
    expect(text()).toContain('₦1,200 available. Not enough for this payment.');
    expect(body().querySelector<HTMLInputElement>('input[value="card"]')!.checked).toBe(true);
  });

  it('switches to card when the wallet turns out to be short', async () => {
    await mountAt('/cars/new');
    await addCarToReview();
    ada().walletBalance = 100; // spent in another tab
    await click('Pay ₦2,500 and start');
    await vi.waitFor(() =>
      expect(text()).toContain('Not enough in your wallet. Pay by card or bank transfer instead.'),
    );
    expect(body().querySelector<HTMLInputElement>('input[value="card"]')!.checked).toBe(true);
    expect(text()).not.toContain('is all set');
  });

  it('pays by card on Paystack, keeping the car to add when the driver comes back', async () => {
    await mountAt('/cars/new');
    await addCarToReview();
    const card = body().querySelector<HTMLInputElement>('input[value="card"]')!;
    card.checked = true;
    card.dispatchEvent(new Event('change'));
    await settle();
    await click('Pay ₦2,500 and start');

    await vi.waitFor(() => expect(harness.left).toHaveLength(1));
    const reference = new URL(harness.left[0]!).searchParams.get('reference')!;
    const intent = intentStore().recall(reference);
    expect(intent).toMatchObject({ kind: 'add-car', amount: 2_500, returnTo: '/cars/new' });
    expect(intent?.kind === 'add-car' && intent.draft.car.plate_number).toBe('KTU 604 XR');
    expect(ada().transactions[0]).toMatchObject({ category: 'service_charge', status: 'pending' });
    // Nothing is saved until Paystack confirms.
    expect(ada().vehicles.some((v) => v.plate_number === 'KTU 604 XR')).toBe(false);
  });

  it('offers only card or bank transfer without wallet pay', async () => {
    testFlags.walletPay = false;
    await mountAt('/cars/new');
    await addCarToReview();
    expect(body().querySelector('input[value="wallet"]')).toBeNull();
    expect(body().querySelector<HTMLInputElement>('input[value="card"]')!.checked).toBe(true);
  });

  it('remembers the wallet payment if the driver goes back after it', async () => {
    let fail = true;
    server.use(
      http.post(`${BASE}/vehicles`, () =>
        fail
          ? HttpResponse.json({ status: 'error', message: 'Vehicles are down' }, { status: 400 })
          : undefined,
      ),
    );
    await mountAt('/cars/new');
    await addCarToReview();
    await click('Pay ₦2,500 and start');
    await vi.waitFor(() =>
      expect(text()).toContain(
        "Your ₦2,500 payment went through, but we couldn't add your car yet. Vehicles are down",
      ),
    );

    // Back to step 3 with the stepper, then forward again: no second payment.
    await click(/Other papers/);
    await click('Continue');
    expect(text()).toContain('Paid ₦2,500 from your wallet.');
    expect(text()).not.toContain('Pay ₦2,500 and start');

    fail = false;
    await click('Try again');
    await vi.waitFor(() => expect(text()).toContain('KTU 604 XR is all set'));
    expect(ada().walletBalance).toBe(6_000);
    const fees = ada().transactions.filter((t) => t.category === 'service_charge');
    expect(fees.filter((t) => t.amount === 2_500)).toHaveLength(1);
  });
});

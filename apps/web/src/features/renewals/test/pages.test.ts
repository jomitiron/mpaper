import { RENEWAL_STEP_MS } from '@motopapers/api/mocks';
import type { VueWrapper } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSessionStore } from '@/stores/session';
import { intentStore } from '@/features/payments/lib/intent';
import {
  ada,
  body,
  button,
  click,
  field,
  harness,
  mountAt,
  server,
  testFlags,
  text,
  type,
  useHarness,
} from '@/features/payments/test/harness';
import { createRequestStore, requestStore, resetRequestStore } from '../lib/requests';

/** Renewing papers from Home, My cars and the car panel, against the mock API. */

useHarness({ flags: { renewals: true } });

let mounted: VueWrapper | null = null;

beforeEach(() => {
  resetRequestStore(createRequestStore(null));
  mounted = null;
});

/** Opens the app at `path`, closing the one opened before (as a reload would). */
async function open(path: string) {
  mounted?.unmount();
  document.body.innerHTML = '';
  const app = await mountAt(path);
  mounted = app.wrapper;
  return app;
}

const radio = (value: 'wallet' | 'card') =>
  body().querySelector<HTMLInputElement>(`input[name="renew-pay"][value="${value}"]`)!;
const dialog = () => body().querySelector<HTMLElement>('[role="dialog"]');
const steps = () =>
  [...body().querySelectorAll('.rn-step')].map(
    (li) =>
      `${li.querySelector('.rn-label')?.firstChild?.textContent}:${li.className.split('rn-')[2]}`,
  );

/** Moves the mock API's clock (renewals move on every 20 s once paid). */
function later(ms: number) {
  vi.setSystemTime(new Date(Date.now() + ms));
}

describe('renew by card', () => {
  it('starts from Home with the car and paper chosen, and goes to Paystack when the wallet is short', async () => {
    const { router } = await open('/');
    expect(text()).toContain('Your Ford Edge licence expired 13 days ago');
    await click('Renew licence · ₦18,500');
    // The renew page loads lazily: the first time can take a moment.
    await vi.waitFor(() => expect(text()).toContain('Check and pay'));
    expect(router.currentRoute.value.fullPath).toBe('/cars/102/renew/licence');
    expect(text()).toContain('Renew licence');
    expect(text()).toContain('EKY 219 GD · Ford Edge');
    expect(text()).toContain('Expired 29 Sep 2026 · expired 13 days ago');
    expect(text()).toContain('Licence renewal₦18,500');

    // ₦8,500 won't cover ₦18,500: the wallet is off and the card is chosen.
    expect(radio('wallet').disabled).toBe(true);
    expect(text()).toContain('₦8,500 available. Not enough for this renewal.');
    expect(radio('card').checked).toBe(true);
    expect((field('Delivery address') as unknown as HTMLTextAreaElement).value).toBe(
      '14 Admiralty Way, Lekki Phase 1, Lagos',
    );

    await click('Pay ₦18,500');
    await vi.waitFor(() => expect(harness.left).toHaveLength(1));
    const url = new URL(harness.left[0]!);
    expect(url.pathname).toBe('/payments/callback');
    const reference = url.searchParams.get('reference')!;
    expect(intentStore().recall(reference)).toMatchObject({
      kind: 'other',
      label: 'Licence renewal · EKY 219 GD',
      returnTo: '/cars/102/renew/licence',
      returnLabel: 'Track your renewal',
      amount: 18_500,
    });
    expect(ada().renewals[0]).toMatchObject({
      vehicle_id: 102,
      document_type: 'vehicle_license',
      status: 'awaiting_payment',
      delivery_address: '14 Admiralty Way, Lekki Phase 1, Lagos',
    });
    // The button stays busy while the browser leaves for Paystack.
    expect(button('Pay ₦18,500').getAttribute('aria-busy')).toBe('true');
  });

  it('warns about a card payment still being confirmed before paying again', async () => {
    await open('/cars/102/renew/licence');
    await click('Pay ₦18,500');
    await vi.waitFor(() => expect(harness.left).toHaveLength(1));

    await open('/cars/102/renew/licence');
    expect(text()).toContain(
      'A card payment of ₦18,500 for this renewal is still being confirmed. Check Payments before you pay again.',
    );
  });
});

describe('renew from the wallet', () => {
  it('pays from the car panel and shows the renewal moving through each step', async () => {
    const { router } = await open('/cars/102');
    const road = [...dialog()!.querySelectorAll<HTMLElement>('.dr-doc')][2]!;
    expect(road.textContent).toContain('Roadworthiness');
    await click('Renew', road);
    await vi.waitFor(() => expect(text()).toContain('Check and pay'));
    expect(router.currentRoute.value.fullPath).toBe('/cars/102/renew/roadworthiness');

    expect(radio('wallet').checked).toBe(true);
    expect(text()).toContain('₦8,500 available');
    await click('Pay ₦6,500');

    await vi.waitFor(() => expect(text()).toContain('Paid ₦6,500 from your wallet.'));
    expect(text()).toContain('Your roadworthiness renewal is paid');
    expect(steps()).toEqual([
      'Paid:done',
      'Processing:todo',
      'Out for delivery:todo',
      'Delivered:todo',
    ]);
    expect(ada().walletBalance).toBe(2_000);
    expect(document.activeElement?.textContent).toContain('Your roadworthiness renewal is paid');

    // The car panel follows it, and its Renew button is gone.
    await click('See EKY 219 GD');
    expect(router.currentRoute.value.fullPath).toBe('/cars/102');
    expect(dialog()!.textContent).toContain('Roadworthiness renewal');
    const roadDoc = [...dialog()!.querySelectorAll<HTMLElement>('.dr-doc')][2]!;
    expect(roadDoc.textContent).toContain('Renewal in progress');
    expect(() => button('Renew', roadDoc)).toThrow();

    later(RENEWAL_STEP_MS + 1_000);
    await open('/cars/102');
    expect(steps()).toEqual([
      'Paid:done',
      'Processing:current',
      'Out for delivery:todo',
      'Delivered:todo',
    ]);
    expect(dialog()!.querySelector('[aria-current="step"]')?.textContent).toContain('Processing');

    later(2 * RENEWAL_STEP_MS);
    await open('/cars/102');
    expect(dialog()!.textContent).toContain('Your new roadworthiness has been delivered');
    expect(dialog()!.textContent).toContain('New expiry date');
    // The new paper is on the car: a year on from its old expiry date (4 Nov 2026).
    expect([...dialog()!.querySelectorAll('.dr-doc')][2]!.textContent).toContain('4 Nov 2027');
  });

  it('switches Home and My cars to the renewal in progress', async () => {
    ada().walletBalance = 50_000;
    await open('/cars/102/renew/licence');
    await click('Pay ₦18,500');
    await vi.waitFor(() => expect(text()).toContain('Your vehicle licence renewal is paid'));

    await open('/');
    const alert = body().querySelector('.alert-card')!;
    expect(alert.textContent).toContain('Renewal in progress');
    expect(alert.textContent).toContain('Your Ford Edge licence is being renewed');
    expect(alert.textContent).toContain("EKY 219 GD · Paid. We'll email you at each step.");
    expect(button('Track renewal', alert).getAttribute('href')).toBe('/cars/102');

    await open('/cars');
    const card = [...body().querySelectorAll('.car')].find((c) =>
      c.textContent?.includes('EKY 219 GD'),
    )!;
    expect(button('Track renewal', card).getAttribute('href')).toBe('/cars/102');
    expect(card.textContent).not.toContain('Renew licence');
  });

  it('sends a wallet that ran short to the card, saying why', async () => {
    await open('/cars/102/renew/roadworthiness');
    expect(radio('wallet').checked).toBe(true);
    ada().walletBalance = 1_000; // Spent elsewhere since the page loaded.

    await click('Pay ₦6,500');
    await vi.waitFor(() =>
      expect(text()).toContain('Not enough in your wallet. Pay by card or bank transfer instead.'),
    );
    expect(radio('card').checked).toBe(true);
    await vi.waitFor(() => expect(text()).toContain('₦1,000 available. Not enough'));
    expect(radio('wallet').disabled).toBe(true);
    expect(ada().renewals).toHaveLength(0);
  });

  it('asks for a delivery address and saves a new one to the profile', async () => {
    await open('/cars/102/renew/roadworthiness');
    await type('Delivery address', '');
    await click('Pay ₦6,500');
    expect(text()).toContain('Enter the address we should deliver to.');
    expect(document.activeElement).toBe(field('Delivery address'));
    expect(ada().renewals).toHaveLength(0);

    await type('Delivery address', '2 Awolowo Road, Ikoyi, Lagos');
    await click('Pay ₦6,500');
    await vi.waitFor(() => expect(text()).toContain('Your roadworthiness renewal is paid'));
    expect(ada().user.address).toBe('2 Awolowo Road, Ikoyi, Lagos');
    expect(useSessionStore().user?.address).toBe('2 Awolowo Road, Ikoyi, Lagos');
    expect(ada().renewals[0]!.delivery_address).toBe('2 Awolowo Road, Ikoyi, Lagos');
  });

  it('shows where a renewal is instead of asking to pay again', async () => {
    ada().walletBalance = 50_000;
    await open('/cars/101/renew/insurance');
    await click('Pay ₦15,000');
    await vi.waitFor(() => expect(text()).toContain('Your insurance renewal is paid'));

    await open('/cars/101/renew/insurance');
    expect(text()).toContain('Your insurance renewal is paid');
    expect(text()).not.toContain('Pay with');
  });

  it("can't find a paper that isn't one", async () => {
    await open('/cars/102/renew/tyres');
    expect(text()).toContain("We couldn't find this paper");
  });
});

describe('Request renewal', () => {
  it('asks the team to quote for comprehensive cover', async () => {
    await open('/cars/102/renew/insurance');
    expect(text()).toContain('Ask us to renew it');
    expect(text()).toContain('Insurance renewal, comprehensiveQuoted by our team');
    expect(text()).toContain(
      "Comprehensive cover is priced on your car's value, so our team will give you a price when they call.",
    );
    expect(body().querySelector('input[name="renew-pay"]')).toBeNull();
    await click('Request renewal');
    expect(text()).toContain("We've got your request");
    expect(text()).toContain(
      'Our team will call you on +234 803 555 0142 to give you a price for your insurance, take payment and arrange delivery.',
    );
  });

  describe('with the renewals API off', () => {
    beforeEach(() => {
      testFlags.renewals = false;
    });

    it('records the request and tells the driver the team will call', async () => {
      const renewalCalls: string[] = [];
      server.events.on('request:start', ({ request }) => {
        if (request.url.includes('/renewals')) renewalCalls.push(request.url);
      });

      await open('/');
      await click('Renew licence · ₦18,500');
      await vi.waitFor(() => expect(text()).toContain('Ask us to renew it'));
      expect(text()).toContain("You'll pay when our team calls. Nothing is charged now.");
      expect(text()).toContain("We'll call you on +234 803 555 0142.");
      await click('Request renewal');

      expect(text()).toContain("We've got your request");
      expect(text()).toContain(
        'Our team will call you on +234 803 555 0142 to take payment and arrange delivery.',
      );
      expect(requestStore().list(ada().user.id)).toMatchObject([
        { vehicleId: 102, kind: 'vehicle_license', price: 18_500, expiryAtRequest: '2026-09-29' },
      ]);

      await open('/');
      const alert = body().querySelector('.alert-card')!;
      expect(alert.textContent).toContain('Renewal requested');
      expect(alert.textContent).toContain("We're arranging your Ford Edge licence renewal");
      expect(button('See request', alert).getAttribute('href')).toBe('/cars/102');

      await open('/cars/102');
      expect(dialog()!.textContent).toContain("We've got your request");
      expect([...dialog()!.querySelectorAll('.dr-doc')][0]!.textContent).toContain(
        'Renewal requested',
      );
      // Nothing went to the renewals API.
      expect(renewalCalls).toEqual([]);
    });

    it('asks for a phone number when the account has none, and saves it', async () => {
      ada().user.phone = null;
      const session = useSessionStore();
      session.setUser({ ...session.user!, phone: null });

      await open('/cars/102/renew/licence');
      await click('Request renewal');
      expect(text()).toContain('Enter your phone number.');
      await type('Phone number', '0803 555 0199');
      await click('Request renewal');
      await vi.waitFor(() => expect(text()).toContain("We've got your request"));
      expect(text()).toContain('Our team will call you on +234 803 555 0199');
      expect(ada().user.phone).toBe('+2348035550199');
    });
  });
});

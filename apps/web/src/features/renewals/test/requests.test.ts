import { describe, expect, it, vi } from 'vitest';
import { car } from '@/features/cars/test/fixtures';
import { createIntentStore } from '@/features/payments/lib/intent';
import { navigation } from '@/features/payments/lib/checkout';
import { paystackReference, renewByCard, renewFromWallet, type RenewOrder } from '../lib/actions';
import { createRequestStore, isOpenRequest, openRequestFor } from '../lib/requests';
import { memoryStorage, renewal, request, TODAY } from './fixtures';

describe('renewal requests (Request renewal)', () => {
  it('keeps one request per paper on each car, per driver', () => {
    const storage = memoryStorage();
    const store = createRequestStore(storage);
    store.add(1, request());
    store.add(1, request({ kind: 'insurance' }));
    store.add(1, request({ deliveryAddress: '2 Awolowo Road, Ikoyi, Lagos' }));
    store.add(2, request({ vehicleId: 9 }));

    expect(store.list(1).map((r) => [r.kind, r.deliveryAddress])).toEqual([
      ['vehicle_license', '2 Awolowo Road, Ikoyi, Lagos'],
      ['insurance', '14 Admiralty Way, Lekki Phase 1, Lagos'],
    ]);
    expect(store.list(2)).toHaveLength(1);
    // It's in storage, so it survives a reload.
    expect(createRequestStore(storage).list(1)).toHaveLength(2);

    store.forget(1, 102, 'insurance');
    expect(store.list(1).map((r) => r.kind)).toEqual(['vehicle_license']);
  });

  it("ignores storage it can't read", () => {
    const storage = memoryStorage();
    storage.setItem('motopapers:renewal-requests:1', '{"not":"a list"}');
    expect(createRequestStore(storage).list(1)).toEqual([]);
    storage.setItem('motopapers:renewal-requests:1', JSON.stringify([{ vehicleId: 'x' }]));
    expect(createRequestStore(storage).list(1)).toEqual([]);
  });

  it('works without storage, for as long as the page is open', () => {
    const store = createRequestStore(null);
    store.add(1, request());
    expect(store.list(1)).toHaveLength(1);
  });

  it('stands until the paper gets a new date, the car goes, or 30 days pass', () => {
    const cars = [{ ...car(102, { licence: -13 }), id: 102 }];
    const asked = request({ expiryAtRequest: cars[0]!.vehicle_license!.expiry_date });
    expect(isOpenRequest(asked, cars, TODAY)).toBe(true);
    expect(openRequestFor([asked], cars, 102, 'vehicle_license', TODAY)).toBe(asked);

    const renewed = [
      { ...cars[0]!, vehicle_license: { ...cars[0]!.vehicle_license!, expiry_date: '2027-10-01' } },
    ];
    expect(isOpenRequest(asked, renewed, TODAY)).toBe(false);
    expect(isOpenRequest(asked, [], TODAY)).toBe(false);
    expect(isOpenRequest({ ...asked, requestedAt: '2026-09-01T09:00:00Z' }, cars, TODAY)).toBe(
      false,
    );
  });
});

describe('starting a renewal', () => {
  const order: RenewOrder = {
    vehicleId: 102,
    plate: 'EKY 219 GD',
    kind: 'vehicle_license',
    amount: 18_500,
    deliveryAddress: '14 Admiralty Way, Lekki Phase 1, Lagos',
    returnTo: '/cars/102/renew/licence',
  };

  it('pays from the wallet with the paper and delivery address', async () => {
    const create = vi.fn().mockResolvedValue({ renewal: renewal() });
    await expect(renewFromWallet(order, create)).resolves.toEqual(renewal());
    expect(create).toHaveBeenCalledWith(102, {
      document_type: 'vehicle_license',
      pay_with: 'wallet',
      delivery_address: '14 Admiralty Way, Lekki Phase 1, Lagos',
    });
  });

  it('pays by card: remembers what the payment is for, then goes to Paystack', async () => {
    const assign = vi.spyOn(navigation, 'assign').mockImplementation(() => {});
    const storage = memoryStorage();
    const store = createIntentStore(storage, () => 1_000);
    const create = vi.fn().mockResolvedValue({
      renewal: renewal({ status: 'awaiting_payment' }),
      auth_url: 'https://checkout.paystack.com/abc123',
      reference: 'MOT-1',
    });

    await renewByCard(order, { create, store, now: () => 1_000 });

    expect(create).toHaveBeenCalledWith(102, {
      document_type: 'vehicle_license',
      pay_with: 'card',
      delivery_address: order.deliveryAddress,
    });
    expect(store.recall('MOT-1')).toEqual({
      kind: 'other',
      label: 'Licence renewal · EKY 219 GD',
      returnTo: '/cars/102/renew/licence',
      returnLabel: 'Track your renewal',
      reference: 'MOT-1',
      amount: 18_500,
      createdAt: 1_000,
    });
    expect(assign).toHaveBeenCalledWith('https://checkout.paystack.com/abc123');
    assign.mockRestore();
  });

  it("doesn't leave when the API sends no checkout page", async () => {
    const assign = vi.spyOn(navigation, 'assign').mockImplementation(() => {});
    const create = vi.fn().mockResolvedValue({ renewal: renewal() });
    await expect(
      renewByCard(order, { create, store: createIntentStore(memoryStorage()) }),
    ).rejects.toThrow('Paystack sent no checkout page.');
    expect(assign).not.toHaveBeenCalled();
    assign.mockRestore();
  });

  it("finds Paystack's reference in the response, or in its return address", () => {
    expect(
      paystackReference({ renewal: renewal(), auth_url: 'https://x.test', reference: 'A' }),
    ).toBe('A');
    expect(
      paystackReference({
        renewal: renewal(),
        auth_url: 'https://app.test/payments/callback?reference=MOT-9&trxref=MOT-9',
      }),
    ).toBe('MOT-9');
    expect(
      paystackReference({ renewal: renewal(), auth_url: 'https://checkout.paystack.com/x' }),
    ).toBeNull();
    expect(paystackReference({ renewal: renewal() })).toBeNull();
  });
});

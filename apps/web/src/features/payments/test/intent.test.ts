import type { Vehicle } from '@motopapers/api';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyDraft } from '../../cars/add/draft';
import type { CarApi } from '../../cars/add/saveCar';
import { newProgress, saveCar } from '../../cars/add/saveCar';
import { resumableCarApi } from '../addCar/resumableCarApi';
import { navigation, payOnPaystack } from '../lib/checkout';
import { createIntentStore, INTENTS_KEY, type AddCarIntent } from '../lib/intent';

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    data,
  };
}

const NOW = Date.UTC(2026, 9, 12, 9);

function carIntent(overrides: Partial<AddCarIntent> = {}): AddCarIntent {
  const draft = emptyDraft();
  draft.car.plate_number = 'KTU 604 XR';
  return {
    kind: 'add-car',
    reference: 'MOT-car',
    amount: 2_500,
    createdAt: NOW,
    returnTo: '/cars/new',
    draft,
    ...overrides,
  };
}

afterEach(() => vi.restoreAllMocks());

describe('payment intents', () => {
  it('remembers what a payment is for under its reference', () => {
    const store = createIntentStore(memoryStorage(), () => NOW);
    store.remember({
      kind: 'top-up',
      reference: 'MOT-1',
      amount: 20_000,
      createdAt: NOW,
      returnTo: '/payments',
    });
    expect(store.recall('MOT-1')).toMatchObject({ kind: 'top-up', amount: 20_000 });
    expect(store.recall('MOT-2')).toBeNull();
    store.forget('MOT-1');
    expect(store.recall('MOT-1')).toBeNull();
  });

  it('drops intents older than a week, and anything that is not an intent', () => {
    const storage = memoryStorage();
    storage.setItem(
      INTENTS_KEY,
      JSON.stringify({
        old: { kind: 'top-up', reference: 'old', amount: 1, createdAt: 0, returnTo: '/' },
        junk: { kind: 'top-up', reference: 'junk' },
        car: { kind: 'add-car', reference: 'car', amount: 1, createdAt: NOW, returnTo: '/' },
      }),
    );
    const store = createIntentStore(storage, () => NOW);
    expect(store.recall('old')).toBeNull();
    expect(store.recall('junk')).toBeNull();
    expect(store.recall('car')).toBeNull(); // no draft
  });

  it('survives storage that is broken or missing', () => {
    const storage = memoryStorage();
    storage.setItem(INTENTS_KEY, '{not json');
    expect(createIntentStore(storage).recall('x')).toBeNull();
    const none = createIntentStore(null);
    none.remember(carIntent());
    expect(none.recall('MOT-car')).toBeNull();
  });

  it('lists cars paid for by card that still need finishing, newest first', () => {
    const store = createIntentStore(memoryStorage(), () => NOW);
    store.remember(carIntent({ reference: 'a', createdAt: NOW - 2000 }));
    store.remember(carIntent({ reference: 'b', createdAt: NOW - 1000 }));
    store.remember(carIntent({ reference: 'done', done: true }));
    store.remember(carIntent({ reference: 'failed', failed: true }));
    expect(store.unfinishedCars().map((i) => i.reference)).toEqual(['b', 'a']);
    store.update('a', (i) => ({ ...i, done: true }));
    expect(store.unfinishedCars().map((i) => i.reference)).toEqual(['b']);
  });
});

describe('payOnPaystack', () => {
  it('remembers the intent before sending the driver to Paystack', async () => {
    const store = createIntentStore(memoryStorage(), () => NOW);
    const initialize = vi.fn().mockResolvedValue({
      auth_url: 'https://checkout.paystack.com/abc',
      reference: 'MOT-9',
    });
    const assign = vi.spyOn(navigation, 'assign').mockImplementation(() => {
      // By the time we leave, the return page must be able to find what this was for.
      expect(store.recall('MOT-9')).toMatchObject({ kind: 'top-up', amount: 5_000 });
    });

    await payOnPaystack(
      {
        amount: 5_000,
        category: 'wallet_transaction',
        intent: { kind: 'top-up', returnTo: '/payments' },
      },
      { initialize, store, now: () => NOW },
    );

    expect(initialize).toHaveBeenCalledWith({
      amount: 5_000,
      transaction_category: 'wallet_transaction',
    });
    expect(assign).toHaveBeenCalledWith('https://checkout.paystack.com/abc');
    expect(store.recall('MOT-9')).toEqual({
      kind: 'top-up',
      returnTo: '/payments',
      reference: 'MOT-9',
      amount: 5_000,
      createdAt: NOW,
    });
  });

  it("doesn't leave or remember anything when Paystack can't be reached", async () => {
    const store = createIntentStore(memoryStorage(), () => NOW);
    const assign = vi.spyOn(navigation, 'assign').mockImplementation(() => {});
    const initialize = vi.fn().mockRejectedValue(new Error('down'));
    await expect(
      payOnPaystack(
        { amount: 100, category: 'wallet_transaction', intent: { kind: 'top-up', returnTo: '/' } },
        { initialize, store },
      ),
    ).rejects.toThrow('down');
    expect(assign).not.toHaveBeenCalled();
  });

  it('refuses an address that is not a web page', async () => {
    const assign = vi.spyOn(navigation, 'assign').mockImplementation(() => {});
    const initialize = vi
      .fn()
      .mockResolvedValue({ auth_url: 'javascript:alert(1)', reference: 'x' });
    await expect(
      payOnPaystack(
        { amount: 100, category: 'wallet_transaction', intent: { kind: 'top-up', returnTo: '/' } },
        { initialize, store: createIntentStore(memoryStorage()) },
      ),
    ).rejects.toThrow();
    expect(assign).not.toHaveBeenCalled();
  });
});

describe('resumableCarApi', () => {
  const vehicle = { id: 77, plate_number: 'KTU 604 XR' } as Vehicle;

  function fakeApi() {
    // Only the ids matter here: the saved records are read back by id.
    const paper = (id: number) => ({ id }) as never;
    return {
      createVehicle: vi.fn<CarApi['createVehicle']>().mockResolvedValue(vehicle),
      createVehicleLicense: vi.fn<CarApi['createVehicleLicense']>().mockResolvedValue(paper(1)),
      createInsurance: vi.fn<CarApi['createInsurance']>().mockResolvedValue(paper(2)),
      createRoadworthiness: vi.fn<CarApi['createRoadworthiness']>().mockResolvedValue(paper(3)),
    };
  }

  function draftWithPapers() {
    const draft = carIntent().draft;
    Object.assign(draft.car, {
      brand: 'Toyota',
      model: 'Corolla',
      color: 'Grey',
      engine_number: '2ZR',
      chassis_number: '2T1',
      engine_capacity: '1,798 cc',
    });
    draft.licence = { expiry_date: '2027-03-02', license_pin: 'K7Q2' };
    draft.insurance.expiry_date = '2027-04-18';
    draft.roadworthiness.expiry_date = '2027-01-09';
    return draft;
  }

  it('never creates the car or a paper twice, even after a reload', async () => {
    const store = createIntentStore(memoryStorage(), () => NOW);
    const draft = draftWithPapers();
    store.remember(carIntent({ draft }));

    const api = fakeApi();
    api.createInsurance.mockRejectedValueOnce(new Error('insurance down'));
    const first = await saveCar(draft, newProgress(), resumableCarApi('MOT-car', store, api));
    expect(first.failed.map((f) => f.kind)).toEqual(['insurance']);
    expect(store.recall('MOT-car')).toMatchObject({
      saved: { vehicle: { id: 77 }, papers: { vehicle_license: { id: 1 } } },
    });

    // A reload starts with fresh progress: only the insurance is sent again.
    const second = await saveCar(draft, newProgress(), resumableCarApi('MOT-car', store, api));
    expect(second.failed).toEqual([]);
    expect(second.vehicle.id).toBe(77);
    expect(api.createVehicle).toHaveBeenCalledTimes(1);
    expect(api.createVehicleLicense).toHaveBeenCalledTimes(1);
    expect(api.createRoadworthiness).toHaveBeenCalledTimes(1);
    expect(api.createInsurance).toHaveBeenCalledTimes(2);
  });
});

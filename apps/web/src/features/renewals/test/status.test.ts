import { describe, expect, it } from 'vitest';
import { car, TODAY as CARS_TODAY } from '@/features/cars/test/fixtures';
import { homeSummary } from '@/features/home/summary';
import { paperFromSlug, renewalLabel, renewalPrice, PAPER_SLUGS } from '../lib/papers';
import { paperProgress } from '../lib/progress';
import {
  awaitingPaymentFor,
  renewalFor,
  renewalHeadline,
  shownRenewals,
  trackerSteps,
} from '../lib/status';
import { renewal, request, TODAY } from './fixtures';

const states = (status: Parameters<typeof trackerSteps>[0]) =>
  trackerSteps(status).map((s) => `${s.label}:${s.state}`);

describe('tracker', () => {
  it('ticks Paid, then shows the step in progress', () => {
    expect(states('paid')).toEqual([
      'Paid:done',
      'Processing:todo',
      'Out for delivery:todo',
      'Delivered:todo',
    ]);
    expect(states('processing')).toEqual([
      'Paid:done',
      'Processing:current',
      'Out for delivery:todo',
      'Delivered:todo',
    ]);
    expect(states('out_for_delivery')).toEqual([
      'Paid:done',
      'Processing:done',
      'Out for delivery:current',
      'Delivered:todo',
    ]);
    expect(states('delivered')).toEqual([
      'Paid:done',
      'Processing:done',
      'Out for delivery:done',
      'Delivered:done',
    ]);
  });

  it('has nothing done while waiting for payment', () => {
    expect(trackerSteps('awaiting_payment').every((s) => s.state === 'todo')).toBe(true);
  });

  it('says where the renewal is', () => {
    expect(renewalHeadline('processing', 'insurance')).toBe("We're renewing your insurance");
    expect(renewalHeadline('out_for_delivery', 'vehicle_license')).toBe(
      'Your new vehicle licence is on its way',
    );
  });
});

describe('which renewals show', () => {
  it('shows the newest renewal for each paper: in progress, or delivered in the last two weeks', () => {
    const list = [
      renewal({ id: 1, status: 'delivered', updated_at: '2026-09-01T10:00:00Z' }),
      renewal({ id: 2, status: 'processing', created_at: '2026-10-10T10:00:00Z' }),
      renewal({
        id: 3,
        document_type: 'insurance',
        status: 'delivered',
        updated_at: '2026-10-05T10:00:00Z',
      }),
      renewal({ id: 4, document_type: 'roadworthiness', status: 'cancelled' }),
      renewal({ id: 5, vehicle_id: 101, status: 'awaiting_payment' }),
    ];
    expect(shownRenewals(list, TODAY).map((r) => r.id)).toEqual([3, 2]);
    expect(renewalFor(list, 102, 'vehicle_license', TODAY)?.id).toBe(2);
    expect(renewalFor(list, 102, 'roadworthiness', TODAY)).toBeUndefined();
  });

  it("doesn't let a newer unpaid renewal hide one in progress", () => {
    const list = [
      renewal({ id: 1, status: 'paid', created_at: '2026-10-11T10:00:00Z' }),
      renewal({ id: 2, status: 'awaiting_payment', created_at: '2026-10-12T08:00:00Z' }),
    ];
    expect(renewalFor(list, 102, 'vehicle_license', TODAY)?.id).toBe(1);
  });

  it('warns about a card payment still being confirmed, from the last day only', () => {
    const fresh = renewal({ id: 7, status: 'awaiting_payment' });
    const old = renewal({
      id: 8,
      status: 'awaiting_payment',
      created_at: '2026-10-01T08:00:00Z',
      updated_at: '2026-10-01T08:00:00Z',
    });
    expect(awaitingPaymentFor([old, fresh], 102, 'vehicle_license', TODAY)?.id).toBe(7);
    expect(awaitingPaymentFor([old], 102, 'vehicle_license', TODAY)).toBeUndefined();
  });
});

describe('papers being renewed', () => {
  it('lists renewals in progress and open requests, once per paper', () => {
    const progress = paperProgress(
      [
        renewal({ id: 1, status: 'out_for_delivery' }),
        renewal({ id: 2, document_type: 'insurance', status: 'delivered' }),
      ],
      [request(), request({ kind: 'roadworthiness' })],
      TODAY,
    );
    expect(progress).toEqual([
      { vehicleId: 102, kind: 'vehicle_license', status: 'out_for_delivery' },
      { vehicleId: 102, kind: 'roadworthiness', status: 'requested' },
    ]);
  });

  it('leads Home with a renewal in progress, unless another paper has expired', () => {
    const cars = [car(1, { licence: -13, insurance: 237, road: 23 }), car(2, { insurance: 9 })];
    const renewing = [
      { vehicleId: 1, kind: 'vehicle_license' as const, status: 'processing' as const },
    ];
    const s = homeSummary(cars, CARS_TODAY, renewing);
    expect(s.alert).toMatchObject({ kind: 'renewing', vehicle: { id: 1 }, progress: renewing[0] });

    const another = homeSummary(
      [...cars, car(3, { licence: -2, insurance: 100, road: 100 })],
      CARS_TODAY,
      renewing,
    );
    expect(another.alert).toMatchObject({ kind: 'expired', vehicle: { id: 3 } });
  });
});

describe('renewal papers and prices', () => {
  const pricing = {
    tracking_fee: 2_500,
    renewal: { vehicle_license: 18_500, insurance_third_party: 15_000, roadworthiness: 6_500 },
  };

  it('reads the paper from the address', () => {
    expect(paperFromSlug('licence')).toBe('vehicle_license');
    expect(paperFromSlug(['roadworthiness'])).toBe('roadworthiness');
    expect(paperFromSlug('vehicle_license')).toBeNull();
    expect(PAPER_SLUGS.insurance).toBe('insurance');
  });

  it('prices each paper, and leaves comprehensive cover to the team', () => {
    expect(renewalPrice(pricing, 'vehicle_license', null)).toBe(18_500);
    expect(renewalPrice(pricing, 'insurance', 'third_party')).toBe(15_000);
    expect(renewalPrice(pricing, 'insurance', 'comprehensive')).toBeNull();
    expect(renewalPrice(pricing, 'roadworthiness', null)).toBe(6_500);
    expect(renewalPrice(undefined, 'roadworthiness', null)).toBeUndefined();
  });

  it('labels the payment for the receipt', () => {
    expect(renewalLabel('insurance', 'KJA 731 AE')).toBe('Insurance renewal · KJA 731 AE');
  });
});

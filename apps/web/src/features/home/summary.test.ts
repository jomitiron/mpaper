import type { Transaction } from '@motopapers/api';
import { describe, expect, it } from 'vitest';
import { car, TODAY } from '@/features/cars/test/fixtures';
import { activityRow } from './activity';
import { homeSummary } from './summary';

describe('Home summary', () => {
  it('leads with the most overdue paper', () => {
    const s = homeSummary(
      [
        car(1, { licence: 154, insurance: 9, road: 114 }),
        car(2, { licence: -13, insurance: 237, road: 23 }),
        car(3, { licence: -2, insurance: 100, road: 100 }),
      ],
      TODAY,
    );
    expect(s.alert).toMatchObject({ kind: 'expired', vehicle: { id: 2 }, others: 1 });
    expect(s.alert.kind === 'expired' && s.alert.paper.kind).toBe('vehicle_license');
  });

  it('falls back to the soonest due paper, then papers to add, then all good', () => {
    expect(
      homeSummary([car(1, { licence: 154, insurance: 9, road: 23 })], TODAY).alert,
    ).toMatchObject({ kind: 'due', paper: { kind: 'insurance', daysLeft: 9 } });
    expect(homeSummary([car(1, { licence: 80 })], TODAY).alert).toEqual({
      kind: 'missing',
      count: 2,
    });
    expect(homeSummary([car(1, { licence: 80, insurance: 90, road: 100 })], TODAY).alert).toEqual({
      kind: 'calm',
    });
    expect(homeSummary([], TODAY).alert).toEqual({ kind: 'empty' });
  });

  it('counts valid papers out of every paper slot', () => {
    const s = homeSummary(
      [car(1, { licence: 154, insurance: 9, road: 114 }), car(2, { licence: 80 })],
      TODAY,
    );
    expect(s.validPapers).toBe(3);
    expect(s.totalPapers).toBe(6);
  });

  it('shows the next four papers to run out, leaving out expired and untracked ones', () => {
    const s = homeSummary(
      [
        car(1, { licence: 154, insurance: 9, road: 114 }),
        car(2, { licence: -13, insurance: 237, road: 23 }),
        car(3, { licence: 80 }),
      ],
      TODAY,
    );
    expect(s.comingUp.map((p) => [p.vehicle.id, p.paper.kind, p.paper.daysLeft])).toEqual([
      [1, 'insurance', 9],
      [2, 'roadworthiness', 23],
      [3, 'vehicle_license', 80],
      [1, 'roadworthiness', 114],
    ]);
  });
});

describe('Recent activity rows', () => {
  const vehicles = [car(102, {}, { plate_number: 'EKY 219 GD' })];
  const tx = (fields: Partial<Transaction>): Transaction => ({
    id: 1,
    amount: 18_500,
    status: 'success',
    reference: 'T1',
    transaction_type: 'debit',
    created_at: '2026-10-11T10:15:00.000Z',
    payment: null,
    ...fields,
  });

  it('uses the labels when the backend sends them', () => {
    const row = activityRow(
      tx({
        status: 'pending',
        category: 'renewal',
        description: 'Licence renewal',
        vehicle_id: 102,
        document_type: 'vehicle_license',
      }),
      vehicles,
      true,
    );
    expect(row).toMatchObject({
      title: 'Licence renewal',
      sub: 'EKY 219 GD · 11 Oct · Pending',
      icon: 'vehicle_license',
      amount: '−₦18,500',
      tone: '',
    });
  });

  it('labels by money in or out without them', () => {
    const topUp = activityRow(
      tx({
        transaction_type: 'credit',
        amount: 20_000,
        category: 'wallet_topup',
        payment: { id: 1, amount: 20_000, status: 'success', reference: 'MOT-1' },
      }),
      vehicles,
      false,
    );
    expect(topUp).toMatchObject({
      title: 'Wallet top-up',
      sub: 'Paystack · 11 Oct',
      icon: 'topup',
      amount: '+₦20,000',
      tone: 'in',
    });
    expect(activityRow(tx({ vehicle_id: 102 }), vehicles, false)).toMatchObject({
      title: 'Payment',
      sub: 'Wallet · 11 Oct',
      icon: 'service',
    });
  });

  it('strikes through failed payments', () => {
    const row = activityRow(
      tx({ transaction_type: 'credit', amount: 10_000, status: 'failed' }),
      vehicles,
      false,
    );
    expect(row.tone).toBe('void');
    expect(row.sub).toBe('11 Oct · Failed');
  });
});

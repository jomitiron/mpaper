import type { Vehicle } from '@motopapers/api';
import { describe, expect, it } from 'vitest';
import { groupByMonth, paidThisYear, paymentRow, paymentTitle } from '../lib/rows';
import { payment, tx } from './fixtures';

const EKY = { id: 102, plate_number: 'EKY 219 GD' } as Vehicle;

const licenceRenewal = tx({
  id: 906,
  amount: 18_500,
  status: 'pending',
  transaction_type: 'debit',
  category: 'renewal',
  description: 'Licence renewal',
  vehicle_id: 102,
  document_type: 'vehicle_license',
  created_at: '2026-10-11T10:15:00.000Z',
});

describe('a payment as a row', () => {
  it('says what it was for and which car, with transaction labels', () => {
    const row = paymentRow(licenceRenewal, [EKY], true);
    expect(row).toMatchObject({
      title: 'Licence renewal',
      sub: 'EKY 219 GD',
      icon: 'vehicle_license',
      status: { label: 'Pending', tone: 'warn' },
      amount: '−₦18,500',
      tone: '',
      date: '11 Oct 2026',
      action: 'check',
    });
  });

  it('falls back to money in or out without labels (api-gaps.md)', () => {
    const row = paymentRow(licenceRenewal, [EKY], false);
    expect(row).toMatchObject({ title: 'Payment', sub: 'Paystack', icon: 'payment' });
    const topUp = paymentRow(tx({ transaction_type: 'credit' }), [], false);
    expect(topUp).toMatchObject({ title: 'Wallet top-up', icon: 'topup', amount: '+₦20,000' });
  });

  it('names a category when there is no description', () => {
    const fee = tx({ transaction_type: 'debit', category: 'service_charge', description: null });
    expect(paymentTitle(fee, true)).toBe('Tracking and reminders');
    expect(paymentRow(fee, [], true).icon).toBe('service');
  });

  it('shows a paid top-up as money in', () => {
    const row = paymentRow(tx({ status: 'success', transaction_type: 'credit' }), [], true);
    expect(row).toMatchObject({
      status: { label: 'Paid', tone: 'ok' },
      amount: '+₦20,000',
      tone: 'in',
      action: null,
    });
  });

  it('crosses out failed and reversed payments; Retry is for failed top-ups only', () => {
    const failedTopUp = paymentRow(tx({ status: 'failed', transaction_type: 'credit' }), [], true);
    expect(failedTopUp).toMatchObject({
      status: { label: 'Failed', tone: 'bad' },
      tone: 'void',
      action: 'retry',
    });
    const failedRenewal = paymentRow({ ...licenceRenewal, status: 'failed' }, [EKY], true);
    expect(failedRenewal).toMatchObject({ tone: 'void', action: null });
    const reversed = paymentRow(tx({ status: 'reversed' }), [], true);
    expect(reversed).toMatchObject({
      status: { label: 'Reversed', tone: 'idle' },
      tone: 'void',
      action: null,
    });
  });

  it('keeps an unknown status readable', () => {
    expect(paymentRow(tx({ status: 'abandoned' }), [], true).status).toEqual({
      label: 'Abandoned',
      tone: 'idle',
    });
  });

  it("shows Paystack's reference, or the wallet transaction's own", () => {
    expect(paymentRow(tx({ payment: payment({ reference: 'MOT-abc' }) }), [], true).reference).toBe(
      'MOT-abc',
    );
    const fromWallet = tx({ payment: null, reference: 'T0042', transaction_type: 'debit' });
    expect(paymentRow(fromWallet, [], false)).toMatchObject({ reference: 'T0042', sub: 'Wallet' });
  });
});

describe('groupByMonth', () => {
  it('groups newest first under the month they were made', () => {
    const groups = groupByMonth([
      { id: 1, created_at: '2026-10-11T10:15:00.000Z' },
      { id: 2, created_at: '2026-10-02T10:15:00.000Z' },
      { id: 3, created_at: '2026-09-27T10:15:00.000Z' },
      { id: 4, created_at: '2026-04-05T10:15:00.000Z' },
    ]);
    expect(groups.map((g) => [g.label, g.items.map((i) => i.id)])).toEqual([
      ['October 2026', [1, 2]],
      ['September 2026', [3]],
      ['April 2026', [4]],
    ]);
    expect(groups.map((g) => g.key)).toEqual(['2026-10', '2026-09', '2026-04']);
  });

  it('uses the Lagos date for timestamps with a zone, and zone-less ones as written', () => {
    const groups = groupByMonth([
      // 23:30 UTC on 30 Sep is 00:30 on 1 Oct in Lagos.
      { id: 1, created_at: '2026-09-30T23:30:00.000Z' },
      // How the real API sends them (no zone).
      { id: 2, created_at: '2025-02-16T22:40:29.231895' },
    ]);
    expect(groups.map((g) => g.label)).toEqual(['October 2026', 'February 2025']);
  });

  it('keeps a month together if it shows up again further down', () => {
    const groups = groupByMonth([
      { id: 1, created_at: '2026-10-11' },
      { id: 2, created_at: '2026-09-11' },
      { id: 3, created_at: '2026-10-01' },
    ]);
    expect(groups.map((g) => g.items.map((i) => i.id))).toEqual([[1, 3], [2]]);
  });

  it('gives nothing for no payments', () => {
    expect(groupByMonth([])).toEqual([]);
  });
});

describe('paidThisYear', () => {
  const list = [
    tx({ id: 1, amount: 6_500, transaction_type: 'debit', category: 'renewal' }),
    tx({ id: 2, amount: 5_000, transaction_type: 'debit', category: 'service_charge' }),
    tx({ id: 3, amount: 20_000, transaction_type: 'credit', category: 'wallet_topup' }),
    tx({
      id: 4,
      amount: 18_500,
      transaction_type: 'debit',
      category: 'renewal',
      status: 'pending',
    }),
    tx({
      id: 5,
      amount: 9_000,
      transaction_type: 'debit',
      category: 'renewal',
      created_at: '2025-12-31T10:00:00.000Z',
    }),
  ];

  it('adds up paid renewals this year, with labels', () => {
    expect(paidThisYear(list, '2026', true)).toBe(6_500);
  });

  it('adds up every paid payment out this year, without labels', () => {
    expect(paidThisYear(list, '2026', false)).toBe(11_500);
  });
});

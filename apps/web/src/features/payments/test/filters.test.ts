import { describe, expect, it } from 'vitest';
import {
  filterCounts,
  filteredByApi,
  filterQuery,
  isTopUp,
  matchesFilter,
  PAYMENT_FILTERS,
  parseFilter,
  type PaymentFilter,
} from '../lib/filters';
import { page, tx } from './fixtures';

const topUp = tx({ id: 1, transaction_type: 'credit', category: 'wallet_topup' });
const renewal = tx({ id: 2, transaction_type: 'debit', category: 'renewal', status: 'pending' });
const trackingFee = tx({ id: 3, transaction_type: 'debit', category: 'service_charge' });

describe('filter → GET /transactions query', () => {
  it.each<[PaymentFilter, object]>([
    ['all', {}],
    ['topups', {}],
    ['renewals', {}],
    ['pending', { status: 'pending' }],
  ])('%s asks for %j', (filter, query) => {
    expect(filterQuery(filter)).toEqual(query);
  });

  it('says which filters the API does and which are picked out of each page', () => {
    expect(PAYMENT_FILTERS.map((f) => [f.key, filteredByApi(f.key)])).toEqual([
      ['all', true],
      ['topups', false],
      ['renewals', false],
      ['pending', true],
    ]);
  });

  it('reads ?filter= from the address, and anything unknown is All', () => {
    expect(parseFilter('pending')).toBe('pending');
    expect(parseFilter(['topups'])).toBe('topups');
    expect(parseFilter('cars')).toBe('all');
    expect(parseFilter(undefined)).toBe('all');
  });
});

describe('matching payments to a filter', () => {
  it('uses the category with transaction labels', () => {
    expect(matchesFilter(topUp, 'topups', true)).toBe(true);
    expect(matchesFilter(renewal, 'topups', true)).toBe(false);
    expect(matchesFilter(renewal, 'renewals', true)).toBe(true);
    // The design's Renewals chip covers every payment out, the tracking fee included.
    expect(matchesFilter(trackingFee, 'renewals', true)).toBe(true);
    expect(matchesFilter(renewal, 'pending', true)).toBe(true);
    expect(matchesFilter(topUp, 'pending', true)).toBe(false);
    expect([topUp, renewal, trackingFee].every((t) => matchesFilter(t, 'all', true))).toBe(true);
  });

  it('uses credit or debit without labels (api-gaps.md)', () => {
    const credit = tx({ transaction_type: 'credit', category: undefined });
    const debit = tx({ transaction_type: 'debit', category: undefined });
    expect(isTopUp(credit, false)).toBe(true);
    expect(isTopUp(debit, false)).toBe(false);
    // With the flag off, a category the API happens to send is ignored.
    expect(isTopUp(tx({ transaction_type: 'credit', category: 'renewal' }), false)).toBe(true);
  });
});

describe('chip counts', () => {
  it('counts every chip once every payment is loaded', () => {
    expect(
      filterCounts(
        { pages: [page([topUp, renewal, trackingFee])], complete: true, pending: 1 },
        true,
      ),
    ).toEqual({ all: 3, pending: 1, topups: 1, renewals: 2 });
  });

  it("leaves Top-ups and Renewals off when there's more to load, rather than guess", () => {
    expect(
      filterCounts(
        {
          pages: [page([topUp, renewal], { total: 45, page_count: 3 })],
          complete: false,
          pending: 4,
        },
        true,
      ),
    ).toEqual({ all: 45, pending: 4 });
  });

  it('shows nothing before the list loads', () => {
    expect(filterCounts({ pages: null, complete: false }, true)).toEqual({
      all: undefined,
      pending: undefined,
    });
  });
});

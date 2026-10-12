import { describe, expect, it } from 'vitest';
import { countByFilter, filterCars, matchesSearch, parseCarFilter, searchKey } from '../lib/filter';
import { summariseCar } from '../lib/papers';
import { car, TODAY } from './fixtures';

const camry = { plate_number: 'KJA 731 AE', brand: 'Toyota', model: 'Camry' };

describe('search', () => {
  it('finds a plate with or without spaces and dashes, in any case', () => {
    for (const q of ['KJA 731 AE', 'kja731ae', 'kja-731', ' 731 ', 'ae']) {
      expect(matchesSearch(camry, q), q).toBe(true);
    }
    expect(matchesSearch(camry, 'KJA 732')).toBe(false);
  });

  it('finds make, model or both together', () => {
    for (const q of ['toyota', 'CAMRY', 'Toyota Camry', 'camry toyota', 'yota cam']) {
      expect(matchesSearch(camry, q), q).toBe(true);
    }
    expect(matchesSearch(camry, 'corolla')).toBe(false);
  });

  it('matches everything when the search is empty', () => {
    expect(matchesSearch(camry, '')).toBe(true);
    expect(matchesSearch(camry, '  - ')).toBe(true);
    expect(searchKey('CR-V 2.0')).toBe('crv20');
  });
});

describe('filters', () => {
  const cars = [
    summariseCar(car(1, { licence: -13, insurance: 237, road: 23 }), TODAY),
    summariseCar(car(2, { licence: 154, insurance: 9, road: 114 }), TODAY),
    summariseCar(car(3, { licence: 80 }), TODAY),
    summariseCar(car(4, { licence: 312, insurance: 103, road: 292 }), TODAY),
    // Expired and missing a paper: counts as needing attention, not as papers to add.
    summariseCar(car(5, { licence: -2 }), TODAY),
  ];

  it('counts each chip', () => {
    expect(countByFilter(cars.map((c) => c.state))).toEqual({
      all: 5,
      attention: 3,
      missing: 1,
      ok: 1,
    });
  });

  it('filters and searches together', () => {
    const ids = (f: Parameters<typeof filterCars>[1], q = '') =>
      filterCars(cars, f, q).map((c) => c.vehicle.id);
    expect(ids('all')).toEqual([1, 2, 3, 4, 5]);
    expect(ids('attention')).toEqual([1, 2, 5]);
    expect(ids('missing')).toEqual([3]);
    expect(ids('ok')).toEqual([4]);
    expect(ids('attention', 'kja 102')).toEqual([2]);
    expect(ids('ok', 'kja 102')).toEqual([]);
  });

  it('reads the filter from the address, falling back to All', () => {
    expect(parseCarFilter('attention')).toBe('attention');
    expect(parseCarFilter(['missing'])).toBe('missing');
    expect(parseCarFilter('nonsense')).toBe('all');
    expect(parseCarFilter(undefined)).toBe('all');
  });
});

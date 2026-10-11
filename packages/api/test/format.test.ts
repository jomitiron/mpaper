import { describe, expect, it } from 'vitest';
import {
  calendarDateOf,
  formatDate,
  formatMonth,
  formatNaira,
  formatShortDate,
  parseNaira,
  plural,
} from '../src/format';
import { findDuplicatePlate, formatPlate, normalisePlate, samePlate } from '../src/plates';

describe('money', () => {
  it('formats naira like the design', () => {
    expect(formatNaira(8500)).toBe('₦8,500');
    expect(formatNaira(1_234_567)).toBe('₦1,234,567');
    expect(formatNaira(0)).toBe('₦0');
  });

  it('signs money in and out with + and a real minus', () => {
    expect(formatNaira(20_000, { sign: true })).toBe('+₦20,000');
    expect(formatNaira(-18_500)).toBe('−₦18,500');
  });

  it('reads typed amounts', () => {
    expect(parseNaira('₦20,000')).toBe(20000);
    expect(parseNaira('')).toBe(0);
  });
});

describe('dates', () => {
  it('formats as "20 Oct 2026"', () => {
    expect(formatDate('2026-10-20')).toBe('20 Oct 2026');
    expect(formatDate('2026-09-02')).toBe('2 Sep 2026');
    expect(formatShortDate('2026-10-20')).toBe('20 Oct');
    expect(formatMonth('2026-10-20')).toBe('October 2026');
  });

  it('shows a zoned timestamp on its Lagos date', () => {
    expect(calendarDateOf('2026-10-10T23:30:00Z')).toBe('2026-10-11');
    expect(calendarDateOf('2026-10-10T23:30:00+01:00')).toBe('2026-10-10');
    expect(formatDate('2026-10-10T23:30:00.000Z')).toBe('11 Oct 2026');
  });

  it('takes a timestamp without a zone as written', () => {
    expect(calendarDateOf('2025-02-16T23:40:29.231895')).toBe('2025-02-16');
  });
});

describe('plural', () => {
  it('counts', () => {
    expect(plural(1, 'car')).toBe('1 car');
    expect(plural(4, 'car')).toBe('4 cars');
    expect(plural(2, 'day')).toBe('2 days');
  });
});

describe('plates', () => {
  it('compares plates without spaces, dashes or case', () => {
    expect(normalisePlate('kja-731 ae')).toBe('KJA731AE');
    expect(samePlate('KJA 731 AE', 'kja731ae')).toBe(true);
    expect(samePlate('KJA 731 AE', 'KJA 731 AF')).toBe(false);
    expect(samePlate('', '')).toBe(false);
  });

  it('formats the standard plate', () => {
    expect(formatPlate('ktu604xr')).toBe('KTU 604 XR');
    expect(formatPlate(' abc-12 ')).toBe('ABC-12');
  });

  it('finds a car already on the account', () => {
    const cars = [
      { id: 1, plate_number: 'KJA 731 AE' },
      { id: 2, plate_number: 'EKY-219-GD' },
    ];
    expect(findDuplicatePlate('eky219gd', cars)?.id).toBe(2);
    expect(findDuplicatePlate('LSD 482 KJ', cars)).toBeUndefined();
  });
});

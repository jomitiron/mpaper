import { describe, expect, it } from 'vitest';
import {
  addDays,
  daysBetween,
  lagosDate,
  needsAttention,
  paperStatus,
  toCalendarDate,
  vehicleStatus,
  worstState,
} from '../src/status';

const TODAY = '2026-10-11';

describe('paperStatus', () => {
  it('is due (not expired) on the expiry date itself', () => {
    expect(paperStatus('2026-10-11', TODAY)).toEqual({
      state: 'due',
      daysLeft: 0,
      expiryDate: '2026-10-11',
    });
  });

  it('is expired the day after', () => {
    expect(paperStatus('2026-10-10', TODAY)).toMatchObject({ state: 'expired', daysLeft: -1 });
  });

  it('is due at exactly 30 days and valid at 31', () => {
    expect(paperStatus('2026-11-10', TODAY)).toMatchObject({ state: 'due', daysLeft: 30 });
    expect(paperStatus('2026-11-11', TODAY)).toMatchObject({ state: 'valid', daysLeft: 31 });
  });

  it('matches the design sample: insurance due in 9 days, licence expired 13 days ago', () => {
    expect(paperStatus('2026-10-20', TODAY)).toMatchObject({ state: 'due', daysLeft: 9 });
    expect(paperStatus('2026-09-28', TODAY)).toMatchObject({ state: 'expired', daysLeft: -13 });
    expect(paperStatus('2027-03-14', TODAY)).toMatchObject({ state: 'valid', daysLeft: 154 });
  });

  it('is not tracked without a date', () => {
    for (const value of [null, undefined, '']) {
      expect(paperStatus(value, TODAY)).toEqual({
        state: 'untracked',
        daysLeft: null,
        expiryDate: null,
      });
    }
  });

  it('treats an impossible or unreadable date as not tracked', () => {
    expect(paperStatus('2026-02-31', TODAY).state).toBe('untracked');
    expect(paperStatus('20/10/2026', TODAY).state).toBe('untracked');
  });

  it('reads the date part of a timestamp as written', () => {
    expect(paperStatus('2026-10-20T00:00:00+01:00', TODAY)).toMatchObject({ daysLeft: 9 });
  });

  it('counts across a leap day', () => {
    expect(paperStatus('2028-03-01', '2028-02-28')).toMatchObject({ daysLeft: 2 });
  });
});

describe('today in Lagos', () => {
  it('rolls over at midnight Lagos time (UTC+1), not UTC or local time', () => {
    expect(lagosDate(new Date('2026-10-10T22:59:59Z'))).toBe('2026-10-10');
    expect(lagosDate(new Date('2026-10-10T23:00:00Z'))).toBe('2026-10-11');
    expect(lagosDate(new Date('2026-10-11T22:59:59Z'))).toBe('2026-10-11');
  });

  it('uses the Lagos date when given an instant', () => {
    // 00:30 on 11 Oct in Lagos, still 10 Oct in UTC, already 12 Oct on this machine (UTC+14).
    const now = new Date('2026-10-10T23:30:00Z');
    expect(paperStatus('2026-10-11', now)).toMatchObject({ state: 'due', daysLeft: 0 });
    expect(paperStatus('2026-10-10', now)).toMatchObject({ state: 'expired', daysLeft: -1 });
  });

  it('parses calendar dates and rejects nonsense', () => {
    expect(toCalendarDate('2026-10-11')).toBe('2026-10-11');
    expect(toCalendarDate(new Date('invalid'))).toBeNull();
    expect(toCalendarDate('soon')).toBeNull();
  });
});

describe('date helpers', () => {
  it('adds days across months and years', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-10-11', -13)).toBe('2026-09-28');
  });

  it('counts days between dates', () => {
    expect(daysBetween('2026-10-11', '2027-10-11')).toBe(365);
    expect(daysBetween('2026-10-11', '2026-10-01')).toBe(-10);
  });
});

describe('vehicleStatus', () => {
  const paper = (expiry_date: string) => ({ expiry_date });

  it('takes the worst paper: expired, then due, then not tracked, then valid', () => {
    expect(worstState(['valid', 'untracked', 'due', 'expired'])).toBe('expired');
    expect(worstState(['valid', 'untracked', 'due'])).toBe('due');
    expect(worstState(['valid', 'untracked'])).toBe('untracked');
    expect(worstState(['valid'])).toBe('valid');
  });

  it('works out each paper and the car overall', () => {
    const status = vehicleStatus(
      {
        vehicle_license: paper('2026-09-28'),
        insurance: paper('2027-06-05'),
        roadworthiness: paper('2026-11-03'),
      },
      TODAY,
    );
    expect(status.state).toBe('expired');
    expect(status.papers.vehicle_license.daysLeft).toBe(-13);
    expect(status.papers.roadworthiness.state).toBe('due');
    expect(status.papers.insurance.state).toBe('valid');
  });

  it('says papers to add when some are missing and the rest are valid', () => {
    const car = { vehicle_license: paper('2026-12-30'), insurance: null, roadworthiness: null };
    expect(vehicleStatus(car, TODAY).state).toBe('untracked');
    expect(needsAttention(car, TODAY)).toBe(false);
  });

  it('flags cars with a paper due or expired', () => {
    expect(needsAttention({ insurance: paper('2026-10-20') }, TODAY)).toBe(true);
    expect(needsAttention({ insurance: paper('2026-10-01') }, TODAY)).toBe(true);
    expect(needsAttention({ insurance: paper('2027-10-01') }, TODAY)).toBe(false);
  });
});

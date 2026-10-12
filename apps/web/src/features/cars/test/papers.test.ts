import { describe, expect, it } from 'vitest';
import {
  barFraction,
  bigDays,
  dueWords,
  expiryLine,
  sortByUrgency,
  summariseCar,
} from '../lib/papers';
import { car, TODAY } from './fixtures';

describe('paper status edge cases', () => {
  const insurance = (days: number) => summariseCar(car(1, { insurance: days }), TODAY).papers[1]!;

  it('a paper expiring today is due, not expired', () => {
    const paper = insurance(0);
    expect(paper.state).toBe('due');
    expect(paper.daysLeft).toBe(0);
    expect(dueWords(paper)).toBe('due today');
    expect(bigDays(paper)).toEqual({ value: 'Today', unit: '' });
    expect(expiryLine(paper)).toBe('Expires today');
  });

  it('a paper that expired yesterday is expired by one day', () => {
    const paper = insurance(-1);
    expect(paper.state).toBe('expired');
    expect(dueWords(paper)).toBe('expired yesterday');
    expect(bigDays(paper)).toEqual({ value: '1', unit: 'day ago' });
    expect(expiryLine(paper)).toBe('Expired 10 Oct 2026');
  });

  it('30 days left is due soon; 31 is valid', () => {
    expect(insurance(30).state).toBe('due');
    expect(dueWords(insurance(30))).toBe('due in 30 days');
    expect(insurance(31).state).toBe('valid');
    expect(bigDays(insurance(31))).toEqual({ value: '31', unit: 'days left' });
  });

  it('says tomorrow and singular days', () => {
    expect(dueWords(insurance(1))).toBe('due tomorrow');
    expect(bigDays(insurance(1))).toEqual({ value: '1', unit: 'day left' });
    expect(dueWords(insurance(-13))).toBe('expired 13 days ago');
  });
});

describe('summariseCar', () => {
  it('names the most overdue paper first', () => {
    const s = summariseCar(car(1, { licence: -13, insurance: -2, road: 5 }), TODAY);
    expect(s.state).toBe('expired');
    expect(s.urgent?.kind).toBe('vehicle_license');
    expect(s.statusText).toBe('Licence expired');
  });

  it('names the soonest due paper when nothing has expired', () => {
    const s = summariseCar(car(1, { licence: 154, insurance: 9, road: 23 }), TODAY);
    expect(s.state).toBe('due');
    expect(s.statusText).toBe('Insurance due in 9 days');
  });

  it('counts papers to add', () => {
    expect(summariseCar(car(1, { licence: 80 }), TODAY).statusText).toBe('2 papers to add');
    expect(summariseCar(car(1, { licence: 80, road: 90 }), TODAY).statusText).toBe(
      '1 paper to add',
    );
  });

  it('is all good when every paper is valid', () => {
    const s = summariseCar(car(1, { licence: 312, insurance: 103, road: 292 }), TODAY);
    expect(s.state).toBe('valid');
    expect(s.statusText).toBe('All good');
    expect(s.urgent).toBeUndefined();
  });
});

describe('ordering and bars', () => {
  it('puts expired, then due, then papers to add, then all good', () => {
    const cars = [
      summariseCar(car(1, { licence: 300, insurance: 300, road: 300 }), TODAY),
      summariseCar(car(2, { licence: 80 }), TODAY),
      summariseCar(car(3, { licence: 10, insurance: 300, road: 300 }), TODAY),
      summariseCar(car(4, { licence: -1, insurance: 300, road: 300 }), TODAY),
    ];
    expect(sortByUrgency(cars).map((c) => c.vehicle.id)).toEqual([4, 3, 2, 1]);
  });

  it('fills a bar by a year, full when expired, empty when not on file', () => {
    const [licence, insurance, road] = summariseCar(
      car(1, { licence: -5, insurance: 730 }),
      TODAY,
    ).papers;
    expect(barFraction(licence!)).toBe(1);
    expect(barFraction(insurance!)).toBe(1);
    expect(barFraction(road!)).toBe(0);
    const soon = summariseCar(car(1, { licence: 0 }), TODAY).papers[0]!;
    expect(barFraction(soon)).toBeCloseTo(0.04);
  });
});

import type { DateInput, PaperState, Vehicle } from '@motopapers/api';
import {
  sortByUrgency,
  summariseCar,
  type CarSummary,
  type PaperView,
} from '@/features/cars/lib/papers';

/** What Home shows, worked out from the driver's cars. */

export interface PaperOnCar {
  vehicle: Vehicle;
  paper: PaperView;
}

/**
 * The big card at the top of Home, in order of priority: an expired paper, a paper due within
 * 30 days, papers not on file, all good. No cars: a nudge to add one.
 */
export type HomeAlert =
  | { kind: 'expired' | 'due'; vehicle: Vehicle; paper: PaperView; others: number }
  | { kind: 'missing'; count: number }
  | { kind: 'calm' }
  | { kind: 'empty' };

export interface HomeSummary {
  cars: CarSummary[];
  validPapers: number;
  totalPapers: number;
  alert: HomeAlert;
  /** The next four papers to run out (valid or due, not expired or untracked). */
  comingUp: PaperOnCar[];
}

function byDaysLeft(a: PaperOnCar, b: PaperOnCar): number {
  return (a.paper.daysLeft ?? 0) - (b.paper.daysLeft ?? 0);
}

function papersIn(cars: readonly CarSummary[], states: readonly PaperState[]): PaperOnCar[] {
  return cars
    .flatMap((car) => car.papers.map((paper) => ({ vehicle: car.vehicle, paper })))
    .filter((p) => states.includes(p.paper.state))
    .sort(byDaysLeft);
}

export function homeSummary(
  vehicles: readonly Vehicle[],
  today: DateInput = new Date(),
): HomeSummary {
  const cars = sortByUrgency(vehicles.map((v) => summariseCar(v, today)));
  const all = cars.flatMap((car) => car.papers);

  const expired = papersIn(cars, ['expired']);
  const due = papersIn(cars, ['due']);
  const missing = all.filter((p) => p.state === 'untracked').length;

  let alert: HomeAlert;
  if (!cars.length) alert = { kind: 'empty' };
  else if (expired[0]) alert = { kind: 'expired', ...expired[0], others: expired.length - 1 };
  else if (due[0]) alert = { kind: 'due', ...due[0], others: due.length - 1 };
  else if (missing) alert = { kind: 'missing', count: missing };
  else alert = { kind: 'calm' };

  return {
    cars,
    validPapers: all.filter((p) => p.state === 'valid').length,
    totalPapers: all.length,
    alert,
    comingUp: papersIn(cars, ['due', 'valid']).slice(0, 4),
  };
}

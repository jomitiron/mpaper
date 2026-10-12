import type { DateInput, PaperState, Vehicle } from '@motopapers/api';
import type { PaperProgress } from '@/features/renewals/lib/progress';
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
 * The big card at the top of Home, in order of priority: an expired paper, a renewal in progress,
 * a paper due within 30 days, papers not on file, all good. No cars: a nudge to add one. A paper
 * that's being renewed doesn't count as expired or due (phase 4).
 */
export type HomeAlert =
  | { kind: 'expired' | 'due'; vehicle: Vehicle; paper: PaperView; others: number }
  | { kind: 'renewing'; vehicle: Vehicle; paper: PaperView; progress: PaperProgress }
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
  renewing: readonly PaperProgress[] = [],
): HomeSummary {
  const cars = sortByUrgency(vehicles.map((v) => summariseCar(v, today)));
  const all = cars.flatMap((car) => car.papers);

  const progressOf = (p: PaperOnCar) =>
    renewing.find((r) => r.vehicleId === p.vehicle.id && r.kind === p.paper.kind);
  const expired = papersIn(cars, ['expired']).filter((p) => !progressOf(p));
  const due = papersIn(cars, ['due']).filter((p) => !progressOf(p));
  const beingRenewed = papersIn(cars, ['expired', 'due', 'valid', 'untracked'])
    .map((p) => ({ ...p, progress: progressOf(p) }))
    .find((p): p is PaperOnCar & { progress: PaperProgress } => Boolean(p.progress));
  const missing = all.filter((p) => p.state === 'untracked').length;

  let alert: HomeAlert;
  if (!cars.length) alert = { kind: 'empty' };
  else if (expired[0]) alert = { kind: 'expired', ...expired[0], others: expired.length - 1 };
  else if (beingRenewed) alert = { kind: 'renewing', ...beingRenewed };
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

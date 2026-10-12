import type { PaperState, Vehicle } from '@motopapers/api';

/** My cars filters, as they appear in the address: `/cars?filter=attention&q=kja`. */
export const CAR_FILTERS = ['all', 'attention', 'missing', 'ok'] as const;
export type CarFilter = (typeof CAR_FILTERS)[number];

export const CAR_FILTER_LABELS: Record<CarFilter, string> = {
  all: 'All',
  attention: 'Needs attention',
  missing: 'Papers to add',
  ok: 'All good',
};

export function parseCarFilter(value: unknown): CarFilter {
  const raw = Array.isArray(value) ? value[0] : value;
  return CAR_FILTERS.includes(raw as CarFilter) ? (raw as CarFilter) : 'all';
}

/** Which filter chip a car's overall state belongs to (besides All). */
export function filterOf(state: PaperState): Exclude<CarFilter, 'all'> {
  if (state === 'expired' || state === 'due') return 'attention';
  if (state === 'untracked') return 'missing';
  return 'ok';
}

export function matchesFilter(state: PaperState, filter: CarFilter): boolean {
  return filter === 'all' || filterOf(state) === filter;
}

/** Lower case, letters and digits only, so "kja-731" finds "KJA 731 AE" and "toyotacamry" works. */
export function searchKey(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Search by plate, make or model. An empty search matches every car. */
export function matchesSearch(
  vehicle: Pick<Vehicle, 'plate_number' | 'brand' | 'model'>,
  query: string,
): boolean {
  const q = searchKey(query);
  if (!q) return true;
  const haystack = [
    vehicle.plate_number,
    `${vehicle.brand}${vehicle.model}`,
    `${vehicle.model}${vehicle.brand}`,
  ].map(searchKey);
  return haystack.some((text) => text.includes(q));
}

export function countByFilter(states: readonly PaperState[]): Record<CarFilter, number> {
  const counts: Record<CarFilter, number> = { all: states.length, attention: 0, missing: 0, ok: 0 };
  for (const state of states) counts[filterOf(state)] += 1;
  return counts;
}

/** The cars to show: those in the chosen filter that match the search. */
export function filterCars<T extends { state: PaperState; vehicle: Vehicle }>(
  cars: readonly T[],
  filter: CarFilter,
  query: string,
): T[] {
  return cars.filter(
    (car) => matchesFilter(car.state, filter) && matchesSearch(car.vehicle, query),
  );
}

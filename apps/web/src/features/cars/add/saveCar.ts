import {
  createInsurance,
  createRoadworthiness,
  createVehicle,
  createVehicleLicense,
  PAPER_KINDS,
  type PaperKind,
  type Vehicle,
} from '@motopapers/api';
import { toNewVehicle, toPaperBodies, type CarDraft } from './draft';

/**
 * Saves a new car: `POST /vehicles` (paid tier), then one record per paper the driver added.
 *
 * Papers can fail on their own after the car is created. `progress` remembers what's done, so
 * calling `saveCar` again with the same progress retries only what failed and never creates the
 * car twice.
 */

export interface SaveProgress {
  /** The created car, once `POST /vehicles` has worked. */
  vehicle: Vehicle | null;
  /** Papers already saved. */
  saved: PaperKind[];
}

export interface PaperFailure {
  kind: PaperKind;
  error: unknown;
}

export interface SaveResult {
  vehicle: Vehicle;
  /** Papers that were saved by this call or an earlier one. */
  saved: PaperKind[];
  /** Papers that failed this time. Empty when everything is saved. */
  failed: PaperFailure[];
}

export interface CarApi {
  createVehicle: typeof createVehicle;
  createVehicleLicense: typeof createVehicleLicense;
  createInsurance: typeof createInsurance;
  createRoadworthiness: typeof createRoadworthiness;
}

const defaultApi: CarApi = {
  createVehicle,
  createVehicleLicense,
  createInsurance,
  createRoadworthiness,
};

export function newProgress(): SaveProgress {
  return { vehicle: null, saved: [] };
}

/** Papers in the draft, in display order. */
export function papersInDraft(draft: CarDraft): PaperKind[] {
  const bodies = toPaperBodies(draft);
  return PAPER_KINDS.filter((kind) => bodies[kind] !== undefined);
}

/**
 * Creates the car (unless `progress` already has it), then every paper not yet saved.
 * Throws only when the car itself can't be created (a 409 means the plate is already on the
 * account). Paper failures are returned in `failed`.
 */
export async function saveCar(
  draft: CarDraft,
  progress: SaveProgress,
  api: CarApi = defaultApi,
): Promise<SaveResult> {
  if (!progress.vehicle) {
    progress.vehicle = await api.createVehicle(toNewVehicle(draft));
  }
  const vehicle = progress.vehicle;
  const bodies = toPaperBodies(draft);

  const todo = PAPER_KINDS.filter(
    (kind) => bodies[kind] !== undefined && !progress.saved.includes(kind),
  );
  const results = await Promise.allSettled(
    todo.map((kind) => {
      if (kind === 'vehicle_license') return api.createVehicleLicense(vehicle.id, bodies[kind]!);
      if (kind === 'insurance') return api.createInsurance(vehicle.id, bodies[kind]!);
      return api.createRoadworthiness(vehicle.id, bodies[kind]!);
    }),
  );

  const failed: PaperFailure[] = [];
  results.forEach((result, index) => {
    const kind = todo[index]!;
    if (result.status === 'fulfilled') progress.saved.push(kind);
    else failed.push({ kind, error: result.reason });
  });
  return { vehicle, saved: [...progress.saved], failed };
}

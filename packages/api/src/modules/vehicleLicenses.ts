import { z } from 'zod';
import { request } from '../client';
import { envelope } from '../schemas/common';
import {
  vehicleLicenseSchema,
  type NewVehicleLicense,
  type VehicleLicense,
} from '../schemas/papers';

interface Options {
  signal?: AbortSignal;
}

/** `POST /vehicle/:id/vehicle-licenses`. Needs the licence PIN (the document reader returns it). */
export async function createVehicleLicense(
  vehicleId: number,
  body: NewVehicleLicense,
  options: Options = {},
): Promise<VehicleLicense> {
  const res = await request(`/vehicle/${vehicleId}/vehicle-licenses`, {
    method: 'POST',
    body,
    schema: envelope(vehicleLicenseSchema),
    ...options,
  });
  return res.data;
}

/** `GET /vehicle/:id/vehicle-licenses`. Every licence record for the car (history). */
export async function listVehicleLicenses(
  vehicleId: number,
  options: Options = {},
): Promise<VehicleLicense[]> {
  const res = await request(`/vehicle/${vehicleId}/vehicle-licenses`, {
    schema: envelope(z.array(vehicleLicenseSchema)),
    ...options,
  });
  return res.data;
}

/** `GET /vehicle/:id/vehicle-licenses/valid-document`. The licence that's valid today. */
export async function getValidVehicleLicense(
  vehicleId: number,
  options: Options = {},
): Promise<VehicleLicense | null> {
  const res = await request(`/vehicle/${vehicleId}/vehicle-licenses/valid-document`, {
    schema: envelope(vehicleLicenseSchema.nullable()),
    ...options,
  });
  return res.data;
}

import { z } from 'zod';
import { request } from '../client';
import { envelope, messageEnvelope } from '../schemas/common';
import { vehicleSchema, type NewVehicle, type Vehicle } from '../schemas/vehicle';

interface Options {
  signal?: AbortSignal;
}

/** `GET /vehicles`. Each car includes its current licence, insurance and roadworthiness (or null). */
export async function listVehicles(options: Options = {}): Promise<Vehicle[]> {
  const res = await request('/vehicles', { schema: envelope(z.array(vehicleSchema)), ...options });
  return res.data;
}

/** `GET /vehicles/:id`. A missing car is a 400 "Vehicle does not exist". */
export async function getVehicle(id: number, options: Options = {}): Promise<Vehicle> {
  const res = await request(`/vehicles/${id}`, { schema: envelope(vehicleSchema), ...options });
  return res.data;
}

/**
 * `POST /vehicles`. The real API may not reject a duplicate plate yet (a 409 is planned), so check
 * `findDuplicatePlate()` against `listVehicles()` first.
 */
export async function createVehicle(body: NewVehicle, options: Options = {}): Promise<Vehicle> {
  const res = await request('/vehicles', {
    method: 'POST',
    body,
    schema: envelope(vehicleSchema),
    ...options,
  });
  return res.data;
}

/** `PATCH /vehicles/:id`. Only the colour can change. */
export async function updateVehicleColor(
  id: number,
  color: string,
  options: Options = {},
): Promise<Vehicle> {
  const res = await request(`/vehicles/${id}`, {
    method: 'PATCH',
    body: { color },
    schema: envelope(vehicleSchema),
    ...options,
  });
  return res.data;
}

/** `DELETE /vehicles/:id`. **Not in the API docs**; the old app calls it. Handle failure gracefully. */
export async function deleteVehicle(id: number, options: Options = {}): Promise<void> {
  await request(`/vehicles/${id}`, {
    method: 'DELETE',
    schema: messageEnvelope.nullish(),
    ...options,
  });
}

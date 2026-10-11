import { z } from 'zod';
import { request } from '../client';
import { envelope } from '../schemas/common';
import { insuranceSchema, type Insurance, type NewInsurance } from '../schemas/papers';

interface Options {
  signal?: AbortSignal;
}

/** `POST /vehicle/:id/insurance`. Adds a new record; it becomes the car's current insurance. */
export async function createInsurance(
  vehicleId: number,
  body: NewInsurance,
  options: Options = {},
): Promise<Insurance> {
  const res = await request(`/vehicle/${vehicleId}/insurance`, {
    method: 'POST',
    body,
    schema: envelope(insuranceSchema),
    ...options,
  });
  return res.data;
}

/** `GET /vehicle/:id/insurance`. Every insurance record for the car (history). */
export async function listInsurance(
  vehicleId: number,
  options: Options = {},
): Promise<Insurance[]> {
  const res = await request(`/vehicle/${vehicleId}/insurance`, {
    schema: envelope(z.array(insuranceSchema)),
    ...options,
  });
  return res.data;
}

/** `GET /vehicle/:id/insurance/valid-document`. The record that's valid today. */
export async function getValidInsurance(
  vehicleId: number,
  options: Options = {},
): Promise<Insurance | null> {
  const res = await request(`/vehicle/${vehicleId}/insurance/valid-document`, {
    schema: envelope(insuranceSchema.nullable()),
    ...options,
  });
  return res.data;
}

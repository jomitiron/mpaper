import { z } from 'zod';
import { request } from '../client';
import { envelope } from '../schemas/common';
import {
  roadworthinessSchema,
  type NewRoadworthiness,
  type Roadworthiness,
} from '../schemas/papers';

interface Options {
  signal?: AbortSignal;
}

/** `POST /vehicle/:id/roadworthiness`. Adds a new record; it becomes the car's current one. */
export async function createRoadworthiness(
  vehicleId: number,
  body: NewRoadworthiness,
  options: Options = {},
): Promise<Roadworthiness> {
  const res = await request(`/vehicle/${vehicleId}/roadworthiness`, {
    method: 'POST',
    body,
    schema: envelope(roadworthinessSchema),
    ...options,
  });
  return res.data;
}

/** `GET /vehicle/:id/roadworthiness`. Every roadworthiness record for the car (history). */
export async function listRoadworthiness(
  vehicleId: number,
  options: Options = {},
): Promise<Roadworthiness[]> {
  const res = await request(`/vehicle/${vehicleId}/roadworthiness`, {
    schema: envelope(z.array(roadworthinessSchema)),
    ...options,
  });
  return res.data;
}

/** `GET /vehicle/:id/roadworthiness/valid-document`. The record that's valid today. */
export async function getValidRoadworthiness(
  vehicleId: number,
  options: Options = {},
): Promise<Roadworthiness | null> {
  const res = await request(`/vehicle/${vehicleId}/roadworthiness/valid-document`, {
    schema: envelope(roadworthinessSchema.nullable()),
    ...options,
  });
  return res.data;
}

import { z } from 'zod';
import { request } from '../client';
import { envelope } from '../schemas/common';
import {
  createdRenewalSchema,
  renewalSchema,
  type CreatedRenewal,
  type CreateRenewalBody,
  type Renewal,
} from '../schemas/gaps';

/** Renewal orders. **Not built yet** (api-gaps.md, `VITE_FLAG_RENEWALS`): mocks only. */

interface Options {
  signal?: AbortSignal;
}

/** `POST /vehicles/:id/renewals`. Paying by card returns an `auth_url` for Paystack. */
export async function createRenewal(
  vehicleId: number,
  body: CreateRenewalBody,
  options: Options = {},
): Promise<CreatedRenewal> {
  const res = await request(`/vehicles/${vehicleId}/renewals`, {
    method: 'POST',
    body,
    schema: envelope(createdRenewalSchema),
    ...options,
  });
  return res.data;
}

/** `GET /renewals`. Every renewal on the account. */
export async function listRenewals(options: Options = {}): Promise<Renewal[]> {
  const res = await request('/renewals', { schema: envelope(z.array(renewalSchema)), ...options });
  return res.data;
}

/** `GET /vehicles/:id/renewals`. */
export async function listVehicleRenewals(
  vehicleId: number,
  options: Options = {},
): Promise<Renewal[]> {
  const res = await request(`/vehicles/${vehicleId}/renewals`, {
    schema: envelope(z.array(renewalSchema)),
    ...options,
  });
  return res.data;
}

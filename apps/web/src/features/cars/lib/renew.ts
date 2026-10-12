import type { PaperKind } from '@motopapers/api';
import type { RouteLocationRaw } from 'vue-router';
import { PAPER_SLUGS } from '@/features/renewals/lib/papers';

/**
 * Where Renew buttons go (Home's alert card, My cars, the car panel): phase 4's renew page,
 * `/cars/:id/renew/:paper`, with the car and paper chosen. It pays for the renewal, or asks the
 * team for one while the renewals API is off (VITE_FLAG_RENEWALS).
 */
export const RENEW_FLOW_READY = true;

export function renewTarget(vehicleId: number, paper: PaperKind): RouteLocationRaw {
  return { name: 'renew', params: { id: String(vehicleId), paper: PAPER_SLUGS[paper] } };
}

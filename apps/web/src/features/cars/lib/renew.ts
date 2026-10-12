import type { PaperKind } from '@motopapers/api';
import type { RouteLocationRaw } from 'vue-router';

/**
 * PHASE 4 SEAM · where Renew buttons go (Home's alert card, My cars, the car panel).
 *
 * Phase 4 builds the Renew flow: change `renewTarget` to open it with the car and paper chosen,
 * and set `RENEW_FLOW_READY` to true so the car panel shows its Renew buttons too. Until then a
 * Renew button opens the car's panel, where the driver can update the paper's date.
 */
export const RENEW_FLOW_READY = false;

export function renewTarget(vehicleId: number, _paper: PaperKind): RouteLocationRaw {
  return { name: 'car', params: { id: String(vehicleId) } };
}

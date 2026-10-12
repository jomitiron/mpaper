import type { Renewal } from '@motopapers/api';
import type { RenewalRequest } from '../lib/requests';

/** Today in the renewals tests (and the payments harness). */
export const TODAY = '2026-10-12';

export function renewal(overrides: Partial<Renewal> = {}): Renewal {
  return {
    id: 1,
    vehicle_id: 102,
    document_type: 'vehicle_license',
    status: 'paid',
    amount: 18_500,
    delivery_address: '14 Admiralty Way, Lekki Phase 1, Lagos',
    new_expiry_date: null,
    created_at: '2026-10-12T08:00:00.000Z',
    updated_at: '2026-10-12T08:00:00.000Z',
    ...overrides,
  };
}

export function request(overrides: Partial<RenewalRequest> = {}): RenewalRequest {
  return {
    vehicleId: 102,
    kind: 'vehicle_license',
    plate: 'EKY 219 GD',
    deliveryAddress: '14 Admiralty Way, Lekki Phase 1, Lagos',
    phone: '+2348035550142',
    price: 18_500,
    requestedAt: '2026-10-12T08:00:00.000Z',
    expiryAtRequest: '2026-09-29',
    ...overrides,
  };
}

/** sessionStorage-like storage in memory. */
export function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

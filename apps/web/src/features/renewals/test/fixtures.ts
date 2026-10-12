import type { Renewal } from '@motopapers/api';

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

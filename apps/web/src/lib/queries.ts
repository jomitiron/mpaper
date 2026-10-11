import { getWalletBalance, listVehicles } from '@motopapers/api';
import { queryOptions } from '@tanstack/vue-query';

/**
 * Shared query keys, so every feature reads and invalidates the same cache entries.
 * Invalidate `queryKeys.vehicles` after any write to a car or its papers.
 */
export const queryKeys = {
  vehicles: ['vehicles'] as const,
  vehicle: (id: number) => ['vehicles', id] as const,
  wallet: ['wallet'] as const,
  transactions: ['transactions'] as const,
  me: ['me'] as const,
  pricing: ['pricing'] as const,
  insuranceCompanies: ['insurance-companies'] as const,
  renewals: ['renewals'] as const,
  notificationPreferences: ['notification-preferences'] as const,
};

export function vehiclesQuery() {
  return queryOptions({
    queryKey: queryKeys.vehicles,
    queryFn: ({ signal }) => listVehicles({ signal }),
  });
}

export function walletQuery() {
  return queryOptions({
    queryKey: queryKeys.wallet,
    queryFn: ({ signal }) => getWalletBalance({ signal }),
  });
}

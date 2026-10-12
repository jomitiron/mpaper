import { lagosToday, listRenewals, listVehicleRenewals, type Renewal } from '@motopapers/api';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { computed, toValue, watch, type MaybeRefOrGetter } from 'vue';
import { flags } from '@/env';
import { queryKeys } from '@/lib/queries';
import { isInProgress, shownRenewals } from './status';

/**
 * Renewals' server data. Every key starts with `['renewals']`, so one invalidation covers both the
 * account's list (Home) and each car's (the car panel, the renew page).
 */

/** How often to ask again while a renewal is moving. Statuses change in hours, not seconds. */
export const POLL_MS = 30_000;

export const renewalKeys = {
  all: queryKeys.renewals,
  vehicle: (vehicleId: number) => [...queryKeys.renewals, 'vehicle', vehicleId] as const,
};

const pollWhileMoving = (query: { state: { data: Renewal[] | undefined } }) =>
  query.state.data?.some(isInProgress) ? POLL_MS : false;

/**
 * Watches renewals and refreshes the cars when one is delivered: the new paper is on the car now.
 */
function useDeliveredRefresh(data: () => Renewal[] | undefined) {
  const queryClient = useQueryClient();
  watch(data, (now, before) => {
    if (!now || !before) return;
    const delivered = now.some(
      (r) =>
        r.status === 'delivered' && before.some((b) => b.id === r.id && b.status !== 'delivered'),
    );
    if (delivered) void queryClient.invalidateQueries({ queryKey: queryKeys.vehicles });
  });
}

/** `GET /renewals`: every renewal on the account (Home). Off without the renewals API. */
export function useAccountRenewals() {
  const query = useQuery({
    queryKey: renewalKeys.all,
    queryFn: ({ signal }) => listRenewals({ signal }),
    enabled: flags.renewals,
    refetchInterval: pollWhileMoving,
    meta: { silent: true },
  });
  useDeliveredRefresh(() => query.data.value);
  return query;
}

/** `GET /vehicles/:id/renewals` (the car panel, the renew page). Off without the renewals API. */
export function useVehicleRenewals(vehicleId: MaybeRefOrGetter<number | null>) {
  const query = useQuery({
    queryKey: computed(() => renewalKeys.vehicle(toValue(vehicleId) ?? 0)),
    queryFn: ({ signal }) => listVehicleRenewals(toValue(vehicleId)!, { signal }),
    enabled: computed(() => flags.renewals && toValue(vehicleId) !== null),
    refetchInterval: pollWhileMoving,
    meta: { silent: true },
  });
  useDeliveredRefresh(() => query.data.value);
  return query;
}

/** The renewals worth showing (in progress, or delivered lately), newest first. */
export function useShownRenewals(data: () => Renewal[] | undefined) {
  return computed(() => shownRenewals(data() ?? [], lagosToday()));
}

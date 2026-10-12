import { lagosToday, type PaperKind, type Renewal, type RenewalStatus } from '@motopapers/api';
import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useAccountRenewals } from './queries';
import { isInProgress, shownRenewals } from './status';

/** Papers being renewed right now, for Home's alert card ("Renewal in progress"). */

export interface PaperProgress {
  vehicleId: number;
  kind: PaperKind;
  /** Where the renewal is. */
  status: RenewalStatus;
}

export function paperProgress(renewals: readonly Renewal[], today: string): PaperProgress[] {
  return shownRenewals(renewals, today)
    .filter(isInProgress)
    .map((r) => ({ vehicleId: r.vehicle_id, kind: r.document_type, status: r.status }));
}

/** Every paper being renewed on the account (GET /renewals). */
export function useRenewalProgress() {
  const renewals = useAccountRenewals();
  return computed(() => paperProgress(renewals.data.value ?? [], lagosToday()));
}

/** Whether one paper on one car is being renewed (My cars, the car panel's Renew buttons). */
export function usePaperProgress(
  vehicleId: MaybeRefOrGetter<number>,
  kind: MaybeRefOrGetter<PaperKind | undefined>,
) {
  const all = useRenewalProgress();
  return computed(() =>
    all.value.find((p) => p.vehicleId === toValue(vehicleId) && p.kind === toValue(kind)),
  );
}

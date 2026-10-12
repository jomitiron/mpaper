import { lagosToday, type PaperKind, type Renewal, type RenewalStatus } from '@motopapers/api';
import { computed } from 'vue';
import { useAccountRenewals, useOpenRequests } from './queries';
import type { RenewalRequest } from './requests';
import { isInProgress, shownRenewals } from './status';

/** Papers being renewed right now, for Home's alert card ("Renewal in progress"). */

export interface PaperProgress {
  vehicleId: number;
  kind: PaperKind;
  /** Where the renewal is, or `requested` for a "Request renewal" the team will call about. */
  status: RenewalStatus | 'requested';
}

export function paperProgress(
  renewals: readonly Renewal[],
  requests: readonly RenewalRequest[],
  today: string,
): PaperProgress[] {
  const moving: PaperProgress[] = shownRenewals(renewals, today)
    .filter(isInProgress)
    .map((r) => ({ vehicleId: r.vehicle_id, kind: r.document_type, status: r.status }));
  const asked: PaperProgress[] = requests
    .filter((q) => !moving.some((m) => m.vehicleId === q.vehicleId && m.kind === q.kind))
    .map((q) => ({ vehicleId: q.vehicleId, kind: q.kind, status: 'requested' }));
  return [...moving, ...asked];
}

/** Every paper being renewed on the account: GET /renewals, and requests kept in this browser. */
export function useRenewalProgress() {
  const renewals = useAccountRenewals();
  const requests = useOpenRequests();
  return computed(() => paperProgress(renewals.data.value ?? [], requests.value, lagosToday()));
}

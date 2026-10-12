import { calendarDateOf, daysBetween, type PaperKind, type Vehicle } from '@motopapers/api';
import { shallowRef, type ShallowRef } from 'vue';

/**
 * "Request renewal": the fallback while the renewals API isn't on (VITE_FLAG_RENEWALS off), and
 * for papers without a set price (comprehensive cover). The team takes payment and arranges the
 * delivery by phone.
 *
 * There's no endpoint to send a request to yet, so it's kept in this browser (localStorage, per
 * driver) to show "Renewal requested" on Home, the car panel and the renew page. See
 * docs/backend-handoff.md: the backend needs to record these for the team.
 */

export interface RenewalRequest {
  vehicleId: number;
  kind: PaperKind;
  plate: string;
  deliveryAddress: string;
  /** Where the team will call. */
  phone: string;
  /** Naira, or null when the team will quote. */
  price: number | null;
  /** ISO timestamp. */
  requestedAt: string;
  /** The paper's expiry date when it was asked for. A new date means it's been renewed. */
  expiryAtRequest: string | null;
}

/** A request stops showing after this long: by then the team has called, or the driver can ask again. */
export const REQUEST_SHOWN_DAYS = 30;

const KEY_PREFIX = 'motopapers:renewal-requests:';

export interface RequestStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStorage(): RequestStorage | null {
  try {
    return localStorage;
  } catch {
    return null; // Storage blocked: requests last as long as the page.
  }
}

function isRequest(value: unknown): value is RenewalRequest {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.vehicleId === 'number' &&
    typeof v.kind === 'string' &&
    typeof v.plate === 'string' &&
    typeof v.deliveryAddress === 'string' &&
    typeof v.phone === 'string' &&
    (typeof v.price === 'number' || v.price === null) &&
    typeof v.requestedAt === 'string' &&
    (typeof v.expiryAtRequest === 'string' || v.expiryAtRequest === null)
  );
}

export function createRequestStore(storage: RequestStorage | null = defaultStorage()) {
  const memory = new Map<number, RenewalRequest[]>();
  /** Bumped on every change, so computed lists that read it update. */
  const version: ShallowRef<number> = shallowRef(0);

  function read(userId: number): RenewalRequest[] {
    if (!storage) return memory.get(userId) ?? [];
    try {
      const parsed: unknown = JSON.parse(storage.getItem(KEY_PREFIX + userId) ?? '[]');
      return Array.isArray(parsed) ? parsed.filter(isRequest) : [];
    } catch {
      return [];
    }
  }

  function write(userId: number, requests: RenewalRequest[]): void {
    memory.set(userId, requests);
    try {
      storage?.setItem(KEY_PREFIX + userId, JSON.stringify(requests));
    } catch {
      // Storage full or blocked: keep it in memory for this page.
    }
    version.value += 1;
  }

  return {
    version,
    list(userId: number): RenewalRequest[] {
      void version.value; // Track changes.
      return read(userId);
    },
    /** Records a request, replacing any earlier one for the same paper on the same car. */
    add(userId: number, request: RenewalRequest): void {
      const others = read(userId).filter(
        (r) => !(r.vehicleId === request.vehicleId && r.kind === request.kind),
      );
      write(userId, [request, ...others]);
    },
    forget(userId: number, vehicleId: number, kind: PaperKind): void {
      write(
        userId,
        read(userId).filter((r) => !(r.vehicleId === vehicleId && r.kind === kind)),
      );
    },
  };
}

export type RequestStore = ReturnType<typeof createRequestStore>;

let store: RequestStore | null = null;

/** The app's request store (localStorage). */
export function requestStore(): RequestStore {
  store ??= createRequestStore();
  return store;
}

/** Tests start each case with an empty store. */
export function resetRequestStore(next: RequestStore | null = null): void {
  store = next;
}

/**
 * Whether a request still stands: the car is still on the account, the paper hasn't been given a
 * new expiry date since, and it's less than 30 days old.
 */
export function isOpenRequest(
  request: RenewalRequest,
  vehicles: readonly Vehicle[],
  today: string,
): boolean {
  const vehicle = vehicles.find((v) => v.id === request.vehicleId);
  if (!vehicle) return false;
  const expiry = vehicle[request.kind]?.expiry_date ?? null;
  if (expiry !== request.expiryAtRequest) return false;
  return daysBetween(calendarDateOf(request.requestedAt), today) <= REQUEST_SHOWN_DAYS;
}

/** The open request for one paper on one car, if any. */
export function openRequestFor(
  requests: readonly RenewalRequest[],
  vehicles: readonly Vehicle[],
  vehicleId: number,
  kind: PaperKind,
  today: string,
): RenewalRequest | undefined {
  return requests.find(
    (r) => r.vehicleId === vehicleId && r.kind === kind && isOpenRequest(r, vehicles, today),
  );
}

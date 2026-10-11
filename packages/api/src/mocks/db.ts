import type { DocumentType } from '../schemas/gaps';
import type { Vehicle } from '../schemas/vehicle';
import { addDays, lagosToday } from '../status';
import {
  DEFAULT_PREFERENCES,
  seedState,
  type MockAccount,
  type MockState,
  type MockTransaction,
  type MockVehicle,
} from './fixtures';

/**
 * In-memory data behind the mock handlers. In the browser it's saved to sessionStorage, so it
 * survives the full-page trip to the (mock) Paystack checkout and back.
 */

export interface MockStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface MockDbOptions {
  /** Where to keep the data between page loads. Null keeps it in memory only. */
  storage?: MockStorage | null;
  storageKey?: string;
  /** Fixed "today" as `YYYY-MM-DD` (tests). Defaults to today in Lagos. */
  today?: string;
  /** Clock in ms, for payments settling and renewals moving on (tests). */
  now?: () => number;
}

/** How long a mock Paystack payment takes to settle. */
export const PAYMENT_SETTLE_MS = 1_500;
/** How long a mock renewal spends in each status after it's paid. */
export const RENEWAL_STEP_MS = 20_000;
export const MOCK_TOKEN_TTL_SECONDS = 30 * 60;

export type MockDb = ReturnType<typeof createMockDb>;

export function createMockDb(options: MockDbOptions = {}) {
  const storage = options.storage ?? null;
  const key = options.storageKey ?? 'motopapers:mock-db';
  const now = options.now ?? (() => Date.now());
  const today = () => options.today ?? lagosToday();

  let state: MockState = load() ?? seedState(today());

  function load(): MockState | null {
    if (!storage) return null;
    try {
      const raw = storage.getItem(key);
      const parsed = raw ? (JSON.parse(raw) as MockState) : null;
      return parsed?.version === 1 ? parsed : null;
    } catch {
      return null;
    }
  }

  function save(): void {
    try {
      storage?.setItem(key, JSON.stringify(state));
    } catch {
      // Storage full or blocked: carry on in memory.
    }
  }

  function nextId(): number {
    state.nextId += 1;
    return state.nextId;
  }

  function timestamp(): string {
    return new Date(now()).toISOString();
  }

  /** Settles due payments and moves renewals along. Call before reading. */
  function tick(): void {
    const time = now();
    let changed = false;
    for (const account of state.accounts) {
      for (const tx of account.transactions) {
        if (tx.status !== 'pending' || tx.settleAt === undefined || tx.settleAt > time) continue;
        if (tx.outcome === 'never') continue;
        const outcome = tx.outcome ?? 'success';
        tx.status = outcome;
        tx.updated_at = new Date(tx.settleAt).toISOString();
        if (tx.payment) {
          tx.payment.status = outcome;
          tx.payment.updated_at = tx.updated_at;
        }
        if (outcome === 'success') {
          if (tx.category === 'wallet_topup') account.walletBalance += tx.amount;
          const renewal = account.renewals.find((r) => r.id === tx.renewalId);
          if (renewal) {
            renewal.status = 'paid';
            renewal.paidAt = tx.settleAt;
            renewal.updated_at = tx.updated_at;
          }
        }
        changed = true;
      }
      for (const renewal of account.renewals) {
        if (renewal.paidAt === undefined || renewal.status === 'delivered') continue;
        if (renewal.status === 'cancelled') continue;
        const steps = Math.floor((time - renewal.paidAt) / RENEWAL_STEP_MS);
        const status =
          steps >= 3
            ? 'delivered'
            : steps === 2
              ? 'out_for_delivery'
              : steps === 1
                ? 'processing'
                : 'paid';
        if (status === renewal.status) continue;
        renewal.status = status;
        renewal.updated_at = timestamp();
        if (status === 'delivered') {
          const vehicle = account.vehicles.find((v) => v.id === renewal.vehicle_id);
          if (vehicle) renewal.new_expiry_date = addRenewedPaper(vehicle, renewal.document_type);
        }
        changed = true;
      }
    }
    if (changed) save();
  }

  /** Adds a paper one year on from today or its current expiry, whichever is later. */
  function addRenewedPaper(vehicle: MockVehicle, type: DocumentType): string {
    const from = (current?: { expiry_date: string }) => {
      const start = current && current.expiry_date > today() ? current.expiry_date : today();
      return addDays(start, 365);
    };
    const created_at = timestamp();
    if (type === 'vehicle_license') {
      const current = vehicle.vehicle_licenses.at(-1);
      const expiry_date = from(current);
      vehicle.vehicle_licenses.push({
        id: nextId(),
        vehicle_id: vehicle.id,
        expiry_date,
        license_pin: current?.license_pin ?? null,
        created_at,
        updated_at: created_at,
      });
      return expiry_date;
    }
    if (type === 'insurance') {
      const current = vehicle.insurance.at(-1);
      const expiry_date = from(current);
      vehicle.insurance.push({
        id: nextId(),
        vehicle_id: vehicle.id,
        cover_type: current?.cover_type ?? 'third_party',
        vehicle_value: current?.vehicle_value ?? 0,
        expiry_date,
        created_at,
        updated_at: created_at,
      });
      return expiry_date;
    }
    const current = vehicle.roadworthiness.at(-1);
    const expiry_date = from(current);
    vehicle.roadworthiness.push({
      id: nextId(),
      vehicle_id: vehicle.id,
      expiry_date,
      inspection_date: null,
      inspection_location: null,
      created_at,
      updated_at: created_at,
    });
    return expiry_date;
  }

  /** The API shape of a car: details plus its current papers (nested ones leave out vehicle_id). */
  function vehicleView(vehicle: MockVehicle, owner: MockAccount): Vehicle {
    const strip = <T extends { vehicle_id?: number }>(paper: T | undefined) => {
      if (!paper) return null;
      const { vehicle_id: _vehicleId, ...rest } = paper;
      return rest;
    };
    return {
      id: vehicle.id,
      user: {
        id: owner.user.id,
        first_name: owner.user.first_name,
        last_name: owner.user.last_name,
      },
      brand: vehicle.brand,
      color: vehicle.color,
      model: vehicle.model,
      plate_number: vehicle.plate_number,
      engine_number: vehicle.engine_number,
      chassis_number: vehicle.chassis_number,
      engine_capacity: vehicle.engine_capacity,
      created_at: vehicle.created_at,
      updated_at: vehicle.updated_at,
      vehicle_license: strip(vehicle.vehicle_licenses.at(-1)),
      insurance: strip(vehicle.insurance.at(-1)),
      roadworthiness: strip(vehicle.roadworthiness.at(-1)),
    };
  }

  function accountById(id: number): MockAccount | undefined {
    return state.accounts.find((account) => account.user.id === id);
  }

  function accountByEmail(email: string): MockAccount | undefined {
    const wanted = email.trim().toLowerCase();
    return state.accounts.find((account) => account.user.email.toLowerCase() === wanted);
  }

  function createAccount(details: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    password: string;
    email_verified?: boolean;
  }): MockAccount {
    const id = nextId();
    const account: MockAccount = {
      user: {
        id,
        first_name: details.first_name,
        last_name: details.last_name,
        email: details.email,
        phone: details.phone,
        email_verified: details.email_verified ?? false,
        wallet: { id, balance: 0 },
        address: null,
        created_at: timestamp(),
        updated_at: timestamp(),
      },
      password: details.password,
      walletBalance: 0,
      vehicles: [],
      transactions: [],
      renewals: [],
      preferences: { ...DEFAULT_PREFERENCES },
    };
    state.accounts.push(account);
    save();
    return account;
  }

  /** The user object as the API returns it, with the live wallet balance. */
  function userView(account: MockAccount) {
    return { ...account.user, wallet: { id: account.user.id, balance: account.walletBalance } };
  }

  function addTransaction(
    account: MockAccount,
    tx: Omit<
      MockTransaction,
      'id' | 'reference' | 'user_id' | 'currency' | 'created_at' | 'updated_at'
    >,
  ): MockTransaction {
    const id = nextId();
    const created_at = timestamp();
    const transaction: MockTransaction = {
      id,
      reference: `T${id.toString(16).toUpperCase().padStart(32, '0')}`,
      user_id: account.user.id,
      currency: 'NGN',
      created_at,
      updated_at: created_at,
      ...tx,
    };
    account.transactions.unshift(transaction);
    return transaction;
  }

  /** A pending Paystack payment that settles after PAYMENT_SETTLE_MS (see `paymentOutcomeFor`). */
  function addPaystackPayment(
    account: MockAccount,
    fields: Pick<MockTransaction, 'amount' | 'transaction_type' | 'category' | 'description'> &
      Partial<Pick<MockTransaction, 'vehicle_id' | 'document_type' | 'renewalId'>>,
  ): MockTransaction {
    const created_at = timestamp();
    const transaction = addTransaction(account, {
      status: 'pending',
      settleAt: now() + PAYMENT_SETTLE_MS,
      outcome: paymentOutcomeFor(fields.amount),
      vehicle_id: null,
      document_type: null,
      ...fields,
      payment: {
        id: 0,
        email: account.user.email,
        amount: fields.amount,
        status: 'pending',
        currency: 'NGN',
        reference: `MOT-${crypto.randomUUID()}`,
        created_at,
        updated_at: created_at,
      },
    });
    if (transaction.payment) transaction.payment.id = transaction.id;
    return transaction;
  }

  function findTransaction(account: MockAccount, reference: string): MockTransaction | undefined {
    return account.transactions.find(
      (tx) => tx.reference === reference || tx.payment?.reference === reference,
    );
  }

  function reset(): void {
    state = seedState(today());
    storage?.removeItem(key);
    save();
  }

  return {
    get state() {
      return state;
    },
    today,
    now,
    tick,
    save,
    reset,
    nextId,
    timestamp,
    accountById,
    accountByEmail,
    createAccount,
    userView,
    vehicleView,
    addTransaction,
    addPaystackPayment,
    findTransaction,
  };
}

/**
 * Mock Paystack outcome by amount, so every path can be tried:
 * amounts ending in 13 (₦1,013) fail, amounts ending in 99 (₦1,099) never settle, the rest succeed.
 */
export function paymentOutcomeFor(amount: number): 'success' | 'failed' | 'never' {
  const lastTwo = Math.round(amount) % 100;
  if (lastTwo === 13) return 'failed';
  if (lastTwo === 99) return 'never';
  return 'success';
}

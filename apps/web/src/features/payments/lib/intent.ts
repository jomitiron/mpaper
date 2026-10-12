import type {
  Insurance,
  PaperKind,
  Roadworthiness,
  Vehicle,
  VehicleLicense,
} from '@motopapers/api';
import type { CarDraft } from '../../cars/add/draft';

/**
 * What a Paystack payment was for, remembered in sessionStorage before the driver is sent to
 * Paystack, so `/payments/callback?reference=` knows what to do when they come back. The API
 * can't carry this for us: `POST /transactions/initialize` takes only an amount and a category.
 *
 * Paystack returns to the same tab, so sessionStorage is enough, and it's gone with the tab.
 */

interface IntentBase {
  /** Paystack's reference (`MOT-…`), from `POST /transactions/initialize`. */
  reference: string;
  /** Naira. */
  amount: number;
  /** ms since epoch. Intents older than a week are dropped. */
  createdAt: number;
  /** Where the driver was. */
  returnTo: string;
}

export interface TopUpIntent extends IntentBase {
  kind: 'top-up';
}

/** What's been saved of a car paid for by card, so a reload never creates it twice. */
export interface SavedCar {
  vehicle: Vehicle;
  papers: {
    vehicle_license?: VehicleLicense;
    insurance?: Insurance;
    roadworthiness?: Roadworthiness;
  };
}

export interface AddCarIntent extends IntentBase {
  kind: 'add-car';
  /** Steps 1–3 of Add a car. */
  draft: CarDraft;
  saved?: SavedCar;
  /** Papers the driver chose to add later after they failed to save. */
  skipped?: PaperKind[];
  /** The car and every paper are saved (or skipped): nothing left to do. */
  done?: boolean;
  /** Paystack said the payment failed. */
  failed?: boolean;
}

/** Anything else paid by card (phase 4's renewals): a label for the receipt and where to go next. */
export interface OtherIntent extends IntentBase {
  kind: 'other';
  /** What it was for, e.g. "Licence renewal · EKY 219 GD". */
  label: string;
  /** The receipt's main button, e.g. "Track your renewal". Defaults to "Continue". */
  returnLabel?: string;
}

export type PaymentIntent = TopUpIntent | AddCarIntent | OtherIntent;

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** An intent before Paystack has given it a reference. */
export type NewIntent = DistributiveOmit<PaymentIntent, 'reference' | 'amount' | 'createdAt'>;

export const INTENTS_KEY = 'motopapers:payment-intents';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const KINDS: readonly string[] = ['top-up', 'add-car', 'other'];

export interface IntentStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStorage(): IntentStorage | null {
  try {
    return sessionStorage;
  } catch {
    return null; // Storage blocked: the return page falls back to a plain receipt.
  }
}

function isIntent(value: unknown): value is PaymentIntent {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (!KINDS.includes(v.kind as string)) return false;
  if (typeof v.reference !== 'string' || typeof v.amount !== 'number') return false;
  if (typeof v.createdAt !== 'number' || typeof v.returnTo !== 'string') return false;
  if (v.kind === 'add-car') return Boolean(v.draft && typeof v.draft === 'object');
  if (v.kind === 'other') return typeof v.label === 'string';
  return true;
}

export function createIntentStore(
  storage: IntentStorage | null = defaultStorage(),
  now: () => number = Date.now,
) {
  function readAll(): Record<string, PaymentIntent> {
    try {
      const parsed: unknown = JSON.parse(storage?.getItem(INTENTS_KEY) ?? '{}');
      if (!parsed || typeof parsed !== 'object') return {};
      const fresh: Record<string, PaymentIntent> = {};
      for (const [reference, intent] of Object.entries(parsed)) {
        if (isIntent(intent) && now() - intent.createdAt < MAX_AGE_MS) fresh[reference] = intent;
      }
      return fresh;
    } catch {
      return {};
    }
  }

  function writeAll(intents: Record<string, PaymentIntent>): void {
    try {
      storage?.setItem(INTENTS_KEY, JSON.stringify(intents));
    } catch {
      // Storage full or blocked: the return page falls back to a plain receipt.
    }
  }

  return {
    /** Remembers what a payment is for. Call before sending the driver to Paystack. */
    remember(intent: PaymentIntent): void {
      writeAll({ ...readAll(), [intent.reference]: intent });
    },
    recall(reference: string): PaymentIntent | null {
      return readAll()[reference] ?? null;
    },
    /** Changes a remembered add-car intent (what's been saved so far). */
    update(reference: string, change: (intent: AddCarIntent) => AddCarIntent): void {
      const all = readAll();
      const intent = all[reference];
      if (intent?.kind !== 'add-car') return;
      writeAll({ ...all, [reference]: change(intent) });
    },
    forget(reference: string): void {
      const all = readAll();
      delete all[reference];
      writeAll(all);
    },
    /** Cars paid for by card that aren't on the account yet (still confirming, or not saved). */
    unfinishedCars(): AddCarIntent[] {
      return Object.values(readAll())
        .filter((i): i is AddCarIntent => i.kind === 'add-car' && !i.done && !i.failed)
        .sort((a, b) => b.createdAt - a.createdAt);
    },
  };
}

export type IntentStore = ReturnType<typeof createIntentStore>;

let store: IntentStore | null = null;

/** The app's intent store (sessionStorage). */
export function intentStore(): IntentStore {
  store ??= createIntentStore();
  return store;
}

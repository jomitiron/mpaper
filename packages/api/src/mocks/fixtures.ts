import type { NotificationPreferences, Renewal } from '../schemas/gaps';
import type { Insurance, Roadworthiness, VehicleLicense } from '../schemas/papers';
import type { Transaction } from '../schemas/transaction';
import type { User } from '../schemas/user';
import { addDays } from '../status';

/**
 * Sample data from the approved design: Ada Okafor and her four cars. Expiry dates are set
 * relative to "today" so the statuses match the design whenever the mocks run:
 * KJA 731 AE insurance due in 9 days, EKY 219 GD licence expired 13 days ago, and so on.
 */

export interface MockVehicle {
  id: number;
  plate_number: string;
  brand: string;
  model: string;
  color: string;
  engine_number: string;
  chassis_number: string;
  engine_capacity: string;
  created_at: string;
  updated_at: string;
  /** Paper histories, oldest first. The last one is the car's current paper. */
  vehicle_licenses: VehicleLicense[];
  insurance: Insurance[];
  roadworthiness: Roadworthiness[];
}

export interface MockTransaction extends Transaction {
  /** When a pending Paystack payment settles (ms since epoch). Unset: stays as it is. */
  settleAt?: number;
  outcome?: 'success' | 'failed' | 'never';
  renewalId?: number;
}

export interface MockRenewal extends Renewal {
  /** When the renewal was paid (ms). Its status moves on from here. */
  paidAt?: number;
}

export interface MockAccount {
  user: User;
  password: string;
  walletBalance: number;
  vehicles: MockVehicle[];
  transactions: MockTransaction[];
  renewals: MockRenewal[];
  preferences: NotificationPreferences;
}

export interface MockState {
  version: 1;
  accounts: MockAccount[];
  nextId: number;
}

export const SAMPLE_EMAIL = 'ada.okafor@example.com';
export const SAMPLE_PASSWORD = 'password123';

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  email: true,
  sms: true,
  whatsapp: false,
  lead_days: [30, 14, 7],
  auto_renew: false,
};

/** What the document reader mock returns for any image ("Use a sample licence"). */
export const SAMPLE_LICENCE_READING: Record<string, { content: string }> = {
  'Registration Number': { content: 'KTU 604 XR' },
  'Vehicle Make': { content: 'Toyota' },
  'Vehicle Model': { content: 'Corolla' },
  'Vehicle Color': { content: 'Grey' },
  'Engine Number': { content: '2ZR-6618023' },
  'Chassis Number': { content: '2T1BURHE0KC184362' },
  'Engine Capacity': { content: '1,798 cc' },
  'Expiry Date': { content: '02/03/2027' },
  'Date Issued': { content: '03/03/2026' },
  PIN: { content: 'K7Q2M9XR4D' },
};

export function seedState(today: string): MockState {
  const at = (offsetDays: number, time = '09:30:00') =>
    `${addDays(today, offsetDays)}T${time}.000Z`;
  const created = at(-400);

  const vehicle = (
    id: number,
    details: Omit<
      MockVehicle,
      'id' | 'created_at' | 'updated_at' | 'vehicle_licenses' | 'insurance' | 'roadworthiness'
    >,
    papers: {
      licence: { days: number; pin: string };
      insurance?: { days: number; cover: 'third_party' | 'comprehensive'; value: number };
      road?: { days: number };
    },
  ): MockVehicle => ({
    id,
    ...details,
    created_at: created,
    updated_at: created,
    vehicle_licenses: [
      {
        id: id * 10 + 1,
        vehicle_id: id,
        expiry_date: addDays(today, papers.licence.days),
        license_pin: papers.licence.pin,
        created_at: created,
        updated_at: created,
      },
    ],
    insurance: papers.insurance
      ? [
          {
            id: id * 10 + 2,
            vehicle_id: id,
            cover_type: papers.insurance.cover,
            vehicle_value: papers.insurance.value,
            expiry_date: addDays(today, papers.insurance.days),
            created_at: created,
            updated_at: created,
          },
        ]
      : [],
    roadworthiness: papers.road
      ? [
          {
            id: id * 10 + 3,
            vehicle_id: id,
            expiry_date: addDays(today, papers.road.days),
            inspection_date: null,
            inspection_location: null,
            created_at: created,
            updated_at: created,
          },
        ]
      : [],
  });

  const vehicles: MockVehicle[] = [
    vehicle(
      101,
      {
        plate_number: 'KJA 731 AE',
        brand: 'Toyota',
        model: 'Camry',
        color: 'Silver',
        engine_number: '2AR-4417392',
        chassis_number: '4T1BF1FK5JU512847',
        engine_capacity: '2,494 cc',
      },
      {
        licence: { days: 154, pin: 'J4R8T2M6QA' },
        insurance: { days: 9, cover: 'third_party', value: 9_500_000 },
        road: { days: 114 },
      },
    ),
    vehicle(
      102,
      {
        plate_number: 'EKY 219 GD',
        brand: 'Ford',
        model: 'Edge',
        color: 'Blue',
        engine_number: 'DT-3J88210',
        chassis_number: '2FMPK4J98GBB30422',
        engine_capacity: '3,496 cc',
      },
      {
        licence: { days: -13, pin: 'P7N3K9D2XW' },
        insurance: { days: 237, cover: 'comprehensive', value: 12_000_000 },
        road: { days: 23 },
      },
    ),
    vehicle(
      103,
      {
        plate_number: 'LSD 482 KJ',
        brand: 'Honda',
        model: 'CR-V',
        color: 'Black',
        engine_number: 'K24W-9031157',
        chassis_number: '2HKRW2H85LH604119',
        engine_capacity: '2,356 cc',
      },
      {
        licence: { days: 312, pin: 'B5V1L8C4ZE' },
        insurance: { days: 103, cover: 'comprehensive', value: 18_500_000 },
        road: { days: 292 },
      },
    ),
    vehicle(
      104,
      {
        plate_number: 'APP 105 BC',
        brand: 'Lexus',
        model: 'RX 350',
        color: 'Red',
        engine_number: '2GR-7720045',
        chassis_number: '2T2BK1BA5FC281736',
        engine_capacity: '3,456 cc',
      },
      { licence: { days: 80, pin: 'H2Q9F6S3RY' } },
    ),
  ];

  const tx = (
    id: number,
    offsetDays: number,
    fields: Pick<
      MockTransaction,
      'amount' | 'status' | 'transaction_type' | 'category' | 'description'
    > &
      Partial<Pick<MockTransaction, 'vehicle_id' | 'document_type'>> & { paystack: boolean },
  ): MockTransaction => {
    const time = at(offsetDays, '10:15:00');
    const { paystack, ...rest } = fields;
    return {
      id,
      currency: 'NGN',
      reference: `T${id.toString(16).toUpperCase().padStart(32, '0')}`,
      user_id: 2631,
      payment: paystack
        ? {
            id,
            email: SAMPLE_EMAIL,
            amount: fields.amount,
            status: fields.status,
            currency: 'NGN',
            reference: `MOT-${id.toString(16).padStart(8, '0')}-0000-4000-8000-000000000000`,
            created_at: time,
            updated_at: time,
          }
        : null,
      created_at: time,
      updated_at: time,
      vehicle_id: null,
      document_type: null,
      ...rest,
    };
  };

  const transactions: MockTransaction[] = [
    tx(906, 0, {
      amount: 18_500,
      status: 'pending',
      transaction_type: 'debit',
      category: 'renewal',
      description: 'Licence renewal',
      vehicle_id: 102,
      document_type: 'vehicle_license',
      paystack: true,
    }),
    tx(905, -3, {
      amount: 20_000,
      status: 'success',
      transaction_type: 'credit',
      category: 'wallet_topup',
      description: 'Wallet top-up',
      paystack: true,
    }),
    tx(904, -9, {
      amount: 6_500,
      status: 'success',
      transaction_type: 'debit',
      category: 'renewal',
      description: 'Roadworthiness renewal',
      vehicle_id: 103,
      document_type: 'roadworthiness',
      paystack: false,
    }),
    tx(903, -14, {
      amount: 10_000,
      status: 'failed',
      transaction_type: 'credit',
      category: 'wallet_topup',
      description: 'Wallet top-up',
      paystack: true,
    }),
    tx(902, -26, {
      amount: 5_000,
      status: 'success',
      transaction_type: 'debit',
      category: 'service_charge',
      description: 'Tracking and reminders',
      paystack: true,
    }),
    tx(901, -189, {
      amount: 1_000,
      status: 'pending',
      transaction_type: 'credit',
      category: 'wallet_topup',
      description: 'Wallet top-up',
      paystack: true,
    }),
  ];

  const ada: MockAccount = {
    user: {
      id: 2631,
      first_name: 'Ada',
      last_name: 'Okafor',
      email: SAMPLE_EMAIL,
      phone: '+2348035550142',
      email_verified: true,
      wallet: { id: 2631, balance: 8_500 },
      address: '14 Admiralty Way, Lekki Phase 1, Lagos',
      created_at: created,
      updated_at: created,
    },
    password: SAMPLE_PASSWORD,
    walletBalance: 8_500,
    vehicles,
    transactions,
    renewals: [],
    preferences: { ...DEFAULT_PREFERENCES },
  };

  return { version: 1, accounts: [ada], nextId: 5000 };
}

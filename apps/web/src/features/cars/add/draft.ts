import {
  findDuplicatePlate,
  formatPlate,
  parseNaira,
  toCalendarDate,
  type CoverType,
  type LicenceField,
  type LicenceReading,
  type NewInsurance,
  type NewRoadworthiness,
  type NewVehicle,
  type NewVehicleLicense,
  type Vehicle,
} from '@motopapers/api';

/**
 * Everything the driver enters in Add a car, steps 1–3. Plain JSON (no Files, no Dates), so it can
 * be kept in sessionStorage across the Paystack redirect in step 4.
 */
export interface CarDraft {
  car: CarFields;
  licence: { expiry_date: string; license_pin: string };
  insurance: {
    cover: CoverType | 'none';
    /** As typed, e.g. "9,500,000". Only for comprehensive cover. */
    vehicle_value: string;
    expiry_date: string;
    /**
     * Chosen from GET /insurance-companies. The API has nowhere to store it yet (build plan:
     * "insurer on the insurance record"), so it isn't sent.
     */
    insurer_id: number | null;
  };
  roadworthiness: { expiry_date: string; none: boolean };
  /** Fields filled in by the licence reader: they get the "Read from licence" tag. */
  read: DraftField[];
  /** Text the reader found but couldn't use, e.g. an expiry date in an odd format. */
  unparsed: Partial<Record<DraftField, string>>;
  source: 'reader' | 'manual' | null;
}

export interface CarFields {
  plate_number: string;
  brand: string;
  model: string;
  color: string;
  engine_number: string;
  chassis_number: string;
  engine_capacity: string;
}

export type CarField = keyof CarFields;
export type DraftField = CarField | 'licence_expiry' | 'license_pin';

/** Step 2's fields, in the order the design shows them. */
export const DETAIL_FIELDS: readonly { key: DraftField; label: string }[] = [
  { key: 'plate_number', label: 'Plate number' },
  { key: 'licence_expiry', label: 'Licence expiry date' },
  { key: 'license_pin', label: 'Licence PIN' },
  { key: 'brand', label: 'Make' },
  { key: 'model', label: 'Model' },
  { key: 'color', label: 'Colour' },
  { key: 'engine_number', label: 'Engine number' },
  { key: 'chassis_number', label: 'Chassis number' },
  { key: 'engine_capacity', label: 'Engine capacity' },
];

const CAR_FIELDS: readonly CarField[] = [
  'plate_number',
  'brand',
  'model',
  'color',
  'engine_number',
  'chassis_number',
  'engine_capacity',
];

export function emptyDraft(): CarDraft {
  return {
    car: {
      plate_number: '',
      brand: '',
      model: '',
      color: '',
      engine_number: '',
      chassis_number: '',
      engine_capacity: '',
    },
    licence: { expiry_date: '', license_pin: '' },
    insurance: { cover: 'third_party', vehicle_value: '', expiry_date: '', insurer_id: null },
    roadworthiness: { expiry_date: '', none: false },
    read: [],
    unparsed: {},
    source: null,
  };
}

const READER_TO_DRAFT: Record<LicenceField, DraftField> = {
  plate_number: 'plate_number',
  brand: 'brand',
  model: 'model',
  color: 'color',
  engine_number: 'engine_number',
  chassis_number: 'chassis_number',
  engine_capacity: 'engine_capacity',
  expiry_date: 'licence_expiry',
  license_pin: 'license_pin',
};

/** Fills step 2 from what the licence reader read. Fields it didn't read are left empty. */
export function draftFromReading(reading: LicenceReading, base: CarDraft = emptyDraft()): CarDraft {
  const draft: CarDraft = {
    ...base,
    car: { ...emptyDraft().car },
    licence: { expiry_date: '', license_pin: '' },
    read: [],
    unparsed: {},
    source: 'reader',
  };
  for (const field of CAR_FIELDS) {
    const value = reading.vehicle[field];
    if (value) draft.car[field] = value;
  }
  draft.licence.expiry_date = reading.licence.expiry_date ?? '';
  draft.licence.license_pin = reading.licence.license_pin ?? '';
  draft.read = reading.read.map((field) => READER_TO_DRAFT[field]);
  for (const [field, text] of Object.entries(reading.unparsed)) {
    if (text) draft.unparsed[READER_TO_DRAFT[field as LicenceField]] = text;
  }
  return draft;
}

export function fieldValue(draft: CarDraft, field: DraftField): string {
  if (field === 'licence_expiry') return draft.licence.expiry_date;
  if (field === 'license_pin') return draft.licence.license_pin;
  return draft.car[field];
}

export function setFieldValue(draft: CarDraft, field: DraftField, value: string): void {
  if (field === 'licence_expiry') draft.licence.expiry_date = value;
  else if (field === 'license_pin') draft.licence.license_pin = value;
  else draft.car[field] = value;
  // An edited field is no longer what the reader read.
  draft.read = draft.read.filter((f) => f !== field);
  delete draft.unparsed[field];
}

// ---------------------------------------------------------------- validation

export type Errors<K extends string> = Partial<Record<K, string>>;

const REQUIRED: Record<CarField, string> = {
  plate_number: 'Enter the plate number.',
  brand: 'Enter the make, for example Toyota.',
  model: 'Enter the model, for example Corolla.',
  color: 'Enter the colour.',
  engine_number: 'Enter the engine number from the licence.',
  chassis_number: 'Enter the chassis number from the licence.',
  engine_capacity: 'Enter the engine capacity, for example 1,798 cc.',
};

function isDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && toCalendarDate(value) !== null;
}

/** The car already on the account with the draft's plate, if any. */
export function duplicateOf(draft: CarDraft, vehicles: readonly Vehicle[]): Vehicle | undefined {
  return findDuplicatePlate(draft.car.plate_number, vehicles);
}

/**
 * Step 2. The API needs every car field. The licence record needs both its expiry date and PIN,
 * so they go together: fill both to track the licence, or leave both empty to add it later.
 */
export function detailsErrors(
  draft: CarDraft,
  vehicles: readonly Vehicle[] = [],
): Errors<DraftField> {
  const errors: Errors<DraftField> = {};
  for (const field of CAR_FIELDS) {
    if (!draft.car[field].trim()) errors[field] = REQUIRED[field];
  }
  const plate = draft.car.plate_number.trim();
  if (plate && plate.replace(/[^a-z0-9]/gi, '').length < 4) {
    errors.plate_number = 'Check the plate number. It looks too short.';
  } else if (plate && duplicateOf(draft, vehicles)) {
    errors.plate_number = 'This plate is already on your account.';
  }

  const expiry = draft.licence.expiry_date.trim();
  const pin = draft.licence.license_pin.trim();
  if (expiry && !isDate(expiry)) errors.licence_expiry = 'Enter a real date.';
  if (expiry && !pin)
    errors.license_pin = 'Enter the licence PIN as well, or clear the expiry date.';
  if (pin && !expiry)
    errors.licence_expiry = 'Enter the licence expiry date as well, or clear the PIN.';
  return errors;
}

export type PaperField = 'vehicle_value' | 'insurance_expiry' | 'road_expiry';

/** Step 3. Either paper can be skipped ("No cover yet", "I don't have a certificate yet"). */
export function papersErrors(draft: CarDraft): Errors<PaperField> {
  const errors: Errors<PaperField> = {};
  const { insurance, roadworthiness } = draft;
  if (insurance.cover !== 'none') {
    if (!insurance.expiry_date) {
      errors.insurance_expiry = 'Enter the expiry date, or choose No cover yet.';
    } else if (!isDate(insurance.expiry_date)) {
      errors.insurance_expiry = 'Enter a real date.';
    }
    if (insurance.cover === 'comprehensive' && !(parseNaira(insurance.vehicle_value) > 0)) {
      errors.vehicle_value = "Enter the car's value, for example 9,500,000.";
    }
  }
  if (!roadworthiness.none) {
    if (!roadworthiness.expiry_date) {
      errors.road_expiry = "Enter the expiry date, or tick I don't have a certificate yet.";
    } else if (!isDate(roadworthiness.expiry_date)) {
      errors.road_expiry = 'Enter a real date.';
    }
  }
  return errors;
}

// ---------------------------------------------------------------- API bodies

export function toNewVehicle(draft: CarDraft): NewVehicle {
  const car = draft.car;
  return {
    plate_number: formatPlate(car.plate_number),
    brand: car.brand.trim(),
    model: car.model.trim(),
    color: car.color.trim(),
    engine_number: car.engine_number.trim(),
    chassis_number: car.chassis_number.trim(),
    engine_capacity: car.engine_capacity.trim(),
    is_paid_tier: true,
  };
}

export interface PaperBodies {
  vehicle_license?: NewVehicleLicense;
  insurance?: NewInsurance;
  roadworthiness?: NewRoadworthiness;
}

/** The paper records to create after the car. Skipped papers are left out. */
export function toPaperBodies(draft: CarDraft): PaperBodies {
  const bodies: PaperBodies = {};
  const pin = draft.licence.license_pin.trim();
  if (draft.licence.expiry_date && pin) {
    bodies.vehicle_license = { expiry_date: draft.licence.expiry_date, license_pin: pin };
  }
  const insurance = draft.insurance;
  if (insurance.cover !== 'none' && insurance.expiry_date) {
    bodies.insurance = {
      cover_type: insurance.cover,
      // The API needs a value for every cover type; it only means something for comprehensive.
      vehicle_value: insurance.cover === 'comprehensive' ? parseNaira(insurance.vehicle_value) : 0,
      expiry_date: insurance.expiry_date,
    };
  }
  if (!draft.roadworthiness.none && draft.roadworthiness.expiry_date) {
    bodies.roadworthiness = { expiry_date: draft.roadworthiness.expiry_date };
  }
  return bodies;
}

/** Digits grouped for the vehicle value field: "9500000" → "9,500,000". */
export function groupDigits(value: string): string {
  const amount = parseNaira(value);
  return amount ? new Intl.NumberFormat('en-NG').format(amount) : '';
}

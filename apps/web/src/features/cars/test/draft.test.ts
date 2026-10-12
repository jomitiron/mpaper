import { mapLicenceReading } from '@motopapers/api';
import { SAMPLE_LICENCE_READING } from '@motopapers/api/mocks';
import { describe, expect, it } from 'vitest';
import {
  detailsErrors,
  draftFromReading,
  duplicateOf,
  emptyDraft,
  groupDigits,
  papersErrors,
  setFieldValue,
  toNewVehicle,
  toPaperBodies,
  type CarDraft,
} from '../add/draft';
import { car } from './fixtures';

function filled(): CarDraft {
  return draftFromReading(mapLicenceReading(SAMPLE_LICENCE_READING));
}

describe('licence reader → Add a car', () => {
  it('fills every field and tags it "Read from licence"', () => {
    const draft = filled();
    expect(draft.car).toEqual({
      plate_number: 'KTU 604 XR',
      brand: 'Toyota',
      model: 'Corolla',
      color: 'Grey',
      engine_number: '2ZR-6618023',
      chassis_number: '2T1BURHE0KC184362',
      engine_capacity: '1,798 cc',
    });
    // Licences print dates day first: 02/03/2027 is 2 March 2027.
    expect(draft.licence).toEqual({ expiry_date: '2027-03-02', license_pin: 'K7Q2M9XR4D' });
    expect(draft.source).toBe('reader');
    expect([...draft.read].sort()).toEqual(
      [
        'brand',
        'chassis_number',
        'color',
        'engine_capacity',
        'engine_number',
        'licence_expiry',
        'license_pin',
        'model',
        'plate_number',
      ].sort(),
    );
  });

  it('leaves fields it could not read empty, and keeps unreadable dates as a hint', () => {
    const draft = draftFromReading(
      mapLicenceReading({
        'Registration Number': { content: 'lsd482kj' },
        'Expiry Date': { content: 'sometime next year' },
      }),
    );
    expect(draft.car.plate_number).toBe('LSD 482 KJ');
    expect(draft.car.brand).toBe('');
    expect(draft.licence.expiry_date).toBe('');
    expect(draft.unparsed.licence_expiry).toBe('sometime next year');
    expect(draft.read).toEqual(['plate_number']);
  });

  it('keeps the papers already entered when a new licence is read', () => {
    const base = emptyDraft();
    base.roadworthiness.expiry_date = '2027-01-09';
    const draft = draftFromReading(mapLicenceReading(SAMPLE_LICENCE_READING), base);
    expect(draft.roadworthiness.expiry_date).toBe('2027-01-09');
  });

  it('drops the tag from a field the driver edits', () => {
    const draft = filled();
    setFieldValue(draft, 'brand', 'Lexus');
    expect(draft.car.brand).toBe('Lexus');
    expect(draft.read).not.toContain('brand');
    expect(draft.read).toContain('model');
  });
});

describe('step 2 checks', () => {
  it('needs every car field', () => {
    const errors = detailsErrors(emptyDraft());
    expect(Object.keys(errors).sort()).toEqual(
      [
        'brand',
        'chassis_number',
        'color',
        'engine_capacity',
        'engine_number',
        'model',
        'plate_number',
      ].sort(),
    );
    expect(detailsErrors(filled())).toEqual({});
  });

  it('takes the licence expiry date and PIN together, or neither', () => {
    const draft = filled();
    draft.licence.license_pin = '';
    expect(detailsErrors(draft).license_pin).toMatch(/PIN/);
    draft.licence.expiry_date = '';
    expect(detailsErrors(draft)).toEqual({});
    draft.licence.license_pin = 'K7Q2';
    expect(detailsErrors(draft).licence_expiry).toMatch(/expiry date/);
    draft.licence.expiry_date = '2027-02-31';
    expect(detailsErrors(draft).licence_expiry).toBe('Enter a real date.');
  });

  it('spots a plate already on the account, however it is typed', () => {
    const vehicles = [car(1, {}, { plate_number: 'KJA 731 AE' })];
    for (const plate of ['KJA 731 AE', 'kja731ae', 'KJA-731-AE', ' kja 731-ae ']) {
      const draft = filled();
      draft.car.plate_number = plate;
      expect(duplicateOf(draft, vehicles)?.id, plate).toBe(1);
      expect(detailsErrors(draft, vehicles).plate_number).toBe(
        'This plate is already on your account.',
      );
    }
    const other = filled();
    other.car.plate_number = 'KJA 731 AF';
    expect(duplicateOf(other, vehicles)).toBeUndefined();
  });
});

describe('step 3 checks', () => {
  it('needs an expiry date unless the paper is skipped', () => {
    const draft = emptyDraft();
    expect(Object.keys(papersErrors(draft)).sort()).toEqual(['insurance_expiry', 'road_expiry']);
    draft.insurance.cover = 'none';
    draft.roadworthiness.none = true;
    expect(papersErrors(draft)).toEqual({});
  });

  it("needs the car's value for comprehensive cover", () => {
    const draft = emptyDraft();
    draft.insurance.cover = 'comprehensive';
    draft.insurance.expiry_date = '2027-04-18';
    draft.roadworthiness.none = true;
    expect(papersErrors(draft)).toEqual({ vehicle_value: expect.stringMatching(/value/) });
    draft.insurance.vehicle_value = '9,500,000';
    expect(papersErrors(draft)).toEqual({});
  });
});

describe('API bodies', () => {
  it('sends a tidy paid-tier car', () => {
    const draft = filled();
    draft.car.plate_number = ' ktu-604-xr ';
    draft.car.brand = ' Toyota ';
    expect(toNewVehicle(draft)).toEqual({
      plate_number: 'KTU 604 XR',
      brand: 'Toyota',
      model: 'Corolla',
      color: 'Grey',
      engine_number: '2ZR-6618023',
      chassis_number: '2T1BURHE0KC184362',
      engine_capacity: '1,798 cc',
      is_paid_tier: true,
    });
  });

  it('sends only the papers the driver added', () => {
    const draft = filled();
    draft.insurance.cover = 'none';
    draft.insurance.expiry_date = '2027-04-18';
    draft.roadworthiness.expiry_date = '2027-01-09';
    expect(toPaperBodies(draft)).toEqual({
      vehicle_license: { expiry_date: '2027-03-02', license_pin: 'K7Q2M9XR4D' },
      roadworthiness: { expiry_date: '2027-01-09' },
    });

    draft.insurance.cover = 'comprehensive';
    draft.insurance.vehicle_value = '₦9,500,000';
    draft.roadworthiness.none = true;
    expect(toPaperBodies(draft).insurance).toEqual({
      cover_type: 'comprehensive',
      vehicle_value: 9_500_000,
      expiry_date: '2027-04-18',
    });
    expect(toPaperBodies(draft).roadworthiness).toBeUndefined();

    // The API needs a value for every cover; third party sends 0.
    draft.insurance.cover = 'third_party';
    expect(toPaperBodies(draft).insurance?.vehicle_value).toBe(0);
  });

  it('groups digits in the value field', () => {
    expect(groupDigits('9500000')).toBe('9,500,000');
    expect(groupDigits('₦ 12,000,000.')).toBe('12,000,000');
    expect(groupDigits('')).toBe('');
  });
});

import { HttpError, mapLicenceReading, type Vehicle } from '@motopapers/api';
import { SAMPLE_LICENCE_READING } from '@motopapers/api/mocks';
import { describe, expect, it, vi } from 'vitest';
import { draftFromReading, toPaperBodies as toBodies, type CarDraft } from '../add/draft';
import { firstReminderLine } from '../add/reminder';
import { newProgress, papersInDraft, saveCar, type CarApi } from '../add/saveCar';
import { car, TODAY } from './fixtures';

function draft(): CarDraft {
  const d = draftFromReading(mapLicenceReading(SAMPLE_LICENCE_READING));
  d.insurance.expiry_date = '2027-04-18';
  d.roadworthiness.expiry_date = '2027-01-09';
  return d;
}

function fakeApi(overrides: Partial<CarApi> = {}) {
  const created: Vehicle = { ...car(900), plate_number: 'KTU 604 XR' };
  const record = { id: 1, expiry_date: '2027-01-01' };
  return {
    createVehicle: vi.fn(async () => created),
    createVehicleLicense: vi.fn(async () => record),
    createInsurance: vi.fn(async () => ({ ...record, cover_type: 'third_party' })),
    createRoadworthiness: vi.fn(async () => record),
    ...overrides,
  } satisfies CarApi;
}

describe('saveCar', () => {
  it('creates the car on the paid tier, then each paper for it', async () => {
    const api = fakeApi();
    const result = await saveCar(draft(), newProgress(), api);
    expect(api.createVehicle).toHaveBeenCalledWith(
      expect.objectContaining({ plate_number: 'KTU 604 XR', is_paid_tier: true }),
    );
    expect(api.createVehicleLicense).toHaveBeenCalledWith(900, {
      expiry_date: '2027-03-02',
      license_pin: 'K7Q2M9XR4D',
    });
    expect(api.createInsurance).toHaveBeenCalledWith(900, {
      cover_type: 'third_party',
      vehicle_value: 0,
      expiry_date: '2027-04-18',
    });
    expect(api.createRoadworthiness).toHaveBeenCalledWith(900, { expiry_date: '2027-01-09' });
    expect(result.failed).toEqual([]);
    expect(result.saved).toEqual(['vehicle_license', 'insurance', 'roadworthiness']);
  });

  it('skips papers the driver left out', async () => {
    const d = draft();
    d.insurance.cover = 'none';
    d.roadworthiness.none = true;
    const api = fakeApi();
    await saveCar(d, newProgress(), api);
    expect(api.createInsurance).not.toHaveBeenCalled();
    expect(api.createRoadworthiness).not.toHaveBeenCalled();
    expect(papersInDraft(d)).toEqual(['vehicle_license']);
  });

  it('retries only the failed paper, without creating the car again', async () => {
    const insurance = vi
      .fn<CarApi['createInsurance']>()
      .mockRejectedValueOnce(new HttpError(500, 'Server error', {}))
      .mockResolvedValue({ id: 2, cover_type: 'third_party', expiry_date: '2027-04-18' });
    const api = fakeApi({ createInsurance: insurance });
    const progress = newProgress();

    const first = await saveCar(draft(), progress, api);
    expect(first.failed.map((f) => f.kind)).toEqual(['insurance']);
    expect(first.saved).toEqual(['vehicle_license', 'roadworthiness']);

    const second = await saveCar(draft(), progress, api);
    expect(second.failed).toEqual([]);
    expect(api.createVehicle).toHaveBeenCalledTimes(1);
    expect(api.createVehicleLicense).toHaveBeenCalledTimes(1);
    expect(api.createRoadworthiness).toHaveBeenCalledTimes(1);
    expect(insurance).toHaveBeenCalledTimes(2);
  });

  it('throws when the car itself fails, so the next try creates it', async () => {
    const createVehicle = vi
      .fn<CarApi['createVehicle']>()
      .mockRejectedValueOnce(
        new HttpError(409, 'This plate number is already on your account', {}),
      );
    const api = fakeApi({ createVehicle });
    const progress = newProgress();
    await expect(saveCar(draft(), progress, api)).rejects.toMatchObject({ status: 409 });
    expect(progress.vehicle).toBeNull();
    expect(api.createVehicleLicense).not.toHaveBeenCalled();
  });
});

describe('first reminder line', () => {
  const all = ['vehicle_license', 'insurance', 'roadworthiness'] as const;

  it('gives the date 30 days before the earliest expiry', () => {
    const d = draft();
    expect(firstReminderLine(toBodies(d), all, TODAY)).toBe(
      "We'll send your first reminder on 10 Dec 2026, 30 days before the earliest expiry.",
    );
  });

  it('says what to do when a paper is already due or expired', () => {
    const d = draft();
    d.roadworthiness.expiry_date = '2026-10-20';
    expect(firstReminderLine(toBodies(d), all, TODAY)).toBe(
      'Its roadworthiness is due in 9 days. Renew it from My cars.',
    );
    d.roadworthiness.expiry_date = '2026-10-01';
    expect(firstReminderLine(toBodies(d), all, TODAY)).toBe(
      'Its roadworthiness expired 10 days ago. Renew it from My cars.',
    );
  });

  it('ignores papers that were not saved, and handles none', () => {
    const d = draft();
    d.roadworthiness.expiry_date = '2026-10-01';
    expect(firstReminderLine(toBodies(d), ['vehicle_license'], TODAY)).toMatch(/31 Jan 2027/);
    expect(firstReminderLine(toBodies(d), [], TODAY)).toBe(
      'Add expiry dates from the car panel to start getting reminders.',
    );
  });
});

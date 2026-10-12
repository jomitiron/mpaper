import { addDays, type Vehicle } from '@motopapers/api';

/** A fixed "today" so the status maths in tests never drifts. */
export const TODAY = '2026-10-11';

/** A car with papers expiring `days` from TODAY (null: not on file). */
export function car(
  id: number,
  papers: { licence?: number | null; insurance?: number | null; road?: number | null } = {},
  details: Partial<Pick<Vehicle, 'plate_number' | 'brand' | 'model' | 'color'>> = {},
): Vehicle {
  const at = (days: number | null | undefined) =>
    days === null || days === undefined ? null : addDays(TODAY, days);
  const licence = at(papers.licence);
  const insurance = at(papers.insurance);
  const road = at(papers.road);
  return {
    id,
    plate_number: details.plate_number ?? `KJA ${100 + id} AE`,
    brand: details.brand ?? 'Toyota',
    model: details.model ?? 'Camry',
    color: details.color ?? 'Silver',
    engine_number: '2AR-4417392',
    chassis_number: '4T1BF1FK5JU512847',
    engine_capacity: '2,494 cc',
    vehicle_license: licence ? { id: id * 10 + 1, expiry_date: licence, license_pin: 'PIN' } : null,
    insurance: insurance
      ? { id: id * 10 + 2, expiry_date: insurance, cover_type: 'third_party', vehicle_value: 0 }
      : null,
    roadworthiness: road ? { id: id * 10 + 3, expiry_date: road } : null,
  };
}

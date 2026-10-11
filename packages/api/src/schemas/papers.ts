import { z } from 'zod';
import { isoDate } from './common';

/**
 * The three papers. Endpoints are singular: `/vehicle/:id/insurance|roadworthiness|vehicle-licenses`.
 * Records nested in a vehicle leave out `vehicle_id`.
 */

export const coverTypes = ['third_party', 'comprehensive'] as const;
export type CoverType = (typeof coverTypes)[number];

export const insuranceSchema = z.object({
  id: z.number(),
  vehicle_id: z.number().optional(),
  /** `third_party` or `comprehensive`. Kept as a string so an unexpected value can't break a page. */
  cover_type: z.string(),
  vehicle_value: z.number().nullish(),
  expiry_date: isoDate,
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});
export type Insurance = z.infer<typeof insuranceSchema>;

export const roadworthinessSchema = z.object({
  id: z.number(),
  vehicle_id: z.number().optional(),
  expiry_date: isoDate,
  inspection_date: z.string().nullish(),
  inspection_location: z.string().nullish(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});
export type Roadworthiness = z.infer<typeof roadworthinessSchema>;

export const vehicleLicenseSchema = z.object({
  id: z.number(),
  vehicle_id: z.number().optional(),
  expiry_date: isoDate,
  license_pin: z.string().nullish(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});
export type VehicleLicense = z.infer<typeof vehicleLicenseSchema>;

export const newInsuranceSchema = z.object({
  cover_type: z.enum(coverTypes),
  vehicle_value: z.number().nonnegative(),
  expiry_date: z.iso.date(),
});
export type NewInsurance = z.infer<typeof newInsuranceSchema>;

export const newRoadworthinessSchema = z.object({
  expiry_date: z.iso.date(),
});
export type NewRoadworthiness = z.infer<typeof newRoadworthinessSchema>;

export const newVehicleLicenseSchema = z.object({
  license_pin: z.string().min(1),
  /** The docs table says "number" but the example is a `YYYY-MM-DD` string, which is what we send. */
  expiry_date: z.iso.date(),
});
export type NewVehicleLicense = z.infer<typeof newVehicleLicenseSchema>;

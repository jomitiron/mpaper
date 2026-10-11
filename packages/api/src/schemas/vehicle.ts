import { z } from 'zod';
import { nullable, text } from './common';
import { insuranceSchema, roadworthinessSchema, vehicleLicenseSchema } from './papers';

export const vehicleOwnerSchema = z.object({
  id: z.number(),
  first_name: z.string().nullish(),
  last_name: z.string().nullish(),
});

/**
 * A car. `GET /vehicles` and `GET /vehicles/:id` include the current licence, insurance and
 * roadworthiness (or null). Create and update responses leave them out, so they come out as null.
 * The API doesn't store the year.
 */
export const vehicleSchema = z.object({
  id: z.number(),
  plate_number: z.string(),
  brand: text,
  model: text,
  color: text,
  engine_number: text,
  chassis_number: text,
  engine_capacity: text,
  user: vehicleOwnerSchema.optional(),
  user_id: z.number().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  vehicle_license: nullable(vehicleLicenseSchema),
  insurance: nullable(insuranceSchema),
  roadworthiness: nullable(roadworthinessSchema),
});
export type Vehicle = z.infer<typeof vehicleSchema>;

export const newVehicleSchema = z.object({
  plate_number: z.string().min(1),
  engine_number: z.string().min(1),
  engine_capacity: z.string().min(1),
  chassis_number: z.string().min(1),
  brand: z.string().min(1),
  model: z.string().min(1),
  color: z.string().min(1),
  is_paid_tier: z.boolean(),
});
export type NewVehicle = z.infer<typeof newVehicleSchema>;

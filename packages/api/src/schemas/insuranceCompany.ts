import { z } from 'zod';

export const insuranceCompanySchema = z.object({
  id: z.number(),
  name: z.string(),
});
export type InsuranceCompany = z.infer<typeof insuranceCompanySchema>;

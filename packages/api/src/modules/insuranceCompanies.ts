import { z } from 'zod';
import { request } from '../client';
import { envelope } from '../schemas/common';
import { insuranceCompanySchema, type InsuranceCompany } from '../schemas/insuranceCompany';

/** `GET /insurance-companies`. The insurers a driver can pick from (57 today). */
export async function listInsuranceCompanies(
  options: { signal?: AbortSignal } = {},
): Promise<InsuranceCompany[]> {
  const res = await request('/insurance-companies', {
    schema: envelope(z.array(insuranceCompanySchema)),
    ...options,
  });
  return res.data;
}

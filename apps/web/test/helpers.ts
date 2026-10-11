import type { User } from '@motopapers/api';

export const ADA: User = {
  id: 2631,
  first_name: 'Ada',
  last_name: 'Okafor',
  email: 'ada.okafor@example.com',
  phone: '+2348035550142',
  email_verified: true,
  wallet: { id: 2631, balance: 8500 },
  address: null,
  created_at: '2025-09-01T10:00:00.000Z',
};

/** A JWT-shaped token that expires `inSeconds` from now. */
export function tokenExpiringIn(inSeconds: number): string {
  const encode = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, '');
  const exp = Math.floor(Date.now() / 1000) + inSeconds;
  return `${encode({ alg: 'none' })}.${encode({ id: ADA.id, exp })}.sig`;
}

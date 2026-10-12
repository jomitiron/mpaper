import type { UpdateUserBody, User } from '@motopapers/api';
import { checkPhone, normalisePhone, type FormErrors } from '@/features/auth/lib/validation';

/**
 * The delivery address (and, when the account has none, the phone number the team calls) on the
 * renew page. Both are the driver's profile details, so they're saved back with `PUT /users`.
 */

export const ADDRESS_HINT = 'Street, area and city, like 14 Admiralty Way, Lekki Phase 1, Lagos.';
const MIN_ADDRESS = 10;

export function checkAddress(value: string): string | undefined {
  const address = value.trim();
  if (!address) return 'Enter the address we should deliver to.';
  if (address.length < MIN_ADDRESS) return `Add the street, area and city. ${ADDRESS_HINT}`;
  return undefined;
}

export interface DeliveryValues {
  address: string;
  /** Asked for only when the account has no phone number (some Google sign-ups). */
  phone: string | null;
}

export function validateDelivery(values: DeliveryValues): FormErrors<'address' | 'phone'> {
  const errors: FormErrors<'address' | 'phone'> = {};
  const address = checkAddress(values.address);
  if (address) errors.address = address;
  if (values.phone !== null) {
    const phone = checkPhone(values.phone);
    if (phone) errors.phone = phone;
  }
  return errors;
}

/** What to send to `PUT /users`, or null when nothing changed. */
export function profileChanges(user: User | null, values: DeliveryValues): UpdateUserBody | null {
  const body: UpdateUserBody = {};
  const address = values.address.trim();
  if (address !== (user?.address ?? '').trim()) body.address = address;
  if (values.phone !== null) {
    const phone = normalisePhone(values.phone);
    if (phone && phone !== user?.phone) body.phone = phone;
  }
  return Object.keys(body).length ? body : null;
}

/** `+2348035550142` → `+234 803 555 0142`, as the design writes numbers. */
export function formatPhone(phone: string | null | undefined): string {
  const normal = phone ? normalisePhone(phone) : null;
  if (!normal) return phone ?? '';
  const d = normal.slice(4);
  return `+234 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

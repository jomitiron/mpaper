import { updateUser, type UpdateUserBody, type User } from '@motopapers/api';
import { checkPhone, normalisePhone, type FormErrors } from '@/features/auth/lib/validation';
import { checkAddress, formatPhone } from '@/features/renewals/lib/delivery';

/**
 * Settings' profile: first name, last name, phone number and delivery address (`PUT /users`).
 * Email can't be changed; it's used to sign in.
 */

export interface ProfileValues {
  first_name: string;
  last_name: string;
  /** As typed: `803 555 0142`, `0803…`, `+234…`. */
  phone: string;
  address: string;
}

export type ProfileField = keyof ProfileValues;

/** The form, filled in from the signed-in driver. */
export function profileValues(user: User | null): ProfileValues {
  return {
    first_name: user?.first_name ?? '',
    last_name: user?.last_name ?? '',
    // The +234 sits before the box, so show the rest: "803 555 0142".
    phone: formatPhone(user?.phone).replace(/^\+234\s?/, ''),
    address: user?.address ?? '',
  };
}

/**
 * What's wrong with the form, by field. The phone can stay empty only if the account never had
 * one (some Google sign-ups); the address is optional here, but must be whole if given.
 */
export function validateProfile(
  values: ProfileValues,
  user: User | null,
): FormErrors<ProfileField> {
  const errors: FormErrors<ProfileField> = {};
  if (!values.first_name.trim()) errors.first_name = 'Enter your first name.';
  if (!values.last_name.trim()) errors.last_name = 'Enter your last name.';
  if (values.phone.trim() || user?.phone) {
    const phone = checkPhone(values.phone);
    if (phone) errors.phone = phone;
  }
  if (values.address.trim()) {
    const address = checkAddress(values.address);
    if (address) errors.address = address;
  }
  return errors;
}

/** The fields that changed, ready for `PUT /users`, or null when nothing did. */
export function profileBody(user: User | null, values: ProfileValues): UpdateUserBody | null {
  const body: UpdateUserBody = {};
  const first = values.first_name.trim();
  const last = values.last_name.trim();
  const address = values.address.trim();
  const phone = values.phone.trim() ? normalisePhone(values.phone) : '';
  if (first !== (user?.first_name ?? '')) body.first_name = first;
  if (last !== (user?.last_name ?? '')) body.last_name = last;
  if (phone !== null && phone !== (user?.phone ?? '')) body.phone = phone;
  if (address !== (user?.address ?? '').trim()) body.address = address;
  return Object.keys(body).length ? body : null;
}

/** What Settings needs from the session store. */
export interface ProfileSession {
  user: User | null;
  setUser(user: User): void;
}

let latest = 0;

/**
 * Saves profile changes optimistically: the new details show (and the sidebar's name changes)
 * straight away, the API is told, and if it says no the old details come back and the error is
 * thrown for the form to show. A later save wins: an older one finishing doesn't undo it.
 */
export async function saveProfile(
  session: ProfileSession,
  body: UpdateUserBody,
  update: typeof updateUser = updateUser,
): Promise<User> {
  const before = session.user;
  if (!before) throw new Error('Sign in to change your profile.');
  const attempt = ++latest;
  const optimistic: User = { ...before, ...body };
  session.setUser(optimistic);
  try {
    const saved = await update(body);
    const merged: User = { ...optimistic, ...saved };
    if (attempt === latest) session.setUser(merged);
    return merged;
  } catch (error) {
    if (attempt === latest) session.setUser(before);
    throw error;
  }
}

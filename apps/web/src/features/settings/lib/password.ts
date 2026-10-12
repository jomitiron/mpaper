import { isHttpError } from '@motopapers/api';
import { apiFieldErrors } from '@/features/auth/lib/errors';
import { checkNewPassword, type FormErrors } from '@/features/auth/lib/validation';

/** Change password (`POST /users/password` with the old and new passwords). */

export interface PasswordValues {
  old_password: string;
  new_password: string;
}

export type PasswordField = keyof PasswordValues;

export function validatePassword(values: PasswordValues): FormErrors<PasswordField> {
  const errors: FormErrors<PasswordField> = {};
  if (!values.old_password) errors.old_password = 'Enter your current password.';
  const fresh = checkNewPassword(values.new_password);
  if (fresh) errors.new_password = fresh;
  else if (values.new_password === values.old_password) {
    errors.new_password = "Choose a password that's different from your current one.";
  }
  return errors;
}

/**
 * Where an API error belongs: a wrong current password (400 "Invalid old password") goes under
 * that field; field errors go under theirs; anything else is for the whole form.
 */
export function passwordErrors(error: unknown): FormErrors<PasswordField> {
  const fields = apiFieldErrors(error, ['old_password', 'new_password']);
  if (Object.keys(fields).length) return fields;
  if (isHttpError(error, 400) && /old|current|incorrect|invalid/i.test(error.message)) {
    return { old_password: "That's not your current password. Check it and try again." };
  }
  return {};
}

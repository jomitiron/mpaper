import { errorMessage, isHttpError } from '@motopapers/api';
import type { FormErrors } from './validation';

/**
 * Turns API errors into plain messages for the auth forms. The API's own message is used where it
 * reads well; a few are reworded (its OTP and sign-in messages are terse).
 */

/** Field errors the API sent back (`status: "fail"`), for the fields this form shows. */
export function apiFieldErrors<K extends string>(
  error: unknown,
  fields: readonly K[],
): FormErrors<K> {
  if (!isHttpError(error)) return {};
  const out: FormErrors<K> = {};
  for (const field of fields) {
    const message = error.fields[field];
    if (message) out[field] = sentence(message);
  }
  return out;
}

export function signInError(error: unknown): string {
  if (isHttpError(error, 401)) {
    return "That email and password don't match. Check them and try again.";
  }
  return errorMessage(error);
}

/**
 * The API answers the right password for an unverified email with a bare 500 (seen on
 * ijanla-dev), so a 500 from sign-in may mean "verify your email first".
 */
export function mightBeUnverified(error: unknown): boolean {
  return isHttpError(error) && error.status >= 500;
}

export type CodeProblem = 'expired' | 'invalid';

/** Whether a verify-email or reset-password error is about the code. */
export function codeProblem(error: unknown): CodeProblem | null {
  if (!isHttpError(error) || error.status >= 500) return null;
  if (error.isExpired === true || /expired/i.test(error.message)) return 'expired';
  // Wrong code: "Invalid OTP". An unknown email gets "Invalid credentials".
  if (error.isExpired === false || /otp|credentials/i.test(error.message)) return 'invalid';
  return null;
}

export const CODE_MESSAGES: Record<CodeProblem, string> = {
  expired: 'That code has expired. Send a new code and try again.',
  invalid: "That code isn't right. Check the email we sent and try again.",
};

export function isDuplicateEmail(error: unknown): boolean {
  return (
    isHttpError(error) && error.status < 500 && /already (exists|registered)/i.test(error.message)
  );
}

/** "email must be a valid email" → "Email must be a valid email." */
function sentence(message: string): string {
  const text = message.trim().replace(/_/g, ' ');
  const capital = text.charAt(0).toUpperCase() + text.slice(1);
  return /[.!?]$/.test(capital) ? capital : `${capital}.`;
}

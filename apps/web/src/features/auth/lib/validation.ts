/**
 * Checks for the sign-in, sign-up and reset forms. Each returns a message for the driver, or
 * undefined when the value is fine. Form errors are keyed by the API's field names, so errors the
 * API sends back land under the same fields.
 */

export type FormErrors<K extends string> = Partial<Record<K, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const PASSWORD_HINT = 'At least 8 characters, including a number.';
export const OTP_LENGTH = 6;

export function checkEmail(value: string): string | undefined {
  const email = value.trim();
  if (!email) return 'Enter your email address.';
  if (!EMAIL.test(email)) return 'Enter an email address like name@example.com.';
  return undefined;
}

/** A password the driver is choosing (sign up, reset). */
export function checkNewPassword(value: string): string | undefined {
  if (!value) return 'Choose a password.';
  if (value.length < 8) return 'Use at least 8 characters.';
  if (!/\d/.test(value)) return 'Include at least one number.';
  return undefined;
}

export function checkCode(value: string): string | undefined {
  if (!new RegExp(`^\\d{${OTP_LENGTH}}$`).test(value)) {
    return `Enter the ${OTP_LENGTH}-digit code from the email.`;
  }
  return undefined;
}

/**
 * A Nigerian mobile number in international form (`+2348035550142`), or null. Takes what drivers
 * type: `803 555 0142`, `0803 555 0142`, `+234 803 555 0142`, `2348035550142`.
 */
export function normalisePhone(value: string): string | null {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('234')) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return /^[789]\d{9}$/.test(digits) ? `+234${digits}` : null;
}

export function checkPhone(value: string): string | undefined {
  if (!value.trim()) return 'Enter your phone number.';
  if (!normalisePhone(value)) return 'Enter a Nigerian mobile number, like 803 555 0142.';
  return undefined;
}

export interface SignInValues {
  email: string;
  password: string;
}

export function validateSignIn(values: SignInValues): FormErrors<keyof SignInValues> {
  return compact({
    email: checkEmail(values.email),
    password: values.password ? undefined : 'Enter your password.',
  });
}

export interface SignUpValues {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  password: string;
}

export function validateSignUp(values: SignUpValues): FormErrors<keyof SignUpValues> {
  return compact({
    first_name: values.first_name.trim() ? undefined : 'Enter your first name.',
    last_name: values.last_name.trim() ? undefined : 'Enter your last name.',
    phone: checkPhone(values.phone),
    email: checkEmail(values.email),
    password: checkNewPassword(values.password),
  });
}

export interface ResetValues {
  email: string;
  otp: string;
  password: string;
}

export function validateReset(values: ResetValues): FormErrors<keyof ResetValues> {
  return compact({
    email: checkEmail(values.email),
    otp: checkCode(values.otp),
    password: checkNewPassword(values.password),
  });
}

export function hasErrors(errors: object): boolean {
  return Object.keys(errors).length > 0;
}

function compact<K extends string>(errors: Record<K, string | undefined>): FormErrors<K> {
  const out: FormErrors<K> = {};
  for (const key of Object.keys(errors) as K[]) {
    if (errors[key]) out[key] = errors[key];
  }
  return out;
}

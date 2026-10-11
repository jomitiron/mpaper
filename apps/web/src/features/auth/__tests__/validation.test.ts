import { HttpError, NetworkError } from '@motopapers/api';
import { describe, expect, it } from 'vitest';
import {
  apiFieldErrors,
  codeProblem,
  isDuplicateEmail,
  mightBeUnverified,
  signInError,
} from '../lib/errors';
import {
  checkCode,
  checkEmail,
  checkNewPassword,
  normalisePhone,
  validateReset,
  validateSignIn,
  validateSignUp,
} from '../lib/validation';

describe('phone numbers', () => {
  it.each([
    ['803 555 0142', '+2348035550142'],
    ['0803 555 0142', '+2348035550142'],
    ['+234 803 555 0142', '+2348035550142'],
    ['2348035550142', '+2348035550142'],
    ['+234 (0) 803-555-0142', '+2348035550142'],
    ['0701 234 5678', '+2347012345678'],
    ['09123456789', '+2349123456789'],
  ])('reads %s as %s', (typed, phone) => {
    expect(normalisePhone(typed)).toBe(phone);
  });

  it.each(['', '0803', '803 555 01420', '0603 555 0142', '+44 20 7946 0958', 'call me'])(
    'rejects %j',
    (typed) => {
      expect(normalisePhone(typed)).toBeNull();
    },
  );
});

describe('fields', () => {
  it('checks emails', () => {
    expect(checkEmail('')).toBe('Enter your email address.');
    expect(checkEmail('ada@')).toMatch(/like name@example.com/);
    expect(checkEmail('  ada.okafor@example.com ')).toBeUndefined();
  });

  it('wants 8 characters and a number in a new password', () => {
    expect(checkNewPassword('')).toBe('Choose a password.');
    expect(checkNewPassword('abc123')).toBe('Use at least 8 characters.');
    expect(checkNewPassword('password')).toBe('Include at least one number.');
    expect(checkNewPassword('password1')).toBeUndefined();
  });

  it('wants six digits in a code', () => {
    expect(checkCode('12345')).toBe('Enter the 6-digit code from the email.');
    expect(checkCode('12345a')).toBeDefined();
    expect(checkCode('123456')).toBeUndefined();
  });
});

describe('forms', () => {
  it('sign in needs an email and a password (any password)', () => {
    expect(validateSignIn({ email: '', password: '' })).toEqual({
      email: 'Enter your email address.',
      password: 'Enter your password.',
    });
    expect(validateSignIn({ email: 'ada.okafor@example.com', password: 'x' })).toEqual({});
  });

  it('sign up checks every field', () => {
    expect(
      validateSignUp({
        first_name: ' ',
        last_name: '',
        phone: '123',
        email: 'x',
        password: 'short',
      }),
    ).toEqual({
      first_name: 'Enter your first name.',
      last_name: 'Enter your last name.',
      phone: 'Enter a Nigerian mobile number, like 803 555 0142.',
      email: 'Enter an email address like name@example.com.',
      password: 'Use at least 8 characters.',
    });
    expect(
      validateSignUp({
        first_name: 'Ada',
        last_name: 'Okafor',
        phone: '803 555 0142',
        email: 'ada.okafor@example.com',
        password: 'okafor2026',
      }),
    ).toEqual({});
  });

  it('reset needs the email, the code and a good password', () => {
    expect(validateReset({ email: 'ada@example.com', otp: '12', password: 'pass' })).toEqual({
      otp: 'Enter the 6-digit code from the email.',
      password: 'Use at least 8 characters.',
    });
  });
});

describe('API errors', () => {
  const http = (status: number, body: object) =>
    new HttpError(status, (body as { message: string }).message, body);

  it('rewords a wrong sign-in and keeps other messages', () => {
    expect(signInError(http(401, { message: 'Invalid credentials' }))).toBe(
      "That email and password don't match. Check them and try again.",
    );
    expect(signInError(new NetworkError(new TypeError('fetch failed')))).toMatch(/connection/);
  });

  it('treats a 500 from sign-in as a maybe-unverified account', () => {
    expect(mightBeUnverified(http(500, { message: 'Something went wrong' }))).toBe(true);
    expect(mightBeUnverified(http(401, { message: 'Invalid credentials' }))).toBe(false);
  });

  it('tells an expired code from a wrong one', () => {
    expect(codeProblem(http(400, { message: 'Expired OTP', is_expired: true }))).toBe('expired');
    expect(codeProblem(http(400, { message: 'Invalid OTP', is_expired: false }))).toBe('invalid');
    expect(codeProblem(http(400, { message: 'Invalid OTP' }))).toBe('invalid');
    expect(codeProblem(http(400, { message: 'Invalid credentials', is_expired: false }))).toBe(
      'invalid',
    );
    expect(codeProblem(http(500, { message: 'Something went wrong' }))).toBeNull();
  });

  it('puts field errors under the matching fields', () => {
    const error = http(400, {
      status: 'fail',
      message: 'email must be a valid email',
      data: { email: 'email must be a valid email', value: 'something else' },
    });
    expect(apiFieldErrors(error, ['email', 'phone'] as const)).toEqual({
      email: 'Email must be a valid email.',
    });
  });

  it('spots a duplicate email', () => {
    expect(isDuplicateEmail(http(400, { message: 'A user with this email already exists' }))).toBe(
      true,
    );
    expect(isDuplicateEmail(http(400, { message: 'Invalid params' }))).toBe(false);
  });
});

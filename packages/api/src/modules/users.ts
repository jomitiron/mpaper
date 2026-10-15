import { z } from 'zod';
import { isHttpError, request } from '../client';
import { envelope, messageEnvelope } from '../schemas/common';
import {
  sessionSchema,
  userSchema,
  type OAuthAction,
  type OAuthBody,
  type OAuthField,
  type OAuthPlatform,
  type ResetPasswordBody,
  type Session,
  type SignInBody,
  type SignUpBody,
  type UpdatePasswordBody,
  type UpdateUserBody,
  type User,
} from '../schemas/user';

interface Options {
  signal?: AbortSignal;
}

/** `POST /users/sign-up`. Returns the new, unverified user; a code is emailed to them. */
export async function signUp(body: SignUpBody | OAuthBody, options: Options = {}): Promise<User> {
  const res = await request('/users/sign-up', {
    method: 'POST',
    body,
    auth: false,
    schema: envelope(z.object({ user: userSchema })),
    ...options,
  });
  return res.data.user;
}

/** `POST /users/verify-email`. Returns the verified user and a token. */
export async function verifyEmail(
  body: { email: string; otp: string },
  options: Options = {},
): Promise<Session> {
  const res = await request('/users/verify-email', {
    method: 'POST',
    body,
    auth: false,
    schema: envelope(sessionSchema),
    ...options,
  });
  return res.data;
}

/** `POST /users/sign-in` with email and password, or an OAuth code. A 401 means wrong details. */
export async function signIn(
  body: SignInBody | OAuthBody,
  options: Options = {},
): Promise<Session> {
  const res = await request('/users/sign-in', {
    method: 'POST',
    body,
    auth: false,
    schema: envelope(sessionSchema),
    ...options,
  });
  return res.data;
}

/** `POST /users/resend-verification-email`. Sends the token if there is one, as the docs ask. */
export async function resendVerificationEmail(
  body: { email: string },
  options: Options = {},
): Promise<void> {
  await request('/users/resend-verification-email', {
    method: 'POST',
    body,
    schema: messageEnvelope,
    ...options,
  });
}

/** `POST /users/sign-out`. */
export async function signOut(options: Options = {}): Promise<void> {
  await request('/users/sign-out', { method: 'POST', schema: messageEnvelope, ...options });
}

/**
 * `GET /users/oauth-url`. Returns the provider URL to send the driver to, and the API's name for
 * the provider (see `OAuthField`) so the code that comes back goes in the right field. Asks with
 * the documented `platform` first; an API that answers "type is required" is asked again with `type`.
 */
export async function getOAuthUrl(
  params: { platform: OAuthPlatform; action: OAuthAction },
  options: Options = {},
): Promise<{ url: string; field: OAuthField }> {
  const ask = async (field: OAuthField) => {
    const res = await request('/users/oauth-url', {
      query: { [field]: params.platform, action: params.action },
      auth: false,
      schema: envelope(z.string()),
      ...options,
    });
    return { url: res.data, field };
  };
  try {
    return await ask('platform');
  } catch (error) {
    if (isHttpError(error, 400) && 'type' in error.fields) return ask('type');
    throw error;
  }
}

/** The sign-in or sign-up body for an OAuth code, with the provider under the API's name for it. */
export function oauthBody(code: string, platform: OAuthPlatform, field: OAuthField): OAuthBody {
  return field === 'type'
    ? { oauth_code: code, oauth_type: platform }
    : { oauth_code: code, oauth_platform: platform };
}

/** `POST /users/forgot-password`. Emails a reset code. */
export async function forgotPassword(
  body: { email: string },
  options: Options = {},
): Promise<void> {
  await request('/users/forgot-password', {
    method: 'POST',
    body,
    auth: false,
    schema: messageEnvelope,
    ...options,
  });
}

/** `POST /users/reset-password`. A 400 `HttpError` has `isExpired` set for an expired code. */
export async function resetPassword(body: ResetPasswordBody, options: Options = {}): Promise<void> {
  await request('/users/reset-password', {
    method: 'POST',
    body,
    auth: false,
    schema: messageEnvelope,
    ...options,
  });
}

/** `PUT /users`. Name, phone and delivery address. Email can't be changed. */
export async function updateUser(body: UpdateUserBody, options: Options = {}): Promise<User> {
  const res = await request('/users', {
    method: 'PUT',
    body,
    schema: envelope(userSchema),
    ...options,
  });
  return res.data;
}

/** `POST /users/password`. A 400 means the old password was wrong. */
export async function updatePassword(
  body: UpdatePasswordBody,
  options: Options = {},
): Promise<User> {
  const res = await request('/users/password', {
    method: 'POST',
    body,
    schema: envelope(userSchema),
    ...options,
  });
  return res.data;
}

/**
 * `GET /users/me`. **Not built yet** (api-gaps.md): served by the mocks only. Fall back to the user
 * from the sign-in response when it fails.
 */
export async function getMe(options: Options = {}): Promise<User> {
  const res = await request('/users/me', { schema: envelope(userSchema), ...options });
  return res.data;
}

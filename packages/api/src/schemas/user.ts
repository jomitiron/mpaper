import { z } from 'zod';

export const walletSummarySchema = z.object({
  id: z.number(),
  balance: z.number(),
});

export const userSchema = z.object({
  id: z.number(),
  first_name: z.string(),
  last_name: z.string(),
  email: z.string(),
  /** Can be missing for accounts created with Google or Facebook. */
  phone: z.string().nullish(),
  email_verified: z.boolean(),
  wallet: walletSummarySchema.nullish(),
  address: z.string().nullish(),
  created_at: z.string(),
  updated_at: z.string().optional(),
});
export type User = z.infer<typeof userSchema>;

/** Returned by sign-in and verify-email. Tokens last 30 minutes. */
export const sessionSchema = z.object({
  user: userSchema,
  token: z.string(),
});
export type Session = z.infer<typeof sessionSchema>;

export type OAuthPlatform = 'google' | 'facebook';
export type OAuthAction = 'signin' | 'signup';

export const signUpBodySchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.email(),
  phone: z.string().min(1),
  password: z.string().min(8),
});
export type SignUpBody = z.infer<typeof signUpBodySchema>;

/**
 * Sign in or sign up with the code Google (or Facebook) sent back. The docs call the platform
 * `oauth_platform`, but the API rejects that and asks for `oauth_type` (checked on ijanla-dev).
 */
export interface OAuthBody {
  oauth_code: string;
  oauth_type: OAuthPlatform;
}

export interface SignInBody {
  email: string;
  password: string;
}

export interface UpdateUserBody {
  first_name?: string;
  last_name?: string;
  phone?: string;
  address?: string;
}

export interface UpdatePasswordBody {
  old_password: string;
  new_password: string;
}

export interface ResetPasswordBody {
  email: string;
  otp: string;
  password: string;
}

import type { OAuthAction } from '@motopapers/api';

/**
 * Small bits of state the auth pages hand to each other through sessionStorage (this tab only),
 * so a refresh or a trip to Google doesn't lose them. Never the password or the token.
 */

const EMAIL_KEY = 'motopapers:auth-email';
const OAUTH_KEY = 'motopapers:oauth';

function tab(): Storage | null {
  try {
    return sessionStorage;
  } catch {
    return null;
  }
}

function read(key: string): string | null {
  try {
    return tab()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) tab()?.removeItem(key);
    else tab()?.setItem(key, value);
  } catch {
    // Storage blocked: the next page asks again.
  }
}

/** The email being verified or reset, so the next step can show it and prefill sign-in. */
export const authEmail = {
  get: (): string => read(EMAIL_KEY) ?? '',
  set: (email: string): void => write(EMAIL_KEY, email.trim() || null),
  clear: (): void => write(EMAIL_KEY, null),
};

/** What to do when Google sends the driver back to /auth/callback. */
export interface OAuthState {
  action: OAuthAction;
  /** Where to go after signing in. */
  next: string;
  /** "Keep me signed in". */
  remember: boolean;
  /** Set when a Google sign-up is finishing with a sign-in: show "Add your first car". */
  newAccount?: boolean;
}

export const oauthState = {
  save(state: OAuthState): void {
    write(OAUTH_KEY, JSON.stringify(state));
  },
  /** Reads the saved state once. */
  take(): OAuthState | null {
    const raw = read(OAUTH_KEY);
    write(OAUTH_KEY, null);
    if (!raw) return null;
    try {
      const value = JSON.parse(raw) as Partial<OAuthState>;
      if (value.action !== 'signin' && value.action !== 'signup') return null;
      return {
        action: value.action,
        next: typeof value.next === 'string' ? value.next : '/',
        remember: value.remember === true,
        newAccount: value.newAccount === true,
      };
    } catch {
      return null;
    }
  },
};

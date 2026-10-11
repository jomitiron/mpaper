import {
  getMe,
  signOut as signOutOnServer,
  tokenExpiresAt,
  userSchema,
  type User,
} from '@motopapers/api';
import { defineStore } from 'pinia';
import { computed, onScopeDispose, ref } from 'vue';

/**
 * The signed-in driver. Other phases read `token`, `user`, `isSignedIn` and call `setSession()`,
 * `signOut()` and `restore()`; keep those stable.
 *
 * - The session is saved in sessionStorage (this tab only), or localStorage with "Keep me signed
 *   in", and put back by `restore()` on start-up.
 * - Tokens last 30 minutes and there's no refresh endpoint yet. The store reads `exp` from the
 *   token, signs out when it passes and tells `onExpired()` listeners, so the app can send the
 *   driver to sign in.
 * - `restore()` refreshes the user with `GET /users/me` in the background. That endpoint is mocked
 *   only (api-gaps.md); on the real API it fails and the saved user stays.
 */

export const SESSION_STORAGE_KEY = 'motopapers:session';

/** setTimeout can't wait longer than this (about 24.8 days). */
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

type Place = 'session' | 'local';

function storageFor(place: Place): Storage | null {
  try {
    return place === 'local' ? localStorage : sessionStorage;
  } catch {
    return null; // Storage blocked (some private modes).
  }
}

function readSaved(place: Place): { token: string; user: User } | null {
  try {
    const saved: unknown = JSON.parse(storageFor(place)?.getItem(SESSION_STORAGE_KEY) ?? 'null');
    if (!saved || typeof saved !== 'object') return null;
    const token = (saved as { token?: unknown }).token;
    const user = userSchema.safeParse((saved as { user?: unknown }).user);
    if (typeof token !== 'string' || !token || !user.success) return null;
    return { token, user: user.data };
  } catch {
    return null;
  }
}

function forget(place: Place): void {
  try {
    storageFor(place)?.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Nothing saved, or storage blocked.
  }
}

function hasExpired(token: string, now = Date.now()): boolean {
  const expiresAt = tokenExpiresAt(token);
  return expiresAt !== null && expiresAt <= now;
}

export interface SetSessionOptions {
  /** "Keep me signed in": save in localStorage so the session outlives the tab. */
  remember?: boolean;
}

export interface SignOutOptions {
  /**
   * Tell the API too (`POST /users/sign-out`). Defaults to true. Skipped anyway when the token has
   * already expired; the 401 hook passes false.
   */
  remote?: boolean;
}

export const useSessionStore = defineStore('session', () => {
  const token = ref<string | null>(null);
  const user = ref<User | null>(null);
  /** Saved in localStorage ("Keep me signed in") rather than sessionStorage. */
  const remember = ref(false);
  /** When the token expires, in ms since the epoch, or null if it doesn't say. */
  const expiresAt = ref<number | null>(null);
  const isSignedIn = computed(() => token.value !== null);

  let expiryTimer: ReturnType<typeof setTimeout> | undefined;
  const expiryListeners = new Set<() => void>();

  function persist(): void {
    if (!token.value || !user.value) return;
    const place: Place = remember.value ? 'local' : 'session';
    forget(place === 'local' ? 'session' : 'local');
    try {
      storageFor(place)?.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({ token: token.value, user: user.value }),
      );
    } catch {
      // Storage full or blocked: stay signed in for this page only.
    }
  }

  function scheduleExpiry(): void {
    clearTimeout(expiryTimer);
    expiryTimer = undefined;
    if (expiresAt.value === null) return;
    const wait = expiresAt.value - Date.now();
    if (wait <= 0) {
      expire();
      return;
    }
    expiryTimer = setTimeout(checkExpiry, Math.min(wait, MAX_TIMEOUT_MS));
  }

  function expire(): void {
    if (!token.value) return;
    void signOut({ remote: false });
    for (const listener of [...expiryListeners]) listener();
  }

  /** Signs out if the token has run out; otherwise waits for it again. */
  function checkExpiry(): void {
    if (!token.value || expiresAt.value === null) return;
    if (expiresAt.value <= Date.now()) expire();
    else scheduleExpiry();
  }

  function start(session: { token: string; user: User }, keep: boolean): void {
    token.value = session.token;
    user.value = session.user;
    remember.value = keep;
    expiresAt.value = tokenExpiresAt(session.token);
    scheduleExpiry();
  }

  function clear(): void {
    clearTimeout(expiryTimer);
    expiryTimer = undefined;
    token.value = null;
    user.value = null;
    remember.value = false;
    expiresAt.value = null;
    forget('session');
    forget('local');
  }

  function setSession(session: { token: string; user: User }, options: SetSessionOptions = {}) {
    start(session, options.remember ?? false);
    persist();
  }

  /** Replaces the signed-in driver's details (after `PUT /users`, say), keeping the token. */
  function setUser(next: User): void {
    if (!token.value) return;
    user.value = next;
    persist();
  }

  /**
   * Ends the session. The local session is cleared straight away, so the app never waits on the
   * network to sign someone out; the API is told in the background.
   */
  function signOut(options: SignOutOptions = {}): Promise<void> {
    const current = token.value;
    if ((options.remote ?? true) && current && !hasExpired(current)) {
      // request() reads the token as soon as it's called, so it goes out with this request even
      // though the session is cleared below. A 401 from it then finds the driver signed out.
      void signOutOnServer().catch(() => {});
    }
    clear();
    return Promise.resolve();
  }

  /** Puts back a saved session on start-up, unless its token has expired. */
  function restore(): void {
    const fromTab = readSaved('session');
    const saved = fromTab ?? readSaved('local');
    if (!saved || hasExpired(saved.token)) {
      clear();
      return;
    }
    start(saved, !fromTab);
    void refreshUser();
  }

  /** Fetches the driver's latest details (`GET /users/me`). Keeps the saved ones if it fails. */
  async function refreshUser(): Promise<void> {
    const current = token.value;
    if (!current) return;
    try {
      const fresh = await getMe();
      if (token.value !== current) return; // Signed out or switched account meanwhile.
      user.value = fresh;
      persist();
    } catch {
      // Not on the real API yet (404). A 401 has already signed the driver out via the API hook.
    }
  }

  /** Calls `listener` when the token runs out and the store signs out. Returns an unsubscribe. */
  function onExpired(listener: () => void): () => void {
    expiryListeners.add(listener);
    return () => expiryListeners.delete(listener);
  }

  // A sleeping tab can miss its timer: check again when the driver comes back to it.
  const onVisible = () => {
    if (document.visibilityState === 'visible') checkExpiry();
  };
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisible);
    onScopeDispose(() => document.removeEventListener('visibilitychange', onVisible));
  }

  return {
    token,
    user,
    remember,
    expiresAt,
    isSignedIn,
    setSession,
    setUser,
    signOut,
    restore,
    refreshUser,
    onExpired,
  };
});

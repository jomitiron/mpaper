import { tokenExpiresAt, userSchema, type User } from '@motopapers/api';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

/**
 * The signed-in driver.
 *
 * STUB from phase 0. Phase 1 owns the real implementation: expiry timer from the JWT `exp`,
 * "Keep me signed in" (localStorage), `GET /users/me` on restore, calling `POST /users/sign-out`.
 * Keep this interface stable; other phases read it:
 *
 *   token, user, isSignedIn, setSession({ token, user }), signOut(), restore()
 *
 * signOut() is also called by the API's 401 hook, so it must not itself send the expired token
 * in a way that triggers another 401.
 */

const STORAGE_KEY = 'motopapers:session';

function storage(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

export const useSessionStore = defineStore('session', () => {
  const token = ref<string | null>(null);
  const user = ref<User | null>(null);
  const isSignedIn = computed(() => token.value !== null);

  function setSession(session: { token: string; user: User }): void {
    token.value = session.token;
    user.value = session.user;
    try {
      storage()?.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Private mode or storage full: stay signed in for this page only.
    }
  }

  function signOut(): void {
    token.value = null;
    user.value = null;
    storage()?.removeItem(STORAGE_KEY);
  }

  /** Puts back a saved session on start-up, unless its token has expired. */
  function restore(): void {
    try {
      const saved: unknown = JSON.parse(storage()?.getItem(STORAGE_KEY) ?? 'null');
      if (!saved || typeof saved !== 'object') return;
      const savedToken = (saved as { token?: unknown }).token;
      const savedUser = userSchema.safeParse((saved as { user?: unknown }).user);
      const expiresAt = typeof savedToken === 'string' ? tokenExpiresAt(savedToken) : null;
      if (typeof savedToken !== 'string' || !savedUser.success) return signOut();
      if (expiresAt !== null && expiresAt <= Date.now()) return signOut();
      token.value = savedToken;
      user.value = savedUser.data;
    } catch {
      signOut();
    }
  }

  return { token, user, isSignedIn, setSession, signOut, restore };
});

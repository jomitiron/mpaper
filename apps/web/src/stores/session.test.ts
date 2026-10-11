import { listVehicles, signIn } from '@motopapers/api';
import { SAMPLE_EMAIL, SAMPLE_PASSWORD } from '@motopapers/api/mocks';
import { http, HttpResponse } from 'msw';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory } from 'vue-router';
import { API, useMockApi } from '@/features/auth/__tests__/harness';
import { setupApi } from '@/lib/api';
import { createAppRouter } from '@/router';
import { ADA, tokenExpiringIn } from '../../test/helpers';
import { SESSION_STORAGE_KEY, useSessionStore } from './session';

const api = useMockApi();

afterEach(() => {
  vi.useRealTimers();
});

/** A real session from the mock API. */
async function adaSession() {
  return signIn({ email: SAMPLE_EMAIL, password: SAMPLE_PASSWORD });
}

/** A new page load: a fresh store reading what was saved. */
function reload() {
  setActivePinia(createPinia());
  return useSessionStore();
}

describe('saving the session', () => {
  it('keeps it in this tab by default', () => {
    useSessionStore().setSession({ token: tokenExpiringIn(600), user: ADA });
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toContain('"Ada"');
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('keeps it across tabs with "Keep me signed in", and moves it back without', () => {
    const session = useSessionStore();
    session.setSession({ token: tokenExpiringIn(600), user: ADA }, { remember: true });
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toContain('"Ada"');
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();

    session.setSession({ token: tokenExpiringIn(600), user: ADA });
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).not.toBeNull();
  });

  it('updates the saved user', () => {
    const session = useSessionStore();
    session.setSession({ token: tokenExpiringIn(600), user: ADA });
    session.setUser({ ...ADA, address: '12 Allen Avenue, Ikeja' });
    expect(reloadUser()).toBe('12 Allen Avenue, Ikeja');

    function reloadUser() {
      const restored = reload();
      restored.restore();
      return restored.user?.address;
    }
  });
});

describe('restore()', () => {
  it('puts back a kept session and refreshes the driver from GET /users/me', async () => {
    const { token, user } = await adaSession();
    useSessionStore().setSession(
      { token, user: { ...user, first_name: 'Old' } },
      { remember: true },
    );

    const restored = reload();
    restored.restore();
    expect(restored.isSignedIn).toBe(true);
    expect(restored.remember).toBe(true);
    expect(restored.user?.first_name).toBe('Old');
    await vi.waitFor(() => expect(restored.user?.first_name).toBe('Ada'));
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toContain('"Ada"');
  });

  it('keeps the saved driver when GET /users/me is missing (the real API today)', async () => {
    api.server.use(
      http.get(`${API}/users/me`, () =>
        HttpResponse.json({ error: 'Path not found.' }, { status: 404 }),
      ),
    );
    const { token, user } = await adaSession();
    useSessionStore().setSession({ token, user: { ...user, first_name: 'Saved' } });

    const restored = reload();
    restored.restore();
    await vi.waitFor(() =>
      expect(api.requests.some((r) => r.url.endsWith('/users/me'))).toBe(true),
    );
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(restored.isSignedIn).toBe(true);
    expect(restored.user?.first_name).toBe('Saved');
  });

  it('prefers this tab over a kept session', () => {
    localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({ token: tokenExpiringIn(600), user: { ...ADA, first_name: 'Kept' } }),
    );
    sessionStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({ token: tokenExpiringIn(600), user: { ...ADA, first_name: 'Tab' } }),
    );
    const session = useSessionStore();
    session.restore();
    expect(session.user?.first_name).toBe('Tab');
    expect(session.remember).toBe(false);
  });

  it('drops an expired session from both places', () => {
    localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({ token: tokenExpiringIn(-5), user: ADA }),
    );
    const session = useSessionStore();
    session.restore();
    expect(session.isSignedIn).toBe(false);
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });
});

describe('expiry', () => {
  it('signs out when the token runs out, and tells listeners', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const session = useSessionStore();
    const expired = vi.fn();
    session.onExpired(expired);
    session.setSession({ token: tokenExpiringIn(60), user: ADA });

    vi.advanceTimersByTime(59_000);
    expect(session.isSignedIn).toBe(true);
    vi.advanceTimersByTime(1_000);
    expect(session.isSignedIn).toBe(false);
    expect(expired).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('checks again when the driver comes back to a sleeping tab', () => {
    vi.useFakeTimers({ toFake: ['Date'] }); // The timer never fires, as in a frozen tab.
    const session = useSessionStore();
    session.setSession({ token: tokenExpiringIn(60), user: ADA });
    vi.setSystemTime(Date.now() + 61_000);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(session.isSignedIn).toBe(false);
  });

  it('stops the timer on sign-out', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const session = useSessionStore();
    const expired = vi.fn();
    session.onExpired(expired);
    session.setSession({ token: tokenExpiringIn(60), user: ADA });
    void session.signOut({ remote: false });
    vi.advanceTimersByTime(120_000);
    expect(expired).not.toHaveBeenCalled();
  });
});

describe('signOut()', () => {
  it('clears at once and tells the API with the token it had', async () => {
    const { token, user } = await adaSession();
    const session = useSessionStore();
    session.setSession({ token, user });
    api.requests = [];

    void session.signOut();
    expect(session.isSignedIn).toBe(false);
    expect(session.user).toBeNull();
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();

    await vi.waitFor(() => expect(api.requests).toHaveLength(1));
    expect(api.requests[0]!.url).toBe(`${API}/users/sign-out`);
    expect(api.requests[0]!.headers.get('authorization')).toBe(`Bearer ${token}`);
  });

  it("doesn't call the API with remote: false or an expired token", async () => {
    const session = useSessionStore();
    session.setSession({ token: tokenExpiringIn(600), user: ADA });
    void session.signOut({ remote: false });
    session.setSession({ token: tokenExpiringIn(-1), user: ADA });
    void session.signOut();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(api.requests).toEqual([]);
  });
});

describe('the 401 hook', () => {
  it('signs out and sends the driver to sign in, back to where they were', async () => {
    const router = createAppRouter(createMemoryHistory());
    const session = useSessionStore();
    session.setSession({ token: tokenExpiringIn(600), user: ADA });
    setupApi({ router, session });
    await router.push('/cars?filter=attention');
    api.server.use(
      http.get(`${API}/vehicles`, () =>
        HttpResponse.json({ message: 'Unauthorized', status: 'error' }, { status: 401 }),
      ),
    );
    // setupApi points at the env's API; send this one to the mock.
    const { configureApi } = await import('@motopapers/api');
    configureApi({ baseUrl: API });

    await expect(listVehicles()).rejects.toMatchObject({ status: 401 });
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/sign-in'));
    expect(router.currentRoute.value.query.next).toBe('/cars?filter=attention');
    expect(session.isSignedIn).toBe(false);
    // The dead token isn't sent again to sign out.
    expect(api.requests.map((r) => new URL(r.url).pathname)).toEqual(['/vehicles']);
  });

  it('does the same when the token runs out on its own', async () => {
    const router = createAppRouter(createMemoryHistory());
    const session = useSessionStore();
    setupApi({ router, session });
    session.setSession({ token: tokenExpiringIn(600), user: ADA });
    await router.push('/payments');

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    session.setSession({ token: tokenExpiringIn(30), user: ADA });
    vi.advanceTimersByTime(30_000);
    vi.useRealTimers();
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/sign-in'));
    expect(router.currentRoute.value.query.next).toBe('/payments');
  });
});

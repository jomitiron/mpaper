import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createWebHistory } from 'vue-router';
import { createAppRouter } from '@/router';
import { safeNext, withoutBase } from '@/router/next';
import { useSessionStore } from '@/stores/session';
import { ADA, tokenExpiringIn } from './helpers';

// On App Service the app is served under /app/ (docs/phases/P7-app-service.md).
const BASE = '/app/';

beforeEach(() => {
  setActivePinia(createPinia());
  sessionStorage.clear();
});

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('safeNext under /app/', () => {
  it('keeps router paths as they are', () => {
    expect(safeNext('/cars/12?tab=papers', '/', BASE)).toBe('/cars/12?tab=papers');
    expect(safeNext('/', '/', BASE)).toBe('/');
  });

  it('takes the base off a next that includes it', () => {
    expect(safeNext('/app/cars?filter=attention', '/', BASE)).toBe('/cars?filter=attention');
    expect(safeNext('/app/', '/', BASE)).toBe('/');
    expect(safeNext('/app', '/', BASE)).toBe('/');
    expect(safeNext('/app?x=1', '/', BASE)).toBe('/?x=1');
  });

  it('still refuses other sites, with or without the base', () => {
    expect(safeNext('https://evil.test', '/', BASE)).toBe('/');
    expect(safeNext('//evil.test', '/', BASE)).toBe('/');
    expect(safeNext('/app//evil.test', '/', BASE)).toBe('/');
    expect(safeNext('/app/\\evil.test', '/', BASE)).toBe('/');
  });

  it('leaves paths that only start like the base alone', () => {
    expect(withoutBase('/application', BASE)).toBe('/application');
    expect(withoutBase('/cars', '/')).toBe('/cars');
  });
});

describe('router under /app/', () => {
  it('builds links with the base', () => {
    const r = createAppRouter(createWebHistory(BASE));
    expect(r.resolve('/payments/callback?reference=MOT-1').href).toBe(
      '/app/payments/callback?reference=MOT-1',
    );
    expect(r.resolve({ path: '/sign-in', query: { next: '/cars' } }).href).toBe(
      '/app/sign-in?next=/cars',
    );
  });

  it('opens a deep link and sends a signed-out driver to sign in with a router path', async () => {
    window.history.replaceState(null, '', '/app/cars?filter=attention');
    const history = createWebHistory(BASE);
    const r = createAppRouter(history);
    await r.replace(history.location);
    expect(r.currentRoute.value.path).toBe('/sign-in');
    expect(r.currentRoute.value.query.next).toBe('/cars?filter=attention');
    expect(window.location.pathname).toBe('/app/sign-in');
  });

  it('opens the Paystack return and the old Google return', async () => {
    useSessionStore().setSession({ token: tokenExpiringIn(600), user: ADA });
    window.history.replaceState(null, '', '/app/payments/callback?reference=MOT-1');
    const history = createWebHistory(BASE);
    const r = createAppRouter(history);
    await r.replace(history.location);
    expect(r.currentRoute.value.name).not.toBe('not-found');
    expect(r.currentRoute.value.query.reference).toBe('MOT-1');
    expect(r.resolve('/complete-onboard?code=x').name).not.toBe('not-found');
  });

  it('sends a signed-in driver on to a next that includes the base', async () => {
    useSessionStore().setSession({ token: tokenExpiringIn(600), user: ADA });
    const history = createWebHistory(BASE);
    const r = createAppRouter(history);
    await r.push('/sign-in?next=/app/settings');
    expect(r.currentRoute.value.path).toBe('/settings');
    expect(window.location.pathname).toBe('/app/settings');
  });
});

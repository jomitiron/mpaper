import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { createMemoryHistory } from 'vue-router';
import { createAppRouter, featureRoutes } from '@/router';
import { resolveAccess } from '@/router/guards';
import { safeNext } from '@/router/next';
import { useSessionStore } from '@/stores/session';
import { ADA, tokenExpiringIn } from './helpers';

function router() {
  return createAppRouter(createMemoryHistory());
}

beforeEach(() => {
  setActivePinia(createPinia());
  sessionStorage.clear();
});

describe('routes', () => {
  it('collects every page from the feature folders', () => {
    const r = router();
    const paths = [
      '/',
      '/cars',
      '/cars/new',
      '/cars/12',
      '/payments',
      '/payments/callback',
      '/settings',
      '/sign-in',
      '/sign-up',
      '/forgot-password',
      '/reset-password',
    ];
    for (const path of paths) {
      expect(r.resolve(path).name, path).not.toBe('not-found');
    }
    expect(r.resolve('/cars/new').name).toBe('add-car');
    expect(r.resolve('/cars/12').name).toBe('car');
    expect(featureRoutes.length).toBeGreaterThanOrEqual(10);
  });

  it('sends unknown addresses to the 404 page', () => {
    expect(router().resolve('/nowhere/at/all').name).toBe('not-found');
  });
});

describe('access', () => {
  it('sends a signed-out driver to sign in, remembering where they were going', async () => {
    const r = router();
    await r.push('/cars?filter=attention');
    expect(r.currentRoute.value.path).toBe('/sign-in');
    expect(r.currentRoute.value.query.next).toBe('/cars?filter=attention');
  });

  it('lets a signed-out driver see public pages', async () => {
    const r = router();
    await r.push('/forgot-password');
    expect(r.currentRoute.value.path).toBe('/forgot-password');
  });

  it('lets a signed-in driver in, and moves them off sign-in', async () => {
    useSessionStore().setSession({ token: tokenExpiringIn(600), user: ADA });
    const r = router();
    await r.push('/payments');
    expect(r.currentRoute.value.path).toBe('/payments');
    await r.push('/sign-in?next=/settings');
    expect(r.currentRoute.value.path).toBe('/settings');
    await r.push('/sign-up');
    expect(r.currentRoute.value.path).toBe('/');
  });

  it('decides access from the route meta', () => {
    const r = router();
    expect(resolveAccess(r.resolve('/sign-in'), { isSignedIn: false })).toBe(true);
    expect(resolveAccess(r.resolve('/'), { isSignedIn: false })).toEqual({
      path: '/sign-in',
      query: { next: '/' },
    });
  });

  it('redirects the old app addresses, keeping the query', async () => {
    useSessionStore().setSession({ token: tokenExpiringIn(600), user: ADA });
    const r = router();
    await r.push('/vehicles?x=1');
    expect(r.currentRoute.value.fullPath).toBe('/cars?x=1');
    await r.push('/transactions');
    expect(r.currentRoute.value.path).toBe('/payments');
    await r.push('/home');
    expect(r.currentRoute.value.path).toBe('/');
    useSessionStore().signOut();
    await r.push('/login');
    expect(r.currentRoute.value.path).toBe('/sign-in');
    await r.push('/signup');
    expect(r.currentRoute.value.path).toBe('/sign-up');
  });

  it('sets the page title', async () => {
    const r = router();
    await r.push('/sign-up');
    expect(document.title).toBe('Create your account · MotoPapers');
  });
});

describe('safeNext', () => {
  it('only allows paths on this site', () => {
    expect(safeNext('/cars/12?tab=papers')).toBe('/cars/12?tab=papers');
    expect(safeNext('https://evil.test')).toBe('/');
    expect(safeNext('//evil.test')).toBe('/');
    expect(safeNext('/\\evil.test')).toBe('/');
    expect(safeNext(undefined, '/cars')).toBe('/cars');
    expect(safeNext(['/payments'])).toBe('/payments');
  });
});

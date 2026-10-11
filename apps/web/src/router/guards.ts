import type { RouteLocationNormalized, RouteLocationRaw, Router } from 'vue-router';
import { useSessionStore } from '@/stores/session';
import { safeNext } from './next';

export const SIGN_IN_PATH = '/sign-in';

/** Where a navigation should go, given whether the driver is signed in. */
export function resolveAccess(
  to: Pick<RouteLocationNormalized, 'meta' | 'query' | 'fullPath'>,
  session: { isSignedIn: boolean },
): true | RouteLocationRaw {
  if (to.meta.public) {
    if (to.meta.guestOnly && session.isSignedIn) return safeNext(to.query.next);
    return true;
  }
  if (!session.isSignedIn) return { path: SIGN_IN_PATH, query: { next: to.fullPath } };
  return true;
}

export function installGuards(router: Router): void {
  router.beforeEach((to) => resolveAccess(to, useSessionStore()));
  router.afterEach((to) => {
    document.title = to.meta.title ? `${to.meta.title} · MotoPapers` : 'MotoPapers';
  });
}

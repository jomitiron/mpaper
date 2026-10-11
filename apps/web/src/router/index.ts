import {
  createRouter,
  createWebHistory,
  type RouteRecordRaw,
  type Router,
  type RouterHistory,
} from 'vue-router';
import './meta';
import { installGuards } from './guards';

/**
 * Each feature folder exports its routes from `src/features/<name>/routes.ts`; they're collected
 * here, so no phase edits this file to add a page.
 */
const featureModules = import.meta.glob<{ default: RouteRecordRaw[] }>('../features/*/routes.ts', {
  eager: true,
});

export const featureRoutes: RouteRecordRaw[] = Object.values(featureModules).flatMap(
  (module) => module.default,
);

/** Addresses from the old app keep working (also redirected by staticwebapp.config.json). */
const legacyRedirects: RouteRecordRaw[] = [
  ['/home', '/'],
  ['/vehicles', '/cars'],
  ['/transactions', '/payments'],
  ['/login', '/sign-in'],
  ['/signup', '/sign-up'],
].map(([from, to]) => ({
  path: from!,
  redirect: (route) => ({ path: to!, query: route.query, hash: route.hash }),
}));

export const routes: RouteRecordRaw[] = [
  ...featureRoutes,
  ...legacyRedirects,
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/pages/NotFoundPage.vue'),
    meta: { public: true, layout: 'bare', title: 'Page not found' },
  },
];

export function createAppRouter(
  history: RouterHistory = createWebHistory(import.meta.env.BASE_URL),
): Router {
  const router = createRouter({
    history,
    routes,
    scrollBehavior(to, from, saved) {
      if (saved) return saved;
      if (to.hash) return { el: to.hash };
      // Opening a sheet over a page (e.g. /cars → /cars/12) keeps the page where it was.
      if (to.matched[0] && to.matched[0] === from.matched[0]) return false;
      return { top: 0 };
    },
  });
  installGuards(router);
  return router;
}

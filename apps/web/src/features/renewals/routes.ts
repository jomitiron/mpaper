import type { RouteRecordRaw } from 'vue-router';

// Phase 4 owns this file and everything in features/renewals. The Renew flow may end up as a
// sheet opened from Home, My cars and the car panel; change or remove this route as needed.
export default [
  {
    path: '/renewals',
    name: 'renewals',
    component: () => import('./pages/RenewalsPage.vue'),
    meta: { title: 'Renewals' },
  },
] satisfies RouteRecordRaw[];

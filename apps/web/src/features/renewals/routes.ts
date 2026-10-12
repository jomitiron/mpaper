import type { RouteRecordRaw } from 'vue-router';

// Phase 4 owns this file and everything in features/renewals.
export default [
  {
    // Every Renew button comes here (cars/lib/renew.ts), and so can the reminder emails' renew_url.
    // `paper` is licence, insurance or roadworthiness.
    path: '/cars/:id(\\d+)/renew/:paper',
    name: 'renew',
    component: () => import('./pages/RenewPage.vue'),
    meta: { title: 'Renew a paper' },
  },
] satisfies RouteRecordRaw[];

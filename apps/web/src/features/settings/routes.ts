import type { RouteRecordRaw } from 'vue-router';

// Phase 4 owns this file and everything in features/settings.
export default [
  {
    path: '/settings',
    name: 'settings',
    component: () => import('./pages/SettingsPage.vue'),
    meta: { title: 'Settings' },
  },
] satisfies RouteRecordRaw[];

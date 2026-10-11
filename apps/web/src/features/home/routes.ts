import type { RouteRecordRaw } from 'vue-router';

// Phase 2 owns this file and everything in features/home.
export default [
  {
    path: '/',
    name: 'home',
    component: () => import('./pages/HomePage.vue'),
    meta: { title: 'Home' },
  },
] satisfies RouteRecordRaw[];

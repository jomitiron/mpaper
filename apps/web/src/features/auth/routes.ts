import type { RouteRecordRaw } from 'vue-router';

// Phase 1 owns this file and everything in features/auth.
export default [
  {
    path: '/sign-in',
    name: 'sign-in',
    component: () => import('./pages/SignInPage.vue'),
    meta: { public: true, guestOnly: true, layout: 'bare', title: 'Sign in' },
  },
  {
    path: '/sign-up',
    name: 'sign-up',
    component: () => import('./pages/SignUpPage.vue'),
    meta: { public: true, guestOnly: true, layout: 'bare', title: 'Create your account' },
  },
  {
    path: '/forgot-password',
    name: 'forgot-password',
    component: () => import('./pages/ForgotPasswordPage.vue'),
    meta: { public: true, layout: 'bare', title: 'Forgot password' },
  },
  {
    path: '/reset-password',
    name: 'reset-password',
    component: () => import('./pages/ResetPasswordPage.vue'),
    meta: { public: true, layout: 'bare', title: 'Reset password' },
  },
  {
    // Google comes back here. The API redirects to the old app's /complete-onboard today, so
    // that address works too until the backend points Google at /auth/callback.
    path: '/auth/callback',
    alias: '/complete-onboard',
    name: 'auth-callback',
    component: () => import('./pages/AuthCallbackPage.vue'),
    meta: { public: true, layout: 'bare', title: 'Signing in' },
  },
] satisfies RouteRecordRaw[];

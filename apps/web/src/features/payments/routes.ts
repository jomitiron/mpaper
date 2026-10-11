import type { RouteRecordRaw } from 'vue-router';

// Phase 3 owns this file and everything in features/payments.
export default [
  {
    path: '/payments',
    name: 'payments',
    component: () => import('./pages/PaymentsPage.vue'),
    meta: { title: 'Payments' },
  },
  {
    // Paystack sends the driver back here with ?reference=
    path: '/payments/callback',
    name: 'payment-callback',
    component: () => import('./pages/PaymentCallbackPage.vue'),
    meta: { title: 'Confirming your payment' },
  },
] satisfies RouteRecordRaw[];

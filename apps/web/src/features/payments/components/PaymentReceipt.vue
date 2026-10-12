<script setup lang="ts">
import { Check } from '@lucide/vue';
import {
  formatDate,
  formatNaira,
  formatPlate,
  lagosToday,
  type Payment,
  type Transaction,
} from '@motopapers/api';
import { Button } from '@motopapers/ui';
import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import { flags } from '@/env';
import { walletQuery } from '@/lib/queries';
import { useSessionStore } from '@/stores/session';
import type { PaymentIntent } from '../lib/intent';
import { paymentTitle } from '../lib/rows';

/** "Payment received": the receipt after Paystack confirms, laid out like the receipt email. */

const props = defineProps<{
  payment: Payment;
  intent: PaymentIntent | null;
  transaction?: Transaction;
}>();

const session = useSessionStore();
// The payment return page has just invalidated the wallet, so this is the new balance.
const wallet = useQuery({ ...walletQuery(), meta: { silent: true } });

const thanks = computed(() => {
  const name = session.user?.first_name?.trim();
  return name ? `Thanks, ${name}. Here's your receipt.` : "Thanks. Here's your receipt.";
});

const forText = computed(() => {
  const intent = props.intent;
  if (intent?.kind === 'top-up') return 'Wallet top-up';
  if (intent?.kind === 'other') return intent.label;
  if (intent?.kind === 'add-car') {
    return `Tracking and reminders, ${formatPlate(intent.draft.car.plate_number)}`;
  }
  return props.transaction ? paymentTitle(props.transaction, flags.txLabels) : null;
});

const balance = computed(() => {
  if (wallet.data.value) return formatNaira(wallet.data.value.balance);
  return wallet.isError.value ? 'Unavailable' : '₦…';
});

const date = computed(() =>
  formatDate(props.payment.updated_at ?? props.payment.created_at ?? lagosToday()),
);

const next = computed(() =>
  props.intent?.kind === 'other' && props.intent.returnTo !== '/payments'
    ? { to: props.intent.returnTo, label: props.intent.returnLabel ?? 'Continue' }
    : { to: '/payments', label: 'View payments' },
);
</script>

<template>
  <section class="pay-result" aria-labelledby="receipt-title">
    <span class="pay-result-ic ok" aria-hidden="true"><Check class="ic" /></span>
    <h1 id="receipt-title" tabindex="-1" data-result-heading>Payment received</h1>
    <p class="pay-amount num">{{ formatNaira(payment.amount) }}</p>
    <p>{{ thanks }}</p>
    <dl class="receipt">
      <div v-if="forText">
        <dt>For</dt>
        <dd>{{ forText }}</dd>
      </div>
      <div>
        <dt>Amount</dt>
        <dd class="num">{{ formatNaira(payment.amount) }}</dd>
      </div>
      <div>
        <dt>Reference</dt>
        <dd class="mono">{{ payment.reference }}</dd>
      </div>
      <div>
        <dt>Date</dt>
        <dd>{{ date }}</dd>
      </div>
      <div>
        <dt>Wallet balance</dt>
        <dd class="num" :aria-busy="wallet.isPending.value ? 'true' : undefined">{{ balance }}</dd>
      </div>
    </dl>
    <div class="acts">
      <Button :to="next.to">{{ next.label }}</Button>
      <Button variant="white" to="/">Go to Home</Button>
    </div>
  </section>
</template>

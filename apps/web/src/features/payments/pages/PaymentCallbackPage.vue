<script setup lang="ts">
import { CircleAlert, Clock, Receipt, X } from '@lucide/vue';
import { errorMessage, formatDate, formatNaira, formatPlate, lagosToday } from '@motopapers/api';
import { Button } from '@motopapers/ui';
import { useQueryClient } from '@tanstack/vue-query';
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { flags } from '@/env';
import { queryKeys } from '@/lib/queries';
import FinishAddingCar from '../addCar/FinishAddingCar.vue';
import PaymentReceipt from '../components/PaymentReceipt.vue';
import { payOnPaystack } from '../lib/checkout';
import { referenceFrom, usePaymentConfirmation, type ConfirmState } from '../lib/confirm';
import { intentStore } from '../lib/intent';
import { paymentTitle } from '../lib/rows';
import { SUPPORT_PHONE } from '../lib/support';
import '../payments.css';

/**
 * `/payments/callback?reference=`: Paystack sends the driver here after paying. We wait for the
 * API to hear from Paystack (live stream, then polling, see waitForPayment) and only then show
 * the receipt, so a driver never sees "paid" for a payment that failed.
 */

const route = useRoute();
const router = useRouter();
const queryClient = useQueryClient();
const store = intentStore();

const reference = referenceFrom(route.query);
const intent = reference ? store.recall(reference) : null;
const carIntent = intent?.kind === 'add-car' ? intent : null;

const { state, check } = usePaymentConfirmation(reference);
onMounted(() => void check());

const TITLES: Record<ConfirmState['status'], string> = {
  missing: 'Payment not found',
  confirming: 'Confirming your payment',
  paid: 'Payment received',
  failed: "Payment didn't go through",
  timeout: 'Still confirming',
  error: 'Confirming your payment',
};

watch(
  () => state.value.status,
  async (status, before) => {
    document.title = `${TITLES[status]} · MotoPapers`;
    // On first render the page has only just loaded: focus moves only when the answer changes.
    if (before === undefined) return;
    if (status === 'paid') {
      // The wallet, the payments list and (for a car) the car list have all changed.
      void queryClient.invalidateQueries({ queryKey: queryKeys.wallet });
      void queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
      void queryClient.invalidateQueries({ queryKey: queryKeys.vehicles });
    } else if (status === 'failed' && reference && carIntent) {
      store.update(reference, (i) => ({ ...i, failed: true }));
    }
    await nextTick();
    document.querySelector<HTMLElement>('[data-result-heading]')?.focus();
  },
  { immediate: true },
);

/** "a wallet top-up", "tracking and reminders for KTU 604 XR". */
const forWords = computed(() => {
  if (intent?.kind === 'top-up') return 'a wallet top-up';
  if (intent?.kind === 'add-car') {
    return `tracking and reminders for ${formatPlate(intent.draft.car.plate_number)}`;
  }
  const label =
    intent?.kind === 'other'
      ? intent.label
      : state.value.status === 'failed' && state.value.transaction
        ? paymentTitle(state.value.transaction, flags.txLabels)
        : null;
  return label ? label[0]!.toLowerCase() + label.slice(1) : null;
});

const failedPayment = computed(() => (state.value.status === 'failed' ? state.value : null));

// ---------------------------------------------------------------- Try again

const retrying = ref(false);
const retryError = ref<string | null>(null);

async function tryAgain() {
  if (!intent || retrying.value) return;
  if (intent.kind === 'top-up') {
    void router.push({ path: '/payments', query: { topup: '1', amount: String(intent.amount) } });
    return;
  }
  if (intent.kind === 'other') {
    void router.push(intent.returnTo);
    return;
  }
  // The car's details are still here: pay for it again on Paystack.
  retrying.value = true;
  retryError.value = null;
  try {
    await payOnPaystack({
      amount: intent.amount,
      category: 'service_charge',
      intent: { kind: 'add-car', returnTo: intent.returnTo, draft: intent.draft },
    });
  } catch (error) {
    retrying.value = false;
    retryError.value = `We couldn't open Paystack. ${errorMessage(error)}`;
  }
}
</script>

<template>
  <FinishAddingCar v-if="state.status === 'paid' && carIntent" :intent="carIntent" />

  <PaymentReceipt
    v-else-if="state.status === 'paid'"
    :payment="state.payment"
    :transaction="state.transaction"
    :intent="intent"
  />

  <section v-else-if="state.status === 'confirming'" class="pay-result" aria-busy="true">
    <span class="pay-result-ic" aria-hidden="true"><span class="spin" /></span>
    <h1 tabindex="-1" data-result-heading>Confirming your payment…</h1>
    <p>
      We're waiting for Paystack to confirm it. This usually takes a few seconds, so keep this page
      open.
    </p>
  </section>

  <section v-else-if="failedPayment" class="pay-result">
    <span class="pay-result-ic bad" aria-hidden="true"><X class="ic" /></span>
    <h1 tabindex="-1" data-result-heading>
      {{ failedPayment.reversed ? 'This payment was reversed' : "Your payment didn't go through" }}
    </h1>
    <p class="pay-amount num">
      {{ formatNaira(failedPayment.payment.amount) }}
    </p>
    <p>
      <template v-if="forWords">For {{ forWords }}. </template>
      <template v-if="failedPayment.reversed">
        Paystack reversed this payment, so it didn't go through.
      </template>
      <template v-else>
        Paystack couldn't complete this payment. You can try again with the same or a different card
        or bank.
      </template>
    </p>
    <dl class="receipt">
      <div>
        <dt>Reference</dt>
        <dd class="mono">{{ failedPayment.payment.reference }}</dd>
      </div>
      <div>
        <dt>Date</dt>
        <dd>
          {{
            formatDate(
              failedPayment.payment.updated_at ?? failedPayment.payment.created_at ?? lagosToday(),
            )
          }}
        </dd>
      </div>
    </dl>
    <p v-if="retryError" class="pay-error" role="alert">
      <CircleAlert class="ic" aria-hidden="true" />
      <span>{{ retryError }}</span>
    </p>
    <div class="acts">
      <Button v-if="intent" :loading="retrying" @click="tryAgain">Try again</Button>
      <Button :variant="intent ? 'white' : 'coral'" to="/payments">View payments</Button>
    </div>
    <p class="hint">
      If money left your account, call us on {{ SUPPORT_PHONE }} with reference
      <span class="mono">{{ failedPayment.payment.reference }}</span> and we'll sort it out.
    </p>
  </section>

  <section v-else-if="state.status === 'timeout' || state.status === 'error'" class="pay-result">
    <span class="pay-result-ic wait" aria-hidden="true"><Clock class="ic" /></span>
    <template v-if="state.status === 'timeout'">
      <h1 tabindex="-1" data-result-heading>Still confirming</h1>
      <p>
        Paystack hasn't confirmed this payment yet. We'll email you as soon as it does.
        <template v-if="carIntent">
          Then check again here or on Payments to finish adding
          {{ formatPlate(carIntent.draft.car.plate_number) }}.
        </template>
      </p>
    </template>
    <template v-else>
      <h1 tabindex="-1" data-result-heading>We couldn't check your payment</h1>
      <p>We couldn't reach MotoPapers to confirm it. Your payment may still go through.</p>
    </template>
    <dl class="receipt">
      <div>
        <dt>Reference</dt>
        <dd class="mono">{{ reference }}</dd>
      </div>
    </dl>
    <div class="acts">
      <Button @click="check()">Check again</Button>
      <Button variant="white" to="/payments">Go to Payments</Button>
    </div>
  </section>

  <section v-else class="pay-result">
    <span class="pay-result-ic" aria-hidden="true"><Receipt class="ic" /></span>
    <h1 tabindex="-1" data-result-heading>We couldn't find that payment</h1>
    <p>
      This page needs a payment reference from Paystack. You'll find all your payments on the
      Payments page.
    </p>
    <div class="acts">
      <Button to="/payments">Go to Payments</Button>
    </div>
  </section>
</template>

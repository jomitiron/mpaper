<script setup lang="ts">
import { CircleAlert } from '@lucide/vue';
import { errorMessage, formatNaira } from '@motopapers/api';
import { Button, Chip, Modal } from '@motopapers/ui';
import { computed, ref, useId, watch } from 'vue';
import {
  formatAmountInput,
  MIN_TOP_UP,
  parseAmount,
  QUICK_AMOUNTS,
  topUpButtonLabel,
  topUpProblem,
} from '../lib/amount';
import { payOnPaystack } from '../lib/checkout';

/**
 * "Top up your wallet": an amount (₦100 or more), then `POST /transactions/initialize` with
 * `wallet_transaction` and off to Paystack. Paystack brings the driver back to the payment return
 * page, which shows the receipt.
 */

const props = withDefaults(defineProps<{ initialAmount?: number | null }>(), {
  initialAmount: null,
});
const open = defineModel<boolean>('open', { required: true });

const inputId = useId();
const hintId = useId();
const errorId = useId();

const text = ref('');
const amount = computed(() => parseAmount(text.value));
const shown = ref(false); // Show "Enter at least ₦100" only after a try.
const problem = computed(() => (shown.value ? topUpProblem(amount.value) : null));
const starting = ref(false);
const failure = ref<string | null>(null);

// Each time it opens: start from the amount given (Retry) or empty.
watch(
  open,
  (isOpen) => {
    if (!isOpen) return;
    text.value = formatAmountInput(props.initialAmount ?? 0);
    shown.value = false;
    failure.value = null;
    starting.value = false;
  },
  { immediate: true },
);

function onInput(event: Event) {
  const input = event.target as HTMLInputElement;
  text.value = formatAmountInput(parseAmount(input.value));
  // Keep the input showing the formatted value even when the number didn't change.
  input.value = text.value;
  failure.value = null;
}

function pick(value: number) {
  text.value = formatAmountInput(value);
  failure.value = null;
  document.getElementById(inputId)?.focus();
}

async function submit() {
  if (starting.value) return;
  shown.value = true;
  if (topUpProblem(amount.value)) {
    document.getElementById(inputId)?.focus();
    return;
  }
  starting.value = true;
  failure.value = null;
  try {
    await payOnPaystack({
      amount: amount.value,
      category: 'wallet_transaction',
      intent: { kind: 'top-up', returnTo: '/payments' },
    });
    // On the way to Paystack: stay busy until the page goes.
  } catch (error) {
    starting.value = false;
    failure.value = `We couldn't open Paystack. ${errorMessage(error)}`;
  }
}
</script>

<template>
  <Modal v-model:open="open" title="Top up your wallet" :initial-focus="`#${inputId}`">
    <form class="topup-form" novalidate @submit.prevent="submit">
      <div class="fld">
        <label :for="inputId">How much?</label>
        <div class="amount-in">
          <span aria-hidden="true">₦</span>
          <input
            :id="inputId"
            :value="text"
            inputmode="numeric"
            autocomplete="off"
            placeholder="0"
            :aria-invalid="problem ? 'true' : undefined"
            :aria-describedby="problem ? `${errorId} ${hintId}` : hintId"
            @input="onInput"
          />
        </div>
        <span v-if="problem" :id="errorId" class="fld-error">
          <CircleAlert class="ic" aria-hidden="true" />{{ problem }}
        </span>
      </div>

      <div class="chips" role="group" aria-label="Quick amounts">
        <Chip v-for="value in QUICK_AMOUNTS" :key="value" @click="pick(value)">
          {{ formatNaira(value) }}
        </Chip>
      </div>

      <p :id="hintId" class="hint">
        You'll pay on Paystack by card or bank transfer, then come back here. Minimum
        {{ formatNaira(MIN_TOP_UP) }}.
      </p>

      <p v-if="failure" class="pay-error" role="alert">
        <CircleAlert class="ic" aria-hidden="true" />
        <span>{{ failure }}</span>
      </p>

      <!-- Not disabled below ₦100: pressing it says what's needed instead. -->
      <Button type="submit" size="lg" block :loading="starting">
        {{ topUpButtonLabel(amount) }}
      </Button>
    </form>
  </Modal>
</template>

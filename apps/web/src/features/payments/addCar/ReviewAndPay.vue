<script setup lang="ts">
import { CircleAlert, CircleCheck } from '@lucide/vue';
import {
  debitWallet,
  errorMessage,
  findDuplicatePlate,
  formatNaira,
  getPricing,
  isHttpError,
} from '@motopapers/api';
import { Button } from '@motopapers/ui';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { computed, ref, useId } from 'vue';
import { flags } from '@/env';
import { queryKeys, vehiclesQuery, walletQuery } from '@/lib/queries';
import AddCarSuccess from '../../cars/add/AddCarSuccess.vue';
import DraftReview from '../../cars/add/DraftReview.vue';
import type { ReadyToPayEmits, ReadyToPayProps } from '../../cars/add/onReadyToPay';
import { payOnPaystack } from '../lib/checkout';
import CarSaveProblem from './CarSaveProblem.vue';
import { useCarSaveOutcome } from './outcome';
import { paidFromWallet, type WalletPayment } from './paid';
import '../payments.css';

/**
 * Add a car, step 4: Review and pay. The tracking fee (GET /pricing) is paid from the wallet
 * (POST /wallets/debit, VITE_FLAG_WALLET_PAY) and then the car is saved here, or by card or bank
 * transfer on Paystack, after which the payment return page saves the car and shows the success
 * screen.
 */

const props = defineProps<ReadyToPayProps>();
const emit = defineEmits<ReadyToPayEmits>();

const { saver } = props;
const queryClient = useQueryClient();

const pricing = useQuery({
  queryKey: queryKeys.pricing,
  queryFn: ({ signal }) => getPricing({ signal }),
  staleTime: 5 * 60_000,
});
const fee = computed(() => pricing.data.value?.tracking_fee ?? null);
const feeText = computed(() => (fee.value === null ? '₦…' : formatNaira(fee.value)));

const wallet = useQuery({ ...walletQuery(), enabled: flags.walletPay, meta: { silent: true } });
const balance = computed(() => wallet.data.value?.balance ?? null);

type Method = 'wallet' | 'card';
const walletShort = computed(
  () => fee.value !== null && balance.value !== null && balance.value < fee.value,
);
const walletUsable = computed(
  () => flags.walletPay && fee.value !== null && balance.value !== null && !walletShort.value,
);
const walletNote = computed(() => {
  if (wallet.isError.value) return "We couldn't check your balance";
  if (balance.value === null) return 'Checking your balance…';
  const available = `${formatNaira(balance.value)} available`;
  return walletShort.value ? `${available}. Not enough for this payment.` : available;
});
const walletNoteId = useId();

const chosen = ref<Method | null>(null);
/** The wallet when it can pay, unless the driver picked the card. */
const method = computed<Method>(() => {
  if (chosen.value === 'card' || !walletUsable.value) return 'card';
  return 'wallet';
});

const walletPaid = ref<WalletPayment | null>(paidFromWallet.get(saver) ?? null);
const paying = ref(false);
const payError = ref<string | null>(null);

const outcome = useCarSaveOutcome(saver, () => props.draft);

/** Someone may have added this plate in another tab since step 2 checked. */
async function plateTaken(): Promise<boolean> {
  try {
    const cars = await queryClient.fetchQuery({ ...vehiclesQuery(), staleTime: 0 });
    return Boolean(findDuplicatePlate(props.draft.car.plate_number, cars));
  } catch {
    return false; // Can't check: the API still refuses a duplicate with a 409.
  }
}

async function pay() {
  const amount = fee.value;
  if (paying.value || amount === null) return;
  const via = method.value;
  payError.value = null;
  paying.value = true;
  try {
    if (await plateTaken()) {
      paying.value = false;
      emit('duplicate');
      return;
    }
    if (via === 'card') {
      await payOnPaystack({
        amount,
        category: 'service_charge',
        intent: {
          kind: 'add-car',
          returnTo: '/cars/new',
          draft: JSON.parse(JSON.stringify(props.draft)),
        },
      });
      return; // On the way to Paystack: the button stays busy until the page goes.
    }
    const debit = await debitWallet({ amount, category: 'service_charge' });
    const payment = { amount, reference: debit.transaction.reference };
    paidFromWallet.set(saver, payment);
    walletPaid.value = payment;
    void queryClient.invalidateQueries({ queryKey: queryKeys.wallet });
    void queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
    paying.value = false;
    await saver.save();
  } catch (error) {
    paying.value = false;
    if (isHttpError(error, 400) && /insufficient/i.test(error.message)) {
      payError.value = 'Not enough in your wallet. Pay by card or bank transfer instead.';
      chosen.value = 'card';
      void wallet.refetch();
    } else if (via === 'card') {
      payError.value = `We couldn't open Paystack. ${errorMessage(error)}`;
    } else {
      payError.value = `We couldn't take the payment. ${errorMessage(error)}`;
    }
  }
}

function restart() {
  paidFromWallet.forget(saver);
  emit('restart');
}

const paidLine = computed(() =>
  walletPaid.value ? `${formatNaira(walletPaid.value.amount)} was paid from your wallet.` : '',
);
</script>

<template>
  <AddCarSuccess
    v-if="outcome.done.value && saver.vehicle.value"
    :vehicle="saver.vehicle.value"
    :draft="draft"
    :saved="outcome.saved.value"
    :skipped="outcome.skipped.value"
    :paid-line="paidLine"
    @restart="restart"
  />
  <div v-else>
    <h2 class="wz-title" tabindex="-1" data-step-heading>Review and start reminders</h2>
    <p class="wz-sub">Tracking covers reminders for all three papers for 12 months.</p>

    <div class="review">
      <DraftReview :draft="draft" />
      <div class="rbox">
        <h3>Payment</h3>
        <div class="rline">
          <span>Tracking and reminders, 1 car</span><span class="num">{{ feeText }}</span>
        </div>
        <div class="rline total">
          <span>Total</span><span class="num">{{ feeText }}</span>
        </div>

        <p v-if="walletPaid" class="paid-note">
          <CircleCheck class="ic" aria-hidden="true" />
          Paid {{ formatNaira(walletPaid.amount) }} from your wallet.
        </p>
        <fieldset v-else class="pay-methods" :disabled="paying">
          <legend class="lbl">Pay with</legend>
          <label v-if="flags.walletPay" class="radio-card" :class="{ off: !walletUsable }">
            <input
              type="radio"
              name="pay-method"
              value="wallet"
              :checked="method === 'wallet'"
              :disabled="!walletUsable"
              :aria-describedby="walletNoteId"
              @change="chosen = 'wallet'"
            />
            <span>
              <b>Wallet</b>
              <small :id="walletNoteId">{{ walletNote }}</small>
            </span>
          </label>
          <label class="radio-card">
            <input
              type="radio"
              name="pay-method"
              value="card"
              :checked="method === 'card'"
              @change="chosen = 'card'"
            />
            <span>
              <b>Card or bank transfer</b>
              <small>You'll finish paying on Paystack</small>
            </span>
          </label>
        </fieldset>
      </div>
    </div>

    <p v-if="payError" class="form-error" role="alert">
      <CircleAlert class="ic" aria-hidden="true" />
      <span>{{ payError }}</span>
    </p>

    <CarSaveProblem
      v-if="walletPaid"
      :draft="draft"
      :saver="saver"
      :paid-text="`Your ${formatNaira(walletPaid.amount)} payment went through`"
      :reference="walletPaid.reference"
      @skip="outcome.skip()"
    />
    <div v-else class="wz-foot">
      <Button variant="white" :disabled="paying" @click="emit('back')">Back</Button>
      <Button size="lg" :loading="paying" :disabled="fee === null" @click="pay">
        Pay {{ feeText }} and start
      </Button>
    </div>
  </div>
</template>

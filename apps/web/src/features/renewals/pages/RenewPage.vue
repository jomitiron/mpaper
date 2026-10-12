<script setup lang="ts">
import { CircleAlert, CircleCheck, Clock } from '@lucide/vue';
import { formatNaira, getPricing, lagosToday, STATE_LABELS, STATE_TONES } from '@motopapers/api';
import { Button, Field, Input, PaperIcon, Plate, StatusPill } from '@motopapers/ui';
import { useQuery } from '@tanstack/vue-query';
import { computed, nextTick, ref, useId, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import PageHeader from '@/components/PageHeader.vue';
import { flags } from '@/env';
import { queryKeys, vehiclesQuery, walletQuery } from '@/lib/queries';
import { useSessionStore } from '@/stores/session';
import { focusFirstInvalid } from '@/features/auth/lib/focus';
import {
  carName,
  coverLabel,
  dueWords,
  expiryLine,
  PAPER_CLASS,
  PAPER_NOUN,
  paperViews,
} from '@/features/cars/lib/papers';
import RenewalStatus from '../components/RenewalStatus.vue';
import RequestStatus from '../components/RequestStatus.vue';
import { ADDRESS_HINT, formatPhone } from '../lib/delivery';
import { problemText, renewMode, walletOption } from '../lib/flow';
import { paperFromSlug, paperWords, RENEWAL_NAMES, renewalPrice } from '../lib/papers';
import { openRequestFor } from '../lib/requests';
import { useOpenRequests, useVehicleRenewals } from '../lib/queries';
import { awaitingPaymentFor, renewalFor } from '../lib/status';
import { useRenewFlow } from '../lib/useRenewFlow';
import '@/features/cars/cars.css';
import '@/features/payments/payments.css';
import '../renewals.css';

/**
 * `/cars/:id/renew/:paper`: renew one paper on one car. Confirm the car and paper, see the price
 * (GET /pricing), check the delivery address (saved to the profile with PUT /users), then pay
 * from the wallet or by card (POST /vehicles/:id/renewals, VITE_FLAG_RENEWALS). Without the
 * renewals API, or for a paper the team prices, it's "Request renewal" and the team calls.
 *
 * If this paper is already being renewed, the page shows where it is instead.
 */

const route = useRoute();
const router = useRouter();
const session = useSessionStore();

const vehicleId = Number(route.params.id);
const kind = paperFromSlug(route.params.paper);
const today = lagosToday();

const vehicles = useQuery({ ...vehiclesQuery(), meta: { silent: true } });
const vehicle = computed(() => vehicles.data.value?.find((v) => v.id === vehicleId));
const paper = computed(() =>
  vehicle.value && kind ? paperViews(vehicle.value).find((p) => p.kind === kind) : undefined,
);

const pricing = useQuery({
  queryKey: queryKeys.pricing,
  queryFn: ({ signal }) => getPricing({ signal }),
  staleTime: 5 * 60_000,
});
const price = computed(() =>
  kind && paper.value ? renewalPrice(pricing.data.value, kind, paper.value.cover) : undefined,
);
const mode = computed(() => renewMode({ renewalsApi: flags.renewals, price: price.value ?? null }));

const wallet = useQuery({ ...walletQuery(), enabled: flags.renewals, meta: { silent: true } });
const walletChoice = computed(() =>
  walletOption({
    price: price.value,
    balance: wallet.data.value?.balance,
    failed: wallet.isError.value,
  }),
);
const walletNoteId = useId();

const renewals = useVehicleRenewals(kind ? vehicleId : null);
const current = computed(() =>
  kind ? renewalFor(renewals.data.value ?? [], vehicleId, kind, today) : undefined,
);
const awaiting = computed(() =>
  kind ? awaitingPaymentFor(renewals.data.value ?? [], vehicleId, kind, today) : undefined,
);
const openRequests = useOpenRequests();
const openRequest = computed(() =>
  kind && vehicles.data.value
    ? openRequestFor(openRequests.value, vehicles.data.value, vehicleId, kind, today)
    : undefined,
);

const flow = useRenewFlow({
  vehicle: () => vehicle.value,
  kind: kind ?? 'vehicle_license',
  price: () => price.value,
  mode: () => mode.value,
  wallet: () => walletChoice.value,
  returnTo: () => route.fullPath,
});
const { state, errors, method, busy } = flow;

// ---------------------------------------------------------------- the form

const address = ref(session.user?.address ?? '');
/** Only asked for when the account has no phone number for the team to call. */
const needsPhone = !session.user?.phone;
const phone = ref('');

const form = ref<HTMLFormElement | null>(null);

async function submit() {
  await flow.submit({ address: address.value, phone: needsPhone ? phone.value : null });
  if (Object.keys(errors.value).length) await focusFirstInvalid(form.value);
}

// ---------------------------------------------------------------- what to show

type View = 'loading' | 'error' | 'missing' | 'started' | 'tracking' | 'requested' | 'form';

const view = computed<View>(() => {
  if (!kind) return 'missing';
  if (state.value.status === 'started') return 'started';
  if (state.value.status === 'requested') return 'requested';
  if (vehicles.isPending.value) return 'loading';
  if (vehicles.isError.value) return 'error';
  if (!vehicle.value || !paper.value) return 'missing';
  // Once the form is in use, a renewal appearing (ours, by card) mustn't swap it out.
  if (state.value.status === 'editing' && !state.value.problem) {
    if (flags.renewals && renewals.isPending.value) return 'loading';
    if (current.value) return 'tracking';
    if (openRequest.value) return 'requested';
  }
  if (price.value === undefined && pricing.isPending.value) return 'loading';
  return 'form';
});

const shownRenewal = computed(() =>
  state.value.status === 'started' ? state.value.renewal : current.value,
);
const shownRequest = computed(() =>
  state.value.status === 'requested' ? state.value.request : openRequest.value,
);

const noun = kind ? PAPER_NOUN[kind] : 'paper';
const title = computed(() => `Renew ${noun}`);
const sub = computed(() =>
  vehicle.value ? `${vehicle.value.plate_number} · ${carName(vehicle.value)}` : undefined,
);
watch(
  () => vehicle.value?.plate_number,
  (plate) => {
    document.title = plate ? `Renew ${noun} · ${plate} · MotoPapers` : 'Renew a paper · MotoPapers';
  },
  { immediate: true },
);

/** Back to wherever the Renew button was (Home, My cars, the car panel). */
const back = computed(() => {
  const before = router.options.history.state.back;
  if (typeof before === 'string' && before !== route.fullPath && !before.startsWith('/payments')) {
    return { to: before, label: 'Back' };
  }
  return { to: { name: 'car', params: { id: String(vehicleId) } }, label: 'Car details' };
});
const carLink = { name: 'car', params: { id: String(vehicleId) } };

const priceText = computed(() => {
  if (price.value === undefined) return '₦…';
  return price.value === null ? 'Quoted by our team' : formatNaira(price.value);
});
const priceLine = computed(() => {
  if (!kind) return '';
  const cover = paper.value?.cover ? `, ${coverLabel(paper.value.cover).toLowerCase()}` : '';
  return `${RENEWAL_NAMES[kind]}${cover}`;
});
const paperLine = computed(() => {
  const p = paper.value;
  if (!p || p.state === 'untracked') return 'Not on file yet';
  const when = p.state === 'expired' || p.state === 'due' ? ` · ${dueWords(p)}` : '';
  return `${expiryLine(p)}${when}`;
});

const submitLabel = computed(() => {
  if (mode.value === 'request') return 'Request renewal';
  return price.value ? `Pay ${formatNaira(price.value)}` : 'Pay';
});

const callPhone = computed(() => formatPhone(session.user?.phone));

const problem = computed(() =>
  state.value.status === 'editing' && state.value.problem ? problemText(state.value.problem) : null,
);

// Move focus to what's new: the renewal once it's started or requested.
watch(view, async (now, before) => {
  if (before === undefined || (now !== 'started' && now !== 'requested')) return;
  await nextTick();
  document.querySelector<HTMLElement>('[data-renewal-heading]')?.focus();
});
</script>

<template>
  <PageHeader :title="title" :sub="sub" :back="back" />

  <div v-if="view === 'loading'" class="wz-card rn-loading" aria-busy="true">
    <span class="skeleton" /><span class="skeleton" /><span class="skeleton" />
    <span class="visually-hidden">Loading your car…</span>
  </div>

  <div v-else-if="view === 'error'" class="wz-card">
    <h2 class="wz-title">We couldn't load your car</h2>
    <p class="wz-sub">Check your connection and try again.</p>
    <Button size="sm" @click="vehicles.refetch()">Try again</Button>
  </div>

  <div v-else-if="view === 'missing'" class="wz-card">
    <h2 class="wz-title">We couldn't find this paper</h2>
    <p class="wz-sub">The car may have been deleted, or the link is wrong.</p>
    <Button size="sm" to="/cars">See my cars</Button>
  </div>

  <div v-else-if="(view === 'started' || view === 'tracking') && shownRenewal" class="rn-page">
    <p v-if="view === 'started'" class="paid-note">
      <CircleCheck class="ic" aria-hidden="true" />
      Paid {{ formatNaira(shownRenewal.amount) }} from your wallet. We'll email you at each step.
    </p>
    <RenewalStatus :renewal="shownRenewal" :vehicle="vehicle" :level="2" />
    <div class="rn-acts">
      <Button :to="carLink">See {{ vehicle?.plate_number ?? 'your car' }}</Button>
      <Button variant="white" to="/">Go to Home</Button>
    </div>
  </div>

  <div v-else-if="view === 'requested' && shownRequest" class="rn-page">
    <RequestStatus :request="shownRequest" :vehicle="vehicle" :level="2" />
    <div class="rn-acts">
      <Button :to="carLink">See {{ vehicle?.plate_number ?? 'your car' }}</Button>
      <Button variant="white" to="/">Go to Home</Button>
    </div>
  </div>

  <form
    v-else-if="kind && vehicle && paper"
    ref="form"
    class="wz-card rn-form"
    novalidate
    @submit.prevent="submit"
  >
    <h2 class="wz-title">
      {{ mode === 'request' ? 'Ask us to renew it' : 'Check and pay' }}
    </h2>
    <p class="wz-sub">
      We renew your {{ paperWords(kind) }} and deliver the new one to your door.
      <template v-if="mode === 'request'">
        Send the request and our team will call you to take payment and arrange delivery.
      </template>
    </p>

    <div class="review">
      <div class="rbox">
        <div class="review-top">
          <Plate :plate="vehicle.plate_number" />
          <StatusPill :tone="STATE_TONES[paper.state]">{{ STATE_LABELS[paper.state] }}</StatusPill>
        </div>
        <h3 class="review-name">{{ carName(vehicle) }}</h3>
        <div class="rn-paper" :class="paper.state === 'expired' ? 'd-expired' : PAPER_CLASS[kind]">
          <PaperIcon :paper="kind" />
          <span>
            <b>{{ paper.name }}</b>
            <small>{{ paperLine }}</small>
          </span>
        </div>

        <Field label="Delivery address" :hint="ADDRESS_HINT" :error="errors.address">
          <template #default="{ id, describedBy, invalid }">
            <textarea
              :id="id"
              v-model="address"
              class="inp rn-address"
              rows="2"
              autocomplete="street-address"
              :aria-describedby="describedBy"
              :aria-invalid="invalid ? 'true' : undefined"
              :disabled="busy"
            />
          </template>
        </Field>
        <Field
          v-if="needsPhone"
          label="Phone number"
          hint="Our team calls this number about the renewal."
          :error="errors.phone"
        >
          <Input
            v-model="phone"
            prefix="+234"
            type="tel"
            inputmode="tel"
            autocomplete="tel-national"
            :disabled="busy"
          />
        </Field>
        <p class="hint">
          We'll save {{ needsPhone ? 'these to your profile' : 'it to your profile' }} for next
          time.
        </p>
      </div>

      <div class="rbox">
        <h3>{{ mode === 'request' ? 'Price' : 'Payment' }}</h3>
        <div class="rline">
          <span>{{ priceLine }}</span
          ><span class="num">{{ priceText }}</span>
        </div>
        <div v-if="price" class="rline total">
          <span>Total</span><span class="num">{{ formatNaira(price) }}</span>
        </div>

        <template v-if="mode === 'pay'">
          <fieldset class="pay-methods" :disabled="busy">
            <legend class="lbl">Pay with</legend>
            <label class="radio-card" :class="{ off: !walletChoice.usable }">
              <input
                type="radio"
                name="renew-pay"
                value="wallet"
                :checked="method === 'wallet'"
                :disabled="!walletChoice.usable"
                :aria-describedby="walletNoteId"
                @change="flow.choose('wallet')"
              />
              <span>
                <b>Wallet</b>
                <small :id="walletNoteId">{{ walletChoice.note }}</small>
              </span>
            </label>
            <label class="radio-card">
              <input
                type="radio"
                name="renew-pay"
                value="card"
                :checked="method === 'card'"
                @change="flow.choose('card')"
              />
              <span>
                <b>Card or bank transfer</b>
                <small>You'll finish paying on Paystack</small>
              </span>
            </label>
          </fieldset>
          <p v-if="walletChoice.short" class="hint">
            Or
            <RouterLink class="link" :to="{ path: '/payments', query: { topup: '1' } }"
              >top up your wallet</RouterLink
            >
            first.
          </p>
        </template>
        <p v-else class="rn-how">
          <template v-if="price === null">
            {{ coverLabel(paper.cover) || 'This' }} cover is priced on your car's value, so our team
            will give you a price when they call.
          </template>
          <template v-else>You'll pay when our team calls. Nothing is charged now.</template>
          <template v-if="callPhone"> We'll call you on {{ callPhone }}.</template>
        </p>
      </div>
    </div>

    <p v-if="awaiting && mode === 'pay'" class="warn-line" role="status">
      <Clock class="ic" aria-hidden="true" />
      <span>
        A card payment of {{ formatNaira(awaiting.amount) }} for this renewal is still being
        confirmed. Check <RouterLink class="link" to="/payments">Payments</RouterLink> before you
        pay again.
      </span>
    </p>

    <p v-if="problem" class="pay-error rn-problem" role="alert">
      <CircleAlert class="ic" aria-hidden="true" />
      <span>{{ problem }}</span>
    </p>

    <div class="wz-foot">
      <Button variant="white" :to="back.to" :disabled="busy">Back</Button>
      <Button type="submit" size="lg" :loading="busy" :disabled="mode === 'pay' && !price">
        {{ submitLabel }}
      </Button>
    </div>
  </form>
</template>

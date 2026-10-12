<script setup lang="ts">
import { formatNaira, formatPlate, PAPER_KINDS, type PaperKind } from '@motopapers/api';
import { computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import PageHeader from '@/components/PageHeader.vue';
import AddCarSuccess from '../../cars/add/AddCarSuccess.vue';
import DraftReview from '../../cars/add/DraftReview.vue';
import { useCarSaver } from '../../cars/add/useCarSaver';
import type { AddCarIntent } from '../lib/intent';
import { intentStore } from '../lib/intent';
import CarSaveProblem from './CarSaveProblem.vue';
import { useCarSaveOutcome } from './outcome';
import { resumableCarApi } from './resumableCarApi';
import '../../cars/cars.css';

/**
 * Add a car, paid by card: back from Paystack with the payment confirmed, save the car from the
 * remembered draft and show "KTU 604 XR is all set". What's saved is written to the intent as it
 * goes, so reloading this page never adds the car twice.
 */

const props = defineProps<{ intent: AddCarIntent }>();

const router = useRouter();
const store = intentStore();
const reference = props.intent.reference;
const draft = props.intent.draft;

const saver = useCarSaver(() => draft, resumableCarApi(reference, store));
const outcome = useCarSaveOutcome(saver, () => draft, props.intent.skipped ?? []);

// Finished on an earlier visit: show the result without saving anything again.
const finished = props.intent.done && props.intent.saved ? props.intent.saved : null;

onMounted(() => {
  if (!finished) void saver.save();
});

watch(outcome.done, (done) => {
  if (!done) return;
  const skipped = [...outcome.skipped.value];
  store.update(reference, (intent) => ({ ...intent, done: true, skipped }));
});

const vehicle = computed(() => saver.vehicle.value ?? finished?.vehicle ?? null);
const saved = computed<PaperKind[]>(() =>
  finished
    ? PAPER_KINDS.filter((kind) => finished.papers[kind] !== undefined)
    : outcome.saved.value,
);
const skipped = computed(() => (finished ? (props.intent.skipped ?? []) : outcome.skipped.value));
const success = computed(() => (finished !== null || outcome.done.value) && vehicle.value);
const plate = formatPlate(draft.car.plate_number);
</script>

<template>
  <PageHeader title="Add a car" :back="{ to: '/cars', label: 'My cars' }" />
  <div class="wz-card">
    <AddCarSuccess
      v-if="success && vehicle"
      :vehicle="vehicle"
      :draft="draft"
      :saved="saved"
      :skipped="skipped"
      paid-line="Payment received through Paystack."
      @restart="router.push('/cars/new')"
    />
    <div v-else>
      <h2 class="wz-title" tabindex="-1" data-result-heading>Adding {{ plate }}</h2>
      <p class="wz-sub">
        Payment received through Paystack. Now we're saving your car and its papers.
      </p>
      <div class="review review-one">
        <DraftReview :draft="draft" />
      </div>
      <CarSaveProblem
        :draft="draft"
        :saver="saver"
        :paid-text="`Your ${formatNaira(intent.amount)} payment went through`"
        :reference="reference"
        @skip="outcome.skip()"
      />
    </div>
  </div>
</template>

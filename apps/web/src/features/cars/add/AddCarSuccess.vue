<script setup lang="ts">
import { Check } from '@lucide/vue';
import { PAPER_LABELS, type PaperKind, type Vehicle } from '@motopapers/api';
import { Button } from '@motopapers/ui';
import { computed, onMounted, ref } from 'vue';
import { toPaperBodies, type CarDraft } from './draft';
import { firstReminderLine } from './reminder';

/** "KTU 604 XR is all set", after the car is saved. */

const props = withDefaults(
  defineProps<{
    vehicle: Vehicle;
    draft: CarDraft;
    /** Papers that were saved. */
    saved: readonly PaperKind[];
    /** Papers the driver chose to add later after they failed to save. */
    skipped?: readonly PaperKind[];
    /** A line about payment, from phase 3 ("₦2,500 was paid from your wallet."). */
    paidLine?: string;
  }>(),
  { skipped: () => [], paidLine: undefined },
);

const emit = defineEmits<{ restart: [] }>();

const heading = ref<HTMLElement | null>(null);
onMounted(() => heading.value?.focus());

const reminder = computed(() => firstReminderLine(toPaperBodies(props.draft), props.saved));
const skippedLine = computed(() => {
  if (!props.skipped.length) return '';
  const names = props.skipped.map((kind) => PAPER_LABELS[kind].name.toLowerCase());
  return `Add its ${names.join(' and ')} from the car panel when you're ready.`;
});
</script>

<template>
  <div class="success">
    <span class="success-ic" aria-hidden="true"><Check class="ic" /></span>
    <h2 ref="heading" tabindex="-1">
      <span class="num">{{ vehicle.plate_number }}</span> is all set
    </h2>
    <p>
      <template v-if="paidLine">{{ paidLine }} </template>{{ reminder }}
      <template v-if="skippedLine"> {{ skippedLine }}</template>
    </p>
    <div class="acts">
      <Button to="/cars">See my cars</Button>
      <Button variant="white" @click="emit('restart')">Add another car</Button>
    </div>
  </div>
</template>

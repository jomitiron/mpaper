<script setup lang="ts">
import { CircleAlert } from '@lucide/vue';
import { PAPER_LABELS, type PaperKind } from '@motopapers/api';
import { Button } from '@motopapers/ui';
import { computed, ref, watch } from 'vue';
import AddCarSuccess from './AddCarSuccess.vue';
import DraftReview from './DraftReview.vue';
import type { ReadyToPayEmits, ReadyToPayProps } from './onReadyToPay';
import { papersInDraft } from './saveCar';

/**
 * Step 4, phase 2 version: review and add the car, no payment yet. Phase 3 replaces this with
 * Review and pay (see onReadyToPay.ts).
 */

const props = defineProps<ReadyToPayProps>();
const emit = defineEmits<ReadyToPayEmits>();

const { saver } = props;
const skipped = ref<PaperKind[]>([]);

const done = computed(
  () =>
    saver.status.value === 'saved' ||
    (saver.status.value === 'partial' && skipped.value.length > 0),
);
const carSaved = computed(() => saver.vehicle.value !== null);
const failedNames = computed(() =>
  saver.failed.value.map((kind) => PAPER_LABELS[kind].name.toLowerCase()).join(' and '),
);
const saved = computed(() =>
  papersInDraft(props.draft).filter((kind) => !saver.failed.value.includes(kind)),
);

watch(saver.status, (status) => {
  if (status === 'duplicate') emit('duplicate');
});

function skip() {
  skipped.value = [...saver.failed.value];
}

function restart() {
  skipped.value = [];
  emit('restart');
}
</script>

<template>
  <AddCarSuccess
    v-if="done && saver.vehicle.value"
    :vehicle="saver.vehicle.value"
    :draft="draft"
    :saved="saved"
    :skipped="skipped"
    @restart="restart"
  />
  <div v-else>
    <h2 class="wz-title" tabindex="-1" data-step-heading>Review and start reminders</h2>
    <p class="wz-sub">
      Check everything is right. You can update any paper later from the car's panel.
    </p>
    <div class="review review-one">
      <DraftReview :draft="draft" />
    </div>

    <p v-if="saver.status.value === 'failed'" class="form-error" role="alert">
      <CircleAlert class="ic" aria-hidden="true" />
      <span>We couldn't add your car. {{ saver.error.value }}</span>
    </p>
    <p v-else-if="saver.status.value === 'partial'" class="form-error" role="alert">
      <CircleAlert class="ic" aria-hidden="true" />
      <span>
        Your car is added, but we couldn't save its {{ failedNames }}. {{ saver.error.value }}
      </span>
    </p>

    <div class="wz-foot">
      <Button v-if="!carSaved" variant="white" @click="emit('back')">Back</Button>
      <Button v-else variant="quiet" @click="skip">Skip, add it later</Button>
      <Button size="lg" :loading="saver.status.value === 'saving'" @click="saver.save()">
        {{ carSaved || saver.status.value === 'failed' ? 'Try again' : 'Add car' }}
      </Button>
    </div>
  </div>
</template>

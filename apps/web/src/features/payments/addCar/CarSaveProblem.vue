<script setup lang="ts">
import { CircleAlert } from '@lucide/vue';
import { formatPlate, PAPER_LABELS } from '@motopapers/api';
import { Button } from '@motopapers/ui';
import { computed, ref, watch } from 'vue';
import type { CarDraft } from '../../cars/add/draft';
import type { CarSaver } from '../../cars/add/useCarSaver';
import { SUPPORT_PHONE } from '../lib/support';

/**
 * After the tracking fee is paid: what went wrong saving the car, if anything, and the buttons to
 * finish (Try again, Skip, add it later). The payment is never taken again from here.
 */

const props = defineProps<{
  draft: CarDraft;
  saver: CarSaver;
  /** "Your ₦2,500 payment went through". */
  paidText: string;
  /** The payment's reference, for support. */
  reference?: string;
}>();

const emit = defineEmits<{ skip: [] }>();

const status = computed(() => props.saver.status.value);
const plate = computed(() => formatPlate(props.draft.car.plate_number));
const failedNames = computed(() =>
  props.saver.failed.value.map((kind) => PAPER_LABELS[kind].name.toLowerCase()).join(' and '),
);

// "Add car" until a save has gone wrong once, then "Try again".
const tried = ref(false);
watch(
  status,
  (value) => {
    if (value === 'failed' || value === 'partial') tried.value = true;
  },
  { immediate: true },
);
</script>

<template>
  <p v-if="status === 'failed'" class="form-error" role="alert">
    <CircleAlert class="ic" aria-hidden="true" />
    <span>{{ paidText }}, but we couldn't add your car yet. {{ saver.error.value }}</span>
  </p>
  <p v-else-if="status === 'partial'" class="form-error" role="alert">
    <CircleAlert class="ic" aria-hidden="true" />
    <span>
      Your car is added, but we couldn't save its {{ failedNames }}. {{ saver.error.value }}
    </span>
  </p>
  <p v-else-if="status === 'duplicate'" class="form-error" role="alert">
    <CircleAlert class="ic" aria-hidden="true" />
    <span>
      {{ paidText }}, but {{ plate }} is already on your account, so we didn't add it again. Call us
      on {{ SUPPORT_PHONE }}<template v-if="reference"> with reference {{ reference }}</template>
      and we'll sort it out.
    </span>
  </p>

  <div class="wz-foot">
    <Button v-if="status === 'duplicate'" to="/cars">See my cars</Button>
    <template v-else>
      <Button v-if="status === 'partial'" variant="quiet" @click="emit('skip')">
        Skip, add it later
      </Button>
      <span v-else aria-hidden="true" />
      <Button size="lg" :loading="status === 'saving'" @click="saver.save()">
        {{ tried ? 'Try again' : 'Add car' }}
      </Button>
    </template>
  </div>
</template>

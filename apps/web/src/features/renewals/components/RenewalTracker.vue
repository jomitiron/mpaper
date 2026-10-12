<script setup lang="ts">
import { Check } from '@lucide/vue';
import type { RenewalStatus } from '@motopapers/api';
import { computed } from 'vue';
import { trackerSteps } from '../lib/status';

/** Paid, Processing, Out for delivery, Delivered: the steps from the renewal-update email. */

const props = defineProps<{ status: RenewalStatus }>();

const steps = computed(() => trackerSteps(props.status));
const STATE_WORDS = { done: 'done', current: 'in progress', todo: 'to come' } as const;
</script>

<template>
  <ol class="rn-steps" aria-label="Renewal progress">
    <li
      v-for="step in steps"
      :key="step.label"
      :class="`rn-step rn-${step.state}`"
      :aria-current="step.state === 'current' ? 'step' : undefined"
    >
      <span class="rn-mark" aria-hidden="true">
        <Check v-if="step.state === 'done'" class="ic ic-sm" />
      </span>
      <span class="rn-label"
        >{{ step.label }}<span class="visually-hidden"> ({{ STATE_WORDS[step.state] }})</span></span
      >
    </li>
  </ol>
</template>

<script setup lang="ts">
/**
 * Step progress. `numbered` is Add a car (number, title, hint); `bars` is Sign up (a bar over
 * each title). `current` is the 0-based index of the step in progress; steps before it are done,
 * and `current >= steps.length` marks them all done. With `clickable`, done steps become buttons
 * that emit `select`.
 */

export interface StepItem {
  title: string;
  hint?: string;
}

withDefaults(
  defineProps<{
    steps: readonly StepItem[];
    current: number;
    variant?: 'numbered' | 'bars';
    label?: string;
    clickable?: boolean;
  }>(),
  { variant: 'numbered', label: 'Steps' },
);

defineEmits<{ select: [index: number] }>();
</script>

<template>
  <ol
    :class="variant === 'bars' ? 'su-steps' : 'wz-steps'"
    :style="{ '--steps': steps.length }"
    :aria-label="label"
  >
    <li
      v-for="(step, index) in steps"
      :key="index"
      :class="[variant === 'bars' ? 'su-step' : 'wz-step', { done: index < current }]"
      :aria-current="index === current ? 'step' : undefined"
    >
      <component
        :is="clickable && index < current ? 'button' : 'span'"
        :type="clickable && index < current ? 'button' : undefined"
        class="step-body"
        @click="clickable && index < current && $emit('select', index)"
      >
        <span v-if="variant === 'numbered'" class="n" aria-hidden="true">{{ index + 1 }}</span>
        <span class="t">
          {{ step.title }}
          <small v-if="variant === 'numbered' && step.hint">{{ step.hint }}</small>
        </span>
        <span v-if="index < current" class="visually-hidden">(done)</span>
      </component>
    </li>
  </ol>
</template>

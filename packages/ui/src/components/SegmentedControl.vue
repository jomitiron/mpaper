<script setup lang="ts" generic="T extends string | number">
/** A row of mutually exclusive options (cover type). Each option is a toggle button. */

export interface SegmentOption<V> {
  value: V;
  label: string;
  disabled?: boolean;
}

defineProps<{
  options: readonly SegmentOption<T>[];
  /** Accessible name for the group, e.g. "Cover type". */
  label: string;
}>();

const model = defineModel<T>();
</script>

<template>
  <div class="seg" role="group" :aria-label="label">
    <button
      v-for="option in options"
      :key="String(option.value)"
      type="button"
      :aria-pressed="model === option.value ? 'true' : 'false'"
      :disabled="option.disabled"
      @click="model = option.value"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
/** On/off switch. `label` is its accessible name (the row text next to it is usually the visible one). */
defineOptions({ inheritAttrs: false });

defineProps<{ label: string; disabled?: boolean }>();

const checked = defineModel<boolean>({ default: false });
</script>

<template>
  <label class="switch">
    <input
      v-bind="$attrs"
      v-model="checked"
      type="checkbox"
      role="switch"
      :aria-label="label"
      :disabled="disabled"
    />
    <span aria-hidden="true" />
  </label>
</template>

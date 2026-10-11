<script setup lang="ts">
import { CircleAlert, CircleCheck } from '@lucide/vue';

/** A message about the whole form, read out when it appears. Put actions in the slot. */
withDefaults(defineProps<{ message: string; tone?: 'error' | 'info' }>(), { tone: 'error' });
</script>

<template>
  <div class="form-alert" :class="`form-alert-${tone}`" :role="tone === 'error' ? 'alert' : 'status'">
    <CircleAlert v-if="tone === 'error'" class="ic" aria-hidden="true" />
    <CircleCheck v-else class="ic" aria-hidden="true" />
    <div class="form-alert-body">
      <p>{{ message }}</p>
      <slot />
    </div>
  </div>
</template>

<style scoped>
.form-alert {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 600;
}
.form-alert .ic {
  margin-top: 1px;
}
.form-alert-error {
  background: var(--rose);
  color: var(--rose-i);
}
.form-alert-info {
  background: var(--mint);
  color: var(--mint-i);
}
.form-alert-body {
  display: grid;
  gap: 8px;
  justify-items: start;
}
</style>

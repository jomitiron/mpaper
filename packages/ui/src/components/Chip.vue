<script setup lang="ts">
/**
 * A filter or toggle chip. Pass `pressed` (or `v-model:pressed`) to make it a toggle button with
 * aria-pressed; leave it out for a plain chip button (quick amounts).
 */
defineProps<{
  /** Shown after the label, e.g. how many cars match the filter. */
  count?: number | string;
}>();

const pressed = defineModel<boolean | undefined>('pressed', { default: undefined });

const emit = defineEmits<{ click: [event: MouseEvent] }>();

function onClick(event: MouseEvent) {
  if (typeof pressed.value === 'boolean') pressed.value = !pressed.value;
  emit('click', event);
}
</script>

<template>
  <button
    type="button"
    class="chip"
    :aria-pressed="pressed === undefined ? undefined : pressed ? 'true' : 'false'"
    @click="onClick"
  >
    <slot />
    <span v-if="count !== undefined" class="cnt">{{ count }}</span>
  </button>
</template>

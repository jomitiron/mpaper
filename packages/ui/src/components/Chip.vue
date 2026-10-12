<script setup lang="ts">
/**
 * A filter or toggle chip. Pass `pressed` to make it a toggle button with aria-pressed; leave it
 * out for a plain chip button (quick amounts).
 *
 * The pressed state is controlled: a click emits `update:pressed` with the other state (so
 * `v-model:pressed` works), and the chip only changes when the parent passes the new value.
 */
const props = withDefaults(
  defineProps<{
    pressed?: boolean;
    /** Shown after the label, e.g. how many cars match the filter. */
    count?: number | string;
    /**
     * How the count reads to screen readers, e.g. "6 cars", so the chip is "All (6 cars)" rather
     * than "All6". Defaults to the count itself.
     */
    countLabel?: string;
  }>(),
  // Without a pressed value it's a plain button, not a toggle that's off.
  { pressed: undefined, count: undefined, countLabel: undefined },
);

const emit = defineEmits<{ click: [event: MouseEvent]; 'update:pressed': [pressed: boolean] }>();

function onClick(event: MouseEvent) {
  if (props.pressed !== undefined) emit('update:pressed', !props.pressed);
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
    <template v-if="count !== undefined">
      <span class="cnt" aria-hidden="true">{{ count }}</span>
      <span class="visually-hidden"> ({{ countLabel ?? count }})</span>
    </template>
  </button>
</template>

<script setup lang="ts">
import { ref, toRef } from 'vue';
import { useFocusTrap } from '../composables/useFocusTrap';
import { useScrollLock } from '../composables/useScrollLock';

/**
 * A panel that slides in from the right over a scrim (the car panel). Traps focus, closes on
 * Escape or a scrim click, and returns focus to what opened it. Use with `v-model:open`.
 */

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    open: boolean;
    /** Accessible name. Use `labelledby` instead when the sheet has a visible heading. */
    label?: string;
    labelledby?: string;
    closeOnScrim?: boolean;
    /** CSS selector of the element to focus on open. Defaults to the first focusable one. */
    initialFocus?: string;
  }>(),
  { label: undefined, labelledby: undefined, closeOnScrim: true, initialFocus: undefined },
);

const emit = defineEmits<{ 'update:open': [open: boolean]; close: [] }>();

const panel = ref<HTMLElement | null>(null);
const open = toRef(props, 'open');

function close() {
  emit('update:open', false);
  emit('close');
}

useFocusTrap(panel, { active: open, onEscape: close, initialFocus: () => props.initialFocus });
useScrollLock(open);
</script>

<template>
  <Teleport to="body">
    <Transition name="mp-fade">
      <div v-if="open" class="scrim" aria-hidden="true" @click="closeOnScrim && close()" />
    </Transition>
    <Transition name="mp-sheet">
      <aside
        v-if="open"
        v-bind="$attrs"
        ref="panel"
        class="drawer"
        role="dialog"
        aria-modal="true"
        :aria-label="label"
        :aria-labelledby="labelledby"
        tabindex="-1"
      >
        <slot :close="close" />
      </aside>
    </Transition>
  </Teleport>
</template>

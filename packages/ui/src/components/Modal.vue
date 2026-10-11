<script setup lang="ts">
import { X } from '@lucide/vue';
import { ref, toRef, useId } from 'vue';
import { useFocusTrap } from '../composables/useFocusTrap';
import { useScrollLock } from '../composables/useScrollLock';

/**
 * A centred dialog with a title and a close button (top-up). Traps focus, closes on Escape or a
 * click outside, and returns focus to what opened it. Use with `v-model:open`.
 */

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    closeLabel?: string;
    closeOnScrim?: boolean;
    /** CSS selector of the element to focus on open. Defaults to the first focusable one. */
    initialFocus?: string;
  }>(),
  { closeLabel: 'Close', closeOnScrim: true, initialFocus: undefined },
);

const emit = defineEmits<{ 'update:open': [open: boolean]; close: [] }>();

const card = ref<HTMLElement | null>(null);
const open = toRef(props, 'open');
const titleId = useId();

function close() {
  emit('update:open', false);
  emit('close');
}

useFocusTrap(card, { active: open, onEscape: close, initialFocus: () => props.initialFocus });
useScrollLock(open);
</script>

<template>
  <Teleport to="body">
    <Transition name="mp-fade">
      <div v-if="open" class="modal" @click.self="closeOnScrim && close()">
        <div
          v-bind="$attrs"
          ref="card"
          class="modal-card"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          tabindex="-1"
        >
          <div class="top">
            <h2 :id="titleId">{{ title }}</h2>
            <button type="button" class="icon-btn" :aria-label="closeLabel" @click="close">
              <X class="ic" aria-hidden="true" />
            </button>
          </div>
          <slot :close="close" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

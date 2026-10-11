<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, type RouteLocationRaw } from 'vue-router';

export type ButtonVariant =
  'coral' | 'night' | 'white' | 'soft' | 'quiet' | 'danger' | 'danger-soft';
export type ButtonSize = 'sm' | 'md' | 'lg';

const props = withDefaults(
  defineProps<{
    variant?: ButtonVariant;
    size?: ButtonSize;
    /** Full width. */
    block?: boolean;
    /**
     * Shows a spinner and ignores clicks. The button stays focusable (aria-disabled, not disabled)
     * so keyboard focus isn't lost mid-submit.
     */
    loading?: boolean;
    disabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
    /** Renders a RouterLink. */
    to?: RouteLocationRaw;
    /** Renders a plain link (external pages, Paystack). */
    href?: string;
  }>(),
  { variant: 'coral', size: 'md', type: 'button', to: undefined, href: undefined },
);

const emit = defineEmits<{ click: [event: MouseEvent] }>();

const classes = computed(() => [
  'btn',
  `btn-${props.variant}`,
  props.size !== 'md' && `btn-${props.size}`,
  props.block && 'btn-block',
]);

function onClick(event: MouseEvent) {
  if (props.loading || props.disabled) {
    event.preventDefault();
    return;
  }
  emit('click', event);
}
</script>

<template>
  <RouterLink v-if="to !== undefined && !disabled" :to="to" :class="classes" @click="onClick">
    <slot />
  </RouterLink>
  <a v-else-if="href !== undefined && !disabled" :href="href" :class="classes" @click="onClick">
    <slot />
  </a>
  <button
    v-else
    :type="type"
    :class="classes"
    :disabled="disabled"
    :aria-disabled="loading ? 'true' : undefined"
    :aria-busy="loading ? 'true' : undefined"
    @click="onClick"
  >
    <span v-if="loading" class="spin" aria-hidden="true" />
    <slot />
  </button>
</template>

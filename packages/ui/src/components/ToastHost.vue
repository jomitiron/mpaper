<script setup lang="ts">
import { Check, CircleAlert, Sparkles } from '@lucide/vue';
import { computed } from 'vue';
import { useToast, type ToastQueue } from '../composables/useToast';

/** Renders the toast queue. Mount once, near the root of the app. */

const props = defineProps<{ queue?: ToastQueue }>();

const queue = computed(() => props.queue ?? useToast());
const current = computed(() => queue.value.current.value);
const ICONS = { success: Check, error: CircleAlert, info: Sparkles };
</script>

<template>
  <div class="toast-host" role="status" aria-live="polite" aria-atomic="true">
    <Transition name="mp-toast" mode="out-in">
      <div v-if="current" :key="current.id" class="toast" :class="`toast-${current.tone}`">
        <component :is="ICONS[current.tone]" class="ic" aria-hidden="true" />
        <span>{{ current.message }}</span>
      </div>
    </Transition>
  </div>
</template>

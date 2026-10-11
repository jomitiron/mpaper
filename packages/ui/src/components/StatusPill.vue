<script setup lang="ts">
/**
 * Status in words with a dot. Tones: ok (mint), warn (due soon), bad (expired, failed),
 * idle (not tracked). Map paper states with STATE_TONES from @motopapers/api.
 */
export type StatusTone = 'ok' | 'warn' | 'bad' | 'idle';

withDefaults(defineProps<{ tone?: StatusTone }>(), { tone: 'idle' });
</script>

<template>
  <span class="st" :class="`st-${tone}`"><slot /></span>
</template>

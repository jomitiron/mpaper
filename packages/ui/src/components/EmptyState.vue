<script setup lang="ts">
/** Dashed empty box: an icon, a title, a line of help and optional actions (default slot). */
withDefaults(defineProps<{ title: string; text?: string }>(), { text: undefined });
</script>

<template>
  <div class="empty">
    <slot name="icon" />
    <b>{{ title }}</b>
    <span v-if="text">{{ text }}</span>
    <div v-if="$slots.default" class="acts"><slot /></div>
  </div>
</template>

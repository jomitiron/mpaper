<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string;
    subtitle?: string;
    /** Element to render, e.g. `section` or `article`. */
    as?: string;
  }>(),
  { title: undefined, subtitle: undefined, as: 'div' },
);
</script>

<template>
  <component :is="as" class="card">
    <div v-if="title || $slots.header" class="card-h">
      <slot name="header">
        <h2>{{ title }}</h2>
        <p v-if="subtitle">{{ subtitle }}</p>
      </slot>
    </div>
    <slot />
  </component>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    plate: string;
    /** `white` for plates on coloured backgrounds (the car panel header, tiles). */
    variant?: 'default' | 'white';
    size?: 'md' | 'lg';
  }>(),
  { variant: 'default', size: 'md' },
);
</script>

<template>
  <span
    class="plate num"
    :class="{ 'plate-w': variant === 'white', 'plate-lg': size === 'lg' }"
    translate="no"
    >{{ plate }}</span
  >
</template>

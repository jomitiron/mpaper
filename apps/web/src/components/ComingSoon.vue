<script setup lang="ts">
import { Card } from '@motopapers/ui';

/** Placeholder for a page another phase is building. Its owner replaces the whole page. */
defineProps<{
  phase: number;
  /** What the page will do, from the plan. */
  items: readonly string[];
}>();
</script>

<template>
  <Card class="coming">
    <span class="tag">Coming in phase {{ phase }}</span>
    <ul class="coming-list">
      <li v-for="item in items" :key="item">{{ item }}</li>
    </ul>
    <slot />
  </Card>
</template>

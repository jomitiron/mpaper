<script setup lang="ts">
import { Logo } from '@motopapers/ui';
import ComingSoon from '@/components/ComingSoon.vue';

defineProps<{ title: string; items: readonly string[] }>();
</script>

<template>
  <div class="bare-card">
    <Logo />
    <h1>{{ title }}</h1>
    <ComingSoon :phase="1" :items="items" />
    <slot />
  </div>
</template>

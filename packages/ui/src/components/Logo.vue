<script setup lang="ts">
import { FileText } from '@lucide/vue';
import { RouterLink, type RouteLocationRaw } from 'vue-router';

withDefaults(defineProps<{ to?: RouteLocationRaw }>(), { to: undefined });
</script>

<template>
  <component :is="to !== undefined ? RouterLink : 'span'" :to="to" class="logo">
    <i aria-hidden="true"><FileText class="ic" /></i>MotoPapers
  </component>
</template>

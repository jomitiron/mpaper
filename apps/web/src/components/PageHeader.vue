<script setup lang="ts">
import { ChevronLeft } from '@lucide/vue';
import { RouterLink, type RouteLocationRaw } from 'vue-router';

/** The page title row from the design: optional back link, h1, a line under it, actions on the right. */
withDefaults(
  defineProps<{
    title: string;
    sub?: string;
    back?: { to: RouteLocationRaw; label: string };
  }>(),
  { sub: undefined, back: undefined },
);
</script>

<template>
  <header class="topbar">
    <div>
      <RouterLink v-if="back" :to="back.to" class="back">
        <ChevronLeft class="ic ic-sm" aria-hidden="true" />{{ back.label }}
      </RouterLink>
      <h1>{{ title }}</h1>
      <p v-if="sub">{{ sub }}</p>
    </div>
    <div v-if="$slots.actions" class="acts"><slot name="actions" /></div>
  </header>
</template>

<script setup lang="ts">
import AppSidebar from '@/components/AppSidebar.vue';
import AppTabBar from '@/components/AppTabBar.vue';
</script>

<template>
  <div class="app">
    <a class="skip-link" href="#main">Skip to main content</a>
    <AppSidebar />
    <main id="main" class="main" tabindex="-1">
      <slot />
    </main>
    <AppTabBar />
  </div>
</template>

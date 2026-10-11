<script setup lang="ts">
import { setLucideProps } from '@lucide/vue';
import { ToastHost } from '@motopapers/ui';
import { computed } from 'vue';
import { RouterView, useRoute } from 'vue-router';
import AppLayout from '@/layouts/AppLayout.vue';
import BareLayout from '@/layouts/BareLayout.vue';

// Icons match the design: 18px, 1.9 stroke.
setLucideProps({ size: 18, strokeWidth: 1.9 });

const route = useRoute();
const layout = computed(() => (route.meta.layout === 'bare' ? BareLayout : AppLayout));
</script>

<template>
  <component :is="layout">
    <RouterView />
  </component>
  <ToastHost />
</template>

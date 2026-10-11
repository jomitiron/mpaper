<script setup lang="ts">
import ComingSoon from '@/components/ComingSoon.vue';
import PageHeader from '@/components/PageHeader.vue';
</script>

<template>
  <PageHeader title="Renewals" />
  <ComingSoon
    :phase="4"
    :items="[
      'Renew a paper from Home, My cars or the car panel',
      'Delivery address and payment',
      'Follow the renewal until the new paper arrives',
    ]"
  />
</template>

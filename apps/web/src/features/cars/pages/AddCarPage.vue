<script setup lang="ts">
import ComingSoon from '@/components/ComingSoon.vue';
import PageHeader from '@/components/PageHeader.vue';
</script>

<template>
  <PageHeader
    title="Add a car"
    sub="Upload your vehicle licence and we'll fill in the details."
    :back="{ to: '/cars', label: 'My cars' }"
  />
  <ComingSoon
    :phase="2"
    :items="[
      'Upload your licence and we read the details',
      'Check the details',
      'Insurance and roadworthiness',
      'Review and pay (phase 3)',
    ]"
  />
</template>

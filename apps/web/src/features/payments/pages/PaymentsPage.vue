<script setup lang="ts">
import ComingSoon from '@/components/ComingSoon.vue';
import PageHeader from '@/components/PageHeader.vue';
</script>

<template>
  <PageHeader title="Payments" sub="Wallet top-ups and payments for renewals." />
  <ComingSoon
    :phase="3"
    :items="[
      'Wallet balance and top-up',
      'Every payment with its status, by month',
      'Check status on pending payments, Retry on failed ones',
    ]"
  />
</template>

<script setup lang="ts">
import ComingSoon from '@/components/ComingSoon.vue';
import PageHeader from '@/components/PageHeader.vue';
</script>

<template>
  <PageHeader title="Confirming your payment" />
  <ComingSoon
    :phase="3"
    :items="[
      'We wait for Paystack to confirm',
      'Your receipt, or what went wrong and how to try again',
    ]"
  />
</template>

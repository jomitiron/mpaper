<script setup lang="ts">
import ComingSoon from '@/components/ComingSoon.vue';
import PageHeader from '@/components/PageHeader.vue';
</script>

<template>
  <PageHeader title="Settings" sub="Your profile, sign-in and reminders." />
  <ComingSoon
    :phase="4"
    :items="[
      'Profile: name, phone number and delivery address',
      'Password and Google sign-in',
      'Reminders: email, SMS, WhatsApp and when to send them',
    ]"
  />
</template>

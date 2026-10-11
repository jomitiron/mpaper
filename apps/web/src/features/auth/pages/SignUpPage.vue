<script setup lang="ts">
import AuthPlaceholder from '../components/AuthPlaceholder.vue';
</script>

<template>
  <AuthPlaceholder
    title="Create your account"
    :items="[
      'Your name, phone number and email',
      'Verify your email with a 6-digit code',
      'Add your first car',
    ]"
  />
</template>

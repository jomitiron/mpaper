<script setup lang="ts">
import PageHeader from '@/components/PageHeader.vue';
import { flags } from '@/env';
import ProfileCard from '../components/ProfileCard.vue';
import RemindersCard from '../components/RemindersCard.vue';
import SecurityCard from '../components/SecurityCard.vue';
import '../settings.css';

/**
 * `/settings`: profile (PUT /users), reminders (VITE_FLAG_REMINDER_SETTINGS), password
 * (POST /users/password), Google and sign out.
 */
</script>

<template>
  <PageHeader title="Settings" sub="Your profile, sign-in and reminders." />
  <div class="settings">
    <ProfileCard />
    <RemindersCard v-if="flags.reminderSettings" />
    <SecurityCard />
  </div>
</template>

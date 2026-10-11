<script setup lang="ts">
import { Plus } from '@lucide/vue';
import { Button } from '@motopapers/ui';
import { computed } from 'vue';
import ComingSoon from '@/components/ComingSoon.vue';
import PageHeader from '@/components/PageHeader.vue';
import { useSessionStore } from '@/stores/session';

const session = useSessionStore();
const title = computed(() => (session.user?.first_name ? `Hi ${session.user.first_name}` : 'Hi'));
</script>

<template>
  <PageHeader :title="title" sub="Here's what's coming up for your cars.">
    <template #actions>
      <Button to="/cars/new"><Plus class="ic" aria-hidden="true" />Add a car</Button>
    </template>
  </PageHeader>
  <ComingSoon
    :phase="2"
    :items="[
      'The paper that needs action first',
      'Wallet balance and top-up',
      'Coming up: the next four papers by days left',
      'Your cars, with a bar for each paper',
      'Recent activity',
    ]"
  />
</template>

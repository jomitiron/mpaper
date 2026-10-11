<script setup lang="ts">
import { Plus } from '@lucide/vue';
import { Button } from '@motopapers/ui';
import { RouterView } from 'vue-router';
import ComingSoon from '@/components/ComingSoon.vue';
import PageHeader from '@/components/PageHeader.vue';
</script>

<template>
  <PageHeader title="My cars">
    <template #actions>
      <Button to="/cars/new"><Plus class="ic" aria-hidden="true" />Add a car</Button>
    </template>
  </PageHeader>
  <ComingSoon
    :phase="2"
    :items="[
      'Search by plate, make or model',
      'Filters: All, Needs attention, Papers to add, All good',
      'A card for each car with its three papers and what to do next',
    ]"
  />
  <RouterView />
</template>

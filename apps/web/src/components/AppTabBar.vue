<script setup lang="ts">
import { Plus } from '@lucide/vue';
import { RouterLink, useRoute } from 'vue-router';
import { NAV_ITEMS } from './navigation';

const route = useRoute();
const [home, cars, payments, settings] = NAV_ITEMS;
</script>

<template>
  <nav class="tabbar" aria-label="Main">
    <RouterLink
      v-for="item in [home!, cars!]"
      :key="item.to"
      :to="item.to"
      class="tab"
      :aria-current="item.matches(route) && route.path !== '/cars/new' ? 'page' : undefined"
    >
      <component :is="item.icon" class="ic" aria-hidden="true" />{{ item.label }}
    </RouterLink>
    <RouterLink
      to="/cars/new"
      class="tab tab-add"
      aria-label="Add a car"
      :aria-current="route.path === '/cars/new' ? 'page' : undefined"
    >
      <Plus class="ic" aria-hidden="true" />
    </RouterLink>
    <RouterLink
      v-for="item in [payments!, settings!]"
      :key="item.to"
      :to="item.to"
      class="tab"
      :aria-current="item.matches(route) ? 'page' : undefined"
    >
      <component :is="item.icon" class="ic" aria-hidden="true" />{{ item.label }}
    </RouterLink>
  </nav>
</template>

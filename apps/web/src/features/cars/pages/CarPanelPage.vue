<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import CarPanel from '../components/CarPanel.vue';

/** `/cars/:id`: the car panel as a sheet over My cars, so it can be linked to. */

const route = useRoute();
const router = useRouter();

const vehicleId = computed(() => Number(route.params.id));

function close() {
  // Back to wherever the driver opened it from (Home, My cars); a shared link lands on My cars.
  const back = router.options.history.state.back;
  const ok =
    typeof back === 'string' && !back.startsWith('/cars/') && !router.resolve(back).meta.public;
  if (ok) router.back();
  else void router.push({ name: 'cars', query: route.query });
}

function onDeleted() {
  void router.replace({ name: 'cars', query: route.query });
}
</script>

<template>
  <CarPanel :vehicle-id="vehicleId" @close="close" @deleted="onDeleted" />
</template>

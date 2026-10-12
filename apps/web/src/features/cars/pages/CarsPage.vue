<script setup lang="ts">
import { Car, Plus, Search } from '@lucide/vue';
import { plural } from '@motopapers/api';
import { Button, Chip, EmptyState } from '@motopapers/ui';
import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import { RouterView, useRoute, useRouter } from 'vue-router';
import PageHeader from '@/components/PageHeader.vue';
import { vehiclesQuery } from '@/lib/queries';
import CarCard from '../components/CarCard.vue';
import {
  CAR_FILTER_LABELS,
  CAR_FILTERS,
  countByFilter,
  filterCars,
  parseCarFilter,
  type CarFilter,
} from '../lib/filter';
import { sortByUrgency, summariseCar } from '../lib/papers';
import '../cars.css';

const route = useRoute();
const router = useRouter();

const vehicles = useQuery({ ...vehiclesQuery(), meta: { silent: true } });

const cars = computed(() => sortByUrgency((vehicles.data.value ?? []).map((v) => summariseCar(v))));
const counts = computed(() => countByFilter(cars.value.map((c) => c.state)));

// Filter and search live in the address, so a filtered list can be shared and survives a refresh.
const filter = computed(() => parseCarFilter(route.query.filter));
const search = computed({
  get: () => (typeof route.query.q === 'string' ? route.query.q : ''),
  set: (q: string) => void router.replace({ query: { ...route.query, q: q || undefined } }),
});

function setFilter(next: CarFilter) {
  void router.replace({ query: { ...route.query, filter: next === 'all' ? undefined : next } });
}

function clear() {
  void router.replace({ query: {} });
}

const shown = computed(() => filterCars(cars.value, filter.value, search.value));

const sub = computed(() => {
  if (!vehicles.data.value) return undefined;
  const n = cars.value.length;
  if (!n) return 'Add a car to start tracking its papers.';
  const attention = counts.value.attention;
  return `${plural(n, 'car')} · ${attention} ${attention === 1 ? 'needs' : 'need'} attention`;
});

const carLink = (id: number) => ({ name: 'car', params: { id: String(id) }, query: route.query });
</script>

<template>
  <PageHeader title="My cars" :sub="sub">
    <template #actions>
      <Button to="/cars/new"><Plus class="ic" aria-hidden="true" />Add a car</Button>
    </template>
  </PageHeader>

  <div v-if="vehicles.isPending.value" class="cars" aria-busy="true" aria-label="Loading your cars">
    <span v-for="n in 3" :key="n" class="skeleton skeleton-car" />
  </div>

  <EmptyState
    v-else-if="vehicles.isError.value"
    title="We couldn't load your cars"
    text="Check your connection and try again."
  >
    <Button size="sm" @click="vehicles.refetch()">Try again</Button>
  </EmptyState>

  <EmptyState
    v-else-if="!cars.length"
    title="No cars yet"
    text="Add your first car with a photo of its vehicle licence. We'll fill in the details."
  >
    <template #icon><Car class="ic" aria-hidden="true" /></template>
    <Button to="/cars/new"><Plus class="ic" aria-hidden="true" />Add a car</Button>
  </EmptyState>

  <template v-else>
    <div class="toolbar">
      <label class="search">
        <Search class="ic" aria-hidden="true" />
        <span class="visually-hidden">Search cars</span>
        <input
          v-model="search"
          class="inp"
          type="search"
          placeholder="Search plate, make or model"
          autocomplete="off"
          spellcheck="false"
        />
      </label>
      <div class="chips" role="group" aria-label="Filter cars">
        <Chip
          v-for="key in CAR_FILTERS"
          :key="key"
          :pressed="filter === key"
          :count="counts[key]"
          :count-label="plural(counts[key], 'car')"
          @click="setFilter(key)"
        >
          {{ CAR_FILTER_LABELS[key] }}
        </Chip>
      </div>
    </div>

    <p class="visually-hidden" role="status">{{ plural(shown.length, 'car') }} shown</p>

    <div class="cars">
      <CarCard
        v-for="car in shown"
        :key="car.vehicle.id"
        :car="car"
        :to="carLink(car.vehicle.id)"
      />
      <EmptyState
        v-if="!shown.length"
        title="No cars match"
        text="Try another plate number or clear the filter."
      >
        <template #icon><Search class="ic" aria-hidden="true" /></template>
        <Button variant="white" size="sm" @click="clear">Clear search and filter</Button>
      </EmptyState>
    </div>
  </template>

  <RouterView />
</template>

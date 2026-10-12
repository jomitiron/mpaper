<script setup lang="ts">
import { STATE_TONES } from '@motopapers/api';
import { Plate } from '@motopapers/ui';
import { RouterLink, type RouteLocationRaw } from 'vue-router';
import { barFraction, carName, PAPER_BAR, type CarSummary } from '@/features/cars/lib/papers';

/** A car on Home: plate, name, a bar per paper and its status in words. */

defineProps<{ car: CarSummary; to: RouteLocationRaw }>();
</script>

<template>
  <RouterLink :to="to" class="minicar">
    <Plate :plate="car.vehicle.plate_number" />
    <b>{{ carName(car.vehicle) }}</b>
    <span class="bars" aria-hidden="true">
      <i
        v-for="paper in car.papers"
        :key="paper.kind"
        :class="{ none: paper.state === 'untracked' }"
      >
        <span
          v-if="paper.state !== 'untracked'"
          :style="{
            width: `${Math.round(barFraction(paper) * 100)}%`,
            background: paper.state === 'expired' ? 'var(--coral)' : PAPER_BAR[paper.kind],
          }"
        />
      </i>
    </span>
    <span class="stx" :class="`t-${STATE_TONES[car.state]}`">{{ car.statusText }}</span>
  </RouterLink>
</template>

<script setup lang="ts">
import type { Vehicle } from '@motopapers/api';
import { useShownRenewals, useVehicleRenewals } from '../lib/queries';
import RenewalStatus from './RenewalStatus.vue';
import '../renewals.css';

/**
 * The car panel's renewals: a tracker for each paper being renewed (GET /vehicles/:id/renewals).
 * Nothing shows when there are none.
 */

const props = defineProps<{ vehicle: Vehicle }>();

const renewals = useVehicleRenewals(() => props.vehicle.id);
const shown = useShownRenewals(() => renewals.data.value);
</script>

<template>
  <template v-if="shown.length">
    <h3 class="dr-l">{{ shown.length === 1 ? 'Renewal' : 'Renewals' }}</h3>
    <RenewalStatus v-for="renewal in shown" :key="renewal.id" :renewal="renewal" />
  </template>
</template>

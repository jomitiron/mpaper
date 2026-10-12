<script setup lang="ts">
import type { Vehicle } from '@motopapers/api';
import { computed } from 'vue';
import { useOpenRequests, useShownRenewals, useVehicleRenewals } from '../lib/queries';
import RenewalStatus from './RenewalStatus.vue';
import RequestStatus from './RequestStatus.vue';
import '../renewals.css';

/**
 * The car panel's renewals: a tracker for each paper being renewed (GET /vehicles/:id/renewals),
 * and any "Request renewal" waiting for the team's call. Nothing shows when there are none.
 */

const props = defineProps<{ vehicle: Vehicle }>();

const renewals = useVehicleRenewals(() => props.vehicle.id);
const shown = useShownRenewals(() => renewals.data.value);
const openRequests = useOpenRequests();
const requests = computed(() =>
  openRequests.value.filter(
    (r) => r.vehicleId === props.vehicle.id && !shown.value.some((s) => s.document_type === r.kind),
  ),
);
</script>

<template>
  <template v-if="shown.length || requests.length">
    <h3 class="dr-l">{{ shown.length + requests.length === 1 ? 'Renewal' : 'Renewals' }}</h3>
    <RenewalStatus v-for="renewal in shown" :key="renewal.id" :renewal="renewal" />
    <RequestStatus
      v-for="request in requests"
      :key="`${request.vehicleId}-${request.kind}`"
      :request="request"
    />
  </template>
</template>

<script setup lang="ts">
import { X } from '@lucide/vue';
import { type PaperKind, type Vehicle } from '@motopapers/api';
import { Button, Plate, Sheet, useToast } from '@motopapers/ui';
import { useQuery } from '@tanstack/vue-query';
import { computed, ref, watch } from 'vue';
import { vehiclesQuery } from '@/lib/queries';
import CarRenewals from '@/features/renewals/components/CarRenewals.vue'; // Phase 4: renewal tracker
import { carName, summariseCar } from '../lib/papers';
import ColourEditor from './ColourEditor.vue';
import DeleteCar from './DeleteCar.vue';
import PaperDoc from './PaperDoc.vue';
import PaperForm from './PaperForm.vue';
import '../cars.css';

/**
 * The car panel: a sheet with the car's papers (days left, update, add), its details (colour can
 * change, the rest is read-only) and delete. Open while `vehicleId` is set.
 */

const props = defineProps<{ vehicleId: number | null }>();
/** `deleted` means the car is gone: the parent closes the panel. */
const emit = defineEmits<{ close: []; deleted: [] }>();

const toast = useToast();
const list = useQuery(vehiclesQuery());

const found = computed(() =>
  props.vehicleId === null
    ? undefined
    : list.data.value?.find((vehicle) => vehicle.id === props.vehicleId),
);

const editing = ref<PaperKind | null>(null);

// Keep showing the car while the sheet slides away after it's deleted.
const last = ref<Vehicle | null>(null);
const leaving = ref(false);
watch(
  found,
  (vehicle) => {
    if (vehicle) last.value = vehicle;
  },
  { immediate: true },
);
watch(
  () => props.vehicleId,
  () => {
    leaving.value = false;
    editing.value = null;
  },
);

const vehicle = computed(() => found.value ?? (leaving.value ? last.value : null));
const summary = computed(() => (vehicle.value ? summariseCar(vehicle.value) : null));

function toggle(kind: PaperKind) {
  editing.value = editing.value === kind ? null : kind;
}

function onDeleted(plate: string) {
  leaving.value = true;
  toast.success(`${plate} deleted.`);
  emit('deleted');
}
</script>

<template>
  <Sheet
    :open="vehicleId !== null"
    labelledby="car-panel-title"
    initial-focus="[data-close]"
    @close="emit('close')"
  >
    <!-- One header for every state, so the focused close button survives the car loading. -->
    <div class="dr-head" :class="{ 'dr-head-plain': !vehicle }">
      <div class="top">
        <Plate v-if="vehicle" :plate="vehicle.plate_number" variant="white" size="lg" />
        <span v-else />
        <button
          type="button"
          class="x"
          aria-label="Close car details"
          data-close
          @click="emit('close')"
        >
          <X class="ic" aria-hidden="true" />
        </button>
      </div>
      <h2 id="car-panel-title">
        {{
          vehicle
            ? carName(vehicle)
            : list.isPending.value
              ? 'Loading your car…'
              : "We couldn't find this car"
        }}
      </h2>
      <p v-if="vehicle && summary">
        {{
          [vehicle.color, vehicle.engine_capacity, summary.statusText].filter(Boolean).join(' · ')
        }}
      </p>
    </div>

    <div v-if="vehicle && summary" class="dr-body">
      <CarRenewals :vehicle="vehicle" />
      <h3 class="dr-l">Papers</h3>
      <template v-for="paper in summary.papers" :key="paper.kind">
        <PaperDoc
          :paper="paper"
          :vehicle-id="vehicle.id"
          :editing="editing === paper.kind"
          @edit="toggle(paper.kind)"
        />
        <PaperForm
          v-if="editing === paper.kind"
          :vehicle="vehicle"
          :kind="paper.kind"
          @done="editing = null"
          @cancel="editing = null"
        />
      </template>

      <h3 class="dr-l">Car details</h3>
      <dl class="specs">
        <div>
          <dt>Engine number</dt>
          <dd class="mono">{{ vehicle.engine_number || '—' }}</dd>
        </div>
        <div>
          <dt>Chassis number</dt>
          <dd class="mono">{{ vehicle.chassis_number || '—' }}</dd>
        </div>
        <div>
          <dt>Engine capacity</dt>
          <dd>{{ vehicle.engine_capacity || '—' }}</dd>
        </div>
        <ColourEditor :vehicle="vehicle" />
      </dl>
      <p class="hint spec-note">
        Plate, make, model, engine and chassis numbers can't be changed here.
        <a class="link" href="tel:+2348029595069">Contact us to change them</a>.
      </p>

      <DeleteCar :vehicle="vehicle" @deleted="onDeleted" />
    </div>

    <div v-else class="dr-body">
      <div v-if="list.isPending.value" class="skeleton-stack" aria-hidden="true">
        <span class="skeleton" /><span class="skeleton" /><span class="skeleton" />
      </div>
      <template v-else-if="list.isError.value">
        <p>We couldn't load your cars. Check your connection and try again.</p>
        <div><Button size="sm" @click="list.refetch()">Try again</Button></div>
      </template>
      <template v-else>
        <p>It may have been deleted, or the link is wrong.</p>
        <div><Button size="sm" to="/cars">See my cars</Button></div>
      </template>
    </div>
  </Sheet>
</template>

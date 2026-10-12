<script setup lang="ts">
import { Check, ChevronRight } from '@lucide/vue';
import { STATE_TONES, VEHICLE_STATE_LABELS } from '@motopapers/api';
import { Button, Plate, StatusPill } from '@motopapers/ui';
import { computed } from 'vue';
import { RouterLink, type RouteLocationRaw } from 'vue-router';
import { swatchFor } from '../lib/colour';
import { carName, PAPER_NOUN, type CarSummary } from '../lib/papers';
import { renewTarget } from '../lib/renew';
import PaperMini from './PaperMini.vue';

/** A car on My cars: plate, status, the three papers and what to do next. */

const props = defineProps<{ car: CarSummary; to: RouteLocationRaw }>();

const vehicle = computed(() => props.car.vehicle);
const meta = computed(() =>
  [vehicle.value.color, vehicle.value.engine_capacity].filter(Boolean).join(' · '),
);
</script>

<template>
  <article class="car">
    <div class="car-top">
      <Plate :plate="vehicle.plate_number" />
      <StatusPill :tone="STATE_TONES[car.state]">{{ VEHICLE_STATE_LABELS[car.state] }}</StatusPill>
    </div>
    <div>
      <h3>
        <RouterLink :to="to" class="car-open">
          {{ carName(vehicle) }}<span class="visually-hidden">, {{ vehicle.plate_number }}</span>
        </RouterLink>
      </h3>
      <p v-if="meta" class="meta">
        <span class="swatch" :style="{ background: swatchFor(vehicle.color) }" aria-hidden="true" />
        {{ meta }}
      </p>
    </div>
    <div class="minis">
      <PaperMini v-for="paper in car.papers" :key="paper.kind" :paper="paper" />
    </div>
    <div class="car-foot">
      <Button v-if="car.urgent" size="sm" :to="renewTarget(vehicle.id, car.urgent.kind)">
        Renew {{ PAPER_NOUN[car.urgent.kind]
        }}<span class="visually-hidden"> for {{ vehicle.plate_number }}</span>
      </Button>
      <Button v-else-if="car.missing.length" variant="soft" size="sm" :to="to">
        Add missing papers<span class="visually-hidden"> for {{ vehicle.plate_number }}</span>
      </Button>
      <span v-else class="ok-note"><Check class="ic ic-sm" aria-hidden="true" />Reminders on</span>
      <Button variant="quiet" size="sm" :to="to" tabindex="-1" aria-hidden="true">
        Details<ChevronRight class="ic ic-sm" />
      </Button>
    </div>
  </article>
</template>

<script setup lang="ts">
import { formatDate, formatNaira, type Renewal, type Vehicle } from '@motopapers/api';
import { PaperIcon, StatusPill } from '@motopapers/ui';
import { computed } from 'vue';
import { carName, PAPER_CLASS } from '@/features/cars/lib/papers';
import { RENEWAL_NAMES } from '../lib/papers';
import { RENEWAL_STATUS_LABELS, renewalHeadline, renewalNextStep } from '../lib/status';
import RenewalTracker from './RenewalTracker.vue';

/** One renewal: where it is, the tracker, and where it's going. On the car panel and renew page. */

const props = withDefaults(
  defineProps<{
    renewal: Renewal;
    /** Shows a "Car" line. */
    vehicle?: Vehicle;
    /** 2 on the renew page, 4 on the car panel. */
    level?: 2 | 3 | 4;
  }>(),
  { vehicle: undefined, level: 4 },
);

const kind = computed(() => props.renewal.document_type);
const tone = computed(() => (props.renewal.status === 'delivered' ? 'ok' : 'idle'));
</script>

<template>
  <article class="rn-card" :class="{ 'rn-card-done': renewal.status === 'delivered' }">
    <div class="rn-top">
      <span class="rn-kicker">
        <span class="rn-ic" :class="PAPER_CLASS[kind]" aria-hidden="true"
          ><PaperIcon :paper="kind" class="ic-sm"
        /></span>
        {{ RENEWAL_NAMES[kind] }}
      </span>
      <StatusPill :tone="tone">{{ RENEWAL_STATUS_LABELS[renewal.status] }}</StatusPill>
    </div>
    <component :is="`h${level}`" class="rn-title" tabindex="-1" data-renewal-heading>
      {{ renewalHeadline(renewal.status, kind) }}
    </component>
    <p class="rn-next">{{ renewalNextStep(renewal.status) }}</p>
    <RenewalTracker v-if="renewal.status !== 'cancelled'" :status="renewal.status" />
    <dl class="rn-dl">
      <div v-if="vehicle">
        <dt>Car</dt>
        <dd>
          <span class="num">{{ vehicle.plate_number }}</span> · {{ carName(vehicle) }}
        </dd>
      </div>
      <div v-if="renewal.new_expiry_date">
        <dt>New expiry date</dt>
        <dd>{{ formatDate(renewal.new_expiry_date) }}</dd>
      </div>
      <div>
        <dt>{{ renewal.status === 'delivered' ? 'Delivered to' : 'Delivering to' }}</dt>
        <dd>{{ renewal.delivery_address }}</dd>
      </div>
      <div>
        <dt>{{ renewal.status === 'awaiting_payment' ? 'To pay' : 'Paid' }}</dt>
        <dd class="num">{{ formatNaira(renewal.amount) }}</dd>
      </div>
      <div>
        <dt>Started</dt>
        <dd>{{ formatDate(renewal.created_at) }}</dd>
      </div>
    </dl>
  </article>
</template>

<script setup lang="ts">
import { formatDate, formatNaira, type Vehicle } from '@motopapers/api';
import { PaperIcon, StatusPill } from '@motopapers/ui';
import { computed } from 'vue';
import { carName, PAPER_CLASS } from '@/features/cars/lib/papers';
import { SUPPORT_PHONE } from '@/features/payments/lib/support';
import { formatPhone } from '../lib/delivery';
import { paperWords, RENEWAL_NAMES } from '../lib/papers';
import type { RenewalRequest } from '../lib/requests';

/** A "Request renewal" the team will call about. On the car panel and the renew page. */

const props = withDefaults(
  defineProps<{
    request: RenewalRequest;
    vehicle?: Vehicle;
    level?: 2 | 3 | 4;
  }>(),
  { vehicle: undefined, level: 4 },
);

const callLine = computed(() => {
  const phone = formatPhone(props.request.phone);
  const what =
    props.request.price === null
      ? `give you a price for your ${paperWords(props.request.kind)}, take payment and arrange delivery`
      : 'take payment and arrange delivery';
  return phone
    ? `Our team will call you on ${phone} to ${what}.`
    : `Our team will call you to ${what}.`;
});
</script>

<template>
  <article class="rn-card">
    <div class="rn-top">
      <span class="rn-kicker">
        <span class="rn-ic" :class="PAPER_CLASS[request.kind]" aria-hidden="true"
          ><PaperIcon :paper="request.kind" class="ic-sm"
        /></span>
        {{ RENEWAL_NAMES[request.kind] }}
      </span>
      <StatusPill tone="idle">Requested</StatusPill>
    </div>
    <component :is="`h${level}`" class="rn-title" tabindex="-1" data-renewal-heading>
      We've got your request
    </component>
    <p class="rn-next">
      {{ callLine }} Can't wait? Call us on
      <a class="link" :href="`tel:${SUPPORT_PHONE.replace(/\s/g, '')}`">{{ SUPPORT_PHONE }}</a
      >.
    </p>
    <dl class="rn-dl">
      <div v-if="vehicle">
        <dt>Car</dt>
        <dd>
          <span class="num">{{ vehicle.plate_number }}</span> · {{ carName(vehicle) }}
        </dd>
      </div>
      <div>
        <dt>Delivering to</dt>
        <dd>{{ request.deliveryAddress }}</dd>
      </div>
      <div>
        <dt>Price</dt>
        <dd :class="{ num: request.price !== null }">
          {{ request.price === null ? 'Quoted by our team' : formatNaira(request.price) }}
        </dd>
      </div>
      <div>
        <dt>Requested</dt>
        <dd>{{ formatDate(request.requestedAt) }}</dd>
      </div>
    </dl>
  </article>
</template>

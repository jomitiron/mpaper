<script setup lang="ts">
import { formatNaira, getPricing, type PaperKind, type Pricing } from '@motopapers/api';
import { Button } from '@motopapers/ui';
import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import type { RouteLocationRaw } from 'vue-router';
import { queryKeys } from '@/lib/queries';
import { carName, dueWords, PAPER_NOUN } from '@/features/cars/lib/papers';
import { renewTarget } from '@/features/cars/lib/renew';
import type { HomeAlert } from '../summary';

/**
 * The card that leads Home: an expired paper (coral, "Needs action"), a paper due soon (coral,
 * "Coming up"), papers to add or no cars yet (sky), or all good (mint).
 */

const props = defineProps<{ alert: HomeAlert }>();

const pricing = useQuery({
  queryKey: queryKeys.pricing,
  queryFn: ({ signal }) => getPricing({ signal }),
  staleTime: Infinity,
  meta: { silent: true },
});

function renewalPrice(prices: Pricing | undefined, kind: PaperKind, cover: string | null) {
  if (!prices) return undefined;
  if (kind === 'vehicle_license') return prices.renewal.vehicle_license;
  if (kind === 'roadworthiness') return prices.renewal.roadworthiness;
  // Only third-party cover has a set price; comprehensive depends on the car's value.
  return cover === 'third_party' ? prices.renewal.insurance_third_party : undefined;
}

interface View {
  tone: '' | 'calm' | 'start';
  chip: string;
  title: string;
  text: string;
  action: string;
  to: RouteLocationRaw;
  plate?: string;
}

const view = computed<View>(() => {
  const alert = props.alert;
  if (alert.kind === 'expired' || alert.kind === 'due') {
    const { vehicle, paper } = alert;
    const noun = PAPER_NOUN[paper.kind];
    const price =
      alert.kind === 'expired'
        ? renewalPrice(pricing.data.value, paper.kind, paper.cover)
        : undefined;
    return {
      tone: '',
      chip: alert.kind === 'expired' ? 'Needs action' : 'Coming up',
      title:
        alert.kind === 'expired'
          ? `Your ${carName(vehicle)} ${noun} ${dueWords(paper)}`
          : `Your ${carName(vehicle)} ${noun} is ${dueWords(paper)}`,
      text:
        alert.kind === 'expired'
          ? `${vehicle.plate_number} · Renew it now and we'll deliver the new ${paper.name.toLowerCase()} to your door.`
          : `${vehicle.plate_number} · Renew early and skip the rush.`,
      action: `Renew ${noun}${price ? ` · ${formatNaira(price)}` : ''}`,
      to: renewTarget(vehicle.id, paper.kind),
      plate: vehicle.plate_number,
    };
  }
  if (alert.kind === 'missing') {
    return {
      tone: 'start',
      chip: 'Papers to add',
      title:
        alert.count === 1
          ? "1 paper isn't tracked yet"
          : `${alert.count} papers aren't tracked yet`,
      text: 'Add their expiry dates so we can remind you before they run out.',
      action: 'Add missing papers',
      to: { name: 'cars', query: { filter: 'missing' } },
    };
  }
  if (alert.kind === 'empty') {
    return {
      tone: 'start',
      chip: 'Get started',
      title: 'Add your first car',
      text: "Upload a photo of your vehicle licence and we'll fill in the details.",
      action: 'Add a car',
      to: '/cars/new',
    };
  }
  return {
    tone: 'calm',
    chip: 'All good',
    title: 'Every paper on every car is valid',
    text: "We'll remind you well before anything runs out.",
    action: 'See my cars',
    to: '/cars',
  };
});
</script>

<template>
  <section class="alert-card" :class="view.tone" aria-labelledby="home-alert-title">
    <span v-if="view.plate" class="ghost-plate" aria-hidden="true">{{ view.plate }}</span>
    <span class="chipw">{{ view.chip }}</span>
    <h2 id="home-alert-title">{{ view.title }}</h2>
    <p>{{ view.text }}</p>
    <Button :to="view.to" variant="white" class="alert-btn">{{ view.action }}</Button>
  </section>
</template>

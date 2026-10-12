<script setup lang="ts">
import { Bell, Plus } from '@lucide/vue';
import { plural } from '@motopapers/api';
import { Button, EmptyState, Tile, useToast } from '@motopapers/ui';
import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import PageHeader from '@/components/PageHeader.vue';
import { vehiclesQuery } from '@/lib/queries';
import { useSessionStore } from '@/stores/session';
import { dueWords, PAPER_NOUN, shortExpiry } from '@/features/cars/lib/papers';
import { useRenewalProgress } from '@/features/renewals/lib/progress';
import AlertCard from '../components/AlertCard.vue';
import MiniCar from '../components/MiniCar.vue';
import RecentActivity from '../components/RecentActivity.vue';
import WalletCard from '../components/WalletCard.vue';
import { homeSummary } from '../summary';
import '@/features/cars/cars.css';
import '../home.css';

const session = useSessionStore();
const toast = useToast();
const title = computed(() => (session.user?.first_name ? `Hi ${session.user.first_name}` : 'Hi'));

const vehicles = useQuery({ ...vehiclesQuery(), meta: { silent: true } });
// Phase 4: papers being renewed lead the alert card as "Renewal in progress".
const renewing = useRenewalProgress();
const summary = computed(() =>
  vehicles.data.value ? homeSummary(vehicles.data.value, new Date(), renewing.value) : null,
);

const sub = computed(() => {
  const s = summary.value;
  if (!s) return "Here's what's coming up for your cars.";
  if (!s.cars.length) return 'Add a car to start tracking its papers.';
  return `${plural(s.cars.length, 'car')} · ${s.validPapers} of ${s.totalPapers} papers valid. Here's what's coming up.`;
});

const carLink = (id: number) => ({ name: 'car', params: { id: String(id) } });

// Papers that need action, for the bell.
const reminders = computed(() =>
  (summary.value?.cars ?? []).flatMap((car) =>
    car.papers
      .filter((p) => p.state === 'expired' || p.state === 'due')
      .map((p) => `${car.vehicle.plate_number} ${PAPER_NOUN[p.kind]} ${dueWords(p)}`),
  ),
);

function showReminders() {
  const list = reminders.value;
  if (!list.length) return toast.info('Nothing needs your attention right now.');
  toast.info(`${plural(list.length, 'reminder')}: ${list.join(', ')}.`);
}

function tileValue(days: number | null) {
  if (!days) return { value: 'Today', unit: undefined };
  return { value: days, unit: days === 1 ? 'day' : 'days' };
}
</script>

<template>
  <PageHeader :title="title" :sub="sub">
    <template #actions>
      <button
        type="button"
        class="circle bell"
        :class="{ dot: reminders.length > 0 }"
        aria-label="Reminders"
        @click="showReminders"
      >
        <Bell class="ic" aria-hidden="true" />
      </button>
      <Button to="/cars/new"><Plus class="ic" aria-hidden="true" />Add a car</Button>
    </template>
  </PageHeader>

  <EmptyState
    v-if="vehicles.isError.value"
    title="We couldn't load your cars"
    text="Check your connection and try again."
  >
    <Button size="sm" @click="vehicles.refetch()">Try again</Button>
  </EmptyState>

  <template v-else>
    <div class="row1">
      <AlertCard v-if="summary" :alert="summary.alert" />
      <span v-else class="skeleton alert-skeleton" aria-hidden="true" />
      <WalletCard />
    </div>

    <template v-if="summary?.cars.length">
      <div class="h-row">
        <h2>Coming up</h2>
        <RouterLink to="/cars">See all</RouterLink>
      </div>
      <div v-if="summary.comingUp.length" class="tiles">
        <Tile
          v-for="{ vehicle, paper } in summary.comingUp"
          :key="`${vehicle.id}-${paper.kind}`"
          :to="carLink(vehicle.id)"
          :paper="paper.kind"
          :label="paper.short"
          v-bind="tileValue(paper.daysLeft)"
          :sub="paper.daysLeft === 0 ? 'Expires today' : shortExpiry(paper)"
          :pill="paper.state === 'due' ? 'Renew soon' : undefined"
        >
          <template #footer>{{ vehicle.plate_number }} · {{ vehicle.model }}</template>
        </Tile>
      </div>
      <p v-else class="muted">Nothing coming up. Add expiry dates to see what runs out next.</p>
    </template>

    <div class="dash2">
      <div>
        <div class="h-row">
          <h2>Your cars</h2>
          <RouterLink to="/cars/new">+ Add a car</RouterLink>
        </div>
        <div v-if="!summary" class="minicars" aria-hidden="true">
          <span v-for="n in 2" :key="n" class="skeleton minicar-skeleton" />
        </div>
        <div v-else-if="summary.cars.length" class="minicars">
          <MiniCar
            v-for="car in summary.cars"
            :key="car.vehicle.id"
            :car="car"
            :to="carLink(car.vehicle.id)"
          />
        </div>
        <p v-else class="muted">No cars yet.</p>
      </div>
      <div>
        <div class="h-row">
          <h2>Recent activity</h2>
          <RouterLink to="/payments">View all</RouterLink>
        </div>
        <RecentActivity :vehicles="vehicles.data.value ?? []" />
      </div>
    </div>
  </template>
</template>

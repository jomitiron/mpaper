<script setup lang="ts">
import { Receipt, Wallet } from '@lucide/vue';
import { listTransactions, type Vehicle } from '@motopapers/api';
import { PaperIcon } from '@motopapers/ui';
import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import { flags } from '@/env';
import { queryKeys } from '@/lib/queries';
import { activityRow, type ActivityIcon } from '../activity';

/** The latest four payments. Phase 3's Payments page has the full list. */

const props = defineProps<{ vehicles: readonly Vehicle[] }>();

const transactions = useQuery({
  queryKey: [...queryKeys.transactions, { per_page: 4 }],
  queryFn: ({ signal }) => listTransactions({ per_page: 4 }, { signal }),
  meta: { silent: true },
});

const rows = computed(() =>
  (transactions.data.value?.items ?? [])
    .slice(0, 4)
    .map((tx) => activityRow(tx, props.vehicles, flags.txLabels)),
);

const ICON_CLASS: Record<ActivityIcon, string> = {
  topup: 'act-topup',
  vehicle_license: 'd-licence',
  insurance: 'd-insurance',
  roadworthiness: 'd-road',
  service: 'act-service',
};
</script>

<template>
  <div class="card">
    <ul v-if="rows.length">
      <li v-for="row in rows" :key="row.id" class="act">
        <span class="act-ic" :class="ICON_CLASS[row.icon]" aria-hidden="true">
          <Wallet v-if="row.icon === 'topup'" class="ic" />
          <Receipt v-else-if="row.icon === 'service'" class="ic" />
          <PaperIcon v-else :paper="row.icon" />
        </span>
        <div class="act-main">
          <b>{{ row.title }}</b>
          <span>{{ row.sub }}</span>
        </div>
        <span class="amt num" :class="row.tone">
          <span v-if="row.tone === 'void'" class="visually-hidden">Not paid: </span>{{ row.amount }}
        </span>
      </li>
    </ul>
    <p v-else-if="transactions.isPending.value" class="act-empty" aria-busy="true">Loading…</p>
    <p v-else-if="transactions.isError.value" class="act-empty">
      We couldn't load your payments.
      <button type="button" class="link" @click="transactions.refetch()">Try again</button>
    </p>
    <p v-else class="act-empty">No payments yet. Top-ups and renewals will show here.</p>
  </div>
</template>

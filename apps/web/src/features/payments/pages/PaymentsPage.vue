<script setup lang="ts">
import { CircleAlert, Receipt } from '@lucide/vue';
import { errorMessage, formatNaira, formatPlate, plural, type Transaction } from '@motopapers/api';
import { Button, Chip, EmptyState, useToast } from '@motopapers/ui';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/vue-query';
import { computed, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PageHeader from '@/components/PageHeader.vue';
import { flags } from '@/env';
import { queryKeys, vehiclesQuery, walletQuery } from '@/lib/queries';
import PaymentItem from '../components/PaymentItem.vue';
import TopUpModal from '../components/TopUpModal.vue';
import WalletHero from '../components/WalletHero.vue';
import { parseAmount } from '../lib/amount';
import {
  EMPTY_FILTER_TEXT,
  filterCounts,
  filteredByApi,
  filterQuery,
  matchesFilter,
  PAYMENT_FILTERS,
  parseFilter,
  type PaymentFilter,
} from '../lib/filters';
import { intentStore } from '../lib/intent';
import {
  paidThisYearQuery,
  paymentsCountQuery,
  paymentsListQuery,
  recheckPayment,
} from '../lib/queries';
import { groupByMonth, paymentRow, paymentTitle } from '../lib/rows';
import '../payments.css';

const route = useRoute();
const router = useRouter();
const queryClient = useQueryClient();
const toast = useToast();

// ---------------------------------------------------------------- wallet

const wallet = useQuery({ ...walletQuery(), meta: { silent: true } });
const balance = computed(() => {
  if (wallet.data.value) return formatNaira(wallet.data.value.balance);
  return wallet.isError.value ? 'Unavailable' : '₦…';
});
const walletText = flags.walletPay
  ? 'Renewals are paid from your wallet first. Top up any time by card or bank transfer.'
  : 'Top up any time by card or bank transfer.';

const pendingCount = useQuery(paymentsCountQuery('pending'));
const paidThisYear = useQuery(paidThisYearQuery(flags.txLabels));

const stats = computed(() => {
  const lines: string[] = [];
  const paid = paidThisYear.data.value;
  if (typeof paid === 'number') {
    lines.push(
      flags.txLabels
        ? `${formatNaira(paid)} paid for renewals this year`
        : `${formatNaira(paid)} paid this year`,
    );
  }
  const pending = pendingCount.data.value;
  if (pending) lines.push(`${plural(pending, 'payment')} pending`);
  return lines;
});

// ---------------------------------------------------------------- list

const filter = computed(() => parseFilter(route.query.filter));
const serverParams = computed(() => filterQuery(filter.value));

function setFilter(key: PaymentFilter) {
  void router.replace({ query: { ...route.query, filter: key === 'all' ? undefined : key } });
}

const list = useInfiniteQuery(paymentsListQuery(serverParams));
// Every payment, for the counts. The same query as `list` on All, Top-ups and Renewals.
const everything = useInfiniteQuery(paymentsListQuery({}));

const counts = computed(() =>
  filterCounts(
    {
      pages: everything.data.value?.pages ?? null,
      complete: everything.isSuccess.value && !everything.hasNextPage.value,
      pending: pendingCount.data.value,
    },
    flags.txLabels,
  ),
);
const vehicles = useQuery({ ...vehiclesQuery(), enabled: flags.txLabels, meta: { silent: true } });

const loaded = computed<Transaction[]>(
  () => list.data.value?.pages.flatMap((page) => page.items) ?? [],
);
const visible = computed(() =>
  loaded.value.filter((tx) => matchesFilter(tx, filter.value, flags.txLabels)),
);
const groups = computed(() => groupByMonth(visible.value));
const rows = computed(() => {
  const cars = vehicles.data.value ?? [];
  return new Map(visible.value.map((tx) => [tx.id, paymentRow(tx, cars, flags.txLabels)]));
});
const filterLabel = computed(
  () => PAYMENT_FILTERS.find((f) => f.key === filter.value)?.label.toLowerCase() ?? 'payments',
);

// ---------------------------------------------------------------- check status, retry

const checking = reactive(new Set<number>());

async function check(tx: Transaction) {
  if (checking.has(tx.id)) return;
  checking.add(tx.id);
  const reference = tx.payment?.reference ?? tx.reference;
  try {
    const fresh = await recheckPayment(tx, flags.verifyPayment);
    if (fresh.status === 'pending') {
      toast.info(
        flags.verifyPayment
          ? `Checked with Paystack: ${reference} is still waiting for the bank to confirm.`
          : "Still pending. It'll update here as soon as Paystack confirms.",
      );
    } else if (fresh.status === 'success') {
      toast.success(
        fresh.transaction_type === 'credit'
          ? `Payment confirmed. ${formatNaira(fresh.amount)} is in your wallet.`
          : `Payment confirmed: ${paymentTitle(fresh, flags.txLabels).toLowerCase()}.`,
      );
    } else if (fresh.status === 'reversed') {
      toast.info("Paystack reversed this payment, so it didn't go through.");
    } else {
      toast.error("This payment didn't go through.");
    }
    if (fresh.status !== tx.status) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
      void queryClient.invalidateQueries({ queryKey: queryKeys.wallet });
    }
  } catch (error) {
    toast.error(`We couldn't check this payment. ${errorMessage(error)}`);
  } finally {
    checking.delete(tx.id);
  }
}

// ---------------------------------------------------------------- top-up

const topUpOpen = ref(false);
const topUpAmount = ref<number | null>(null);

function openTopUp(amount: number | null = null) {
  topUpAmount.value = amount;
  topUpOpen.value = true;
}

// `/payments?topup=1` (Home's wallet card) opens it; `&amount=` fills it in (Try again).
watch(
  () => route.query.topup,
  (topup) => {
    if (!topup) return;
    const amount = parseAmount(String(route.query.amount ?? ''));
    openTopUp(amount || null);
    const { topup: _topup, amount: _amount, ...rest } = route.query;
    void router.replace({ query: rest });
  },
  { immediate: true },
);

// ---------------------------------------------------------------- cars paid for by card

const unfinished = intentStore().unfinishedCars();
</script>

<template>
  <PageHeader title="Payments" sub="Wallet top-ups and payments for renewals." />

  <div v-for="intent in unfinished" :key="intent.reference" class="pay-notice">
    <CircleAlert class="ic" aria-hidden="true" />
    <div>
      <b>Finish adding {{ formatPlate(intent.draft.car.plate_number) }}</b>
      <span>
        Your {{ formatNaira(intent.amount) }} card payment for it may still be confirming. Check,
        and we'll add the car once it's paid.
      </span>
    </div>
    <Button
      variant="white"
      size="sm"
      :to="{ path: '/payments/callback', query: { reference: intent.reference } }"
    >
      Check now
    </Button>
  </div>

  <WalletHero
    :balance="balance"
    :loading="wallet.isPending.value"
    :text="walletText"
    :stats="stats"
    @top-up="openTopUp()"
  />

  <div class="toolbar">
    <div class="chips" role="group" aria-label="Filter payments">
      <Chip
        v-for="item in PAYMENT_FILTERS"
        :key="item.key"
        :pressed="filter === item.key"
        :count="counts[item.key]"
        @click="setFilter(item.key)"
      >
        {{ item.label }}
      </Chip>
    </div>
  </div>

  <div class="card tx-card">
    <div v-if="list.isPending.value" aria-busy="true">
      <span class="visually-hidden">Loading your payments…</span>
      <div v-for="n in 4" :key="n" class="tx-skeleton" aria-hidden="true" />
    </div>

    <div v-else-if="list.isError.value" class="tx-note" role="alert">
      We couldn't load your payments. {{ errorMessage(list.error.value) }}
      <button type="button" class="link" @click="list.refetch()">Try again</button>
    </div>

    <template v-else>
      <section v-for="group in groups" :key="group.key">
        <h2 class="month">{{ group.label }}</h2>
        <ul>
          <PaymentItem
            v-for="tx in group.items"
            :key="tx.id"
            :row="rows.get(tx.id)!"
            :checking="checking.has(tx.id)"
            @check="check(tx)"
            @retry="openTopUp(tx.amount)"
          />
        </ul>
      </section>

      <template v-if="!visible.length">
        <p v-if="list.hasNextPage.value" class="tx-note">
          No {{ filterLabel }} in your latest {{ plural(loaded.length, 'payment') }}.
        </p>
        <EmptyState
          v-else-if="filter === 'all'"
          title="No payments yet"
          :text="EMPTY_FILTER_TEXT.all"
        >
          <template #icon><Receipt class="ic" aria-hidden="true" /></template>
        </EmptyState>
        <EmptyState v-else title="Nothing here" :text="EMPTY_FILTER_TEXT[filter]">
          <template #icon><Receipt class="ic" aria-hidden="true" /></template>
        </EmptyState>
      </template>

      <div v-if="list.hasNextPage.value" class="tx-more">
        <Button
          variant="white"
          :loading="list.isFetchingNextPage.value"
          @click="list.fetchNextPage()"
        >
          {{ filteredByApi(filter) ? 'Show more payments' : 'Look further back' }}
        </Button>
      </div>
    </template>
  </div>

  <TopUpModal v-model:open="topUpOpen" :initial-amount="topUpAmount" />
</template>

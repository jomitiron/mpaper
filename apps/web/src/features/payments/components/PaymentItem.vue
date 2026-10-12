<script setup lang="ts">
import { Bell, Receipt, Wallet } from '@lucide/vue';
import { Button, PaperIcon, StatusPill } from '@motopapers/ui';
import type { PaymentIcon, PaymentRow } from '../lib/rows';

/** One payment on Payments: what it was for, its status, and the amount with its sign. */

defineProps<{ row: PaymentRow; checking?: boolean }>();
const emit = defineEmits<{ check: []; retry: [] }>();

const ICON_CLASS: Record<PaymentIcon, string> = {
  topup: 'topup',
  vehicle_license: 'd-licence',
  insurance: 'd-insurance',
  roadworthiness: 'd-road',
  service: 'service',
  payment: 'payment',
};
</script>

<template>
  <li class="tx">
    <span class="tx-ic" :class="ICON_CLASS[row.icon]" aria-hidden="true">
      <Wallet v-if="row.icon === 'topup'" class="ic" />
      <Bell v-else-if="row.icon === 'service'" class="ic" />
      <Receipt v-else-if="row.icon === 'payment'" class="ic" />
      <PaperIcon v-else :paper="row.icon" />
    </span>
    <div class="tx-main">
      <b>{{ row.title }}</b>
      <span>
        {{ row.sub }} · <span class="visually-hidden">reference </span
        ><span class="mono tx-ref">{{ row.reference }}</span>
      </span>
    </div>
    <div class="tx-status">
      <StatusPill :tone="row.status.tone">{{ row.status.label }}</StatusPill>
      <Button
        v-if="row.action === 'check'"
        variant="quiet"
        size="sm"
        :loading="checking"
        @click="emit('check')"
      >
        Check status
      </Button>
      <Button v-else-if="row.action === 'retry'" variant="soft" size="sm" @click="emit('retry')">
        Retry
      </Button>
    </div>
    <div class="tx-amt">
      <span class="amt num" :class="row.tone">
        <span v-if="row.tone === 'void'" class="visually-hidden">Not paid: </span>{{ row.amount }}
      </span>
      <small>{{ row.date }}</small>
    </div>
  </li>
</template>

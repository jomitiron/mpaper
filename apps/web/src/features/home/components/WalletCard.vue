<script setup lang="ts">
import { formatNaira, getNotificationPreferences } from '@motopapers/api';
import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { flags } from '@/env';
import { queryKeys, walletQuery } from '@/lib/queries';

/**
 * The night wallet card. Top up is hidden for now (it opened the top-up modal on Payments).
 * The auto-renew line needs reminder settings (VITE_FLAG_REMINDER_SETTINGS); hidden without it.
 */

const wallet = useQuery({ ...walletQuery(), meta: { silent: true } });
const prefs = useQuery({
  queryKey: queryKeys.notificationPreferences,
  queryFn: ({ signal }) => getNotificationPreferences({ signal }),
  enabled: flags.reminderSettings,
  meta: { silent: true },
});

const balance = computed(() => {
  if (wallet.data.value) return formatNaira(wallet.data.value.balance);
  return wallet.isError.value ? 'Unavailable' : '₦…';
});
const autoRenew = computed(() => prefs.data.value?.auto_renew);
</script>

<template>
  <section class="wallet" aria-labelledby="home-wallet-label">
    <span id="home-wallet-label" class="l">Wallet balance</span>
    <span class="v num" :aria-busy="wallet.isPending.value ? 'true' : undefined">{{
      balance
    }}</span>
    <div v-if="flags.reminderSettings && autoRenew !== undefined" class="auto">
      <span>Auto-renew is {{ autoRenew ? 'on' : 'off' }}</span>
      <RouterLink to="/settings">{{ autoRenew ? 'Change' : 'Turn on' }}</RouterLink>
    </div>
  </section>
</template>

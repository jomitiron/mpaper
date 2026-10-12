<script setup lang="ts">
import { Plus } from '@lucide/vue';
import { Button } from '@motopapers/ui';

/** The night wallet card at the top of Payments: balance, a line about it, stats and Top up. */

defineProps<{
  /** `₦8,500`, `₦…` while loading. */
  balance: string;
  loading?: boolean;
  text: string;
  stats: readonly string[];
}>();
const emit = defineEmits<{ topUp: [] }>();
</script>

<template>
  <section class="wallet-hero" aria-labelledby="wallet-hero-label">
    <span class="wallet-ghost" aria-hidden="true">₦</span>
    <div>
      <span id="wallet-hero-label" class="l">Wallet balance</span>
      <p class="v num" :aria-busy="loading ? 'true' : undefined">{{ balance }}</p>
      <p>{{ text }}</p>
      <div v-if="stats.length" class="stats">
        <span v-for="stat in stats" :key="stat">{{ stat }}</span>
      </div>
    </div>
    <Button size="lg" @click="emit('topUp')">
      <Plus class="ic" aria-hidden="true" />Top up wallet
    </Button>
  </section>
</template>

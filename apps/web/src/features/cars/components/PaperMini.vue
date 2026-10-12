<script setup lang="ts">
import { PaperIcon } from '@motopapers/ui';
import { computed } from 'vue';
import { PAPER_CLASS, shortExpiry, type PaperView } from '../lib/papers';

/** One of the three small paper boxes on a car card. */

const props = defineProps<{ paper: PaperView }>();

const view = computed(() => {
  const p = props.paper;
  if (p.state === 'untracked' || p.daysLeft === null) {
    return { cls: 'none', value: 'Add', unit: '', sub: 'Not on file', sr: 'not on file' };
  }
  if (p.state === 'expired') {
    const ago = -p.daysLeft;
    return {
      cls: 'exp',
      value: String(ago),
      unit: 'd ago',
      sub: 'Expired',
      sr: `expired ${ago} ${ago === 1 ? 'day' : 'days'} ago`,
    };
  }
  return {
    cls: PAPER_CLASS[p.kind],
    value: String(p.daysLeft),
    unit: 'd',
    sub: shortExpiry(p),
    sr: `${p.daysLeft} ${p.daysLeft === 1 ? 'day' : 'days'} left, ${shortExpiry(p)}`,
  };
});
</script>

<template>
  <div class="mini" :class="view.cls">
    <span class="k"><PaperIcon :paper="paper.kind" />{{ paper.short }}</span>
    <span class="visually-hidden">: {{ view.sr }}</span>
    <span class="v num" aria-hidden="true"
      >{{ view.value }}<small v-if="view.unit">{{ view.unit }}</small></span
    >
    <span class="d" aria-hidden="true">{{ view.sub }}</span>
  </div>
</template>

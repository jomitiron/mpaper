<script setup lang="ts">
import { Gauge, IdCard, ShieldCheck } from '@lucide/vue';
import { computed } from 'vue';

export type Paper = 'vehicle_license' | 'insurance' | 'roadworthiness';

const props = defineProps<{ paper: Paper }>();

const icon = computed(
  () => ({ vehicle_license: IdCard, insurance: ShieldCheck, roadworthiness: Gauge })[props.paper],
);
</script>

<template>
  <component :is="icon" class="ic" aria-hidden="true" />
</template>

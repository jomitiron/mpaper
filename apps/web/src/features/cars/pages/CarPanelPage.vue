<script setup lang="ts">
import { X } from '@lucide/vue';
import { Sheet } from '@motopapers/ui';
import { useRoute, useRouter } from 'vue-router';
import ComingSoon from '@/components/ComingSoon.vue';

const route = useRoute();
const router = useRouter();

function close() {
  void router.push('/cars');
}
</script>

<template>
  <Sheet :open="true" labelledby="car-panel-title" @close="close">
    <div class="sheet-placeholder">
      <div class="sheet-placeholder-top">
        <h2 id="car-panel-title">Car {{ route.params.id }}</h2>
        <button type="button" class="icon-btn" aria-label="Close car details" @click="close">
          <X class="ic" aria-hidden="true" />
        </button>
      </div>
      <ComingSoon
        :phase="2"
        :items="['Days left for each paper, with Renew or Update', 'Car details', 'Delete car']"
      />
    </div>
  </Sheet>
</template>

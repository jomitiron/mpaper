<script setup lang="ts">
import { Button, PaperIcon } from '@motopapers/ui';
import { computed } from 'vue';
import { usePaperProgress } from '@/features/renewals/lib/progress';
import { RENEW_FLOW_READY, renewTarget } from '../lib/renew';
import { bigDays, coverLabel, expiryLine, PAPER_CLASS, type PaperView } from '../lib/papers';

/** One paper in the car panel: days left in a big number, and Renew, Update or Add. */

const props = defineProps<{ paper: PaperView; vehicleId: number; editing: boolean }>();
const emit = defineEmits<{ edit: [] }>();

const tone = computed(() => {
  if (props.paper.state === 'untracked') return 'none';
  if (props.paper.state === 'expired') return 'exp';
  return PAPER_CLASS[props.paper.kind];
});
const big = computed(() => bigDays(props.paper));
// Phase 4: a paper that's being renewed shows that instead of a Renew button.
const renewing = usePaperProgress(
  () => props.vehicleId,
  () => props.paper.kind,
);
const renewingWords = computed(() => {
  if (!renewing.value) return null;
  return renewing.value.status === 'requested' ? 'Renewal requested' : 'Renewal in progress';
});
const line = computed(() =>
  [expiryLine(props.paper), coverLabel(props.paper.cover), renewingWords.value]
    .filter(Boolean)
    .join(' · '),
);
const needsAction = computed(() => props.paper.state === 'expired' || props.paper.state === 'due');
</script>

<template>
  <div class="dr-doc" :class="tone">
    <span class="k"><PaperIcon :paper="paper.kind" class="ic-sm" />{{ paper.name }}</span>
    <template v-if="paper.state === 'untracked'">
      <span class="n n-none">Not on file</span>
      <span class="s">Add it to get reminders</span>
    </template>
    <template v-else>
      <span class="n num"
        >{{ big.value }}<small v-if="big.unit">{{ big.unit }}</small></span
      >
      <span class="s">{{ line }}</span>
    </template>
    <div class="dr-acts">
      <Button
        v-if="paper.state === 'untracked'"
        size="sm"
        :aria-expanded="editing"
        :aria-label="`Add ${paper.name.toLowerCase()}`"
        @click="emit('edit')"
      >
        Add
      </Button>
      <template v-else>
        <Button
          v-if="needsAction && RENEW_FLOW_READY && !renewing"
          size="sm"
          :to="renewTarget(vehicleId, paper.kind)"
        >
          Renew<span class="visually-hidden"> {{ paper.name.toLowerCase() }}</span>
        </Button>
        <Button
          size="sm"
          :variant="needsAction && !RENEW_FLOW_READY ? 'coral' : 'white'"
          :aria-expanded="editing"
          @click="emit('edit')"
        >
          Update<span class="visually-hidden"> {{ paper.name.toLowerCase() }}</span>
        </Button>
      </template>
    </div>
  </div>
</template>

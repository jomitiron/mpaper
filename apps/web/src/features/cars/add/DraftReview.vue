<script setup lang="ts">
import {
  formatDate,
  formatPlate,
  PAPER_KINDS,
  PAPER_LABELS,
  type PaperKind,
} from '@motopapers/api';
import { Plate } from '@motopapers/ui';
import { computed } from 'vue';
import { swatchFor } from '../lib/colour';
import { carName, coverLabel, PAPER_BAR } from '../lib/papers';
import { toPaperBodies, type CarDraft } from './draft';

/** The car and its papers as entered in steps 1–3 (the review box in step 4). */

const props = defineProps<{ draft: CarDraft }>();

const bodies = computed(() => toPaperBodies(props.draft));

function paperLine(kind: PaperKind): string | null {
  const body = bodies.value[kind];
  if (!body) return null;
  const date = formatDate(body.expiry_date);
  return 'cover_type' in body ? `${coverLabel(body.cover_type)} · ${date}` : date;
}
</script>

<template>
  <div class="rbox">
    <div class="review-top">
      <Plate :plate="formatPlate(draft.car.plate_number)" />
      <span class="muted review-meta">
        <span
          class="swatch"
          :style="{ background: swatchFor(draft.car.color) }"
          aria-hidden="true"
        />{{ draft.car.color }} · {{ draft.car.engine_capacity }}
      </span>
    </div>
    <h3 class="review-name">{{ carName(draft.car) }}</h3>
    <div v-for="kind in PAPER_KINDS" :key="kind" class="rline">
      <span>
        <span class="dot" :style="{ background: PAPER_BAR[kind] }" aria-hidden="true" />{{
          PAPER_LABELS[kind].name
        }}
      </span>
      <span :class="{ muted: !paperLine(kind) }">{{ paperLine(kind) ?? 'Not added' }}</span>
    </div>
  </div>
</template>

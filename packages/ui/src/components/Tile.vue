<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, type RouteLocationRaw } from 'vue-router';
import PaperIcon, { type Paper } from './PaperIcon.vue';

/**
 * A paper tile in the paper's colour: sky licence, mint insurance, butter roadworthiness.
 * `tone="expired"` turns it rose; `tone="none"` is the dashed "not on file" tile.
 *
 *   <Tile paper="insurance" label="Insurance" :value="9" unit="days" sub="20 Oct" pill="Renew soon">
 *     <template #footer>KJA 731 AE · Camry</template>
 *   </Tile>
 */

const props = withDefaults(
  defineProps<{
    paper: Paper;
    label: string;
    tone?: 'paper' | 'expired' | 'none';
    /** The big number (days left). */
    value?: string | number;
    unit?: string;
    sub?: string;
    /** Small white pill, e.g. "Renew soon". */
    pill?: string;
    /** Makes the whole tile a link. */
    to?: RouteLocationRaw;
    /** Makes the whole tile a button. */
    button?: boolean;
  }>(),
  {
    tone: 'paper',
    value: undefined,
    unit: undefined,
    sub: undefined,
    pill: undefined,
    to: undefined,
  },
);

defineEmits<{ click: [event: MouseEvent] }>();

const PAPER_CLASS: Record<Paper, string> = {
  vehicle_license: 'd-licence',
  insurance: 'd-insurance',
  roadworthiness: 'd-road',
};

const toneClass = computed(() =>
  props.tone === 'expired'
    ? 'd-expired'
    : props.tone === 'none'
      ? 'none'
      : PAPER_CLASS[props.paper],
);
</script>

<template>
  <component
    :is="to !== undefined ? RouterLink : button ? 'button' : 'div'"
    :to="to"
    :type="button && to === undefined ? 'button' : undefined"
    class="tile"
    :class="toneClass"
    @click="$emit('click', $event)"
  >
    <span class="k">
      <slot name="icon"><PaperIcon :paper="paper" class="ic-sm" /></slot>
      {{ label }}
    </span>
    <span v-if="value !== undefined" class="n num"
      >{{ value }}<small v-if="unit">{{ unit }}</small></span
    >
    <span v-if="sub" class="s">{{ sub }}</span>
    <span v-if="$slots.footer" class="who"><slot name="footer" /></span>
    <span v-if="pill" class="pill">{{ pill }}</span>
    <slot />
  </component>
</template>

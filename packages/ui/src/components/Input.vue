<script setup lang="ts">
import { computed, inject, useAttrs } from 'vue';
import { FIELD_CONTEXT } from './fieldContext';

/**
 * Text input. Inside a <Field> it takes the field's id, hint and error. `prefix` shows a fixed
 * part before the value, like `+234` or `₦`. Other attributes (type, autocomplete, inputmode,
 * required…) go to the <input>.
 */

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    id?: string;
    prefix?: string;
    invalid?: boolean;
  }>(),
  { id: undefined, prefix: undefined },
);

const model = defineModel<string>({ default: '' });

const attrs = useAttrs();
const field = inject(FIELD_CONTEXT, null);

const inputId = computed(() => props.id ?? field?.id.value);
const isInvalid = computed(() => props.invalid || field?.invalid.value || false);
const describedBy = computed(
  () =>
    [field?.describedBy.value, attrs['aria-describedby'] as string | undefined]
      .filter(Boolean)
      .join(' ') || undefined,
);
</script>

<template>
  <div v-if="prefix" class="inp-wrap">
    <span class="inp-pre" aria-hidden="true">{{ prefix }}</span>
    <input
      v-bind="$attrs"
      :id="inputId"
      v-model="model"
      class="inp"
      :aria-invalid="isInvalid ? 'true' : undefined"
      :aria-describedby="describedBy"
    />
  </div>
  <input
    v-else
    v-bind="$attrs"
    :id="inputId"
    v-model="model"
    class="inp"
    :aria-invalid="isInvalid ? 'true' : undefined"
    :aria-describedby="describedBy"
  />
</template>

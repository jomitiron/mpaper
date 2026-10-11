<script setup lang="ts">
import { CircleAlert } from '@lucide/vue';
import { computed, provide, useId } from 'vue';
import { FIELD_CONTEXT } from './fieldContext';

/**
 * Label, control, hint and error, wired together. Put an <Input> (or any control) inside: <Input>
 * picks up the id and aria attributes itself; other controls can use the slot props.
 *
 *   <Field label="Email" hint="We'll send a code" :error="errors.email">
 *     <Input v-model="email" type="email" autocomplete="email" />
 *   </Field>
 */

const props = withDefaults(
  defineProps<{
    label: string;
    hint?: string;
    error?: string;
    /** Control id. Generated when left out. */
    id?: string;
  }>(),
  { hint: undefined, error: undefined, id: undefined },
);

const generated = useId();
const id = computed(() => props.id ?? generated);
const hintId = computed(() => `${id.value}-hint`);
const errorId = computed(() => `${id.value}-error`);
const invalid = computed(() => Boolean(props.error));
const describedBy = computed(
  () =>
    [props.error ? errorId.value : null, props.hint ? hintId.value : null]
      .filter(Boolean)
      .join(' ') || undefined,
);

provide(FIELD_CONTEXT, { id, describedBy, invalid });
</script>

<template>
  <div class="fld">
    <div v-if="$slots.aside" class="lbl-row">
      <label class="lbl" :for="id"
        ><slot name="label">{{ label }}</slot></label
      >
      <slot name="aside" />
    </div>
    <label v-else :for="id"
      ><slot name="label">{{ label }}</slot></label
    >
    <slot :id="id" :described-by="describedBy" :invalid="invalid" />
    <span v-if="hint" :id="hintId" class="hint">{{ hint }}</span>
    <span v-if="error" :id="errorId" class="fld-error">
      <CircleAlert class="ic" aria-hidden="true" />{{ error }}
    </span>
  </div>
</template>

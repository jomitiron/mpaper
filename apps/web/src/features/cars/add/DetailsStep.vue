<script setup lang="ts">
import { TriangleAlert } from '@lucide/vue';
import { Button, Field, Input } from '@motopapers/ui';
import { computed, ref } from 'vue';
import { carName } from '../lib/papers';
import ReadTag from './ReadTag.vue';
import { focusFirstInvalid, useAddCarContext } from './context';
import {
  DETAIL_FIELDS,
  detailsErrors,
  duplicateOf,
  fieldValue,
  setFieldValue,
  type DraftField,
} from './draft';

/** Step 2: check what the reader read (or type it), with a live duplicate-plate check. */

const emit = defineEmits<{ next: []; back: []; view: [vehicleId: number] }>();

const { draft, vehicles } = useAddCarContext();
const root = ref<HTMLElement | null>(null);
const attempted = ref(false);

const errors = computed(() => detailsErrors(draft, vehicles.value));
const duplicate = computed(() => duplicateOf(draft, vehicles.value));

function errorFor(field: DraftField): string | undefined {
  // The duplicate warning below the form explains itself; don't repeat it on the field.
  if (field === 'plate_number' && duplicate.value) return undefined;
  return attempted.value ? errors.value[field] : undefined;
}

function hintFor(field: DraftField): string | undefined {
  const unread = draft.unparsed[field];
  if (unread) return `We read "${unread}". Check it's right.`;
  if (field === 'license_pin') return 'Needed with the expiry date to track the licence.';
  return undefined;
}

const INPUT_ATTRS: Partial<Record<DraftField, Record<string, string>>> = {
  plate_number: { autocapitalize: 'characters' },
  licence_expiry: { type: 'date' },
  license_pin: { autocapitalize: 'characters' },
  engine_number: { autocapitalize: 'characters' },
  chassis_number: { autocapitalize: 'characters' },
};

function next() {
  attempted.value = true;
  if (Object.keys(errors.value).length) {
    void focusFirstInvalid(root.value);
    return;
  }
  emit('next');
}
</script>

<template>
  <div ref="root">
    <h2 class="wz-title" tabindex="-1" data-step-heading>Check your car's details</h2>
    <p class="wz-sub">
      {{
        draft.source === 'reader'
          ? "Here's what we read from your licence. Fix anything that's wrong."
          : 'Type the details from your vehicle licence.'
      }}
    </p>

    <div class="form-grid">
      <Field
        v-for="field in DETAIL_FIELDS"
        :key="field.key"
        :label="field.label"
        :error="errorFor(field.key)"
        :hint="hintFor(field.key)"
      >
        <template #label>
          {{ field.label }}
          <ReadTag v-if="draft.read.includes(field.key)" />
        </template>
        <Input
          :model-value="fieldValue(draft, field.key)"
          autocomplete="off"
          spellcheck="false"
          v-bind="INPUT_ATTRS[field.key]"
          :invalid="field.key === 'plate_number' && !!duplicate"
          :aria-describedby="field.key === 'plate_number' && duplicate ? 'dup-warn' : undefined"
          @update:model-value="setFieldValue(draft, field.key, $event)"
        />
      </Field>
    </div>

    <p v-if="duplicate" id="dup-warn" class="warn-line" role="alert">
      <TriangleAlert class="ic" aria-hidden="true" />
      <span>
        <b class="num">{{ duplicate.plate_number }}</b> is already on your account ({{
          carName(duplicate)
        }}).
      </span>
      <button type="button" class="link" @click="emit('view', duplicate.id)">View it</button>
    </p>

    <div class="wz-foot">
      <Button variant="white" @click="emit('back')">Back</Button>
      <Button @click="next">Continue</Button>
    </div>
  </div>
</template>

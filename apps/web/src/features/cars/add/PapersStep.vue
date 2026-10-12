<script setup lang="ts">
import { Gauge, ShieldCheck } from '@lucide/vue';
import { listInsuranceCompanies, type CoverType } from '@motopapers/api';
import { Button, Field, Input, SegmentedControl, type SegmentOption } from '@motopapers/ui';
import { useQuery } from '@tanstack/vue-query';
import { computed, ref } from 'vue';
import { queryKeys } from '@/lib/queries';
import { focusFirstInvalid, useAddCarContext } from './context';
import { groupDigits, papersErrors, type PaperField } from './draft';

/** Step 3: insurance (cover type, insurer, value, expiry) and roadworthiness. Either can wait. */

const emit = defineEmits<{ next: []; back: [] }>();

const { draft } = useAddCarContext();
const root = ref<HTMLElement | null>(null);
const attempted = ref(false);

const COVER_OPTIONS: readonly SegmentOption<CoverType | 'none'>[] = [
  { value: 'third_party', label: 'Third party' },
  { value: 'comprehensive', label: 'Comprehensive' },
  { value: 'none', label: 'No cover yet' },
];

const insurers = useQuery({
  queryKey: queryKeys.insuranceCompanies,
  queryFn: ({ signal }) => listInsuranceCompanies({ signal }),
  staleTime: Infinity,
  meta: { silent: true },
});
const insurerOptions = computed(() =>
  [...(insurers.data.value ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
);

const errors = computed(() => papersErrors(draft));
const errorFor = (field: PaperField) => (attempted.value ? errors.value[field] : undefined);

const insurerId = computed({
  get: () => (draft.insurance.insurer_id === null ? '' : String(draft.insurance.insurer_id)),
  set: (value: string) => {
    draft.insurance.insurer_id = value ? Number(value) : null;
  },
});

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
    <h2 class="wz-title" tabindex="-1" data-step-heading>Insurance and roadworthiness</h2>
    <p class="wz-sub">
      Add the expiry dates so we can remind you before they run out. You can skip either and add it
      later.
    </p>

    <div class="subcards">
      <section class="subcard" aria-labelledby="add-insurance-title">
        <div class="subcard-h">
          <i class="d-insurance" aria-hidden="true"><ShieldCheck class="ic" /></i>
          <h3 id="add-insurance-title">Insurance</h3>
        </div>
        <div class="fld">
          <span class="lbl" aria-hidden="true">Cover type</span>
          <SegmentedControl
            v-model="draft.insurance.cover"
            :options="COVER_OPTIONS"
            label="Cover type"
          />
        </div>

        <template v-if="draft.insurance.cover !== 'none'">
          <Field
            v-if="draft.insurance.cover === 'comprehensive'"
            label="Car's value"
            hint="Comprehensive premiums are a percentage of this value."
            :error="errorFor('vehicle_value')"
          >
            <Input
              v-model="draft.insurance.vehicle_value"
              prefix="₦"
              inputmode="numeric"
              autocomplete="off"
              placeholder="9,500,000"
              @blur="draft.insurance.vehicle_value = groupDigits(draft.insurance.vehicle_value)"
            />
          </Field>

          <Field
            v-slot="{ id, describedBy }"
            label="Insurer (optional)"
            :hint="insurers.isError.value ? 'We couldn\'t load the list of insurers.' : undefined"
          >
            <select
              :id="id"
              v-model="insurerId"
              class="inp"
              :aria-describedby="describedBy"
              :disabled="!insurerOptions.length"
            >
              <option value="">
                {{ insurers.isPending.value ? 'Loading insurers…' : 'Choose your insurer' }}
              </option>
              <option
                v-for="insurer in insurerOptions"
                :key="insurer.id"
                :value="String(insurer.id)"
              >
                {{ insurer.name }}
              </option>
            </select>
          </Field>

          <Field label="Expiry date" :error="errorFor('insurance_expiry')">
            <Input v-model="draft.insurance.expiry_date" type="date" />
          </Field>
        </template>
        <p v-else class="hint">We'll help you buy third-party cover once the car is added.</p>
      </section>

      <section class="subcard" aria-labelledby="add-road-title">
        <div class="subcard-h">
          <i class="d-road" aria-hidden="true"><Gauge class="ic" /></i>
          <h3 id="add-road-title">Roadworthiness</h3>
        </div>
        <Field
          v-if="!draft.roadworthiness.none"
          label="Certificate expiry date"
          :error="errorFor('road_expiry')"
        >
          <Input v-model="draft.roadworthiness.expiry_date" type="date" />
        </Field>
        <label class="check">
          <input v-model="draft.roadworthiness.none" type="checkbox" />
          I don't have a certificate yet
        </label>
      </section>
    </div>

    <div class="wz-foot">
      <Button variant="white" @click="emit('back')">Back</Button>
      <Button @click="next">Continue</Button>
    </div>
  </div>
</template>

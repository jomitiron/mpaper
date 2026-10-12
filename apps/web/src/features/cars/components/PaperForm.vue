<script setup lang="ts">
import { CircleAlert } from '@lucide/vue';
import {
  createInsurance,
  createRoadworthiness,
  createVehicleLicense,
  errorMessage,
  PAPER_LABELS,
  parseNaira,
  toCalendarDate,
  type CoverType,
  type PaperKind,
  type Vehicle,
} from '@motopapers/api';
import {
  Button,
  Field,
  Input,
  SegmentedControl,
  useToast,
  type SegmentOption,
} from '@motopapers/ui';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { computed, onMounted, reactive, ref } from 'vue';
import { queryKeys } from '@/lib/queries';
import { groupDigits } from '../add/draft';

/**
 * Adds a paper, or records a renewed one: posts a new record to
 * `/vehicle/:id/vehicle-licenses|insurance|roadworthiness`, which becomes the car's current paper.
 */

const props = defineProps<{ vehicle: Vehicle; kind: PaperKind }>();
const emit = defineEmits<{ done: []; cancel: [] }>();

const queryClient = useQueryClient();
const toast = useToast();
const root = ref<HTMLFormElement | null>(null);

const current = computed(() => props.vehicle[props.kind]);
const name = computed(() => PAPER_LABELS[props.kind].name);

const form = reactive({
  expiry_date: '',
  license_pin: props.vehicle.vehicle_license?.license_pin ?? '',
  cover: (props.vehicle.insurance?.cover_type === 'comprehensive'
    ? 'comprehensive'
    : 'third_party') as CoverType,
  vehicle_value: props.vehicle.insurance?.vehicle_value
    ? groupDigits(String(props.vehicle.insurance.vehicle_value))
    : '',
});

const COVER_OPTIONS: readonly SegmentOption<CoverType>[] = [
  { value: 'third_party', label: 'Third party' },
  { value: 'comprehensive', label: 'Comprehensive' },
];

const attempted = ref(false);
const errors = computed(() => {
  const e: Partial<Record<'expiry_date' | 'license_pin' | 'vehicle_value', string>> = {};
  if (!form.expiry_date) e.expiry_date = 'Enter the expiry date.';
  else if (!toCalendarDate(form.expiry_date)) e.expiry_date = 'Enter a real date.';
  if (props.kind === 'vehicle_license' && !form.license_pin.trim()) {
    e.license_pin = 'Enter the licence PIN.';
  }
  if (
    props.kind === 'insurance' &&
    form.cover === 'comprehensive' &&
    !(parseNaira(form.vehicle_value) > 0)
  ) {
    e.vehicle_value = "Enter the car's value, for example 9,500,000.";
  }
  return e;
});
const shown = (field: keyof typeof errors.value) =>
  attempted.value ? errors.value[field] : undefined;

const save = useMutation({
  mutationFn: async (): Promise<void> => {
    const id = props.vehicle.id;
    if (props.kind === 'vehicle_license') {
      await createVehicleLicense(id, {
        expiry_date: form.expiry_date,
        license_pin: form.license_pin.trim(),
      });
    } else if (props.kind === 'insurance') {
      await createInsurance(id, {
        cover_type: form.cover,
        vehicle_value: form.cover === 'comprehensive' ? parseNaira(form.vehicle_value) : 0,
        expiry_date: form.expiry_date,
      });
    } else {
      await createRoadworthiness(id, { expiry_date: form.expiry_date });
    }
  },
  onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.vehicles });
    toast.success(`${name.value} saved for ${props.vehicle.plate_number}.`);
    emit('done');
  },
  onError: () => {},
});

function submit() {
  attempted.value = true;
  if (Object.keys(errors.value).length) {
    root.value?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    return;
  }
  save.mutate();
}

onMounted(() => root.value?.querySelector<HTMLElement>('input, button')?.focus());
</script>

<template>
  <form ref="root" class="paper-form" novalidate @submit.prevent="submit">
    <h3>{{ current ? `Update ${name.toLowerCase()}` : `Add ${name.toLowerCase()}` }}</h3>
    <p class="hint">
      {{
        current
          ? 'Renewed it yourself? Enter the details from the new paper.'
          : 'Enter the details from the paper so we can remind you before it runs out.'
      }}
    </p>

    <div v-if="kind === 'insurance'" class="fld">
      <span class="lbl" aria-hidden="true">Cover type</span>
      <SegmentedControl v-model="form.cover" :options="COVER_OPTIONS" label="Cover type" />
    </div>
    <Field
      v-if="kind === 'insurance' && form.cover === 'comprehensive'"
      label="Car's value"
      :error="shown('vehicle_value')"
    >
      <Input
        v-model="form.vehicle_value"
        prefix="₦"
        inputmode="numeric"
        autocomplete="off"
        @blur="form.vehicle_value = groupDigits(form.vehicle_value)"
      />
    </Field>
    <Field
      :label="kind === 'roadworthiness' ? 'Certificate expiry date' : 'Expiry date'"
      :error="shown('expiry_date')"
    >
      <Input v-model="form.expiry_date" type="date" />
    </Field>
    <Field v-if="kind === 'vehicle_license'" label="Licence PIN" :error="shown('license_pin')">
      <Input
        v-model="form.license_pin"
        autocomplete="off"
        autocapitalize="characters"
        spellcheck="false"
      />
    </Field>

    <p v-if="save.isError.value" class="form-error" role="alert">
      <CircleAlert class="ic" aria-hidden="true" />{{ errorMessage(save.error.value) }}
    </p>

    <div class="paper-form-acts">
      <Button type="submit" size="sm" :loading="save.isPending.value">Save</Button>
      <Button variant="quiet" size="sm" @click="emit('cancel')">Cancel</Button>
    </div>
  </form>
</template>

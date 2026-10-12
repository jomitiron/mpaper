<script setup lang="ts">
import { CircleAlert } from '@lucide/vue';
import { errorMessage, updateVehicleColor, type Vehicle } from '@motopapers/api';
import { Button, Input, useToast } from '@motopapers/ui';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { nextTick, ref, useId } from 'vue';
import { queryKeys } from '@/lib/queries';
import { swatchFor } from '../lib/colour';

/** The Colour row in the car panel's details. Colour is the only detail a driver can change. */

const props = defineProps<{ vehicle: Vehicle }>();

const queryClient = useQueryClient();
const toast = useToast();
const id = useId();

const editing = ref(false);
const value = ref('');
const invalid = ref(false);
const field = ref<HTMLElement | null>(null);
const changeButton = ref<InstanceType<typeof Button> | null>(null);

async function start() {
  value.value = props.vehicle.color;
  invalid.value = false;
  save.reset();
  editing.value = true;
  await nextTick();
  field.value?.querySelector('input')?.focus();
}

async function stop() {
  editing.value = false;
  await nextTick();
  (changeButton.value?.$el as HTMLElement | undefined)?.focus();
}

const save = useMutation({
  mutationFn: (color: string) => updateVehicleColor(props.vehicle.id, color),
  onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.vehicles });
    toast.success(`Colour updated for ${props.vehicle.plate_number}.`);
    void stop();
  },
  onError: () => {},
});

function submit() {
  const color = value.value.trim();
  invalid.value = !color;
  if (invalid.value) return;
  if (color === props.vehicle.color) return void stop();
  save.mutate(color);
}
</script>

<template>
  <div class="spec-colour">
    <dt :id="`${id}-label`">Colour</dt>
    <dd v-if="!editing">
      <span class="swatch" :style="{ background: swatchFor(vehicle.color) }" aria-hidden="true" />
      {{ vehicle.color || 'Not set' }}
      <Button ref="changeButton" variant="quiet" size="sm" class="spec-edit" @click="start">
        Change<span class="visually-hidden"> colour</span>
      </Button>
    </dd>
    <dd v-else ref="field" class="spec-form">
      <form novalidate @submit.prevent="submit">
        <Input
          v-model="value"
          :aria-labelledby="`${id}-label`"
          autocomplete="off"
          :invalid="invalid"
          :aria-describedby="invalid ? `${id}-error` : undefined"
        />
        <div class="paper-form-acts">
          <Button type="submit" size="sm" :loading="save.isPending.value">Save</Button>
          <Button variant="quiet" size="sm" @click="stop">Cancel</Button>
        </div>
        <p v-if="invalid" :id="`${id}-error`" class="fld-error">
          <CircleAlert class="ic" aria-hidden="true" />Enter a colour.
        </p>
        <p v-else-if="save.isError.value" class="form-error" role="alert">
          <CircleAlert class="ic" aria-hidden="true" />{{ errorMessage(save.error.value) }}
        </p>
      </form>
    </dd>
  </div>
</template>

<script setup lang="ts">
import { CircleAlert, Trash2 } from '@lucide/vue';
import { deleteVehicle, errorMessage, NetworkError, type Vehicle } from '@motopapers/api';
import { Button } from '@motopapers/ui';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { nextTick, ref } from 'vue';
import { queryKeys } from '@/lib/queries';

/**
 * Delete with an inline confirm. `DELETE /vehicles/:id` isn't in the API docs, so a failure gets
 * a plain message and a way to reach us, and the car stays on the list.
 */

const props = defineProps<{ vehicle: Vehicle }>();
const emit = defineEmits<{ deleted: [plate: string] }>();

const queryClient = useQueryClient();
const confirming = ref(false);
const box = ref<HTMLElement | null>(null);

async function ask() {
  remove.reset();
  confirming.value = true;
  await nextTick();
  box.value?.querySelector<HTMLElement>('[data-keep]')?.focus();
}

async function keep() {
  confirming.value = false;
  await nextTick();
  box.value?.querySelector<HTMLElement>('[data-ask]')?.focus();
}

const remove = useMutation({
  mutationFn: () => deleteVehicle(props.vehicle.id),
  onSuccess: () => {
    const plate = props.vehicle.plate_number;
    queryClient.setQueryData<Vehicle[]>(queryKeys.vehicles, (list) =>
      list?.filter((v) => v.id !== props.vehicle.id),
    );
    void queryClient.invalidateQueries({ queryKey: queryKeys.vehicles });
    emit('deleted', plate);
  },
  onError: () => {},
});

function failureText(error: unknown): string {
  if (error instanceof NetworkError) return errorMessage(error);
  return "We couldn't delete this car right now. Try again, or chat with us and we'll remove it for you.";
}
</script>

<template>
  <div ref="box" class="danger">
    <template v-if="!confirming">
      <p>Deleting this car stops its reminders. Your payment history stays.</p>
      <div>
        <Button variant="danger-soft" size="sm" data-ask @click="ask">
          <Trash2 class="ic ic-sm" aria-hidden="true" />Delete car
        </Button>
      </div>
    </template>
    <template v-else>
      <p>
        <b>Delete {{ vehicle.plate_number }}?</b> Its reminders stop and its papers are removed from
        MotoPapers. This can't be undone.
      </p>
      <p v-if="remove.isError.value" class="form-error" role="alert">
        <CircleAlert class="ic" aria-hidden="true" />{{ failureText(remove.error.value) }}
      </p>
      <div class="danger-acts">
        <Button
          variant="danger"
          size="sm"
          :loading="remove.isPending.value"
          @click="remove.mutate()"
        >
          Delete {{ vehicle.plate_number }}
        </Button>
        <Button variant="quiet" size="sm" data-keep @click="keep">Keep it</Button>
      </div>
    </template>
  </div>
</template>

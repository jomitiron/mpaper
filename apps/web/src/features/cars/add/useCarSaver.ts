import { errorMessage, isHttpError, type PaperKind, type Vehicle } from '@motopapers/api';
import { useQueryClient } from '@tanstack/vue-query';
import { readonly, ref, shallowRef } from 'vue';
import { queryKeys } from '@/lib/queries';
import type { CarDraft } from './draft';
import { newProgress, saveCar, type CarApi, type SaveResult } from './saveCar';

/**
 * Saves the car from Add a car and keeps track of how it went, for step 4.
 *
 *   idle → saving → saved            everything is on the account
 *                 → partial          the car is saved, some papers aren't: save() again retries them
 *                 → duplicate        the plate is already on the account (409)
 *                 → failed           the car couldn't be saved: save() again tries it again
 */
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'partial' | 'duplicate' | 'failed';

export function useCarSaver(getDraft: () => CarDraft, api?: CarApi) {
  const queryClient = useQueryClient();
  let progress = newProgress();

  const status = ref<SaveStatus>('idle');
  const vehicle = shallowRef<Vehicle | null>(null);
  const failed = ref<PaperKind[]>([]);
  const error = ref<string | null>(null);

  async function save(): Promise<SaveResult | null> {
    if (status.value === 'saving') return null;
    status.value = 'saving';
    error.value = null;
    try {
      const result = await saveCar(getDraft(), progress, api);
      vehicle.value = result.vehicle;
      failed.value = result.failed.map((f) => f.kind);
      error.value = result.failed[0] ? errorMessage(result.failed[0].error) : null;
      status.value = result.failed.length ? 'partial' : 'saved';
      return result;
    } catch (caught) {
      if (isHttpError(caught, 409)) {
        status.value = 'duplicate';
        error.value = 'This plate is already on your account.';
      } else {
        status.value = 'failed';
        error.value = errorMessage(caught);
      }
      return null;
    } finally {
      // Any write changes the car list, even a partial one. A 409 means our list is out of date.
      if (progress.vehicle || status.value === 'duplicate') {
        void queryClient.invalidateQueries({ queryKey: queryKeys.vehicles });
      }
    }
  }

  /** Starts over for another car. */
  function reset(): void {
    progress = newProgress();
    status.value = 'idle';
    vehicle.value = null;
    failed.value = [];
    error.value = null;
  }

  return {
    status: readonly(status),
    vehicle: readonly(vehicle),
    failed: readonly(failed),
    error: readonly(error),
    save,
    reset,
  };
}

export type CarSaver = ReturnType<typeof useCarSaver>;

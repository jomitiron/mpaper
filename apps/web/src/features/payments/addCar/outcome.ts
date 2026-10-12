import type { PaperKind } from '@motopapers/api';
import { computed, ref } from 'vue';
import type { CarDraft } from '../../cars/add/draft';
import { papersInDraft } from '../../cars/add/saveCar';
import type { CarSaver } from '../../cars/add/useCarSaver';

/**
 * Where saving a paid-for car has got to. It's done when everything is saved, or when the driver
 * chose to add the papers that keep failing later ("Skip, add it later").
 */
export function useCarSaveOutcome(
  saver: CarSaver,
  draft: () => CarDraft,
  initiallySkipped: readonly PaperKind[] = [],
) {
  const skipped = ref<PaperKind[]>([...initiallySkipped]);

  const done = computed(
    () =>
      saver.status.value === 'saved' ||
      (saver.status.value === 'partial' && skipped.value.length > 0),
  );
  /** Papers on the account now. */
  const saved = computed(() =>
    papersInDraft(draft()).filter((kind) => !saver.failed.value.includes(kind)),
  );

  function skip(): void {
    skipped.value = [...saver.failed.value];
  }

  return { skipped, done, saved, skip };
}

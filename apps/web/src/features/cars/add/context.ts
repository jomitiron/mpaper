import type { Vehicle } from '@motopapers/api';
import { inject, nextTick, type InjectionKey, type Ref } from 'vue';
import type { CarDraft } from './draft';

/** What AddCarPage shares with its step components. */
export interface AddCarContext {
  /** Reactive. Steps edit it directly. */
  draft: CarDraft;
  /** The driver's cars, for the duplicate-plate check. */
  vehicles: Readonly<Ref<readonly Vehicle[]>>;
}

export const ADD_CAR_CONTEXT: InjectionKey<AddCarContext> = Symbol('add-car');

export function useAddCarContext(): AddCarContext {
  const context = inject(ADD_CAR_CONTEXT);
  if (!context) throw new Error('Add a car steps must be used inside AddCarPage');
  return context;
}

/** After a failed Continue, moves focus to the first field with an error. */
export async function focusFirstInvalid(root: HTMLElement | null | undefined): Promise<void> {
  await nextTick();
  root?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
}

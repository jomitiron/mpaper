import type { ComputedRef, InjectionKey } from 'vue';

/** What <Field> gives the control inside it, so the label, hint and error are wired up. */
export interface FieldContext {
  id: ComputedRef<string>;
  describedBy: ComputedRef<string | undefined>;
  invalid: ComputedRef<boolean>;
}

export const FIELD_CONTEXT: InjectionKey<FieldContext> = Symbol('motopapers-field');

import { nextTick } from 'vue';

/** After a failed submit, moves focus to the first field with an error. */
export async function focusFirstInvalid(root: HTMLElement | null | undefined): Promise<void> {
  await nextTick();
  root?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
}

/** Moves focus to a new step's heading, so screen readers announce it. */
export async function focusHeading(root: HTMLElement | null | undefined): Promise<void> {
  await nextTick();
  root?.querySelector<HTMLElement>('h1')?.focus();
}

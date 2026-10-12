import type { Component } from 'vue';
import type { CarDraft } from './draft';
import ReviewStep from './ReviewStep.vue';
import type { CarSaver } from './useCarSaver';

/**
 * PHASE 3 SEAM · Add a car, step 4 ("Review and pay").
 *
 * Steps 1–3 (phase 2) build a CarDraft. When the driver presses Continue on step 3, AddCarPage
 * calls `onReadyToPay(draft)` and shows the component it returns as step 4, with the props and
 * events below.
 *
 * Phase 2's step 4 (ReviewStep.vue) shows the review and saves the car without taking payment.
 * Phase 3 replaces this function's body (and ReviewStep.vue, or returns its own component) with
 * Review and pay: the tracking fee by wallet or card, then `saver.save()`, then the success
 * screen. AddCarSuccess.vue and DraftReview.vue can be reused.
 */
export function onReadyToPay(_draft: CarDraft): Component {
  return ReviewStep;
}

export interface ReadyToPayProps {
  /**
   * The car and its papers, from steps 1–3. Plain JSON: keep it in sessionStorage before sending
   * the driver to Paystack, and pass it back to `saveCar()` (saveCar.ts) when they return.
   */
  draft: CarDraft;
  /**
   * Saves the car (`POST /vehicles` with `is_paid_tier: true`) and then each paper. Retry-safe:
   * after a partial failure, `save()` again retries only the papers that failed and never
   * creates the car twice. Invalidates `['vehicles']`.
   */
  saver: CarSaver;
}

export interface ReadyToPayEmits {
  /** Back to step 3. */
  back: [];
  /** `POST /vehicles` answered 409: back to step 2, where the duplicate warning shows. */
  duplicate: [];
  /** "Add another car": start again at step 1. */
  restart: [];
}

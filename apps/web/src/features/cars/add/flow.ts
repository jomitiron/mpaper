import type { StepItem } from '@motopapers/ui';

/**
 * Add a car's steps, as a small state machine so the rules are in one place and testable:
 *
 *   0 Upload licence ──read──▶ 1 Check details ──▶ 2 Other papers ──▶ 3 Review and pay
 *          └──"Enter details by hand"──▲
 *
 * You move forward only when the step you're on is valid. You can always go back, and jump back
 * to any step you've finished.
 */

export const ADD_CAR_STEPS: readonly StepItem[] = [
  { title: 'Upload licence', hint: 'Photo or PDF' },
  { title: 'Check details', hint: 'What we read' },
  { title: 'Other papers', hint: 'Insurance, road' },
  { title: 'Review and pay', hint: 'Start reminders' },
];

export type StepIndex = 0 | 1 | 2 | 3;
export const UPLOAD: StepIndex = 0;
export const DETAILS: StepIndex = 1;
export const PAPERS: StepIndex = 2;
export const REVIEW: StepIndex = 3;

export interface FlowState {
  step: StepIndex;
  /** The licence reader is working on a file. */
  reading: boolean;
  /** Name of the file being read, for "Reading your licence…". */
  fileName: string | null;
  /** Why the last read failed, in plain words. */
  readError: string | null;
}

export type FlowEvent =
  | { type: 'READ_START'; fileName: string }
  | { type: 'READ_DONE' }
  | { type: 'READ_FAILED'; error: string }
  | { type: 'READ_CANCEL' }
  | { type: 'MANUAL' }
  | { type: 'NEXT' }
  | { type: 'BACK' }
  | { type: 'GO'; step: StepIndex }
  | { type: 'RESET' };

/** Whether each step's form is valid right now. */
export interface FlowGuards {
  detailsValid: boolean;
  papersValid: boolean;
}

export function initialFlow(): FlowState {
  return { step: UPLOAD, reading: false, fileName: null, readError: null };
}

/** Whether the driver may stand on `step`, given what's valid. */
export function canEnter(step: StepIndex, guards: FlowGuards): boolean {
  if (step >= PAPERS && !guards.detailsValid) return false;
  if (step >= REVIEW && !guards.papersValid) return false;
  return true;
}

export function transition(state: FlowState, event: FlowEvent, guards: FlowGuards): FlowState {
  switch (event.type) {
    case 'READ_START':
      if (state.step !== UPLOAD || state.reading) return state;
      return { ...state, reading: true, fileName: event.fileName, readError: null };
    case 'READ_DONE':
      if (!state.reading) return state;
      return { ...state, step: DETAILS, reading: false, readError: null };
    case 'READ_FAILED':
      if (!state.reading) return state;
      return { ...state, reading: false, readError: event.error };
    case 'READ_CANCEL':
      return { ...state, reading: false, fileName: null };
    case 'MANUAL':
      if (state.step !== UPLOAD || state.reading) return state;
      return { ...state, step: DETAILS, readError: null };
    case 'NEXT': {
      // Step 1 moves on by reading a licence or choosing to type the details.
      if (state.step === UPLOAD || state.step === REVIEW) return state;
      const next = (state.step + 1) as StepIndex;
      return canEnter(next, guards) ? { ...state, step: next } : state;
    }
    case 'BACK':
      if (state.step === UPLOAD || state.reading) return state;
      return { ...state, step: (state.step - 1) as StepIndex };
    case 'GO':
      if (state.reading || event.step === state.step) return state;
      if (event.step > state.step && !canEnter(event.step, guards)) return state;
      // Going back to Upload starts a fresh read; the details stay until a new one replaces them.
      return { ...state, step: event.step, readError: null, fileName: null };
    case 'RESET':
      return initialFlow();
  }
}

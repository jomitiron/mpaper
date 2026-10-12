import { describe, expect, it } from 'vitest';
import {
  DETAILS,
  initialFlow,
  PAPERS,
  REVIEW,
  transition,
  UPLOAD,
  type FlowEvent,
  type FlowGuards,
  type FlowState,
} from '../add/flow';

const valid: FlowGuards = { detailsValid: true, papersValid: true };
const invalid: FlowGuards = { detailsValid: false, papersValid: false };

function play(events: FlowEvent[], guards: FlowGuards = valid, from = initialFlow()): FlowState {
  return events.reduce((state, event) => transition(state, event, guards), from);
}

describe('Add a car steps', () => {
  it('reads a licence, then moves to Check details', () => {
    const reading = play([{ type: 'READ_START', fileName: 'licence.jpg' }]);
    expect(reading).toMatchObject({ step: UPLOAD, reading: true, fileName: 'licence.jpg' });
    expect(play([{ type: 'READ_DONE' }], valid, reading)).toMatchObject({
      step: DETAILS,
      reading: false,
    });
  });

  it('stays on Upload with the reason when reading fails, and can try again', () => {
    const failed = play([
      { type: 'READ_START', fileName: 'blurry.jpg' },
      { type: 'READ_FAILED', error: "We couldn't read this licence." },
    ]);
    expect(failed).toMatchObject({
      step: UPLOAD,
      reading: false,
      readError: "We couldn't read this licence.",
    });
    const retry = play([{ type: 'READ_START', fileName: 'sharp.jpg' }], valid, failed);
    expect(retry).toMatchObject({ reading: true, readError: null });
  });

  it('ignores a second file and manual entry while reading', () => {
    const reading = play([{ type: 'READ_START', fileName: 'a.jpg' }]);
    expect(play([{ type: 'READ_START', fileName: 'b.jpg' }], valid, reading).fileName).toBe(
      'a.jpg',
    );
    expect(play([{ type: 'MANUAL' }], valid, reading).step).toBe(UPLOAD);
    expect(play([{ type: 'BACK' }], valid, reading).step).toBe(UPLOAD);
  });

  it('ignores a late result after the read was cancelled', () => {
    const cancelled = play([{ type: 'READ_START', fileName: 'a.jpg' }, { type: 'READ_CANCEL' }]);
    expect(play([{ type: 'READ_DONE' }], valid, cancelled).step).toBe(UPLOAD);
  });

  it('goes to Check details by hand', () => {
    expect(play([{ type: 'MANUAL' }]).step).toBe(DETAILS);
  });

  it("doesn't skip Upload with Continue", () => {
    expect(play([{ type: 'NEXT' }]).step).toBe(UPLOAD);
  });

  it('moves forward only when the step is valid', () => {
    expect(play([{ type: 'MANUAL' }, { type: 'NEXT' }], invalid).step).toBe(DETAILS);
    const onPapers = play([{ type: 'MANUAL' }, { type: 'NEXT' }]);
    expect(onPapers.step).toBe(PAPERS);
    expect(
      play([{ type: 'NEXT' }], { detailsValid: true, papersValid: false }, onPapers).step,
    ).toBe(PAPERS);
    expect(play([{ type: 'NEXT' }], valid, onPapers).step).toBe(REVIEW);
    expect(play([{ type: 'NEXT' }, { type: 'NEXT' }], valid, onPapers).step).toBe(REVIEW);
  });

  it('goes back one step at a time, and jumps back to a finished step', () => {
    const onReview = play([{ type: 'MANUAL' }, { type: 'NEXT' }, { type: 'NEXT' }]);
    expect(play([{ type: 'BACK' }], valid, onReview).step).toBe(PAPERS);
    expect(play([{ type: 'GO', step: DETAILS }], valid, onReview).step).toBe(DETAILS);
    expect(play([{ type: 'GO', step: UPLOAD }], valid, onReview)).toMatchObject({
      step: UPLOAD,
      readError: null,
    });
  });

  it("can't jump ahead past an invalid step", () => {
    const onDetails = play([{ type: 'MANUAL' }]);
    expect(play([{ type: 'GO', step: REVIEW }], invalid, onDetails).step).toBe(DETAILS);
    expect(
      play([{ type: 'GO', step: REVIEW }], { detailsValid: true, papersValid: false }, onDetails)
        .step,
    ).toBe(DETAILS);
  });

  it('starts over', () => {
    const onReview = play([{ type: 'MANUAL' }, { type: 'NEXT' }, { type: 'NEXT' }]);
    expect(play([{ type: 'RESET' }], valid, onReview)).toEqual(initialFlow());
  });
});

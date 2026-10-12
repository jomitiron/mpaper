<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';

/**
 * A 6-digit code in six boxes. Typing moves to the next box, Backspace goes back, arrow keys move,
 * and pasting (or the phone's "From Messages/Mail" suggestion) fills every box at once.
 * `v-model` is the digits typed so far; `complete` fires when all six are in.
 */

const props = withDefaults(
  defineProps<{
    /** Accessible name for the group of boxes. */
    label?: string;
    length?: number;
    invalid?: boolean;
    disabled?: boolean;
    /** id of the error or hint that describes the code. */
    describedBy?: string;
  }>(),
  { label: 'Verification code', length: 6, describedBy: undefined },
);

const model = defineModel<string>({ default: '' });
const emit = defineEmits<{ complete: [code: string] }>();

const cells = ref<string[]>(split(model.value));
const boxes = ref<HTMLInputElement[]>([]);

// Keep the boxes in step when the parent clears or sets the code.
watch(model, (value) => {
  if (value !== cells.value.join('')) cells.value = split(value);
});

function split(value: string): string[] {
  const digits = value.replace(/\D/g, '').slice(0, props.length);
  return Array.from({ length: props.length }, (_, i) => digits[i] ?? '');
}

function commit(next: string[]): void {
  cells.value = next;
  const code = next.join('');
  model.value = code;
  if (next.every(Boolean)) emit('complete', code);
}

function focusBox(index: number): void {
  const target = boxes.value[Math.max(0, Math.min(index, props.length - 1))];
  target?.focus();
  target?.select();
}

/** Puts `digits` into the boxes from `start` on and moves to the box after the last one filled. */
function fill(start: number, digits: string): void {
  const next = [...cells.value];
  const chars = digits.slice(0, props.length - start).split('');
  chars.forEach((digit, offset) => (next[start + offset] = digit));
  commit(next);
  void nextTick(() => focusBox(start + chars.length));
}

function onKeydown(index: number, event: KeyboardEvent): void {
  if (event.ctrlKey || event.metaKey || event.altKey) return; // Paste, select all…
  const { key } = event;
  if (/^\d$/.test(key)) {
    event.preventDefault();
    fill(index, key);
  } else if (key === 'Backspace') {
    event.preventDefault();
    const next = [...cells.value];
    if (next[index]) {
      next[index] = '';
      commit(next);
    } else if (index > 0) {
      next[index - 1] = '';
      commit(next);
      focusBox(index - 1);
    }
  } else if (key === 'Delete') {
    event.preventDefault();
    const next = [...cells.value];
    next[index] = '';
    commit(next);
  } else if (key === 'ArrowLeft') {
    event.preventDefault();
    focusBox(index - 1);
  } else if (key === 'ArrowRight') {
    event.preventDefault();
    focusBox(index + 1);
  } else if (key === 'Home') {
    event.preventDefault();
    focusBox(0);
  } else if (key === 'End') {
    event.preventDefault();
    focusBox(props.length - 1);
  } else if (key.length === 1) {
    event.preventDefault(); // Letters and symbols don't belong in a code.
  }
}

/**
 * Typing that didn't come through keydown: phone keyboards (which report "Unidentified" keys),
 * autofill of the whole code, dictation.
 */
function onInput(index: number, event: Event): void {
  const input = event.target as HTMLInputElement;
  const previous = cells.value[index] ?? '';
  let digits = input.value.replace(/\D/g, '');
  // A digit typed into a full box arrives as old + new.
  if (previous && digits.length === 2 && digits.includes(previous)) {
    digits = digits.replace(previous, '');
  }
  input.value = previous;
  if (!digits) {
    const next = [...cells.value];
    next[index] = '';
    commit(next);
    return;
  }
  fill(digits.length >= props.length ? 0 : index, digits);
}

function onPaste(index: number, event: ClipboardEvent): void {
  event.preventDefault();
  const digits = (event.clipboardData?.getData('text') ?? '').replace(/\D/g, '');
  if (!digits) return;
  fill(digits.length >= props.length ? 0 : index, digits);
}

function setBox(el: unknown, index: number): void {
  if (el instanceof HTMLInputElement) boxes.value[index] = el;
}

/** Focuses the first empty box (or the last one). */
function focus(): void {
  const empty = cells.value.findIndex((digit) => !digit);
  focusBox(empty === -1 ? props.length - 1 : empty);
}

defineExpose({ focus });
</script>

<template>
  <div
    class="otp"
    role="group"
    :aria-label="label"
    :aria-describedby="describedBy"
    :style="{ '--otp-length': length }"
  >
    <input
      v-for="(digit, index) in cells"
      :key="index"
      :ref="(el) => setBox(el, index)"
      class="otp-box num"
      type="text"
      inputmode="numeric"
      pattern="[0-9]*"
      :autocomplete="index === 0 ? 'one-time-code' : 'off'"
      :aria-label="`Digit ${index + 1} of ${length}`"
      :aria-invalid="invalid ? 'true' : undefined"
      :disabled="disabled"
      :value="digit"
      @keydown="onKeydown(index, $event)"
      @input="onInput(index, $event)"
      @paste="onPaste(index, $event)"
      @focus="($event.target as HTMLInputElement).select()"
    />
  </div>
</template>

<style scoped>
.otp {
  display: grid;
  grid-template-columns: repeat(var(--otp-length), minmax(0, 1fr));
  gap: 8px;
}
.otp-box {
  width: 100%;
  min-width: 0;
  height: 60px;
  border: 1.5px solid var(--line-2);
  border-radius: var(--radius-lg);
  background: #fff;
  text-align: center;
  font-family: var(--f-head);
  font-size: 26px;
  font-weight: 800;
  color: var(--ink);
  caret-color: var(--coral);
  padding: 0;
}
.otp-box:focus {
  outline: none;
  border-color: var(--coral);
  box-shadow: 0 0 0 4px rgba(255, 90, 60, 0.16);
}
.otp-box[aria-invalid='true'] {
  border-color: var(--rose-i);
}
.otp-box:disabled {
  opacity: 0.6;
}
@media (max-width: 360px) {
  .otp {
    gap: 6px;
  }
  .otp-box {
    height: 52px;
    font-size: 22px;
  }
}
</style>

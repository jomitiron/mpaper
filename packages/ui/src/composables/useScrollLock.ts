import { onBeforeUnmount, watch, type Ref } from 'vue';

/** Stops the page behind an open overlay from scrolling. Counts nested overlays. */

let locks = 0;
let previous = '';

function lock() {
  if (locks === 0) {
    previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  locks += 1;
}

function unlock() {
  locks = Math.max(0, locks - 1);
  if (locks === 0) document.body.style.overflow = previous;
}

export function useScrollLock(active: Ref<boolean>): void {
  let held = false;
  const set = (on: boolean) => {
    if (on && !held) lock();
    if (!on && held) unlock();
    held = on;
  };
  watch(active, set, { immediate: true });
  onBeforeUnmount(() => set(false));
}

import { nextTick, onBeforeUnmount, watch, type Ref } from 'vue';

/**
 * Keeps keyboard focus inside a dialog while it's open:
 * moves focus in on open, wraps Tab and Shift+Tab, pulls stray focus back, closes on Escape and
 * returns focus to whatever had it before. Only the top-most open trap reacts, so a modal over a
 * sheet behaves.
 */

export interface FocusTrapOptions {
  /** Whether the trap is on. */
  active: Ref<boolean>;
  onEscape?: () => void;
  /** CSS selector (inside the container) for the element to focus first. */
  initialFocus?: () => string | undefined;
}

const FOCUSABLE = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Focusable elements inside `root`, in tab order. Layout-free so it works in tests too. */
export function focusableWithin(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.closest('[hidden], [inert], [aria-hidden="true"]') && el.tabIndex >= 0,
  );
}

interface Trap {
  container: () => HTMLElement | null;
  onEscape?: () => void;
}

const stack: Trap[] = [];

function topTrap(): Trap | undefined {
  return stack[stack.length - 1];
}

function onKeydown(event: KeyboardEvent): void {
  const trap = topTrap();
  const container = trap?.container();
  if (!trap || !container) return;

  if (event.key === 'Escape' && trap.onEscape) {
    event.preventDefault();
    event.stopPropagation();
    trap.onEscape();
    return;
  }
  if (event.key !== 'Tab') return;

  const focusable = focusableWithin(container);
  if (focusable.length === 0) {
    event.preventDefault();
    container.focus();
    return;
  }
  const first = focusable[0]!;
  const last = focusable[focusable.length - 1]!;
  const active = document.activeElement;
  if (event.shiftKey && (active === first || active === container || !container.contains(active))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || !container.contains(active))) {
    event.preventDefault();
    first.focus();
  }
}

function onFocusIn(event: FocusEvent): void {
  const container = topTrap()?.container();
  if (!container || !(event.target instanceof Node) || container.contains(event.target)) return;
  (focusableWithin(container)[0] ?? container).focus();
}

function listen(on: boolean): void {
  if (on) {
    document.addEventListener('keydown', onKeydown, true);
    document.addEventListener('focusin', onFocusIn, true);
  } else {
    document.removeEventListener('keydown', onKeydown, true);
    document.removeEventListener('focusin', onFocusIn, true);
  }
}

export function useFocusTrap(container: Ref<HTMLElement | null>, options: FocusTrapOptions): void {
  const trap: Trap = { container: () => container.value, onEscape: options.onEscape };
  let returnTo: HTMLElement | null = null;

  async function activate() {
    returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!stack.includes(trap)) {
      if (stack.length === 0) listen(true);
      stack.push(trap);
    }
    await nextTick();
    const el = container.value;
    if (!el) return;
    const selector = options.initialFocus?.();
    const target =
      (selector ? el.querySelector<HTMLElement>(selector) : null) ?? focusableWithin(el)[0] ?? el;
    target.focus();
  }

  function deactivate() {
    const index = stack.indexOf(trap);
    if (index === -1) return;
    stack.splice(index, 1);
    if (stack.length === 0) listen(false);
    if (returnTo && document.contains(returnTo)) returnTo.focus();
    returnTo = null;
  }

  watch(
    options.active,
    (on) => {
      if (on) void activate();
      else deactivate();
    },
    { immediate: true },
  );
  onBeforeUnmount(deactivate);
}

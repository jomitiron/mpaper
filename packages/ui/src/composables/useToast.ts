import { computed, shallowReactive } from 'vue';

/**
 * Toast queue. Toasts show one at a time at the bottom of the screen, oldest first.
 * `useToast()` returns the app-wide queue rendered by <ToastHost />.
 */

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastOptions {
  tone?: ToastTone;
  /** How long it stays, in ms. Defaults: 3.2 s, or 5 s for errors. */
  duration?: number;
}

export interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
  duration: number;
}

export type ToastQueue = ReturnType<typeof createToastQueue>;

export function createToastQueue() {
  const items = shallowReactive<ToastItem[]>([]);
  let nextId = 1;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function start() {
    clearTimeout(timer);
    const head = items[0];
    if (head) timer = setTimeout(() => dismiss(head.id), head.duration);
  }

  function show(message: string, options: ToastOptions = {}): number {
    const tone = options.tone ?? 'success';
    // The same message twice in a row (say, two failed queries) shows once.
    const last = items[items.length - 1];
    if (last && last.message === message && last.tone === tone) return last.id;
    const item: ToastItem = {
      id: nextId++,
      message,
      tone,
      duration: options.duration ?? (tone === 'error' ? 5000 : 3200),
    };
    items.push(item);
    if (items.length === 1) start();
    return item.id;
  }

  function dismiss(id: number): void {
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) return;
    items.splice(index, 1);
    if (index === 0) start();
  }

  function clear(): void {
    clearTimeout(timer);
    items.splice(0, items.length);
  }

  return {
    items,
    current: computed(() => items[0] ?? null),
    show,
    success: (message: string, options: Omit<ToastOptions, 'tone'> = {}) =>
      show(message, { ...options, tone: 'success' }),
    error: (message: string, options: Omit<ToastOptions, 'tone'> = {}) =>
      show(message, { ...options, tone: 'error' }),
    info: (message: string, options: Omit<ToastOptions, 'tone'> = {}) =>
      show(message, { ...options, tone: 'info' }),
    dismiss,
    clear,
  };
}

const appToasts = createToastQueue();

export function useToast(): ToastQueue {
  return appToasts;
}

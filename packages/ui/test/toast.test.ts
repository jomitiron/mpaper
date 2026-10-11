import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import ToastHost from '../src/components/ToastHost.vue';
import { createToastQueue } from '../src/composables/useToast';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('toast queue', () => {
  it('shows one toast at a time, in order', () => {
    const toasts = createToastQueue();
    toasts.success('Profile saved.');
    toasts.info('A new code is on its way.');
    expect(toasts.current.value?.message).toBe('Profile saved.');
    vi.advanceTimersByTime(3200);
    expect(toasts.current.value?.message).toBe('A new code is on its way.');
    vi.advanceTimersByTime(3200);
    expect(toasts.current.value).toBeNull();
  });

  it('keeps errors up longer', () => {
    const toasts = createToastQueue();
    toasts.error("We can't reach MotoPapers right now.");
    vi.advanceTimersByTime(3200);
    expect(toasts.current.value).not.toBeNull();
    vi.advanceTimersByTime(1800);
    expect(toasts.current.value).toBeNull();
  });

  it('shows the same message twice in a row only once', () => {
    const toasts = createToastQueue();
    const first = toasts.error('Offline');
    const second = toasts.error('Offline');
    expect(second).toBe(first);
    expect(toasts.items).toHaveLength(1);
  });

  it('can dismiss the current toast early', () => {
    const toasts = createToastQueue();
    const id = toasts.success('One');
    toasts.success('Two');
    toasts.dismiss(id);
    expect(toasts.current.value?.message).toBe('Two');
    vi.advanceTimersByTime(3199);
    expect(toasts.current.value?.message).toBe('Two');
  });
});

describe('ToastHost', () => {
  it('renders the current toast in a polite live region', async () => {
    const queue = createToastQueue();
    const wrapper = mount(ToastHost, { props: { queue } });
    const region = wrapper.get('[role="status"]');
    expect(region.attributes('aria-live')).toBe('polite');
    queue.error('Payment failed.');
    await nextTick();
    expect(wrapper.get('.toast').classes()).toContain('toast-error');
    expect(wrapper.text()).toContain('Payment failed.');
  });
});

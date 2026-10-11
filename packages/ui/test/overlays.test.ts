import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import Modal from '../src/components/Modal.vue';
import Sheet from '../src/components/Sheet.vue';

function press(key: string, shiftKey = false) {
  (document.activeElement ?? document.body).dispatchEvent(
    new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true }),
  );
}

const active = () => (document.activeElement as HTMLElement | null)?.id;

/** A page with a trigger button and a sheet holding three focusable elements. */
function sheetHarness() {
  const open = ref(false);
  const Harness = defineComponent(
    () => () =>
      h('div', [
        h('button', { id: 'trigger', onClick: () => (open.value = true) }, 'Open'),
        h(
          Sheet,
          {
            open: open.value,
            'onUpdate:open': (v: boolean) => (open.value = v),
            label: 'Car details',
          },
          {
            default: () => [
              h('button', { id: 'first' }, 'Close'),
              h('a', { id: 'middle', href: '#' }, 'Link'),
              h('button', { id: 'last' }, 'Delete car'),
            ],
          },
        ),
      ]),
  );
  return { open, wrapper: mount(Harness, { attachTo: document.body }) };
}

async function openFromTrigger() {
  const trigger = document.getElementById('trigger')!;
  trigger.focus();
  trigger.click();
  await flushPromises();
}

afterEach(() => {
  document.body.innerHTML = '';
  document.body.style.overflow = '';
});

describe('Sheet', () => {
  it('is a labelled modal dialog', async () => {
    const { wrapper } = sheetHarness();
    await openFromTrigger();
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toBe('Car details');
    wrapper.unmount();
  });

  it('moves focus into the sheet when it opens', async () => {
    const { wrapper } = sheetHarness();
    await openFromTrigger();
    expect(active()).toBe('first');
    wrapper.unmount();
  });

  it('wraps Tab from the last element to the first, and Shift+Tab back', async () => {
    const { wrapper } = sheetHarness();
    await openFromTrigger();
    document.getElementById('last')!.focus();
    press('Tab');
    expect(active()).toBe('first');
    press('Tab', true);
    expect(active()).toBe('last');
    wrapper.unmount();
  });

  it('pulls focus back in if it escapes', async () => {
    const { wrapper } = sheetHarness();
    await openFromTrigger();
    document.getElementById('trigger')!.focus();
    expect(active()).toBe('first');
    wrapper.unmount();
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const { open, wrapper } = sheetHarness();
    await openFromTrigger();
    press('Escape');
    await flushPromises();
    expect(open.value).toBe(false);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(active()).toBe('trigger');
    wrapper.unmount();
  });

  it('closes when the scrim is clicked', async () => {
    const { open, wrapper } = sheetHarness();
    await openFromTrigger();
    (document.querySelector('.scrim') as HTMLElement).click();
    await flushPromises();
    expect(open.value).toBe(false);
    wrapper.unmount();
  });

  it('locks page scroll while open', async () => {
    const { open, wrapper } = sheetHarness();
    await openFromTrigger();
    expect(document.body.style.overflow).toBe('hidden');
    open.value = false;
    await flushPromises();
    expect(document.body.style.overflow).toBe('');
    wrapper.unmount();
  });
});

describe('Modal', () => {
  function modalHarness() {
    const open = ref(false);
    const Harness = defineComponent(
      () => () =>
        h('div', [
          h('button', { id: 'trigger', onClick: () => (open.value = true) }, 'Top up'),
          h(
            Modal,
            {
              open: open.value,
              'onUpdate:open': (v: boolean) => (open.value = v),
              title: 'Top up your wallet',
              initialFocus: '#amount',
            },
            {
              default: () => [h('input', { id: 'amount' }), h('button', { id: 'go' }, 'Continue')],
            },
          ),
        ]),
    );
    return { open, wrapper: mount(Harness, { attachTo: document.body }) };
  }

  it('is labelled by its title and focuses the chosen element', async () => {
    const { wrapper } = modalHarness();
    await openFromTrigger();
    const dialog = document.querySelector('[role="dialog"]')!;
    const title = document.getElementById(dialog.getAttribute('aria-labelledby')!);
    expect(title?.textContent).toBe('Top up your wallet');
    expect(active()).toBe('amount');
    wrapper.unmount();
  });

  it('traps Tab between the close button and the last control', async () => {
    const { wrapper } = modalHarness();
    await openFromTrigger();
    document.getElementById('go')!.focus();
    press('Tab');
    expect((document.activeElement as HTMLElement).getAttribute('aria-label')).toBe('Close');
    press('Tab', true);
    expect(active()).toBe('go');
    wrapper.unmount();
  });

  it('closes from the close button and returns focus', async () => {
    const { open, wrapper } = modalHarness();
    await openFromTrigger();
    (document.querySelector('[aria-label="Close"]') as HTMLElement).click();
    await flushPromises();
    expect(open.value).toBe(false);
    expect(active()).toBe('trigger');
    wrapper.unmount();
  });

  it('closes on a click outside the card but not inside it', async () => {
    const { open, wrapper } = modalHarness();
    await openFromTrigger();
    (document.querySelector('.modal-card') as HTMLElement).click();
    await flushPromises();
    expect(open.value).toBe(true);
    (document.querySelector('.modal') as HTMLElement).click();
    await flushPromises();
    expect(open.value).toBe(false);
    wrapper.unmount();
  });

  it('over a sheet, Escape closes only the modal', async () => {
    const sheetOpen = ref(true);
    const modalOpen = ref(false);
    const Harness = defineComponent(
      () => () =>
        h(
          Sheet,
          {
            open: sheetOpen.value,
            'onUpdate:open': (v: boolean) => (sheetOpen.value = v),
            label: 'Car',
          },
          {
            default: () => [
              h('button', { id: 'delete', onClick: () => (modalOpen.value = true) }, 'Delete'),
              h(
                Modal,
                {
                  open: modalOpen.value,
                  'onUpdate:open': (v: boolean) => (modalOpen.value = v),
                  title: 'Delete KJA 731 AE?',
                },
                { default: () => h('button', { id: 'confirm' }, 'Delete') },
              ),
            ],
          },
        ),
    );
    const wrapper = mount(Harness, { attachTo: document.body });
    await flushPromises();
    document.getElementById('delete')!.click();
    await flushPromises();
    press('Escape');
    await flushPromises();
    expect(modalOpen.value).toBe(false);
    expect(sheetOpen.value).toBe(true);
    expect(active()).toBe('delete');
    wrapper.unmount();
  });
});

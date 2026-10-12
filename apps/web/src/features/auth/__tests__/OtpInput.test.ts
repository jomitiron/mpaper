import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import OtpInput from '../components/OtpInput.vue';

function mountOtp(initial = '') {
  const wrapper = mount(OtpInput, {
    attachTo: document.body,
    props: {
      modelValue: initial,
      'onUpdate:modelValue': (value: string) => wrapper.setProps({ modelValue: value }),
    },
  });
  const boxes = () => wrapper.findAll<HTMLInputElement>('input');
  const values = () => boxes().map((box) => box.element.value);
  const focused = () => boxes().findIndex((box) => box.element === document.activeElement);
  const model = () => wrapper.props('modelValue');
  return { wrapper, boxes, values, focused, model };
}

function pasteEvent(text: string): Event {
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: { getData: () => text } });
  return event;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('OtpInput', () => {
  it('shows six labelled boxes in a named group', () => {
    const { wrapper, boxes } = mountOtp();
    expect(wrapper.get('[role="group"]').attributes('aria-label')).toBe('Verification code');
    expect(boxes()).toHaveLength(6);
    expect(boxes()[0]!.attributes()).toMatchObject({
      'aria-label': 'Digit 1 of 6',
      inputmode: 'numeric',
      autocomplete: 'one-time-code',
    });
  });

  it('moves along as digits are typed, and reports the full code', async () => {
    const { wrapper, boxes, values, focused, model } = mountOtp();
    boxes()[0]!.element.focus();
    for (const [index, digit] of [...'48291'].entries()) {
      await boxes()[index]!.trigger('keydown', { key: digit });
    }
    await nextTick();
    expect(values()).toEqual(['4', '8', '2', '9', '1', '']);
    expect(focused()).toBe(5);
    expect(model()).toBe('48291');
    expect(wrapper.emitted('complete')).toBeUndefined();

    await boxes()[5]!.trigger('keydown', { key: '3' });
    expect(model()).toBe('482913');
    expect(wrapper.emitted('complete')).toEqual([['482913']]);
  });

  it('ignores letters and symbols', async () => {
    const { boxes, model } = mountOtp();
    await boxes()[0]!.trigger('keydown', { key: 'a' });
    await boxes()[0]!.trigger('keydown', { key: '-' });
    expect(model()).toBe('');
  });

  it('clears the box with Backspace, then steps back to clear the one before', async () => {
    const { boxes, values, focused, model } = mountOtp('123');
    boxes()[2]!.element.focus();
    await boxes()[2]!.trigger('keydown', { key: 'Backspace' });
    expect(values()).toEqual(['1', '2', '', '', '', '']);
    expect(focused()).toBe(2);

    await boxes()[2]!.trigger('keydown', { key: 'Backspace' });
    await nextTick();
    expect(values()).toEqual(['1', '', '', '', '', '']);
    expect(focused()).toBe(1);
    expect(model()).toBe('1');
  });

  it('moves with the arrow keys', async () => {
    const { boxes, focused } = mountOtp('123456');
    boxes()[3]!.element.focus();
    await boxes()[3]!.trigger('keydown', { key: 'ArrowLeft' });
    expect(focused()).toBe(2);
    await boxes()[2]!.trigger('keydown', { key: 'ArrowRight' });
    expect(focused()).toBe(3);
    await boxes()[3]!.trigger('keydown', { key: 'Home' });
    expect(focused()).toBe(0);
  });

  it('fills every box from a pasted code, whatever box it lands in', async () => {
    const { wrapper, boxes, values, focused } = mountOtp();
    boxes()[3]!.element.dispatchEvent(pasteEvent('Your MotoPapers code: 482 913'));
    await nextTick();
    expect(values()).toEqual(['4', '8', '2', '9', '1', '3']);
    expect(focused()).toBe(5);
    expect(wrapper.emitted('complete')).toEqual([['482913']]);
  });

  it('fills from the current box when part of a code is pasted', async () => {
    const { boxes, values, focused } = mountOtp('12');
    boxes()[2]!.element.dispatchEvent(pasteEvent('34'));
    await nextTick();
    expect(values()).toEqual(['1', '2', '3', '4', '', '']);
    expect(focused()).toBe(4);
  });

  it('takes digits from phone keyboards and autofill (input events)', async () => {
    const { wrapper, boxes, values } = mountOtp();
    await boxes()[0]!.setValue('7');
    expect(values()[0]).toBe('7');

    // A digit typed into a full box arrives as old + new.
    await boxes()[0]!.setValue('75');
    expect(values()[0]).toBe('5');

    // iOS puts the whole code from Messages into the first box.
    await boxes()[0]!.setValue('482913');
    await nextTick();
    expect(values()).toEqual(['4', '8', '2', '9', '1', '3']);
    expect(wrapper.emitted('complete')).toEqual([['482913']]);
  });

  it('follows the parent when it clears the code', async () => {
    const { wrapper, values } = mountOtp('482913');
    await wrapper.setProps({ modelValue: '' });
    expect(values()).toEqual(['', '', '', '', '', '']);
  });

  it('marks every box when the code is wrong', () => {
    const wrapper = mount(OtpInput, { props: { invalid: true, describedBy: 'otp-error' } });
    expect(wrapper.get('[role="group"]').attributes('aria-describedby')).toBe('otp-error');
    expect(wrapper.findAll('[aria-invalid="true"]')).toHaveLength(6);
  });
});

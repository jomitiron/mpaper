import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import Chip from '../src/components/Chip.vue';
import Field from '../src/components/Field.vue';
import Input from '../src/components/Input.vue';
import SegmentedControl from '../src/components/SegmentedControl.vue';
import StatusPill from '../src/components/StatusPill.vue';
import Stepper from '../src/components/Stepper.vue';
import Switch from '../src/components/Switch.vue';
import Tile from '../src/components/Tile.vue';

describe('Field and Input', () => {
  function field(
    props: { label: string; hint?: string; error?: string },
    inputProps: { prefix?: string } = {},
  ) {
    const value = ref('');
    const wrapper = mount(
      defineComponent(
        () => () =>
          h(Field, props, {
            default: () =>
              h(Input, {
                modelValue: value.value,
                'onUpdate:modelValue': (v: string) => (value.value = v),
                type: 'email',
                ...inputProps,
              }),
          }),
      ),
    );
    return { value, wrapper };
  }

  it('labels the input', () => {
    const { wrapper } = field({ label: 'Email' });
    const input = wrapper.get('input');
    expect(wrapper.get('label').attributes('for')).toBe(input.attributes('id'));
    expect(input.attributes('type')).toBe('email');
  });

  it('describes the input with the error then the hint, and marks it invalid', () => {
    const { wrapper } = field({
      label: 'Password',
      hint: 'At least 8 characters, including a number.',
      error: 'Add a number to your password.',
    });
    const input = wrapper.get('input');
    const ids = input.attributes('aria-describedby')!.split(' ');
    expect(ids.map((id) => wrapper.get(`[id="${id}"]`).text())).toEqual([
      'Add a number to your password.',
      'At least 8 characters, including a number.',
    ]);
    expect(input.attributes('aria-invalid')).toBe('true');
  });

  it('is not marked invalid without an error', () => {
    const { wrapper } = field({ label: 'Email' });
    expect(wrapper.get('input').attributes('aria-invalid')).toBeUndefined();
    expect(wrapper.get('input').attributes('aria-describedby')).toBeUndefined();
  });

  it('updates v-model', async () => {
    const { value, wrapper } = field({ label: 'Email' });
    await wrapper.get('input').setValue('ada.okafor@example.com');
    expect(value.value).toBe('ada.okafor@example.com');
  });

  it('shows a prefix', () => {
    const { wrapper } = field({ label: 'Phone number' }, { prefix: '+234' });
    expect(wrapper.get('.inp-wrap .inp-pre').text()).toBe('+234');
  });
});

describe('Switch', () => {
  it('is a named switch that toggles', async () => {
    const wrapper = mount(Switch, { props: { label: 'Email reminders', modelValue: false } });
    const input = wrapper.get('input');
    expect(input.attributes('role')).toBe('switch');
    expect(input.attributes('aria-label')).toBe('Email reminders');
    await input.setValue(true);
    expect(wrapper.emitted('update:modelValue')).toEqual([[true]]);
  });
});

describe('Chip', () => {
  it('has no pressed state unless given one', () => {
    expect(mount(Chip).get('button').attributes('aria-pressed')).toBeUndefined();
  });

  it('toggles a pressed state and shows a count', async () => {
    const wrapper = mount(Chip, {
      props: { pressed: false, count: 3 },
      slots: { default: 'Needs attention' },
    });
    expect(wrapper.get('button').attributes('aria-pressed')).toBe('false');
    expect(wrapper.get('.cnt').text()).toBe('3');
    await wrapper.get('button').trigger('click');
    expect(wrapper.emitted('update:pressed')).toEqual([[true]]);
  });
});

describe('SegmentedControl', () => {
  it('marks the selected option and selects on click', async () => {
    const wrapper = mount(SegmentedControl, {
      props: {
        label: 'Cover type',
        modelValue: 'third_party',
        options: [
          { value: 'third_party', label: 'Third party' },
          { value: 'comprehensive', label: 'Comprehensive' },
        ],
      },
    });
    expect(wrapper.get('[role="group"]').attributes('aria-label')).toBe('Cover type');
    const [third, comp] = wrapper.findAll('button');
    expect(third!.attributes('aria-pressed')).toBe('true');
    expect(comp!.attributes('aria-pressed')).toBe('false');
    await comp!.trigger('click');
    expect(wrapper.emitted('update:modelValue')).toEqual([['comprehensive']]);
  });
});

describe('Stepper', () => {
  const steps = [
    { title: 'Upload licence', hint: 'Photo or PDF' },
    { title: 'Check details', hint: 'What we read' },
    { title: 'Other papers' },
  ];

  it('marks done steps and the current one', () => {
    const wrapper = mount(Stepper, { props: { steps, current: 1 } });
    const items = wrapper.findAll('li');
    expect(items[0]!.classes()).toContain('done');
    expect(items[1]!.attributes('aria-current')).toBe('step');
    expect(items[2]!.attributes('aria-current')).toBeUndefined();
    expect(wrapper.get('ol').attributes('style')).toContain('--steps: 3');
  });

  it('lets you go back to a done step when clickable', async () => {
    const wrapper = mount(Stepper, { props: { steps, current: 2, clickable: true } });
    const buttons = wrapper.findAll('button');
    expect(buttons).toHaveLength(2);
    await buttons[0]!.trigger('click');
    expect(wrapper.emitted('select')).toEqual([[0]]);
  });

  it('draws bars for sign-up', () => {
    const wrapper = mount(Stepper, { props: { steps, current: 0, variant: 'bars' } });
    expect(wrapper.get('ol').classes()).toContain('su-steps');
    expect(wrapper.find('.n').exists()).toBe(false);
  });
});

describe('StatusPill and Tile', () => {
  it('colours the pill by tone', () => {
    const wrapper = mount(StatusPill, { props: { tone: 'bad' }, slots: { default: 'Expired' } });
    expect(wrapper.classes()).toEqual(['st', 'st-bad']);
  });

  it('colours a tile by paper, or rose when expired', () => {
    const licence = mount(Tile, { props: { paper: 'vehicle_license', label: 'Licence' } });
    expect(licence.classes()).toContain('d-licence');
    const insurance = mount(Tile, {
      props: { paper: 'insurance', label: 'Insurance', value: 9, unit: 'days', pill: 'Renew soon' },
    });
    expect(insurance.classes()).toContain('d-insurance');
    expect(insurance.get('.n').text()).toBe('9days');
    expect(insurance.get('.pill').text()).toBe('Renew soon');
    const expired = mount(Tile, {
      props: { paper: 'roadworthiness', label: 'Road', tone: 'expired' },
    });
    expect(expired.classes()).toContain('d-expired');
  });
});

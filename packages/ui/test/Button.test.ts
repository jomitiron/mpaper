import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import Button, { type ButtonSize, type ButtonVariant } from '../src/components/Button.vue';

type ButtonProps = { variant?: ButtonVariant; size?: ButtonSize; block?: boolean };

describe('Button', () => {
  it('is a coral, medium, type="button" button by default', () => {
    const wrapper = mount(Button, { slots: { default: 'Add a car' } });
    const button = wrapper.get('button');
    expect(button.classes()).toEqual(['btn', 'btn-coral']);
    expect(button.attributes('type')).toBe('button');
    expect(button.text()).toBe('Add a car');
  });

  it.each<[ButtonProps, string]>([
    [{ variant: 'night' }, 'btn-night'],
    [{ variant: 'white' }, 'btn-white'],
    [{ variant: 'soft' }, 'btn-soft'],
    [{ variant: 'quiet' }, 'btn-quiet'],
    [{ size: 'sm' }, 'btn-sm'],
    [{ size: 'lg' }, 'btn-lg'],
    [{ block: true }, 'btn-block'],
  ])('%o adds %s', (props, cls) => {
    expect(mount(Button, { props }).get('button').classes()).toContain(cls);
  });

  it('emits click', async () => {
    const wrapper = mount(Button);
    await wrapper.get('button').trigger('click');
    expect(wrapper.emitted('click')).toHaveLength(1);
  });

  it('while loading: shows a spinner, stays focusable, announces busy and ignores clicks', async () => {
    const wrapper = mount(Button, { props: { loading: true }, slots: { default: 'Save' } });
    const button = wrapper.get('button');
    expect(button.find('.spin').exists()).toBe(true);
    expect(button.attributes('aria-busy')).toBe('true');
    expect(button.attributes('aria-disabled')).toBe('true');
    expect(button.attributes('disabled')).toBeUndefined();
    expect(button.text()).toBe('Save');
    await button.trigger('click');
    expect(wrapper.emitted('click')).toBeUndefined();
  });

  it('when disabled: is disabled and ignores clicks', async () => {
    const wrapper = mount(Button, { props: { disabled: true } });
    const button = wrapper.get('button');
    expect(button.attributes('disabled')).toBeDefined();
    await button.trigger('click');
    expect(wrapper.emitted('click')).toBeUndefined();
  });

  it('submits forms when asked', () => {
    expect(
      mount(Button, { props: { type: 'submit' } })
        .get('button')
        .attributes('type'),
    ).toBe('submit');
  });

  it('renders a router link with `to`', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/:any(.*)*', component: { render: () => null } }],
    });
    const wrapper = mount(Button, {
      props: { to: '/cars/new', variant: 'white' },
      slots: { default: 'Add a car' },
      global: { plugins: [router] },
    });
    await router.isReady();
    const link = wrapper.get('a');
    expect(link.attributes('href')).toBe('/cars/new');
    expect(link.classes()).toContain('btn-white');
  });

  it('renders a plain link with `href`', () => {
    const wrapper = mount(Button, { props: { href: 'https://paystack.com' } });
    expect(wrapper.get('a').attributes('href')).toBe('https://paystack.com');
  });
});

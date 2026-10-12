import { configureApi, HttpError, request } from '@motopapers/api';
import { useToast } from '@motopapers/ui';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createMemoryHistory } from 'vue-router';
import App from '@/App.vue';
import { setupApi } from '@/lib/api';
import { createQueryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queries';
import { createAppRouter } from '@/router';
import { useSessionStore } from '@/stores/session';
import { ADA, tokenExpiringIn } from './helpers';

let pinia: Pinia;

beforeEach(() => {
  pinia = createPinia();
  setActivePinia(pinia);
  sessionStorage.clear();
  useToast().clear();
});

afterEach(() => {
  document.body.innerHTML = '';
});

async function mountApp(path: string, queryClient = new QueryClient()) {
  const router = createAppRouter(createMemoryHistory());
  await router.push(path);
  const wrapper = mount(App, {
    attachTo: document.body,
    global: { plugins: [pinia, router, [VueQueryPlugin, { queryClient }]] },
  });
  await flushPromises();
  return { wrapper, router };
}

describe('app shell', () => {
  beforeEach(() => {
    useSessionStore().setSession({ token: tokenExpiringIn(600), user: ADA });
  });

  it('shows the four sections in the sidebar, with the current one marked', async () => {
    const { wrapper } = await mountApp('/payments');
    const nav = wrapper.get('.side nav[aria-label="Main"]');
    const links = nav.findAll('a');
    expect(links.map((a) => a.text())).toEqual(['Home', 'My cars', 'Payments', 'Settings']);
    expect(links.map((a) => a.attributes('href'))).toEqual([
      '/',
      '/cars',
      '/payments',
      '/settings',
    ]);
    expect(nav.get('[aria-current="page"]').text()).toBe('Payments');
    expect(wrapper.get('h1').text()).toBe('Payments');
    expect(wrapper.text()).toContain('Coming in phase 3');
  });

  it('marks My cars while adding a car', async () => {
    const { wrapper } = await mountApp('/cars/new');
    expect(wrapper.get('.side [aria-current="page"]').text()).toBe('My cars');
    expect(wrapper.get('.tabbar [aria-current="page"]').attributes('aria-label')).toBe('Add a car');
  });

  it('has a phone tab bar with the coral add button', async () => {
    const { wrapper } = await mountApp('/');
    const tabs = wrapper.get('.tabbar').findAll('a');
    expect(tabs.map((a) => a.attributes('aria-label') ?? a.text())).toEqual([
      'Home',
      'My cars',
      'Add a car',
      'Payments',
      'Settings',
    ]);
    expect(wrapper.get('.tab-add').attributes('href')).toBe('/cars/new');
  });

  it('greets the driver and shows who is signed in', async () => {
    const { wrapper } = await mountApp('/');
    expect(wrapper.get('h1').text()).toBe('Hi Ada');
    expect(wrapper.get('.side-user').text()).toContain('Ada Okafor');
    expect(wrapper.get('.side-user .avatar').text()).toBe('AO');
  });

  it('counts cars needing attention on the My cars link', async () => {
    const queryClient = new QueryClient();
    const soon = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
    const later = new Date(Date.now() + 200 * 86_400_000).toISOString().slice(0, 10);
    queryClient.setQueryData(queryKeys.vehicles, [
      { id: 1, insurance: { expiry_date: soon } },
      { id: 2, insurance: { expiry_date: later } },
    ]);
    const { wrapper } = await mountApp('/settings', queryClient);
    expect(wrapper.get('.side .badge').text()).toBe('1 need attention');
  });

  it('opens the car panel as a sheet over My cars', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(queryKeys.vehicles, [
      { id: 12, plate_number: 'KJA 731 AE', brand: 'Toyota', model: 'Camry', color: 'Silver' },
    ]);
    const { router } = await mountApp('/cars/12', queryClient);
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('Toyota Camry');
    (document.querySelector('[aria-label="Close car details"]') as HTMLElement).click();
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/cars');
  });

  it('signs out from the sidebar', async () => {
    const { wrapper, router } = await mountApp('/');
    await wrapper.get('button[aria-label="Sign out"]').trigger('click');
    expect(useSessionStore().isSignedIn).toBe(false);
    // The sign-in page loads lazily.
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/sign-in'));
  });

  it('shows the 404 page for unknown addresses', async () => {
    const { wrapper } = await mountApp('/no-such-page');
    expect(wrapper.get('h1').text()).toBe('Page not found');
    expect(wrapper.find('.side').exists()).toBe(false);
  });
});

describe('401 handling', () => {
  it('signs the driver out and sends them to sign in with next', async () => {
    const session = useSessionStore();
    session.setSession({ token: tokenExpiringIn(600), user: ADA });
    const router = createAppRouter(createMemoryHistory());
    await router.push('/cars?filter=attention');
    setupApi({ router, session });
    configureApi({
      fetch: vi.fn<typeof fetch>(async () =>
        Response.json({ message: 'Unauthorized' }, { status: 401 }),
      ),
    });

    await expect(request('/vehicles', { schema: z.unknown() })).rejects.toBeInstanceOf(HttpError);
    await flushPromises();

    expect(session.isSignedIn).toBe(false);
    expect(router.currentRoute.value.path).toBe('/sign-in');
    expect(router.currentRoute.value.query.next).toBe('/cars?filter=attention');
    expect(useToast().current.value?.message).toBe(
      'Your session ended. Sign in again to carry on.',
    );
  });
});

describe('query errors', () => {
  it('toasts a failed query in plain language, unless it is silent or a 401', async () => {
    const toast = useToast();
    const client = createQueryClient(toast);
    await client
      .fetchQuery({
        queryKey: ['a'],
        queryFn: () => Promise.reject(new HttpError(400, 'Vehicle does not exist', {})),
        retry: false,
      })
      .catch(() => {});
    expect(toast.current.value?.message).toBe('Vehicle does not exist');
    toast.clear();
    await client
      .fetchQuery({
        queryKey: ['b'],
        queryFn: () => Promise.reject(new HttpError(401, 'Unauthorized', {})),
        retry: false,
      })
      .catch(() => {});
    await client
      .fetchQuery({
        queryKey: ['c'],
        queryFn: () => Promise.reject(new Error('x')),
        retry: false,
        meta: { silent: true },
      })
      .catch(() => {});
    expect(toast.current.value).toBeNull();
  });

  it('does not retry a 4xx', () => {
    const retry = createQueryClient().getDefaultOptions().queries?.retry as (
      n: number,
      e: unknown,
    ) => boolean;
    expect(retry(0, new HttpError(404, 'Not found', {}))).toBe(false);
    expect(retry(0, new HttpError(503, 'Down', {}))).toBe(true);
    expect(retry(2, new HttpError(503, 'Down', {}))).toBe(false);
  });
});

import { configureApi } from '@motopapers/api';
import {
  createHandlers,
  createMockDb,
  createMockToken,
  SAMPLE_EMAIL,
  type MockDb,
} from '@motopapers/api/mocks';
import { useToast } from '@motopapers/ui';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { setupServer } from 'msw/node';
import { createPinia, setActivePinia } from 'pinia';
import { afterAll, afterEach, beforeAll, beforeEach, expect, vi } from 'vitest';
import { createMemoryHistory, type Router } from 'vue-router';
import App from '@/App.vue';
import { flags } from '@/env';
import { createAppRouter } from '@/router';
import { useSessionStore } from '@/stores/session';
import { navigation } from '../lib/checkout';

/** Mounts the app against the mock API (MSW), signed in as Ada, for Payments' page tests. */

export const BASE = 'https://api.test';
export const APP = 'http://localhost:3000';
export const server = setupServer();

type Flags = { -readonly [K in keyof typeof flags]: boolean };
export const testFlags = flags as Flags;

export const harness = {
  db: null as unknown as MockDb,
  /** Every address the app tried to leave for (Paystack). */
  left: [] as string[],
};

export function useHarness(options: { flags?: Partial<Flags> } = {}) {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterAll(() => server.close());
  afterEach(() => {
    server.resetHandlers();
    document.body.innerHTML = '';
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    // Today, for statuses and "this year". Only Date is faked, so requests run as normal.
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-12T09:00:00Z') });
    Object.assign(testFlags, {
      renewals: false,
      reminderSettings: false,
      txLabels: true,
      walletPay: true,
      verifyPayment: true,
      ...options.flags,
    });
    harness.db = createMockDb();
    server.use(
      ...createHandlers({
        baseUrl: BASE,
        db: harness.db,
        appOrigin: APP,
        transactionLabels: testFlags.txLabels,
      }),
    );
    setActivePinia(createPinia());
    sessionStorage.clear();
    useToast().clear();
    const account = ada();
    useSessionStore().setSession({
      token: createMockToken(account.user, Date.now()),
      user: harness.db.userView(account),
    });
    configureApi({
      baseUrl: BASE,
      getToken: () => useSessionStore().token,
      // jsdom's AbortSignal isn't one Node's fetch accepts; the browser has no such problem.
      fetch: (input, init) => globalThis.fetch(input, { ...init, signal: undefined }),
    });
    harness.left = [];
    vi.spyOn(navigation, 'assign').mockImplementation((url) => void harness.left.push(url));
  });
}

export function ada() {
  return harness.db.accountByEmail(SAMPLE_EMAIL)!;
}

export async function mountAt(path: string): Promise<{ wrapper: VueWrapper; router: Router }> {
  const router = createAppRouter(createMemoryHistory());
  await router.push(path);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = mount(App, {
    attachTo: document.body,
    global: { plugins: [router, [VueQueryPlugin, { queryClient }]] },
  });
  await settle();
  return { wrapper, router };
}

/** Lets requests, Vue Query and lazy routes finish. */
export async function settle() {
  for (let i = 0; i < 6; i += 1) {
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

export const body = () => document.body;
export const text = () => (body().textContent ?? '').replace(/\s+/g, ' ');

export function button(label: string | RegExp, root: ParentNode = body()): HTMLElement {
  const found = [...root.querySelectorAll<HTMLElement>('button, a')].find((el) => {
    const content = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    return typeof label === 'string' ? content.startsWith(label) : label.test(content);
  });
  if (!found) throw new Error(`No button "${label}"`);
  return found;
}

export async function click(label: string | RegExp, root?: ParentNode) {
  button(label, root).click();
  await settle();
}

export function field(label: string, root: ParentNode = body()): HTMLInputElement {
  const el = [...root.querySelectorAll('label')].find((l) =>
    l.textContent?.trim().startsWith(label),
  );
  if (!el) throw new Error(`No field "${label}"`);
  return document.getElementById(el.htmlFor) as HTMLInputElement;
}

export async function type(label: string, value: string, root?: ParentNode) {
  const input = field(label, root);
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await settle();
}

/** Add a car: read the sample licence and fill in the other papers, up to step 4. */
export async function addCarToReview() {
  const input = body().querySelector<HTMLInputElement>('input[type=file]')!;
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
  const file = new File([bytes], 'licence.jpg', { type: 'image/jpeg' });
  // jsdom's File has no arrayBuffer(); every browser does.
  Object.assign(file, { arrayBuffer: async () => bytes.buffer });
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new Event('change'));
  await vi.waitFor(() => expect(text()).toContain("Check your car's details"));
  await click('Continue');
  await type('Expiry date', '2027-04-18');
  await type('Certificate expiry date', '2027-01-09');
  await click('Continue');
  expect(text()).toContain('Review and start reminders');
}

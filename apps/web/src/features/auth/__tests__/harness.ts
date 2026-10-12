import { configureApi } from '@motopapers/api';
import { createHandlers, createMockDb, type MockDb } from '@motopapers/api/mocks';
import { useToast } from '@motopapers/ui';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises, mount, type DOMWrapper, type VueWrapper } from '@vue/test-utils';
import { setupServer } from 'msw/node';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { afterAll, afterEach, beforeAll, beforeEach, expect, vi } from 'vitest';
import { createMemoryHistory, type Router } from 'vue-router';
import App from '@/App.vue';
import { setupApi } from '@/lib/api';
import { createAppRouter } from '@/router';
import { useSessionStore } from '@/stores/session';

/**
 * Test harness for the auth pages: the mock API from packages/api behind MSW, a fresh Pinia, and
 * the whole app mounted at a path (router guards included).
 */

export const API = 'https://api.test';

// Node 25+ has its own localStorage global, empty unless started with --localstorage-file, and it
// hides jsdom's. Give the tests a working one (CI's Node 20 doesn't need it).
if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: memoryStorage(),
    configurable: true,
    writable: true,
  });
}

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, String(value)),
  };
}

export interface MockApi {
  readonly db: MockDb;
  readonly pinia: Pinia;
  server: ReturnType<typeof setupServer>;
  /** Requests the app sent, in order. */
  requests: Request[];
}

/** Call at the top of a test file. */
export function useMockApi(): MockApi {
  const server = setupServer();
  const state = {
    db: createMockDb({ storage: null }),
    pinia: createPinia(),
    server,
    requests: [] as Request[],
  };

  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
    server.events.on('request:start', ({ request }) => {
      state.requests.push(request.clone());
    });
  });
  beforeEach(() => {
    state.db = createMockDb({ storage: null });
    state.pinia = createPinia();
    state.requests = [];
    setActivePinia(state.pinia);
    sessionStorage.clear();
    localStorage.clear();
    useToast().clear();
    server.resetHandlers(
      ...createHandlers({ baseUrl: API, db: state.db, appOrigin: location.origin }),
    );
    const session = useSessionStore();
    configureApi({ baseUrl: API, getToken: () => session.token, onUnauthorized: () => {} });
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });
  afterAll(() => server.close());

  return state;
}

export async function mountApp(
  api: MockApi,
  path: string,
): Promise<{ wrapper: VueWrapper; router: Router }> {
  const router = createAppRouter(createMemoryHistory());
  const session = useSessionStore(api.pinia);
  setupApi({ router, session });
  configureApi({ baseUrl: API });
  await router.push(path);
  const wrapper = mount(App, {
    attachTo: document.body,
    global: {
      plugins: [api.pinia, router, [VueQueryPlugin, { queryClient: new QueryClient() }]],
    },
  });
  await settle();
  return { wrapper, router };
}

/** Lets requests, lazy pages and re-renders finish. */
export async function settle(): Promise<void> {
  for (let i = 0; i < 6; i++) {
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

/** Waits for a navigation (the first visit to a lazy page takes a moment to load). */
export async function waitForPath(router: Router, fullPath: string): Promise<void> {
  await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe(fullPath), {
    timeout: 3000,
  });
  await settle();
}

/** The control a visible label points at (fails if the label isn't wired to anything). */
export function field(
  wrapper: VueWrapper,
  label: string,
): Omit<DOMWrapper<HTMLInputElement>, 'exists'> {
  const element = wrapper
    .findAll('label')
    .find((node) => node.text().trim() === label)
    ?.attributes('for');
  if (!element) throw new Error(`No label "${label}"`);
  return wrapper.get<HTMLInputElement>(`[id="${element}"]`);
}

export function button(wrapper: VueWrapper, text: string): DOMWrapper<HTMLElement> {
  const found = wrapper
    .findAll<HTMLElement>('button, a')
    .find((node) => node.text().trim() === text);
  if (!found) throw new Error(`No button "${text}"`);
  return found;
}

/** Types a code into the six boxes, one key at a time. */
export async function typeCode(wrapper: VueWrapper, code: string): Promise<void> {
  const boxes = wrapper.findAll('.otp input');
  for (const [index, digit] of [...code].entries()) {
    await boxes[index]!.trigger('keydown', { key: digit });
  }
  await settle();
}

/** Toasts waiting to show. */
export function toasts(): string[] {
  return useToast().items.map((item) => item.message);
}

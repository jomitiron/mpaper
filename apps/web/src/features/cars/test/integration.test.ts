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
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { createPinia, setActivePinia } from 'pinia';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, type Router } from 'vue-router';
import App from '@/App.vue';
import { createAppRouter } from '@/router';
import { useSessionStore } from '@/stores/session';

/** Home, My cars, the car panel and Add a car against the mock API, end to end. */

const BASE = 'https://api.test';
let db: MockDb;
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
afterEach(() => {
  server.resetHandlers();
  document.body.innerHTML = '';
});

beforeEach(() => {
  db = createMockDb();
  server.use(...createHandlers({ baseUrl: BASE, db, transactionLabels: true }));
  setActivePinia(createPinia());
  sessionStorage.clear();
  useToast().clear();
  const account = db.accountByEmail(SAMPLE_EMAIL)!;
  const token = createMockToken(account.user, Date.now());
  useSessionStore().setSession({ token, user: db.userView(account) });
  configureApi({
    baseUrl: BASE,
    getToken: () => useSessionStore().token,
    // jsdom's AbortSignal isn't one Node's fetch accepts; the browser has no such problem.
    fetch: (input, init) => globalThis.fetch(input, { ...init, signal: undefined }),
  });
});

async function mountAt(path: string): Promise<{ wrapper: VueWrapper; router: Router }> {
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
async function settle() {
  for (let i = 0; i < 5; i += 1) {
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

const body = () => document.body;
const text = () => body().textContent ?? '';

function button(label: string, root: ParentNode = body()): HTMLElement {
  const found = [...root.querySelectorAll<HTMLElement>('button, a')].find((el) =>
    el.textContent?.trim().startsWith(label),
  );
  if (!found) throw new Error(`No button "${label}"`);
  return found;
}

function field(label: string, root: ParentNode = body()): HTMLInputElement {
  const el = [...root.querySelectorAll('label')].find((l) =>
    l.textContent?.trim().startsWith(label),
  );
  if (!el) throw new Error(`No field "${label}"`);
  return document.getElementById(el.htmlFor) as HTMLInputElement;
}

async function type(label: string, value: string, root?: ParentNode) {
  const input = field(label, root);
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await settle();
}

async function click(label: string, root?: ParentNode) {
  button(label, root).click();
  await settle();
}

async function uploadLicence() {
  const input = body().querySelector<HTMLInputElement>('input[type=file]')!;
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
  const file = new File([bytes], 'licence.jpg', { type: 'image/jpeg' });
  // jsdom's File has no arrayBuffer(); every browser does.
  Object.assign(file, { arrayBuffer: async () => bytes.buffer });
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new Event('change'));
  await vi.waitFor(() => expect(text()).toContain("Check your car's details"));
}

async function toReview() {
  await uploadLicence();
  await click('Continue');
  await type('Expiry date', '2027-04-18');
  await type('Certificate expiry date', '2027-01-09');
  await click('Continue');
  expect(text()).toContain('Review and start reminders');
}

const ktuCars = () => db.state.accounts[0]!.vehicles.filter((v) => v.plate_number === 'KTU 604 XR');

describe('Add a car', () => {
  it('reads a licence, saves the car and its papers, and shows it on My cars', async () => {
    const { router } = await mountAt('/cars/new');
    await uploadLicence();
    expect(field('Plate number').value).toBe('KTU 604 XR');
    expect(body().querySelectorAll('.read-tag')).toHaveLength(9);

    await click('Continue');
    expect(text()).toContain('Insurance and roadworthiness');
    await toReviewFromPapers();
    await click('Add car');
    await vi.waitFor(() => expect(text()).toContain('KTU 604 XR is all set'));

    const [saved] = ktuCars();
    expect(saved?.vehicle_licenses.at(-1)?.expiry_date).toBe('2027-03-02');
    expect(saved?.insurance.at(-1)).toMatchObject({ expiry_date: '2027-04-18' });
    expect(saved?.roadworthiness.at(-1)?.expiry_date).toBe('2027-01-09');

    await click('See my cars');
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/cars'));
    await settle();
    expect(text()).toContain('5 cars');
    expect(text()).toContain('Toyota Corolla');
  });

  it('keeps the car and retries only the paper that failed', async () => {
    await mountAt('/cars/new');
    await toReview();
    let fail = true;
    server.use(
      http.post(`${BASE}/vehicle/:id/insurance`, () => {
        if (!fail) return undefined;
        return HttpResponse.json(
          { status: 'error', message: 'Insurance is down' },
          { status: 400 },
        );
      }),
    );

    await click('Add car');
    await vi.waitFor(() =>
      expect(text()).toContain("Your car is added, but we couldn't save its insurance."),
    );
    expect(text()).not.toContain('Back');

    fail = false;
    await click('Try again');
    await vi.waitFor(() => expect(text()).toContain('KTU 604 XR is all set'));
    expect(ktuCars()).toHaveLength(1);
    expect(ktuCars()[0]!.insurance).toHaveLength(1);
    expect(ktuCars()[0]!.vehicle_licenses).toHaveLength(1);
  });

  it('lets the driver skip a paper that keeps failing', async () => {
    await mountAt('/cars/new');
    await toReview();
    server.use(
      http.post(`${BASE}/vehicle/:id/roadworthiness`, () =>
        HttpResponse.json({ status: 'error', message: 'Nope' }, { status: 400 }),
      ),
    );
    await click('Add car');
    await vi.waitFor(() => expect(text()).toContain('Skip, add it later'));
    await click('Skip, add it later');
    expect(text()).toContain('KTU 604 XR is all set');
    expect(text()).toContain('Add its roadworthiness from the car panel');
  });

  it('goes back to Check details when the API says the plate is taken', async () => {
    await mountAt('/cars/new');
    await toReview();
    // Someone added the same plate in another tab since the list loaded.
    db.state.accounts[0]!.vehicles.push({
      ...db.state.accounts[0]!.vehicles[0]!,
      id: 9999,
      plate_number: 'KTU 604 XR',
    });
    await click('Add car');
    await vi.waitFor(() => expect(text()).toContain("Check your car's details"));
    await vi.waitFor(() => expect(text()).toContain('KTU 604 XR is already on your account'));
  });

  it('warns about a plate already on the account as it is typed', async () => {
    await mountAt('/cars/new');
    await click('Enter details by hand');
    await type('Plate number', 'kja-731-ae');
    expect(text()).toContain('KJA 731 AE is already on your account (Toyota Camry).');
    await click('View it');
    expect(body().querySelector('.drawer h2')?.textContent).toBe('Toyota Camry');
  });
});

async function toReviewFromPapers() {
  await type('Expiry date', '2027-04-18');
  await type('Certificate expiry date', '2027-01-09');
  await click('Continue');
}

describe('Car panel', () => {
  it('records a renewed paper and shows the new days left', async () => {
    await mountAt('/cars/101');
    const drawer = body().querySelector('.drawer')!;
    expect(drawer.querySelector('h2')?.textContent).toBe('Toyota Camry');
    await click('Update', drawer.querySelector('.dr-doc.d-insurance')!);
    await type('Expiry date', '2027-10-21', drawer);
    await click('Save', drawer.querySelector('.paper-form')!);
    await vi.waitFor(() =>
      expect(drawer.querySelector('.dr-doc.d-insurance')?.textContent).toContain(
        'Expires 21 Oct 2027',
      ),
    );
    expect(db.state.accounts[0]!.vehicles[0]!.insurance).toHaveLength(2);
  });

  it('keeps the car and explains when delete fails', async () => {
    server.use(http.delete(`${BASE}/vehicles/:id`, () => new HttpResponse(null, { status: 404 })));
    const { router } = await mountAt('/cars/102');
    await click('Delete car');
    await click('Delete EKY 219 GD');
    await vi.waitFor(() => expect(text()).toContain("We couldn't delete this car right now."));
    expect(router.currentRoute.value.path).toBe('/cars/102');
    expect(db.state.accounts[0]!.vehicles.some((v) => v.id === 102)).toBe(true);
  });

  it('deletes a car and returns to My cars', async () => {
    const { router } = await mountAt('/cars/102');
    await click('Delete car');
    await click('Delete EKY 219 GD');
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/cars'));
    await settle();
    expect(useToast().current.value?.message).toBe('EKY 219 GD deleted.');
    expect(text()).not.toContain('Ford Edge');
  });
});

describe('My cars and Home', () => {
  it('filters from the address', async () => {
    await mountAt('/cars?filter=attention');
    const names = [...body().querySelectorAll('.car h3')].map((h) => h.textContent?.trim());
    expect(names).toEqual(['Ford Edge, EKY 219 GD', 'Toyota Camry, KJA 731 AE']);
  });

  it('leads Home with the expired licence and the next papers to run out', async () => {
    await mountAt('/');
    expect(body().querySelector('.alert-card h2')?.textContent).toBe(
      'Your Ford Edge licence expired 13 days ago',
    );
    expect(text()).toContain('Renew licence · ₦18,500');
    expect(text()).toContain('4 cars · 7 of 12 papers valid');
    const tiles = [...body().querySelectorAll('.tiles .tile .n')].map((n) => n.textContent);
    expect(tiles).toEqual(['9days', '23days', '80days', '103days']);
    expect(body().querySelectorAll('.act')).toHaveLength(4);
  });
});

import { HttpError } from '@motopapers/api';
import * as Sentry from '@sentry/vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, nextTick, ref } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { startSentry } from './sentry';

vi.mock('@sentry/vue', () => ({
  init: vi.fn(),
  setTag: vi.fn(),
  setUser: vi.fn(),
}));

type InitOptions = {
  release?: string;
  environment?: string;
  sendDefaultPii?: boolean;
  beforeSend: (event: object, hint: { originalException: unknown }) => object | null;
};

function start(userId = ref<number | null>(7)) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/payments', name: 'payments', component: { render: () => null } }],
  });
  startSentry(createApp({}), {
    dsn: 'https://key@o1.ingest.sentry.io/1',
    release: 'abc123',
    environment: 'staging',
    router,
    userId: () => userId.value,
  });
  const options = vi.mocked(Sentry.init).mock.calls[0]![0] as unknown as InitOptions;
  return { options, router, userId };
}

describe('Sentry', () => {
  beforeEach(() => vi.clearAllMocks());

  it('tags the release and environment and keeps personal details out', () => {
    const { options } = start();
    expect(options.release).toBe('motopapers-web@abc123');
    expect(options.environment).toBe('staging');
    expect(options.sendDefaultPii).toBe(false);
  });

  it('drops expected sign-outs and cancelled requests, and keeps real errors', () => {
    const { options } = start();
    const event = { message: 'x' };
    const send = (error: unknown) => options.beforeSend(event, { originalException: error });
    expect(send(new HttpError(401, 'Unauthorized', null))).toBeNull();
    expect(send(new DOMException('The user aborted a request.', 'AbortError'))).toBeNull();
    expect(send(new HttpError(500, 'Something went wrong', null))).toBe(event);
    expect(send(new TypeError('x is undefined'))).toBe(event);
  });

  it("follows the driver's id and the page", async () => {
    const { router, userId } = start();
    expect(Sentry.setUser).toHaveBeenLastCalledWith({ id: '7' });
    userId.value = null;
    await nextTick();
    expect(Sentry.setUser).toHaveBeenLastCalledWith(null);

    await router.push('/payments');
    expect(Sentry.setTag).toHaveBeenCalledWith('route', 'payments');
  });
});

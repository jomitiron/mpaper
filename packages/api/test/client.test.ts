import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  buildUrl,
  configureApi,
  errorMessage,
  HttpError,
  NetworkError,
  request,
  SchemaError,
} from '../src/client';
import { envelope } from '../src/schemas/common';

function respond(status: number, body: unknown) {
  return vi.fn<typeof fetch>(
    async () =>
      new Response(body === undefined ? null : JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
  );
}

const schema = envelope(z.object({ id: z.number() }));

afterEach(() => {
  configureApi({ baseUrl: '', getToken: () => null, onUnauthorized: () => {} });
});

describe('request', () => {
  it('sends JSON with the bearer token and returns the parsed body', async () => {
    const fetch = respond(200, { status: 'success', data: { id: 7 } });
    configureApi({ baseUrl: 'https://api.test/', getToken: () => 'tok', fetch });
    const res = await request('/vehicles', { method: 'POST', body: { a: 1 }, schema });
    expect(res.data.id).toBe(7);
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe('https://api.test/vehicles');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe('{"a":1}');
    expect(init?.headers).toMatchObject({
      Authorization: 'Bearer tok',
      'Content-Type': 'application/json',
    });
  });

  it('leaves the token off when auth is false', async () => {
    const fetch = respond(200, { status: 'success', data: { id: 1 } });
    configureApi({ getToken: () => 'tok', fetch });
    await request('/users/sign-in', { method: 'POST', body: {}, schema, auth: false });
    expect(fetch.mock.calls[0]![1]?.headers).not.toHaveProperty('Authorization');
  });

  it('turns a "fail" response into an HttpError with field errors', async () => {
    configureApi({
      fetch: respond(400, {
        status: 'fail',
        message: 'email must be a valid email',
        data: { email: 'email must be a valid email' },
      }),
    });
    const error = await request('/users/sign-up', { schema }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({
      status: 400,
      message: 'email must be a valid email',
      fields: { email: 'email must be a valid email' },
    });
  });

  it('reads is_expired from OTP errors', async () => {
    configureApi({
      fetch: respond(400, { message: 'Expired OTP', is_expired: true, status: 'error' }),
    });
    const error = (await request('/users/reset-password', { schema }).catch(
      (e: unknown) => e,
    )) as HttpError;
    expect(error.isExpired).toBe(true);
  });

  it('calls the 401 hook when a request with a token is refused', async () => {
    const onUnauthorized = vi.fn();
    configureApi({
      getToken: () => 'expired',
      onUnauthorized,
      fetch: respond(401, { message: 'Unauthorized' }),
    });
    await expect(request('/vehicles', { schema })).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it('does not call the 401 hook for a wrong password (no token sent)', async () => {
    const onUnauthorized = vi.fn();
    configureApi({
      getToken: () => null,
      onUnauthorized,
      fetch: respond(401, { message: 'Invalid credentials', status: 'error' }),
    });
    await expect(request('/users/sign-in', { schema, auth: false })).rejects.toMatchObject({
      message: 'Invalid credentials',
    });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('wraps network failures', async () => {
    configureApi({
      fetch: vi.fn<typeof fetch>(async () => Promise.reject(new TypeError('Failed to fetch'))),
    });
    const error = await request('/vehicles', { schema }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NetworkError);
    expect(errorMessage(error)).toMatch(/can't reach MotoPapers/);
  });

  it('passes aborts through untouched', async () => {
    const abort = new DOMException('Aborted', 'AbortError');
    configureApi({ fetch: vi.fn<typeof fetch>(async () => Promise.reject(abort)) });
    await expect(request('/vehicles', { schema })).rejects.toBe(abort);
  });

  it('rejects a response in the wrong shape', async () => {
    configureApi({ fetch: respond(200, { status: 'success', data: { id: 'seven' } }) });
    const error = await request('/vehicles', { schema }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SchemaError);
    expect((error as SchemaError).message).toContain('data.id');
  });

  it('copes with an empty or non-JSON error body', async () => {
    configureApi({
      fetch: vi.fn<typeof fetch>(
        async () => new Response('<html>Bad gateway</html>', { status: 502 }),
      ),
    });
    const error = await request('/vehicles', { schema }).catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 502 });
    expect(errorMessage(error)).toBe('Something went wrong on our side. Try again in a moment.');
  });
});

describe('buildUrl', () => {
  it('joins the base and path and leaves out empty query values', () => {
    expect(
      buildUrl('https://api.test/', '/transactions', {
        page: 2,
        status: undefined,
        per_page: null,
      }),
    ).toBe('https://api.test/transactions?page=2');
    expect(buildUrl('https://api.test', 'vehicles')).toBe('https://api.test/vehicles');
  });
});

describe('errorMessage', () => {
  it('uses the API message for client errors', () => {
    expect(errorMessage(new HttpError(400, 'Insufficient balance', {}))).toBe(
      'Insufficient balance',
    );
  });

  it('has a fallback for anything else', () => {
    expect(errorMessage(new Error('boom'))).toBe('Something went wrong. Try again.');
  });
});

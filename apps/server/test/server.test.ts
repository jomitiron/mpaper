import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LEGACY_ROUTES, SITE_CSP } from '../server.mjs';
import { BIG_CSS, BIG_JS, makePackage, SECRET, start, type Running } from './helpers';

const API = 'https://ijanla-dev.azurewebsites.net';

let pkg: ReturnType<typeof makePackage>;
let server: Running;

beforeAll(async () => {
  pkg = makePackage();
  server = await start(pkg.root, { API_BASE_URL: API });
});

afterAll(async () => {
  await server.close();
  pkg.cleanup();
});

const get = (path: string, headers: Record<string, string> = {}) =>
  server.request(path, { headers });

describe('the site at /', () => {
  it('serves the home page', async () => {
    const reply = await get('/');
    expect(reply.status).toBe(200);
    expect(reply.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(reply.text).toContain('Never drive with expired papers');
  });

  it('serves a folder page at its trailing-slash address', async () => {
    const reply = await get('/privacy/');
    expect(reply.status).toBe(200);
    expect(reply.text).toContain('<title>Privacy</title>');
  });

  it('moves /privacy to /privacy/, keeping the query', async () => {
    expect((await get('/privacy')).headers.location).toBe('/privacy/');
    const reply = await get('/privacy?utm_source=x');
    expect(reply.status).toBe(301);
    expect(reply.headers.location).toBe('/privacy/?utm_source=x');
  });

  it('serves files as they are', async () => {
    const robots = await get('/robots.txt');
    expect(robots.status).toBe(200);
    expect(robots.headers['content-type']).toBe('text/plain; charset=utf-8');
    expect((await get('/favicon.svg')).headers['content-type']).toBe('image/svg+xml');
  });

  it("answers unknown addresses with the site's 404 page", async () => {
    for (const path of ['/nowhere', '/nowhere/', '/privacy/nope', '/_astro/missing.css']) {
      const reply = await get(path);
      expect(reply.status, path).toBe(404);
      expect(reply.text, path).toContain('Page not found');
      expect(reply.headers['cache-control'], path).toBe('no-cache');
    }
  });
});

describe('the app at /app/', () => {
  it('moves /app to /app/, keeping the query', async () => {
    const reply = await get('/app?next=%2Fcars');
    expect(reply.status).toBe(301);
    expect(reply.headers.location).toBe('/app/?next=%2Fcars');
  });

  it("serves the app's index.html", async () => {
    const reply = await get('/app/');
    expect(reply.status).toBe(200);
    expect(reply.text).toContain('<div id="app">');
  });

  it('falls back to index.html for app addresses, so deep links and refreshes work', async () => {
    for (const path of [
      '/app/cars',
      '/app/cars/12',
      '/app/sign-in?next=%2Fcars',
      '/app/payments/callback?reference=MOT-1',
      '/app/auth/callback?code=x',
      '/app/assets/',
    ]) {
      const reply = await get(path);
      expect(reply.status, path).toBe(200);
      expect(reply.text, path).toContain('<div id="app">');
      expect(reply.headers['cache-control'], path).toBe('no-cache');
    }
  });

  it('answers HEAD like GET, without a body', async () => {
    const getReply = await get('/app/cars/12');
    const head = await server.request('/app/cars/12', { method: 'HEAD' });
    expect(head.status).toBe(200);
    expect(head.body).toHaveLength(0);
    expect(head.headers['content-length']).toBe(String(getReply.body.length));
    expect(head.headers.etag).toBe(getReply.headers.etag);
  });

  it('serves app files, with JavaScript types for .js and .mjs', async () => {
    const js = await get('/app/assets/index-Xy12Ab.js');
    expect(js.status).toBe(200);
    expect(js.headers['content-type']).toBe('text/javascript; charset=utf-8');
    expect(js.text).toBe(BIG_JS);
    const worker = await get('/app/assets/pdf.worker.min-Q1w2E3.mjs');
    expect(worker.headers['content-type']).toBe('text/javascript; charset=utf-8');
  });

  it("doesn't fall back for missing files", async () => {
    for (const path of ['/app/assets/gone-123.js', '/app/logo.png']) {
      const reply = await get(path);
      expect(reply.status, path).toBe(404);
      expect(reply.text, path).toContain('Page not found');
    }
  });
});

describe('old app addresses', () => {
  it('move to the app for good, keeping the query', async () => {
    const expected: Record<string, string> = {
      '/home': '/app/',
      '/vehicles': '/app/cars',
      '/transactions': '/app/payments',
      '/settings': '/app/settings',
      '/login': '/app/sign-in',
      '/signup': '/app/sign-up',
      '/forgot-password': '/app/forgot-password',
      '/reset-password': '/app/reset-password',
      '/complete-onboard': '/app/complete-onboard',
    };
    expect(Object.fromEntries(LEGACY_ROUTES)).toEqual(expected);
    for (const [from, to] of Object.entries(expected)) {
      const reply = await get(`${from}?a=1&b=two`);
      expect(reply.status, from).toBe(301);
      expect(reply.headers.location, from).toBe(`${to}?a=1&b=two`);
    }
    expect((await get('/login/')).headers.location).toBe('/app/sign-in');
  });

  it("keep Google's code on the way to the app", async () => {
    const reply = await get('/complete-onboard?code=4%2F0Ab&state=moto');
    expect(reply.status).toBe(301);
    expect(reply.headers.location).toBe('/app/complete-onboard?code=4%2F0Ab&state=moto');
  });

  it('send Paystack returns to the payment callback', async () => {
    const cases: Array<[string, string]> = [
      ['/?trxref=MOT-1&reference=MOT-1', 'MOT-1'],
      ['/home?trxref=MOT-2', 'MOT-2'],
      ['/transactions?reference=MOT-3', 'MOT-3'],
      ['/vehicles/?trxref=MOT-4&reference=MOT-4', 'MOT-4'],
      ['/settings?reference=a%26b%3Dc', 'a%26b%3Dc'],
    ];
    for (const [from, reference] of cases) {
      const reply = await get(from);
      expect(reply.status, from).toBe(302);
      expect(reply.headers.location, from).toBe(`/app/payments/callback?reference=${reference}`);
      expect(reply.headers['cache-control'], from).toBe('no-store');
    }
  });

  it('leave site pages with a reference alone', async () => {
    const reply = await get('/privacy/?reference=MOT-1');
    expect(reply.status).toBe(200);
  });
});

describe('safety', () => {
  it('only answers GET and HEAD', async () => {
    for (const method of ['POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH']) {
      const reply = await server.request('/app/', { method });
      expect(reply.status, method).toBe(405);
      expect(reply.headers.allow, method).toBe('GET, HEAD');
    }
  });

  it('never serves files outside the package, hidden files or the Static Web Apps config', async () => {
    const paths = [
      '/../secret.txt',
      '/../../secret.txt',
      '/app/../../secret.txt',
      '/%2e%2e/secret.txt',
      '/%2E%2E/%2E%2E/secret.txt',
      '/..%2fsecret.txt',
      '/..%2f..%2fsecret.txt',
      '/app/..%2f..%2fsecret.txt',
      '/app/assets/..%2f..%2f..%2fsecret.txt',
      '/..%5c..%5csecret.txt',
      '/%5c..%5c..%5csecret.txt',
      '/privacy%00.html',
      '/.env',
      '/%2eenv',
      '/staticwebapp.config.json',
      '/%E0%A4%A',
    ];
    for (const path of paths) {
      const reply = await get(path);
      expect([400, 404], path).toContain(reply.status);
      expect(reply.text, path).not.toContain(SECRET);
      expect(reply.text, path).not.toContain('SECRET=1');
      expect(reply.text, path).not.toContain('globalHeaders');
    }
  });

  it("doesn't let a doubled slash turn a redirect into another site", async () => {
    const reply = await get('//evil.example/privacy');
    expect(reply.headers.location ?? '').not.toMatch(/^\/\//);
    const folder = await get('/.//privacy');
    expect(folder.headers.location ?? '').not.toMatch(/^\/\//);
  });

  it('sends the security headers everywhere', async () => {
    for (const path of ['/', '/app/', '/app/config.js', '/home', '/nowhere', '/healthz']) {
      const { headers } = await get(path);
      expect(headers['strict-transport-security'], path).toBe('max-age=31536000');
      expect(headers['x-content-type-options'], path).toBe('nosniff');
      expect(headers['referrer-policy'], path).toBe('strict-origin-when-cross-origin');
      expect(headers['permissions-policy'], path).toContain('camera=()');
      expect(headers['x-frame-options'], path).toBe('DENY');
    }
  });

  it('gives the site its Static Web Apps policy and the app its own', async () => {
    const https = { 'X-Forwarded-Proto': 'https' };
    expect((await get('/', https)).headers['content-security-policy']).toBe(SITE_CSP);
    const app = (await get('/app/cars', https)).headers['content-security-policy'] ?? '';
    expect(app).toContain("script-src 'self';");
    expect(app).toContain(
      "connect-src 'self' https://ijanla-dev.azurewebsites.net https://motorpapers-doc-parser-api.azurewebsites.net;",
    );
    expect(app).toContain("frame-ancestors 'none'");
    expect(app).toMatch(/upgrade-insecure-requests$/);
  });

  it('leaves upgrade-insecure-requests out over plain http (localhost)', async () => {
    for (const path of ['/', '/app/']) {
      const csp = (await get(path)).headers['content-security-policy'] ?? '';
      expect(csp, path).not.toContain('upgrade-insecure-requests');
      expect(csp, path).toContain("default-src 'self'");
    }
  });
});

describe('caching', () => {
  it('keeps hashed files for a year', async () => {
    for (const path of ['/_astro/landing.Ab12Cd.css', '/app/assets/index-Xy12Ab.js']) {
      expect((await get(path)).headers['cache-control'], path).toBe(
        'public, max-age=31536000, immutable',
      );
    }
  });

  it('revalidates HTML and never stores config.js', async () => {
    expect((await get('/')).headers['cache-control']).toBe('no-cache');
    expect((await get('/app/')).headers['cache-control']).toBe('no-cache');
    expect((await get('/app/config.js')).headers['cache-control']).toBe('no-store');
    expect((await get('/healthz')).headers['cache-control']).toBe('no-store');
  });

  it('keeps other files a short while', async () => {
    for (const path of ['/favicon.svg', '/robots.txt', '/og.png', '/app/favicon.svg']) {
      expect((await get(path)).headers['cache-control'], path).toBe('public, max-age=3600');
    }
  });

  it('answers a matching If-None-Match with 304', async () => {
    const first = await get('/app/assets/index-Xy12Ab.js');
    const etag = first.headers.etag!;
    expect(etag).toMatch(/^W\/".+"$/);
    const again = await get('/app/assets/index-Xy12Ab.js', { 'If-None-Match': etag });
    expect(again.status).toBe(304);
    expect(again.body).toHaveLength(0);
    expect(again.headers.etag).toBe(etag);
    const strong = etag.replace(/^W\//, '');
    expect((await get('/app/assets/index-Xy12Ab.js', { 'If-None-Match': strong })).status).toBe(
      304,
    );
    expect((await get('/app/cars', { 'If-None-Match': '"other", ' + etag })).status).toBe(200);
    expect((await get('/', { 'If-None-Match': '"stale"' })).status).toBe(200);
  });
});

describe('compression', () => {
  it('prefers brotli, then gzip', async () => {
    const br = await get('/app/assets/index-Xy12Ab.js', { 'Accept-Encoding': 'gzip, deflate, br' });
    expect(br.headers['content-encoding']).toBe('br');
    expect(br.headers.vary).toBe('Accept-Encoding');
    expect(brotliDecompressSync(br.body).toString()).toBe(BIG_JS);
    expect(Number(br.headers['content-length'])).toBeLessThan(BIG_JS.length);

    const gz = await get('/_astro/landing.Ab12Cd.css', { 'Accept-Encoding': 'gzip' });
    expect(gz.headers['content-encoding']).toBe('gzip');
    expect(gunzipSync(gz.body).toString()).toBe(BIG_CSS);

    const noBr = await get('/_astro/landing.Ab12Cd.css', { 'Accept-Encoding': 'br;q=0, gzip' });
    expect(noBr.headers['content-encoding']).toBe('gzip');
  });

  it("sends files as they are when the client doesn't ask, or when it isn't worth it", async () => {
    const plain = await get('/app/assets/index-Xy12Ab.js');
    expect(plain.headers['content-encoding']).toBeUndefined();
    expect(plain.headers.vary).toBe('Accept-Encoding');
    const small = await get('/robots.txt', { 'Accept-Encoding': 'br' });
    expect(small.headers['content-encoding']).toBeUndefined();
    const image = await get('/og.png', { 'Accept-Encoding': 'br' });
    expect(image.headers['content-encoding']).toBeUndefined();
    expect(image.headers.vary).toBeUndefined();
  });

  it('gives HEAD the compressed length', async () => {
    const headers = { 'Accept-Encoding': 'br' };
    const full = await get('/app/assets/index-Xy12Ab.js', headers);
    const head = await server.request('/app/assets/index-Xy12Ab.js', { method: 'HEAD', headers });
    expect(head.headers['content-encoding']).toBe('br');
    expect(head.headers['content-length']).toBe(String(full.body.length));
    expect(head.body).toHaveLength(0);
  });
});

describe('health', () => {
  it('answers /healthz', async () => {
    const reply = await get('/healthz');
    expect(reply.status).toBe(200);
    expect(reply.text).toBe('ok');
  });
});

import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  appCsp,
  buildConfig,
  configScript,
  DEFAULT_DOC_READER_URL,
  pickEncoding,
  SITE_CSP,
} from '../server.mjs';
import { makePackage, start, type Running } from './helpers';

/** Runs config.js the way the browser does and returns what it set. */
function evaluate(script: string): unknown {
  const window: { __MOTOPAPERS_CONFIG__?: unknown } = {};
  runInNewContext(script, { window });
  return window.__MOTOPAPERS_CONFIG__;
}

const ALL_OFF = {
  renewals: false,
  reminderSettings: false,
  txLabels: false,
  walletPay: false,
  verifyPayment: false,
};

describe('config.js', () => {
  let pkg: ReturnType<typeof makePackage>;
  let server: Running | undefined;

  beforeEach(() => {
    pkg = makePackage();
  });

  afterEach(async () => {
    await server?.close();
    server = undefined;
    pkg.cleanup();
  });

  it("is built from the slot's App Service settings, not the static file", async () => {
    server = await start(pkg.root, {
      API_BASE_URL: 'https://ijanla.azurewebsites.net',
      DOC_PARSER_URL: 'https://reader.example/api/vehicleDocument',
      SITE_URL: 'https://motorpapers.com',
      APP_URL: 'https://motorpapers.com/app',
      SENTRY_DSN: 'https://abc@o1.ingest.sentry.io/2',
      ENVIRONMENT: 'production',
      RELEASE: '1a2b3c',
      FLAG_RENEWALS: 'true',
      FLAG_REMINDER_SETTINGS: '1',
      FLAG_TX_LABELS: 'false',
      FLAG_WALLET_PAY: 'ON',
      USE_MOCKS: 'true',
      VITE_USE_MOCKS: 'true',
    });
    const reply = await server.request('/app/config.js');
    expect(reply.status).toBe(200);
    expect(reply.headers['content-type']).toBe('text/javascript; charset=utf-8');
    expect(reply.headers['cache-control']).toBe('no-store');
    expect(reply.text).toMatch(/^window\.__MOTOPAPERS_CONFIG__ = \{.*\};\n$/);
    expect(evaluate(reply.text)).toEqual({
      apiBaseUrl: 'https://ijanla.azurewebsites.net',
      docReaderUrl: 'https://reader.example/api/vehicleDocument',
      siteUrl: 'https://motorpapers.com',
      appUrl: 'https://motorpapers.com/app',
      sentryDsn: 'https://abc@o1.ingest.sentry.io/2',
      sentryEnvironment: 'production',
      release: '1a2b3c',
      flags: {
        renewals: true,
        reminderSettings: true,
        txLabels: false,
        walletPay: true,
        verifyPayment: false,
      },
    });
    expect(reply.text).not.toContain('Mocks');

    const csp = reply.headers['content-security-policy'];
    expect(csp).toContain(
      "connect-src 'self' https://ijanla.azurewebsites.net https://reader.example https://o1.ingest.sentry.io;",
    );
  });

  it('leaves unset settings out and turns every flag off', async () => {
    server = await start(pkg.root, {});
    expect(evaluate((await server.request('/app/config.js')).text)).toEqual({ flags: ALL_OFF });
    expect(server.warnings.join('\n')).toContain("API_BASE_URL isn't set");
  });

  it('ignores a setting that is not an address, and says so', async () => {
    server = await start(pkg.root, {
      API_BASE_URL: 'https://ijanla-dev.azurewebsites.net',
      SENTRY_DSN: 'not a url',
      SITE_URL: 'javascript:alert(1)',
    });
    const config = evaluate((await server.request('/app/config.js')).text);
    expect(config).toEqual({ apiBaseUrl: 'https://ijanla-dev.azurewebsites.net', flags: ALL_OFF });
    expect(server.warnings.join('\n')).toContain('SENTRY_DSN');
    expect(server.warnings.join('\n')).toContain('SITE_URL');
  });

  it('escapes values so they cannot close a script tag or break the statement', () => {
    const release = '</script><script>alert(1)</script> & \u2028\u2029 "quoted" \\';
    const script = configScript(buildConfig({ RELEASE: release, ENVIRONMENT: '<!--' }));
    expect(script).not.toMatch(/<|>|&|\u2028|\u2029/);
    expect(script.trimEnd().split('\n')).toHaveLength(1);
    expect(evaluate(script)).toMatchObject({ release, sentryEnvironment: '<!--' });
  });

  it('marks every response noindex outside production', async () => {
    server = await start(pkg.root, { ENVIRONMENT: 'staging' });
    for (const path of ['/', '/app/', '/home', '/nowhere']) {
      expect((await server.request(path)).headers['x-robots-tag'], path).toBe('noindex, nofollow');
    }
    await server.close();
    server = await start(pkg.root, { ENVIRONMENT: 'production' });
    expect((await server.request('/')).headers['x-robots-tag']).toBeUndefined();
    await server.close();
    server = await start(pkg.root, {});
    expect((await server.request('/')).headers['x-robots-tag']).toBeUndefined();
  });
});

describe('policies', () => {
  it("keeps the site's policy in step with its Static Web Apps config", () => {
    const config = JSON.parse(
      readFileSync(new URL('../../site/public/staticwebapp.config.json', import.meta.url), 'utf8'),
    ) as { globalHeaders: Record<string, string> };
    expect(SITE_CSP).toBe(config.globalHeaders['Content-Security-Policy']);
  });

  it("uses the API package's document reader by default", () => {
    const client = readFileSync(
      new URL('../../../packages/api/src/client.ts', import.meta.url),
      'utf8',
    );
    expect(client).toContain(`'${DEFAULT_DOC_READER_URL}'`);
    const csp = appCsp(buildConfig({}));
    expect(csp).toContain(
      "connect-src 'self' https://motorpapers-doc-parser-api.azurewebsites.net;",
    );
  });
});

describe('pickEncoding', () => {
  it('reads Accept-Encoding with q-values', () => {
    expect(pickEncoding('gzip, deflate, br, zstd')).toBe('br');
    expect(pickEncoding('gzip')).toBe('gzip');
    expect(pickEncoding('br;q=0, gzip;q=0.8')).toBe('gzip');
    expect(pickEncoding('gzip;q=0')).toBeNull();
    expect(pickEncoding('*')).toBe('br');
    expect(pickEncoding('identity')).toBeNull();
    expect(pickEncoding(undefined)).toBeNull();
  });
});

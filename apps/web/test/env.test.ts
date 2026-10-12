import { DEFAULT_DOC_READER_URL } from '@motopapers/api';
import { describe, expect, it } from 'vitest';
import { readSettings } from '@/env';

const build = (vars: Partial<ImportMetaEnv> = {}): ImportMetaEnv =>
  ({
    MODE: 'production',
    BASE_URL: '/',
    DEV: false,
    PROD: true,
    SSR: false,
    ...vars,
  }) as ImportMetaEnv;

describe('readSettings', () => {
  it('uses the build-time variables when there is no runtime config', () => {
    const { env, flags } = readSettings(
      undefined,
      build({ VITE_API_BASE_URL: 'https://api.test' }),
    );
    expect(env.apiBaseUrl).toBe('https://api.test');
    expect(env.docReaderUrl).toBe(DEFAULT_DOC_READER_URL);
    expect(env.sentryEnvironment).toBe('production');
    expect(flags).toEqual({
      renewals: false,
      reminderSettings: false,
      txLabels: false,
      walletPay: false,
      verifyPayment: false,
    });
  });

  it('lets config.js override them', () => {
    const { env, flags } = readSettings(
      {
        apiBaseUrl: 'https://ijanla.azurewebsites.net',
        docReaderUrl: 'https://reader.test/api/vehicleDocument',
        appUrl: 'https://motorpapers.com/app',
        siteUrl: 'https://motorpapers.com',
        sentryDsn: 'https://key@o1.ingest.sentry.io/2',
        sentryEnvironment: 'staging',
        release: 'abc123',
        flags: { renewals: true, walletPay: false },
      },
      build({
        VITE_API_BASE_URL: 'https://ijanla-dev.azurewebsites.net',
        VITE_FLAG_WALLET_PAY: 'true',
        VITE_FLAG_TX_LABELS: 'true',
        VITE_RELEASE: 'built',
      }),
    );
    expect(env).toMatchObject({
      apiBaseUrl: 'https://ijanla.azurewebsites.net',
      docReaderUrl: 'https://reader.test/api/vehicleDocument',
      appUrl: 'https://motorpapers.com/app',
      siteUrl: 'https://motorpapers.com',
      sentryDsn: 'https://key@o1.ingest.sentry.io/2',
      sentryEnvironment: 'staging',
      release: 'abc123',
    });
    // A flag config.js leaves out keeps its build-time value.
    expect(flags).toMatchObject({ renewals: true, walletPay: false, txLabels: true });
  });

  it('ignores unknown keys and values of the wrong shape', () => {
    const { env, flags } = readSettings(
      {
        apiBaseUrl: 'javascript:alert(1)',
        docReaderUrl: 42,
        sentryEnvironment: '   ',
        flags: { renewals: 'yes', verifyPayment: true, somethingElse: true },
        extra: { nested: true },
      },
      build({ VITE_API_BASE_URL: 'https://api.test' }),
    );
    expect(env.apiBaseUrl).toBe('https://api.test');
    expect(env.docReaderUrl).toBe(DEFAULT_DOC_READER_URL);
    expect(env.sentryEnvironment).toBe('production');
    expect(flags.renewals).toBe(false);
    expect(flags.verifyPayment).toBe(true);
    expect(flags).not.toHaveProperty('somethingElse');
  });

  it('survives a config that is not an object', () => {
    for (const runtime of [null, 'oops', 7, ['x']]) {
      expect(readSettings(runtime, build()).env.apiBaseUrl).toBe(
        'https://ijanla-dev.azurewebsites.net',
      );
    }
  });

  it('never turns the mock API on from config.js', () => {
    const settings = readSettings({ useMocks: true }, build({ VITE_USE_MOCKS: 'false' }));
    expect(settings.env.useMocks).toBe(false);
    expect(readSettings({}, build({ VITE_USE_MOCKS: 'true' })).env.useMocks).toBe(true);
  });
});

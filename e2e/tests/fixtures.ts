import { test as base, expect } from '@playwright/test';
import { APP_URL } from '../ports';

/**
 * Every spec's `test`. The e2e builds report errors to fake Sentry DSNs (the app to its own
 * server, the site to sentry.invalid); this catches those reports, and fails any test whose page
 * throws or reports an error it didn't expect.
 *
 * In WebKit the app's reports go through the mock API's service worker, which Playwright can't
 * see into, so only Chromium checks what the app sends to Sentry.
 */

/** Sentry's envelope endpoints for the e2e DSNs. */
const SENTRY_ENDPOINTS = ['https://sentry.invalid/api/**', `${APP_URL}/api/*/envelope/**`];

export interface SentryEvent {
  release?: string;
  environment?: string;
  user?: { id?: string };
  tags?: Record<string, string>;
  exception?: { values?: { type?: string; value?: string }[] };
}

export const test = base.extend<{
  /** Error reports sent to Sentry during the test. */
  sentryEvents: SentryEvent[];
  /** Set to true in a test that means to cause an error. */
  expectErrors: { value: boolean };
}>({
  // Playwright reads fixture dependencies from this pattern, so it has to be there, even empty.
  // eslint-disable-next-line no-empty-pattern
  expectErrors: async ({}, use) => {
    await use({ value: false });
  },
  sentryEvents: [
    async ({ context, expectErrors }, use) => {
      const events: SentryEvent[] = [];
      for (const endpoint of SENTRY_ENDPOINTS) {
        await context.route(endpoint, async (route) => {
          // An envelope is newline-separated JSON: a header, then item header and payload pairs.
          const lines = (route.request().postData() ?? '').split('\n').filter(Boolean);
          for (let i = 1; i + 1 < lines.length; i += 2) {
            const item = JSON.parse(lines[i]!) as { type?: string };
            if (item.type === 'event') events.push(JSON.parse(lines[i + 1]!) as SentryEvent);
          }
          await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
        });
      }
      const pageErrors: string[] = [];
      context.on('weberror', (error) => pageErrors.push(error.error().message));

      await use(events);

      if (!expectErrors.value) {
        expect(pageErrors, 'uncaught errors in the page').toEqual([]);
        expect(
          events.map((e) => e.exception?.values?.[0]?.value),
          'errors reported to Sentry',
        ).toEqual([]);
      }
    },
    { auto: true },
  ],
});

export { expect };

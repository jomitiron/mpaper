import { readFileSync } from 'node:fs';
import { expect, test } from './fixtures';
import { SITE_URL } from '../ports';
import { expectAccessible } from './a11y';

/** The marketing site: axe on every page, and its way into the app. */

const pages: [string, string][] = [
  ['site-home', '/'],
  ['site-privacy', '/privacy/'],
  ['site-terms', '/terms/'],
  ['site-not-found', '/no-such-page/'],
];

for (const [name, path] of pages) {
  test(name, async ({ page }, testInfo) => {
    await page.goto(SITE_URL + path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectAccessible(page, testInfo, name);
  });
}

test('the FAQ opens and closes', async ({ page }, testInfo) => {
  await page.goto(`${SITE_URL}/#faq`);
  const second = page.locator('#faq details').nth(1);
  await expect(second).not.toHaveAttribute('open');
  await second.locator('summary').click();
  await expect(second).toHaveAttribute('open', '');
  await expectAccessible(page, testInfo, 'site-faq-open');
  await second.locator('summary').click();
  await expect(second).not.toHaveAttribute('open');
});

test('sends drivers to the app to get started', async ({ page }) => {
  await page.goto(SITE_URL + '/');
  const start = page
    .getByRole('link', { name: /get started/i })
    .filter({ visible: true })
    .first();
  await expect(start).toHaveAttribute('href', /^http:\/\/localhost:5176\/sign-up/);
  await start.click();
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
});

test.describe('under the production Content-Security-Policy', () => {
  // The headers Azure Static Web Apps adds (apps/site/public/staticwebapp.config.json), minus
  // upgrade-insecure-requests, which would send localhost to https. The e2e build reports to
  // sentry.invalid, so that's allowed alongside the real *.sentry.io.
  const config = JSON.parse(
    readFileSync(
      new URL('../../apps/site/public/staticwebapp.config.json', import.meta.url),
      'utf8',
    ),
  ) as { globalHeaders: Record<string, string> };
  const csp = config.globalHeaders['Content-Security-Policy']!.replace(
    /;\s*upgrade-insecure-requests/,
    '',
  ).replace('https://*.sentry.io', 'https://*.sentry.io https://sentry.invalid');

  for (const [name, path] of pages) {
    test(`${name} breaks no rule`, async ({ page }) => {
      await page.route(`${SITE_URL}/**`, async (route) => {
        const response = await route.fetch();
        await route.fulfill({
          response,
          headers: { ...response.headers(), 'content-security-policy': csp },
        });
      });
      const violations: string[] = [];
      await page.exposeFunction('reportViolation', (v: string) => violations.push(v));
      await page.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (e) => {
          void (window as unknown as { reportViolation(v: string): void }).reportViolation(
            `${e.violatedDirective} ${e.blockedURI}`,
          );
        });
      });
      await page.goto(SITE_URL + path);
      await page.waitForLoadState('load');
      // The Sentry loader runs after load: give it a moment.
      await page.waitForTimeout(500);
      expect(violations).toEqual([]);
    });
  }
});

test('reports an error on the site with its release', async ({
  page,
  sentryEvents,
  expectErrors,
}) => {
  expectErrors.value = true;
  await page.goto(SITE_URL + '/');
  await page.waitForLoadState('load');
  // Sentry loads after the page: wait until it's listening.
  await expect.poll(() => page.evaluate(() => '__SENTRY__' in window)).toBe(true);
  await page.evaluate(() => {
    setTimeout(() => {
      throw new Error('e2e: site Sentry check');
    });
  });
  await expect.poll(() => sentryEvents.length).toBeGreaterThan(0);
  expect(sentryEvents[0]!.exception?.values?.[0]?.value).toBe('e2e: site Sentry check');
  expect(sentryEvents[0]!.release).toBe('motopapers-site@e2e');
  expect(sentryEvents[0]!.environment).toBe('e2e');
});

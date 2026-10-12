import { expect, test } from '@playwright/test';
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

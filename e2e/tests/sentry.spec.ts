import { expect, test } from './fixtures';
import { freshMocks, signIn } from './support';

/** An error in the app reaches Sentry with its release, environment, page and driver. */

test('reports an uncaught error with its release and the driver', async ({
  page,
  sentryEvents,
  expectErrors,
  browserName,
}) => {
  test.skip(
    browserName === 'webkit',
    "WebKit sends the report through the mock API's service worker, out of Playwright's sight",
  );
  expectErrors.value = true;
  await freshMocks(page);
  await signIn(page);
  await page.goto('/payments');
  await expect(page.getByRole('heading', { name: 'Payments', level: 1 })).toBeVisible();

  await page.evaluate(() => {
    setTimeout(() => {
      throw new Error('e2e: Sentry check');
    });
  });

  await expect.poll(() => sentryEvents.length).toBeGreaterThan(0);
  const [event] = sentryEvents;
  expect(event!.exception?.values?.[0]?.value).toBe('e2e: Sentry check');
  expect(event!.release).toBe('motopapers-web@e2e');
  expect(event!.environment).toBe('e2e');
  expect(event!.tags?.route).toBe('payments');
  expect(event!.user?.id).toMatch(/^\d+$/);
  // Never the driver's email.
  expect(JSON.stringify(event)).not.toContain('ada.okafor@example.com');
});

test('an ended session sends the driver to sign in, and is not reported', async ({
  page,
  sentryEvents,
}) => {
  await freshMocks(page);
  await signIn(page);
  // Point the saved token at an account the API doesn't know: every request now answers 401,
  // as it does when the real 30-minute token runs out.
  await page.evaluate(() => {
    const key = 'motopapers:session';
    const store = sessionStorage.getItem(key) ? sessionStorage : localStorage;
    const saved = JSON.parse(store.getItem(key)!) as { token: string };
    const [head, body, sig] = saved.token.split('.');
    const claims = JSON.parse(atob(body!.replace(/-/g, '+').replace(/_/g, '/'))) as object;
    const forged = btoa(JSON.stringify({ ...claims, id: 999_999 }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    store.setItem(key, JSON.stringify({ ...saved, token: `${head}.${forged}.${sig}` }));
  });

  await page.goto('/payments');
  await expect(page).toHaveURL(/\/sign-in\?next=\/payments$/);
  await expect(page.getByText('Your session ended. Sign in again to carry on.')).toBeVisible();
  expect(sentryEvents).toEqual([]);
});

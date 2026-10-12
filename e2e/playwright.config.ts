import { defineConfig, devices } from '@playwright/test';
import { APP_URL, SITE_URL } from './ports';

/**
 * End-to-end and accessibility checks (docs/phases/P6-launch.md).
 *
 * The app runs as a production build with the mock API on and every flag on, so the whole journey
 * works without a backend; the site runs as its static build. Run with `pnpm e2e` from the root.
 */

const ci = Boolean(process.env.CI);

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  workers: ci ? 2 : undefined,
  reporter: ci
    ? [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }], ['github']]
    : [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: APP_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'en-NG',
    timezoneId: 'Africa/Lagos',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1360, height: 900 } },
    },
    {
      // The driver's phone: Safari's engine at 390px, with touch.
      name: 'webkit-mobile',
      use: { ...devices['iPhone 13'] },
      // A phone has no Tab key.
      testIgnore: /keyboard\.spec/,
    },
  ],
  webServer: [
    {
      command:
        'pnpm --filter web exec vite build --outDir dist/e2e --logLevel warn && pnpm --filter web exec vite preview --outDir dist/e2e --port 5176 --strictPort',
      cwd: '..',
      url: APP_URL,
      reuseExistingServer: !ci,
      timeout: 180_000,
      env: {
        VITE_USE_MOCKS: 'true',
        VITE_APP_URL: APP_URL,
        VITE_SITE_URL: SITE_URL,
        VITE_FLAG_RENEWALS: 'true',
        VITE_FLAG_REMINDER_SETTINGS: 'true',
        VITE_FLAG_TX_LABELS: 'true',
        VITE_FLAG_WALLET_PAY: 'true',
        VITE_FLAG_VERIFY_PAYMENT: 'true',
        VITE_SENTRY_DSN: '',
      },
    },
    {
      command:
        'pnpm --filter site build && pnpm --filter site exec astro preview --port 4326 --host localhost',
      cwd: '..',
      url: SITE_URL,
      reuseExistingServer: !ci,
      timeout: 180_000,
      env: {
        PUBLIC_APP_URL: APP_URL,
        PUBLIC_SITE_URL: SITE_URL,
      },
    },
  ],
});

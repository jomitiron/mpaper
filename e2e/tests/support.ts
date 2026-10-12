import { fileURLToPath } from 'node:url';
import { expect, type Page } from '@playwright/test';

/** Shared steps for the specs. The app runs on the mock API (packages/api/src/mocks/README.md). */

export const SAMPLE_LICENCE = fileURLToPath(
  new URL('../fixtures/sample-licence.png', import.meta.url),
);

/** The sample account: four cars, ₦8,500 in the wallet, payments from the design. */
export const ADA = { email: 'ada.okafor@example.com', password: 'password123' };

/** A fresh email for each test, so parallel runs never meet. */
export function newEmail(prefix = 'driver'): string {
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`;
}

/**
 * Waits until the app has started and drawn the page: the mock API's worker is running and the
 * page's code and styles have loaded. Leaving a page before then cancels those loads, which
 * WebKit reports as errors ("Unable to preload CSS").
 */
export async function pageReady(page: Page): Promise<void> {
  await expect(page.locator('h1').first()).toBeVisible();
}

/** The mock data lives in sessionStorage: start every test from the sample data. */
export async function freshMocks(page: Page): Promise<void> {
  await page.goto('/sign-in');
  await pageReady(page);
  await page.evaluate(() => sessionStorage.clear());
}

export async function signIn(page: Page, who = ADA, next = '/'): Promise<void> {
  await page.goto(next === '/' ? '/sign-in' : `/sign-in?next=${encodeURIComponent(next)}`);
  await page.getByLabel('Email').fill(who.email);
  await page.getByLabel('Password', { exact: true }).fill(who.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).not.toHaveURL(/\/sign-in/);
  await pageReady(page);
}

/** Sign up and verify the email (any 6 digits but 000000 and 999999 work on the mocks). */
export async function signUp(
  page: Page,
  driver: { first: string; last: string; phone: string; email: string; password: string },
): Promise<void> {
  await page.goto('/sign-up');
  await page.getByLabel('First name').fill(driver.first);
  await page.getByLabel('Last name').fill(driver.last);
  await page.getByLabel('Phone number').fill(driver.phone);
  await page.getByLabel('Email').fill(driver.email);
  await page.getByLabel('Password', { exact: true }).fill(driver.password);
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  await expect(page.getByText(`We sent a 6-digit code to ${driver.email}`)).toBeVisible();
  // The code boxes move along by themselves, and the last digit sends it.
  await page.getByLabel('Digit 1 of 6').pressSequentially('482913');
  await expect(page.getByRole('heading', { name: 'Add your first car' })).toBeVisible();
}

/** A calendar date `days` from today in Lagos, as a date input takes it (2026-11-02). */
export function daysFromToday(days: number): string {
  const lagos = new Date(Date.now() + 60 * 60 * 1000); // Lagos is UTC+1 all year.
  lagos.setUTCDate(lagos.getUTCDate() + days);
  return lagos.toISOString().slice(0, 10);
}

/** The main area of the page (the sidebar and tab bar are outside it). */
export const main = (page: Page) => page.locator('main');

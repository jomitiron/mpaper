import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { expectAccessible } from './a11y';
import { freshMocks, main, newEmail, signIn } from './support';

/** axe on every page of the app, signed out and signed in, including sheets, modals and errors. */

test.describe('signed out', () => {
  test.beforeEach(async ({ page }) => {
    await freshMocks(page);
  });

  const pages: [string, string, string][] = [
    ['sign-in', '/sign-in', 'Sign in'],
    ['sign-up', '/sign-up', 'Create your account'],
    ['forgot-password', '/forgot-password', 'Forgot your password?'],
    ['reset-password', '/reset-password', 'Choose a new password'],
  ];
  for (const [name, path, heading] of pages) {
    test(name, async ({ page }, testInfo) => {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
      await expectAccessible(page, testInfo, name);
    });
  }

  test('sign-in with errors', async ({ page }, testInfo) => {
    await page.goto('/sign-in');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByText(/Enter your email/)).toBeVisible();
    await expectAccessible(page, testInfo, 'sign-in-errors');
  });

  test('sign-up: verify and first car', async ({ page }, testInfo) => {
    await page.goto('/sign-up');
    await page.getByLabel('First name').fill('Chioma');
    await page.getByLabel('Last name').fill('Eze');
    await page.getByLabel('Phone number').fill('0803 555 0177');
    await page.getByLabel('Email').fill(newEmail('chioma'));
    await page.getByLabel('Password', { exact: true }).fill('password123');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
    await expectAccessible(page, testInfo, 'sign-up-verify');

    await page.getByLabel('Digit 1 of 6').pressSequentially('000000');
    await expect(page.getByText(/code/i).and(page.locator('.fld-error'))).toBeVisible();
    await expectAccessible(page, testInfo, 'sign-up-verify-error');

    await page.getByLabel('Digit 1 of 6').click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.getByLabel('Digit 1 of 6').pressSequentially('482913');
    await expect(page.getByRole('heading', { name: 'Add your first car' })).toBeVisible();
    await expectAccessible(page, testInfo, 'sign-up-first-car');
  });

  test('page not found', async ({ page }, testInfo) => {
    await page.goto('/no-such-page');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectAccessible(page, testInfo, 'not-found-signed-out');
  });
});

test.describe('signed in', () => {
  test.beforeEach(async ({ page }) => {
    await freshMocks(page);
    await signIn(page);
  });

  async function visit(page: Page, path: string, heading: string | RegExp) {
    await page.goto(path);
    await expect(main(page).getByRole('heading', { name: heading }).first()).toBeVisible();
  }

  test('home', async ({ page }, testInfo) => {
    await visit(page, '/', 'Hi Ada');
    await expectAccessible(page, testInfo, 'home');
  });

  test('my cars, filtered', async ({ page }, testInfo) => {
    await visit(page, '/cars', 'My cars');
    await expectAccessible(page, testInfo, 'cars');
    await main(page)
      .getByRole('button', { name: /^Needs attention/ })
      .click();
    await expect(page).toHaveURL(/filter=attention/);
    await expectAccessible(page, testInfo, 'cars-attention');
  });

  test('car panel', async ({ page }, testInfo) => {
    await page.goto('/cars/102');
    await expect(page.getByRole('dialog')).toBeVisible();
    await expectAccessible(page, testInfo, 'car-panel');
    // Editing a paper opens a form in the panel.
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /^Update/ })
      .first()
      .click();
    await expectAccessible(page, testInfo, 'car-panel-edit');
  });

  test('add a car: every step, with errors', async ({ page }, testInfo) => {
    await visit(page, '/cars/new', 'Upload your vehicle licence');
    await expectAccessible(page, testInfo, 'add-car-upload');

    await page.getByRole('button', { name: 'Enter details by hand' }).click();
    await expect(page.getByRole('heading', { name: "Check your car's details" })).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Enter the colour.')).toBeVisible();
    await expectAccessible(page, testInfo, 'add-car-details-errors');

    await page.getByRole('button', { name: 'Back' }).click();
    await page.getByRole('button', { name: 'Use a sample licence' }).click();
    await expect(page.getByLabel('Plate number')).toHaveValue('KTU 604 XR');
    await expectAccessible(page, testInfo, 'add-car-details-read');
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByRole('heading', { name: 'Insurance and roadworthiness' })).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText(/Enter the expiry date/).first()).toBeVisible();
    await expectAccessible(page, testInfo, 'add-car-papers-errors');

    await page.getByRole('button', { name: 'No cover yet' }).click();
    await page.getByLabel("I don't have a certificate yet").check();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Review and start reminders' })).toBeVisible();
    await expectAccessible(page, testInfo, 'add-car-review');
  });

  test('payments, top up and the payment return page', async ({ page }, testInfo) => {
    await visit(page, '/payments', 'Payments');
    await expectAccessible(page, testInfo, 'payments');

    await main(page).getByRole('button', { name: 'Top up wallet' }).click();
    const modal = page.getByRole('dialog', { name: 'Top up your wallet' });
    await expect(modal).toBeVisible();
    await modal.getByRole('button', { name: 'Continue to Paystack' }).click();
    await expectAccessible(page, testInfo, 'top-up-error');

    await modal.getByRole('button', { name: '₦5,000' }).click();
    await modal.getByRole('button', { name: 'Continue to Paystack · ₦5,000' }).click();
    await expect(page.getByRole('heading', { name: 'Payment received' })).toBeVisible({
      timeout: 15_000,
    });
    await expectAccessible(page, testInfo, 'payment-received');
  });

  test('a failed payment', async ({ page }, testInfo) => {
    await visit(page, '/payments', 'Payments');
    await main(page).getByRole('button', { name: 'Top up wallet' }).click();
    const modal = page.getByRole('dialog', { name: 'Top up your wallet' });
    // ₦1,013 fails on the mock Paystack.
    await modal.getByLabel('How much?').fill('1013');
    await modal.getByRole('button', { name: /Continue to Paystack/ }).click();
    await expect(page).toHaveURL(/\/payments\/callback/);
    await expect(main(page).getByRole('heading', { level: 1 })).not.toHaveText('Payment received', {
      timeout: 15_000,
    });
    await expect(
      main(page)
        .getByRole('button', { name: /Try again/ })
        .first(),
    ).toBeVisible({
      timeout: 15_000,
    });
    await expectAccessible(page, testInfo, 'payment-failed');
  });

  test('settings', async ({ page }, testInfo) => {
    await visit(page, '/settings', 'Settings');
    await expectAccessible(page, testInfo, 'settings');
  });

  test('renew: check and pay, then the tracker', async ({ page }, testInfo) => {
    await visit(page, '/cars/102/renew/roadworthiness', 'Check and pay');
    await expectAccessible(page, testInfo, 'renew-pay');
    await page.getByRole('button', { name: 'Pay ₦6,500' }).click();
    await expect(page.getByText('Paid ₦6,500 from your wallet.')).toBeVisible();
    await expectAccessible(page, testInfo, 'renew-tracker');
  });

  test('renew: call or WhatsApp us', async ({ page }, testInfo) => {
    // Comprehensive cover is priced by the team.
    await visit(page, '/cars/102/renew/insurance', 'Call or WhatsApp us to renew');
    await expectAccessible(page, testInfo, 'renew-call');
  });

  test('page not found', async ({ page }, testInfo) => {
    await page.goto('/no-such-page');
    await expect(main(page).getByRole('heading', { level: 1 })).toBeVisible();
    await expectAccessible(page, testInfo, 'not-found');
  });
});

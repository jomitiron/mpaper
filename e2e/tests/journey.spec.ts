import { expect, test } from './fixtures';
import { daysFromToday, freshMocks, main, newEmail, SAMPLE_LICENCE, signUp } from './support';

/**
 * A new driver's first day: sign up and verify, top up the wallet through Paystack (stubbed: the
 * mock checkout sends the driver straight back to the payment return page), add a car from a
 * licence photo and pay for tracking from the wallet, see it on Home, renew a paper, sign out.
 */

test('a new driver signs up, tops up, adds a car, renews a paper and signs out', async ({
  page,
}) => {
  await freshMocks(page);
  const email = newEmail('tunde');

  await test.step('sign up and verify the email', async () => {
    await signUp(page, {
      first: 'Tunde',
      last: 'Bello',
      phone: '0803 555 0199',
      email,
      password: 'password123',
    });
    await page.getByRole('link', { name: 'Skip for now' }).click();
    await expect(page).toHaveURL('/');
    await expect(main(page).getByText('Add your first car')).toBeVisible();
  });

  await test.step('top up the wallet on Paystack and come back', async () => {
    await page.goto('/payments');
    await expect(main(page).getByRole('heading', { name: 'Payments', level: 1 })).toBeVisible();
    await main(page).getByRole('button', { name: 'Top up wallet' }).click();

    const modal = page.getByRole('dialog', { name: 'Top up your wallet' });
    await expect(modal).toBeVisible();
    await expect(modal.getByLabel('How much?')).toBeFocused();
    await modal.getByLabel('How much?').fill('10000');
    await modal.getByRole('button', { name: 'Continue to Paystack · ₦10,000' }).click();

    // Paystack's checkout is stubbed: the mock sends the driver straight back with a reference.
    await expect(page).toHaveURL(/\/payments\/callback\?reference=/);
    await expect(page.getByRole('heading', { name: 'Payment received' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(main(page)).toContainText('₦10,000');
  });

  await test.step('add a car from a photo of its licence', async () => {
    await page.goto('/cars/new');
    await expect(page.getByRole('heading', { name: 'Upload your vehicle licence' })).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles(SAMPLE_LICENCE);

    await expect(page.getByRole('heading', { name: "Check your car's details" })).toBeVisible();
    await expect(page.getByLabel('Plate number')).toHaveValue('KTU 604 XR');
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByRole('heading', { name: 'Insurance and roadworthiness' })).toBeVisible();
    await page.getByLabel('Expiry date', { exact: true }).fill(daysFromToday(150));
    await page.getByLabel('Certificate expiry date').fill(daysFromToday(21));
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByRole('heading', { name: 'Review and start reminders' })).toBeVisible();
    const wallet = page.getByRole('radio', { name: /Wallet/ });
    await expect(wallet).toBeEnabled();
    await expect(wallet).toBeChecked();
    await expect(main(page)).toContainText('₦10,000 available');
    await page.getByRole('button', { name: 'Pay ₦2,500 and start' }).click();

    await expect(page.getByRole('heading', { name: 'KTU 604 XR is all set' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(main(page)).toContainText(
      '₦2,500 was paid from your wallet. Its roadworthiness is due in 21 days.',
    );
  });

  await test.step('see it on Home', async () => {
    await page.goto('/');
    await expect(main(page)).toContainText('KTU 604 XR');
    await expect(main(page)).toContainText('Toyota Corolla');
    await expect(main(page)).toContainText('₦7,500');
  });

  await test.step('renew a paper from the wallet', async () => {
    await page.goto('/cars');
    await main(page)
      .getByRole('link', { name: /Toyota Corolla/ })
      .click();
    const panel = page.getByRole('dialog');
    await expect(panel).toBeVisible();
    const road = panel.locator('.dr-doc', { hasText: 'Roadworthiness' });
    await road.getByRole('link', { name: 'Renew' }).click();

    await expect(page).toHaveURL(/\/cars\/\d+\/renew\/roadworthiness/);
    await expect(page.getByRole('heading', { name: 'Check and pay' })).toBeVisible();
    await expect(page.getByRole('radio', { name: /Wallet/ })).toBeChecked();
    // A new account has no address yet: paying asks for one and puts the cursor there.
    await page.getByRole('button', { name: 'Pay ₦6,500' }).click();
    const address = page.getByLabel('Delivery address');
    await expect(page.getByText('Enter the address we should deliver to.')).toBeVisible();
    await expect(address).toBeFocused();
    await address.fill('2 Awolowo Road, Ikoyi, Lagos');
    await page.getByRole('button', { name: 'Pay ₦6,500' }).click();

    await expect(page.getByText('Paid ₦6,500 from your wallet.')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Your roadworthiness renewal is paid' }),
    ).toBeFocused();
  });

  await test.step('sign out', async () => {
    await page.goto('/settings');
    await main(page).getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/sign-in/);
    await expect(page.getByRole('heading', { name: 'Sign in', level: 1 })).toBeVisible();
    // Signed out means signed out: the app sends the driver back to sign in.
    await page.goto('/payments');
    await expect(page).toHaveURL(/\/sign-in\?next=\/payments$/);
  });
});

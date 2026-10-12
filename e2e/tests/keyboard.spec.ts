import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { freshMocks, main, signIn } from './support';

/**
 * Keyboard only: Add a car from start to finish, and the sheet and modals open, trap focus, close
 * on Escape and give focus back. Desktop Chrome only (a phone has no Tab key).
 */

/** Presses Tab (or Shift+Tab) until `target` has focus, failing if it never gets there. */
async function tabTo(page: Page, target: Locator, { back = false, max = 60 } = {}) {
  for (let i = 0; i < max; i += 1) {
    if (await target.evaluate((el) => el === document.activeElement).catch(() => false)) break;
    await page.keyboard.press(back ? 'Shift+Tab' : 'Tab');
  }
  await expect(target).toBeFocused();
  await expectVisibleFocus(target);
}

/**
 * The focused control shows it: an outline or a focus ring on it, or an outline on the card it
 * opens (My cars outlines the whole card when its link has focus).
 */
async function expectVisibleFocus(target: Locator) {
  const shown = await target.evaluate((el) => {
    const outlined = (node: Element) => {
      const style = getComputedStyle(node);
      return style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0;
    };
    if (outlined(el) || getComputedStyle(el).boxShadow !== 'none') return true;
    for (let node = el.parentElement, i = 0; node && i < 4; node = node.parentElement, i += 1) {
      if (outlined(node)) return true;
    }
    return false;
  });
  expect(shown, 'focus is visible').toBe(true);
}

/** Tabs `count` times and checks focus never leaves `inside`. */
async function expectTrapped(page: Page, inside: Locator, count = 25) {
  for (let i = 0; i < count; i += 1) {
    await page.keyboard.press(i % 3 === 2 ? 'Shift+Tab' : 'Tab');
    const within = await inside.evaluate((el) => el.contains(document.activeElement));
    expect(within, `focus stays in the dialog after ${i + 1} presses`).toBe(true);
  }
}

test.beforeEach(async ({ page }) => {
  await freshMocks(page);
  await signIn(page);
});

test('adds a car with the keyboard alone', async ({ page }) => {
  await page.goto('/cars/new');
  await expect(page.getByRole('heading', { name: 'Upload your vehicle licence' })).toBeVisible();

  // Step 1: no licence to hand, so type the details.
  await tabTo(page, page.getByRole('button', { name: 'Enter details by hand' }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: "Check your car's details" })).toBeVisible();

  // Step 2: every field in order.
  const typeInto = async (label: string, value: string) => {
    await tabTo(page, page.getByLabel(label, { exact: true }));
    await page.keyboard.type(value);
  };
  await typeInto('Plate number', 'LND 552 KJ');
  await tabTo(page, page.getByLabel('Licence expiry date'));
  await page.keyboard.type('14032027'); // dd mm yyyy, as the date field reads it here
  await typeInto('Licence PIN', '40219375');
  await typeInto('Make', 'Honda');
  await typeInto('Model', 'Accord');
  await typeInto('Colour', 'White');
  await typeInto('Engine number', 'K24Z71203');
  await typeInto('Chassis number', '1HGCP2F31AA058213');
  await typeInto('Engine capacity', '2354');
  await tabTo(page, page.getByRole('button', { name: 'Continue' }));
  await page.keyboard.press('Enter');

  // Step 3: no insurance yet, no roadworthiness certificate yet.
  await expect(page.getByRole('heading', { name: 'Insurance and roadworthiness' })).toBeVisible();
  await tabTo(page, page.getByRole('button', { name: 'No cover yet' }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'No cover yet' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await tabTo(page, page.getByLabel("I don't have a certificate yet"));
  await page.keyboard.press('Space');
  await expect(page.getByLabel("I don't have a certificate yet")).toBeChecked();
  await tabTo(page, page.getByRole('button', { name: 'Continue' }));
  await page.keyboard.press('Enter');

  // Step 4: pay from the wallet.
  await expect(page.getByRole('heading', { name: 'Review and start reminders' })).toBeVisible();
  await expect(page.getByRole('radio', { name: /Wallet/ })).toBeChecked();
  await tabTo(page, page.getByRole('button', { name: 'Pay ₦2,500 and start' }));
  await page.keyboard.press('Enter');

  const done = page.getByRole('heading', { name: 'LND 552 KJ is all set' });
  await expect(done).toBeVisible({ timeout: 15_000 });
  await expect(done).toBeFocused();
  await tabTo(page, page.getByRole('link', { name: 'See my cars' }));
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/cars');
  await expect(main(page)).toContainText('LND 552 KJ');
});

test('opens the car panel, keeps focus in it and closes on Escape', async ({ page }) => {
  await page.goto('/cars');
  const car = main(page).getByRole('link', { name: /Ford Edge/ });
  await tabTo(page, car);
  await page.keyboard.press('Enter');

  const panel = page.getByRole('dialog');
  await expect(panel).toBeVisible();
  await expect(page).toHaveURL(/\/cars\/\d+$/);
  await expect.poll(() => panel.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  await expectTrapped(page, panel);

  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(page).toHaveURL('/cars');
  await expect(car).toBeFocused();
});

test('opens Top up, keeps focus in it and closes on Escape', async ({ page }) => {
  await page.goto('/payments');
  const open = main(page).getByRole('button', { name: 'Top up wallet' });
  await tabTo(page, open);
  await page.keyboard.press('Enter');

  const modal = page.getByRole('dialog', { name: 'Top up your wallet' });
  await expect(modal).toBeVisible();
  await expect(modal.getByLabel('How much?')).toBeFocused();
  await expectTrapped(page, modal);

  await page.keyboard.press('Escape');
  await expect(modal).toBeHidden();
  await expect(open).toBeFocused();
});

test('chooses a quick top-up amount and pays with the keyboard', async ({ page }) => {
  await page.goto('/payments');
  await tabTo(page, main(page).getByRole('button', { name: 'Top up wallet' }));
  await page.keyboard.press('Enter');
  const modal = page.getByRole('dialog', { name: 'Top up your wallet' });
  await tabTo(page, modal.getByRole('button', { name: '₦5,000' }));
  await page.keyboard.press('Enter');
  await expect(modal.getByLabel('How much?')).toHaveValue('5,000');
  await tabTo(page, modal.getByRole('button', { name: 'Continue to Paystack · ₦5,000' }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Payment received' })).toBeVisible({
    timeout: 15_000,
  });
});

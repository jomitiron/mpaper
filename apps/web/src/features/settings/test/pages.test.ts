import { useToast } from '@motopapers/ui';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { useSessionStore } from '@/stores/session';
import { browser } from '@/features/auth/lib/google';
import {
  ada,
  BASE,
  body,
  button,
  click,
  field,
  mountAt,
  server,
  settle,
  testFlags,
  text,
  type,
  useHarness,
} from '@/features/payments/test/harness';

/** Settings against the mock API: profile, password, reminders, Google and sign out. */

useHarness({ flags: { reminderSettings: true } });

const toasts = () => useToast().items.map((t) => t.message);
const profile = () => body().querySelector<HTMLElement>('.profile')!;
const switchFor = (name: string) =>
  body().querySelector<HTMLInputElement>(`input[role="switch"][aria-label="${name}"]`)!;
const chip = (label: string) =>
  button(label, body().querySelector('[aria-labelledby="remind-days"]')!);

describe('profile', () => {
  it('shows the driver, their verified email, phone and delivery address', async () => {
    await mountAt('/settings');
    expect(profile().textContent).toContain('Ada Okafor');
    expect(profile().textContent).toContain('ada.okafor@example.com');
    expect(profile().textContent).toContain('Verified');
    expect(profile().textContent).toContain('+234 803 555 0142');
    expect(profile().textContent).toContain('14 Admiralty Way, Lekki Phase 1, Lagos');
  });

  it('checks the form before saving, and says what to fix', async () => {
    const puts: string[] = [];
    server.events.on('request:start', ({ request }) => {
      if (request.method === 'PUT') puts.push(request.url);
    });
    await mountAt('/settings');
    await click('Edit profile');
    expect(document.activeElement).toBe(field('First name'));
    await type('First name', '');
    await type('Phone number', '12345');
    await click('Save changes');
    expect(text()).toContain('Enter your first name.');
    expect(text()).toContain('Enter a Nigerian mobile number, like 803 555 0142.');
    expect(document.activeElement).toBe(field('First name'));
    expect(puts).toEqual([]);
  });

  it('saves changes with PUT /users and shows them everywhere', async () => {
    await mountAt('/settings');
    await click('Edit profile');
    await type('First name', 'Adaeze');
    await type('Phone number', '0803 555 0199');
    await type('Delivery address', '2 Awolowo Road, Ikoyi, Lagos');
    await click('Save changes');
    await vi.waitFor(() => expect(toasts()).toContain('Profile saved.'));

    expect(ada().user).toMatchObject({
      first_name: 'Adaeze',
      phone: '+2348035550199',
      address: '2 Awolowo Road, Ikoyi, Lagos',
    });
    expect(profile().textContent).toContain('Adaeze Okafor');
    expect(profile().textContent).toContain('+234 803 555 0199');
    expect(body().querySelector('.side-user')?.textContent).toContain('Adaeze Okafor');
    expect(useSessionStore().user?.address).toBe('2 Awolowo Road, Ikoyi, Lagos');
  });

  it('shows the change at once, and puts it back if the API says no', async () => {
    let answer!: () => void;
    const answered = new Promise<void>((resolve) => (answer = resolve));
    server.use(
      http.put(`${BASE}/users`, async () => {
        await answered;
        return HttpResponse.json(
          { status: 'error', message: 'Something went wrong' },
          { status: 500 },
        );
      }),
    );
    await mountAt('/settings');
    await click('Edit profile');
    await type('First name', 'Adaeze');
    await click('Save changes');

    // Optimistic: the new name is on screen while the API thinks about it.
    expect(profile().textContent).toContain('Adaeze Okafor');
    expect(body().querySelector('.side-user')?.textContent).toContain('Adaeze Okafor');
    expect(body().querySelector('.prof-form')).toBeNull();

    answer();
    await vi.waitFor(() =>
      expect(text()).toContain("We couldn't save your changes. Something went wrong"),
    );
    // Rolled back, with the form open again on what they typed.
    expect(useSessionStore().user?.first_name).toBe('Ada');
    expect(body().querySelector('.side-user')?.textContent).toContain('Ada Okafor');
    expect(field('First name').value).toBe('Adaeze');
    expect(ada().user.first_name).toBe('Ada');
    expect(toasts()).not.toContain('Profile saved.');
  });
});

describe('password', () => {
  it('says so under the field when the current password is wrong', async () => {
    await mountAt('/settings');
    await click('Change');
    await type('Current password', 'not-my-password1');
    await type('New password', 'newpass456');
    await click('Save password');
    await vi.waitFor(() =>
      expect(text()).toContain("That's not your current password. Check it and try again."),
    );
    expect(document.activeElement).toBe(field('Current password'));
    expect(ada().password).toBe('password123');
  });

  it('checks the new password, then changes it', async () => {
    await mountAt('/settings');
    await click('Change');
    await type('Current password', 'password123');
    await type('New password', 'short');
    await click('Save password');
    expect(text()).toContain('Use at least 8 characters.');

    await type('New password', 'newpass456');
    await click('Save password');
    await vi.waitFor(() =>
      expect(toasts()).toContain('Password changed. Use the new one next time you sign in.'),
    );
    expect(ada().password).toBe('newpass456');
    expect(body().querySelector('form[aria-label="Change password"]')).toBeNull();
    expect(document.activeElement?.textContent).toContain('Change');
  });
});

describe('reminders', () => {
  it('shows the saved settings and saves each change as it is made', async () => {
    await mountAt('/settings');
    expect(switchFor('Email reminders').checked).toBe(true);
    expect(switchFor('SMS reminders').checked).toBe(true);
    expect(switchFor('WhatsApp reminders').checked).toBe(false);
    expect(switchFor('Renew automatically').checked).toBe(false);
    expect(chip('30 days').getAttribute('aria-pressed')).toBe('true');
    expect(chip('1 day').getAttribute('aria-pressed')).toBe('false');

    switchFor('WhatsApp reminders').click();
    await settle();
    expect(ada().preferences.whatsapp).toBe(true);
    expect(toasts()).toContain('WhatsApp reminders on.');

    await click('1 day', body().querySelector('[aria-labelledby="remind-days"]')!);
    expect(ada().preferences.lead_days).toEqual([30, 14, 7, 1]);
    expect(chip('1 day').getAttribute('aria-pressed')).toBe('true');
  });

  it('puts a change back when it fails to save', async () => {
    server.use(
      http.put(`${BASE}/users/notification-preferences`, () =>
        HttpResponse.json({ status: 'error', message: 'Service unavailable' }, { status: 503 }),
      ),
    );
    await mountAt('/settings');
    switchFor('Renew automatically').click();
    await settle();
    expect(switchFor('Renew automatically').checked).toBe(false);
    expect(toasts()).toContain(
      "We couldn't save that change. Something went wrong on our side. Try again in a moment.",
    );
    expect(ada().preferences.auto_renew).toBe(false);
  });

  it('keeps at least one reminder day', async () => {
    ada().preferences.lead_days = [7];
    await mountAt('/settings');
    await click('7 days', body().querySelector('[aria-labelledby="remind-days"]')!);
    expect(text()).toContain('Keep at least one reminder day.');
    expect(chip('7 days').getAttribute('aria-pressed')).toBe('true');
    expect(ada().preferences.lead_days).toEqual([7]);
  });

  it("isn't shown until the API has reminder settings", async () => {
    testFlags.reminderSettings = false;
    await mountAt('/settings');
    expect(text()).not.toContain('Remind me');
    expect(text()).toContain('Sign-in and security');
  });
});

describe('Google and sign out', () => {
  it('connects Google through Google sign-in, coming back to Settings', async () => {
    const go = vi.spyOn(browser, 'go').mockImplementation(() => {});
    await mountAt('/settings');
    await click('Connect');
    await vi.waitFor(() => expect(go).toHaveBeenCalledTimes(1));
    expect(new URL(go.mock.calls[0]![0]).pathname).toBe('/auth/callback');
    expect(JSON.parse(sessionStorage.getItem('motopapers:oauth')!)).toMatchObject({
      action: 'signin',
      next: '/settings',
    });
  });

  it('signs out', async () => {
    const { router } = await mountAt('/settings');
    await click('Sign out', body().querySelector('.settings')!);
    expect(useSessionStore().isSignedIn).toBe(false);
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/sign-in'));
  });
});

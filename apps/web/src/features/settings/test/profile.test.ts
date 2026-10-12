import { HttpError, type User } from '@motopapers/api';
import { describe, expect, it, vi } from 'vitest';
import { passwordErrors, validatePassword } from '../lib/password';
import { profileBody, profileValues, saveProfile, validateProfile } from '../lib/profile';
import { leadDaysWords, savedMessage, toggleLeadDay } from '../lib/reminders';

const ADA: User = {
  id: 2631,
  first_name: 'Ada',
  last_name: 'Okafor',
  email: 'ada.okafor@example.com',
  phone: '+2348035550142',
  email_verified: true,
  wallet: { id: 2631, balance: 8_500 },
  address: '14 Admiralty Way, Lekki Phase 1, Lagos',
  created_at: '2025-09-01T10:00:00.000Z',
};

function httpError(status: number, message: string, fields?: Record<string, string>) {
  const body = fields ? { status: 'fail', message, data: fields } : { status: 'error', message };
  return new HttpError(status, message, body);
}

describe('profile form', () => {
  it('fills in from the driver, with the phone after +234', () => {
    expect(profileValues(ADA)).toEqual({
      first_name: 'Ada',
      last_name: 'Okafor',
      phone: '803 555 0142',
      address: '14 Admiralty Way, Lekki Phase 1, Lagos',
    });
    expect(profileValues(null)).toEqual({ first_name: '', last_name: '', phone: '', address: '' });
  });

  it('needs a name, a Nigerian mobile number and a whole address', () => {
    expect(
      validateProfile({ first_name: ' ', last_name: '', phone: '12', address: 'Lekki' }, ADA),
    ).toEqual({
      first_name: 'Enter your first name.',
      last_name: 'Enter your last name.',
      phone: 'Enter a Nigerian mobile number, like 803 555 0142.',
      address:
        'Add the street, area and city. Street, area and city, like 14 Admiralty Way, Lekki Phase 1, Lagos.',
    });
    expect(validateProfile(profileValues(ADA), ADA)).toEqual({});
  });

  it('keeps the phone number unless the account never had one; the address can stay empty', () => {
    const values = { ...profileValues(ADA), phone: '', address: '' };
    expect(validateProfile(values, ADA)).toEqual({ phone: 'Enter your phone number.' });
    expect(validateProfile(values, { ...ADA, phone: null })).toEqual({});
  });

  it('sends only what changed, with the phone in international form', () => {
    expect(profileBody(ADA, profileValues(ADA))).toBeNull();
    expect(
      profileBody(ADA, {
        first_name: ' Adaeze ',
        last_name: 'Okafor',
        phone: '0803 555 0199',
        address: '2 Awolowo Road, Ikoyi, Lagos',
      }),
    ).toEqual({
      first_name: 'Adaeze',
      phone: '+2348035550199',
      address: '2 Awolowo Road, Ikoyi, Lagos',
    });
  });
});

describe('saving the profile optimistically', () => {
  function session(user: User | null = ADA) {
    const s = {
      user,
      history: [] as (string | undefined)[],
      setUser(next: User) {
        s.user = next;
        s.history.push(next.first_name);
      },
    };
    return s;
  }

  it('shows the new details straight away and keeps what the API sends back', async () => {
    const s = session();
    let resolve!: (user: User) => void;
    const update = vi.fn(() => new Promise<User>((r) => (resolve = r)));
    const saving = saveProfile(s, { first_name: 'Adaeze' }, update);
    expect(s.user?.first_name).toBe('Adaeze'); // Before the API answers.
    resolve({ ...ADA, first_name: 'Adaeze', updated_at: '2026-10-12T09:00:00Z' });
    await expect(saving).resolves.toMatchObject({ first_name: 'Adaeze' });
    expect(s.user).toMatchObject({ first_name: 'Adaeze', updated_at: '2026-10-12T09:00:00Z' });
    expect(update).toHaveBeenCalledWith({ first_name: 'Adaeze' });
  });

  it('puts the old details back when the API says no', async () => {
    const s = session();
    const failure = httpError(500, 'Something went wrong');
    const update = vi.fn().mockRejectedValue(failure);
    await expect(saveProfile(s, { first_name: 'Adaeze' }, update)).rejects.toBe(failure);
    expect(s.user).toEqual(ADA);
    expect(s.history).toEqual(['Adaeze', 'Ada']);
  });

  it("doesn't let an older save that fails undo a newer one", async () => {
    const s = session();
    let failFirst!: (error: unknown) => void;
    const first = saveProfile(
      s,
      { first_name: 'Adaeze' },
      () => new Promise<User>((_, reject) => (failFirst = reject)),
    );
    const second = saveProfile(s, { last_name: 'Obi' }, async () => ({
      ...ADA,
      first_name: 'Adaeze',
      last_name: 'Obi',
    }));
    await second;
    failFirst(httpError(500, 'Timeout'));
    await expect(first).rejects.toBeTruthy();
    expect(s.user).toMatchObject({ first_name: 'Adaeze', last_name: 'Obi' });
  });

  it('needs someone signed in', async () => {
    await expect(saveProfile(session(null), { first_name: 'X' }, vi.fn())).rejects.toThrow(
      'Sign in to change your profile.',
    );
  });
});

describe('change password', () => {
  it('needs the current password and a good new one', () => {
    expect(validatePassword({ old_password: '', new_password: 'short' })).toEqual({
      old_password: 'Enter your current password.',
      new_password: 'Use at least 8 characters.',
    });
    expect(validatePassword({ old_password: 'password123', new_password: 'password123' })).toEqual({
      new_password: "Choose a password that's different from your current one.",
    });
    expect(validatePassword({ old_password: 'password123', new_password: 'newpass456' })).toEqual(
      {},
    );
  });

  it('puts a wrong current password under its field', () => {
    expect(passwordErrors(httpError(400, 'Invalid old password'))).toEqual({
      old_password: "That's not your current password. Check it and try again.",
    });
    expect(
      passwordErrors(
        httpError(400, 'Invalid params', { new_password: 'new_password is required' }),
      ),
    ).toEqual({ new_password: 'New password is required.' });
    expect(passwordErrors(httpError(500, 'Something went wrong'))).toEqual({});
  });
});

describe('reminder days', () => {
  it('turns days on and off, keeping at least one', () => {
    expect(toggleLeadDay([30, 14, 7], 1)).toEqual([30, 14, 7, 1]);
    expect(toggleLeadDay([30, 14, 7], 14)).toEqual([30, 7]);
    expect(toggleLeadDay([7], 7)).toBeNull();
  });

  it('says what changed', () => {
    const before = {
      email: true,
      sms: true,
      whatsapp: false,
      lead_days: [30, 14, 7],
      auto_renew: false,
    };
    expect(savedMessage(before, { ...before, whatsapp: true })).toBe('WhatsApp reminders on.');
    expect(savedMessage(before, { ...before, email: false })).toBe('Email reminders off.');
    expect(savedMessage(before, { ...before, lead_days: [30, 7] })).toBe(
      "We'll remind you 30 and 7 days before each expiry date.",
    );
    expect(leadDaysWords([1])).toBe('1 day');
    expect(leadDaysWords([7, 30, 14])).toBe('30, 14 and 7 days');
  });
});

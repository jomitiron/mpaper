import {
  MOCK_EXPIRED_OTP,
  MOCK_INVALID_OTP,
  SAMPLE_EMAIL,
  SAMPLE_PASSWORD,
} from '@motopapers/api/mocks';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSessionStore } from '@/stores/session';
import { browser } from '../lib/google';
import { authEmail, oauthState } from '../lib/handoff';
import {
  button,
  field,
  mountApp,
  settle,
  toasts,
  typeCode,
  useMockApi,
  waitForPath,
} from './harness';

const api = useMockApi();

afterEach(() => {
  vi.restoreAllMocks();
});

function paths() {
  return api.requests.map((request) => `${request.method} ${new URL(request.url).pathname}`);
}

describe('sign in', () => {
  it('matches the design', async () => {
    const { wrapper } = await mountApp(api, '/sign-in');
    expect(wrapper.get('h1').text()).toBe('Sign in');
    expect(wrapper.text()).toContain('Pick up where you left off.');
    expect(wrapper.get('.auth-art h2').text()).toBe('Welcome back. Your papers are waiting.');
    expect(button(wrapper, 'Continue with Google').exists()).toBe(true);
    expect(button(wrapper, 'Forgot password?').attributes('href')).toBe('/forgot-password');
    expect(button(wrapper, 'Create an account').attributes('href')).toBe('/sign-up');
    expect(field(wrapper, 'Email').attributes('type')).toBe('email');
    expect(field(wrapper, 'Password').attributes('type')).toBe('password');
  });

  it('says what is missing, under each field, without calling the API', async () => {
    const { wrapper } = await mountApp(api, '/sign-in');
    await wrapper.get('form').trigger('submit');
    await settle();
    expect(wrapper.text()).toContain('Enter your email address.');
    expect(wrapper.text()).toContain('Enter your password.');
    expect(document.activeElement).toBe(field(wrapper, 'Email').element);
    expect(paths()).toEqual([]);
  });

  it('explains a wrong password in plain words', async () => {
    const { wrapper } = await mountApp(api, '/sign-in');
    await field(wrapper, 'Email').setValue(SAMPLE_EMAIL);
    await field(wrapper, 'Password').setValue('not-it');
    await wrapper.get('form').trigger('submit');
    await settle();
    expect(wrapper.get('[role="alert"]').text()).toBe(
      "That email and password don't match. Check them and try again.",
    );
    expect(useSessionStore().isSignedIn).toBe(false);
  });

  it('signs in, keeps the session if asked, and goes back to where the driver was', async () => {
    const { wrapper, router } = await mountApp(api, '/sign-in?next=/payments');
    await field(wrapper, 'Email').setValue(SAMPLE_EMAIL);
    await field(wrapper, 'Password').setValue(SAMPLE_PASSWORD);
    await wrapper.get('input[type="checkbox"]').setValue(true);
    await wrapper.get('form').trigger('submit');
    await waitForPath(router, '/payments');
    const session = useSessionStore();
    expect(session.user?.first_name).toBe('Ada');
    expect(session.remember).toBe(true);
    expect(localStorage.getItem('motopapers:session')).toContain(SAMPLE_EMAIL);
  });

  it('shows the password on request', async () => {
    const { wrapper } = await mountApp(api, '/sign-in');
    const toggle = wrapper.get('button[aria-label="Show password"]');
    await toggle.trigger('click');
    expect(field(wrapper, 'Password').attributes('type')).toBe('text');
    expect(toggle.attributes('aria-pressed')).toBe('true');
  });

  it('offers to verify the email when the API fails an unverified sign-in', async () => {
    api.db.createAccount({
      first_name: 'Tolu',
      last_name: 'Adeyemi',
      email: 'tolu@example.com',
      phone: '+2348030000000',
      password: 'tolu2026',
    });
    const { wrapper, router } = await mountApp(api, '/sign-in');
    await field(wrapper, 'Email').setValue('tolu@example.com');
    await field(wrapper, 'Password').setValue('tolu2026');
    await wrapper.get('form').trigger('submit');
    await settle();
    expect(wrapper.get('[role="alert"]').text()).toContain('verify your email first');

    await button(wrapper, 'Verify my email').trigger('click');
    await waitForPath(router, '/sign-up?step=verify');
    expect(paths()).toContain('POST /users/resend-verification-email');
    expect(wrapper.get('h1').text()).toBe('Check your email');
    expect(wrapper.text()).toContain('tolu@example.com');
  });

  it('leaves for Google with what to do on the way back', async () => {
    const go = vi.spyOn(browser, 'go').mockImplementation(() => {});
    const { wrapper } = await mountApp(api, '/sign-in?next=/cars');
    await button(wrapper, 'Continue with Google').trigger('click');
    await settle();
    expect(go).toHaveBeenCalledWith(expect.stringContaining('/auth/callback?action=signin&code='));
    expect(oauthState.take()).toEqual({
      action: 'signin',
      next: '/cars',
      remember: false,
      newAccount: false,
      field: 'platform',
    });
  });
});

describe('sign up', () => {
  async function fillAccount(wrapper: Awaited<ReturnType<typeof mountApp>>['wrapper']) {
    await field(wrapper, 'First name').setValue('Tolu');
    await field(wrapper, 'Last name').setValue('Adeyemi');
    await field(wrapper, 'Phone number').setValue('0803 000 0000');
    await field(wrapper, 'Email').setValue('tolu@example.com');
    await field(wrapper, 'Password').setValue('tolu2026');
  }

  it('creates an account, verifies the email and offers the first car', async () => {
    const { wrapper } = await mountApp(api, '/sign-up');
    expect(wrapper.get('h1').text()).toBe('Create your account');
    expect(wrapper.get('[aria-current="step"]').text()).toBe('Account');
    expect(field(wrapper, 'Password').attributes('aria-describedby')).toBeDefined();
    expect(wrapper.text()).toContain('At least 8 characters, including a number.');

    await fillAccount(wrapper);
    await wrapper.get('form').trigger('submit');
    await settle();

    const signUp = api.requests.find((r) => r.url.endsWith('/users/sign-up'))!;
    expect(await signUp.json()).toEqual({
      first_name: 'Tolu',
      last_name: 'Adeyemi',
      email: 'tolu@example.com',
      phone: '+2348030000000',
      password: 'tolu2026',
    });
    expect(wrapper.get('h1').text()).toBe('Check your email');
    expect(wrapper.get('[aria-current="step"]').text()).toBe('Verify email');
    expect(wrapper.text()).toContain('We sent a 6-digit code to tolu@example.com');
    // Sign-up just sent a code, so "Send a new code" waits.
    expect(wrapper.text()).toMatch(/Send a new code in (1:00|0:5\d)/);

    await typeCode(wrapper, MOCK_INVALID_OTP);
    expect(wrapper.text()).toContain("That code isn't right.");
    expect(useSessionStore().isSignedIn).toBe(false);

    await typeCode(wrapper, '482913');
    expect(useSessionStore().user?.email).toBe('tolu@example.com');
    expect(wrapper.get('h1').text()).toBe('Add your first car');
    expect(button(wrapper, 'Upload licence').attributes('href')).toBe('/cars/new');
    expect(button(wrapper, 'Skip for now').attributes('href')).toBe('/');
  });

  it('checks the form before calling the API', async () => {
    const { wrapper } = await mountApp(api, '/sign-up');
    await field(wrapper, 'Phone number').setValue('12345');
    await field(wrapper, 'Password').setValue('password');
    await wrapper.get('form').trigger('submit');
    await settle();
    expect(wrapper.text()).toContain('Enter your first name.');
    expect(wrapper.text()).toContain('Enter a Nigerian mobile number, like 803 555 0142.');
    expect(wrapper.text()).toContain('Include at least one number.');
    expect(paths()).toEqual([]);
  });

  it('says when the email already has an account', async () => {
    const { wrapper } = await mountApp(api, '/sign-up');
    await fillAccount(wrapper);
    await field(wrapper, 'Email').setValue(SAMPLE_EMAIL);
    await wrapper.get('form').trigger('submit');
    await settle();
    expect(wrapper.text()).toContain("There's already an account with this email.");
    expect(field(wrapper, 'Email').attributes('aria-invalid')).toBe('true');
  });

  it('goes back to fix the email without signing up twice', async () => {
    const { wrapper, router } = await mountApp(api, '/sign-up');
    await fillAccount(wrapper);
    await wrapper.get('form').trigger('submit');
    await settle();
    await button(wrapper, 'Change it').trigger('click');
    await settle();
    expect(router.currentRoute.value.fullPath).toBe('/sign-up');
    expect(field(wrapper, 'Email').element.value).toBe('tolu@example.com');

    await wrapper.get('form').trigger('submit');
    await settle();
    expect(wrapper.get('h1').text()).toBe('Check your email');
    expect(paths().filter((path) => path === 'POST /users/sign-up')).toHaveLength(1);
  });

  it('reopens the verify step after a refresh', async () => {
    authEmail.set('tolu@example.com');
    const { wrapper } = await mountApp(api, '/sign-up?step=verify');
    expect(wrapper.get('h1').text()).toBe('Check your email');
    expect(wrapper.text()).toContain('tolu@example.com');
  });

  it('sends a new code', async () => {
    api.db.createAccount({
      first_name: 'Tolu',
      last_name: 'Adeyemi',
      email: 'tolu@example.com',
      phone: '+2348030000000',
      password: 'tolu2026',
    });
    authEmail.set('tolu@example.com');
    const { wrapper } = await mountApp(api, '/sign-up?step=verify');
    await button(wrapper, 'Send a new code').trigger('click');
    await settle();
    expect(paths()).toContain('POST /users/resend-verification-email');
    expect(toasts()).toContain('A new code is on its way to tolu@example.com.');
    expect(wrapper.text()).toMatch(/Send a new code in \d:\d\d/);
  });
});

describe('forgot and reset password', () => {
  it('sends a code, then sets a new password with it', async () => {
    const { wrapper, router } = await mountApp(api, '/forgot-password');
    expect(wrapper.get('h1').text()).toBe('Forgot your password?');
    await field(wrapper, 'Email').setValue(SAMPLE_EMAIL);
    await wrapper.get('form').trigger('submit');
    await waitForPath(router, '/reset-password');
    expect(wrapper.text()).toContain(`Enter the 6-digit code we sent to ${SAMPLE_EMAIL}`);

    await typeCode(wrapper, MOCK_EXPIRED_OTP);
    await field(wrapper, 'New password').setValue('newpass2026');
    await wrapper.get('form').trigger('submit');
    await settle();
    expect(wrapper.text()).toContain('That code has expired. Send a new code and try again.');

    await typeCode(wrapper, '123456');
    await wrapper.get('form').trigger('submit');
    await waitForPath(router, '/sign-in');
    expect(toasts()).toContain('Password changed. Sign in with your new password.');
    expect(field(wrapper, 'Email').element.value).toBe(SAMPLE_EMAIL);
    expect(api.db.accountByEmail(SAMPLE_EMAIL)?.password).toBe('newpass2026');
  });

  it('takes the email and code from the link in the email', async () => {
    const { wrapper } = await mountApp(
      api,
      `/reset-password?email=${encodeURIComponent(SAMPLE_EMAIL)}&otp=123456`,
    );
    expect(wrapper.text()).toContain(SAMPLE_EMAIL);
    expect(wrapper.findAll<HTMLInputElement>('.otp input').map((i) => i.element.value)).toEqual([
      ...'123456',
    ]);
  });

  it('asks for the email when it does not know it', async () => {
    const { wrapper } = await mountApp(api, '/reset-password');
    expect(field(wrapper, 'Email').element).toBeInstanceOf(HTMLInputElement);
  });
});

describe('Google callback', () => {
  it('signs in with the code and goes on', async () => {
    oauthState.save({ action: 'signin', next: '/cars', remember: true });
    const { router } = await mountApp(api, '/auth/callback?action=signin&code=mock-oauth-code');
    await waitForPath(router, '/cars');
    expect(useSessionStore().user?.email).toBe(SAMPLE_EMAIL);
    expect(useSessionStore().remember).toBe(true);
    const body = await api.requests.find((r) => r.url.endsWith('/users/sign-in'))!.json();
    expect(body).toEqual({ oauth_code: 'mock-oauth-code', oauth_platform: 'google' });
  });

  it('sends oauth_type to an API that asked for `type` on the way out (ijanla-dev)', async () => {
    oauthState.save({ action: 'signin', next: '/', remember: false, field: 'type' });
    await mountApp(api, '/auth/callback?action=signin&code=mock-oauth-code');
    await vi.waitFor(() =>
      expect(api.requests.some((r) => r.url.endsWith('/users/sign-in'))).toBe(true),
    );
    const body = await api.requests.find((r) => r.url.endsWith('/users/sign-in'))!.json();
    expect(body).toEqual({ oauth_code: 'mock-oauth-code', oauth_type: 'google' });
  });

  it("works at the old app's /complete-onboard address the API uses today", async () => {
    const { router } = await mountApp(
      api,
      '/complete-onboard?complete-signup=google&action=signin&code=mock-oauth-code',
    );
    await waitForPath(router, '/');
    expect(useSessionStore().isSignedIn).toBe(true);
  });

  it('after a Google sign-up, signs in through Google again, then offers the first car', async () => {
    const go = vi.spyOn(browser, 'go').mockImplementation(() => {});
    oauthState.save({ action: 'signup', next: '/', remember: false });
    const first = await mountApp(api, '/auth/callback?action=signup&code=mock-oauth-code');
    expect(paths()).toContain('POST /users/sign-up');
    expect(go).toHaveBeenCalledWith(expect.stringContaining('action=signin'));
    expect(first.wrapper.text()).toContain('Signing you in');
    first.wrapper.unmount();

    const back = await mountApp(api, '/auth/callback?action=signin&code=mock-oauth-code');
    expect(useSessionStore().isSignedIn).toBe(true);
    expect(back.wrapper.get('h1').text()).toBe('Add your first car');
  });

  it('explains a Google account with no MotoPapers account', async () => {
    const { wrapper, router } = await mountApp(api, '/auth/callback?action=signin&code=other');
    expect(wrapper.get('[role="alert"]').text()).toContain("couldn't find a MotoPapers account");
    expect(button(wrapper, 'Sign up with Google').exists()).toBe(true);
    expect(router.currentRoute.value.query.code).toBeUndefined();
  });

  it('notices a cancelled Google sign-in', async () => {
    const { wrapper } = await mountApp(api, '/auth/callback?error=access_denied');
    expect(wrapper.get('[role="alert"]').text()).toBe('You cancelled signing in with Google.');
    expect(paths()).toEqual([]);
  });
});

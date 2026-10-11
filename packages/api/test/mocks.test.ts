import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  configureApi,
  createInsurance,
  createRenewal,
  createRoadworthiness,
  createVehicle,
  createVehicleLicense,
  debitWallet,
  DEFAULT_DOC_READER_URL,
  DEFAULT_PRICING,
  deleteVehicle,
  forgotPassword,
  getMe,
  getNotificationPreferences,
  getOAuthUrl,
  getPricing,
  getTransaction,
  getValidInsurance,
  getValidRoadworthiness,
  getValidVehicleLicense,
  getVehicle,
  getWalletBalance,
  initializeTransaction,
  listInsurance,
  listInsuranceCompanies,
  listRenewals,
  listRoadworthiness,
  listTransactions,
  listVehicleLicenses,
  listVehicleRenewals,
  listVehicles,
  parseStreamMessage,
  readVehicleLicence,
  resendVerificationEmail,
  resetPassword,
  signIn,
  signOut,
  signUp,
  tokenExpiresAt,
  updateNotificationPreferences,
  updatePassword,
  updateUser,
  updateVehicleColor,
  vehicleStatus,
  verifyEmail,
  verifyPayment,
  type HttpError,
} from '../src';
import {
  createHandlers,
  createMockDb,
  MOCK_EXPIRED_OTP,
  MOCK_INVALID_OTP,
  MOCK_OAUTH_CODE,
  PAYMENT_SETTLE_MS,
  RENEWAL_STEP_MS,
  SAMPLE_EMAIL,
  SAMPLE_PASSWORD,
  type MockDb,
} from '../src/mocks';

const BASE = 'https://api.test';
const TODAY = '2026-10-11';

let clock = Date.parse('2026-10-11T09:00:00Z');
let db: MockDb;
let token: string | null = null;
const onUnauthorized = vi.fn();

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());

beforeEach(async () => {
  clock = Date.parse('2026-10-11T09:00:00Z');
  db = createMockDb({ today: TODAY, now: () => clock });
  server.resetHandlers(
    ...createHandlers({ baseUrl: BASE, db, appOrigin: 'http://app.test', transactionLabels: true }),
  );
  configureApi({ baseUrl: BASE, getToken: () => token, onUnauthorized });
  onUnauthorized.mockClear();
  token = (await signIn({ email: SAMPLE_EMAIL, password: SAMPLE_PASSWORD })).token;
});

afterEach(() => {
  token = null;
});

const httpError = (promise: Promise<unknown>) =>
  promise.then(
    () => {
      throw new Error('Expected the request to fail');
    },
    (error: unknown) => error as HttpError,
  );

describe('sign-in and account', () => {
  it('signs in as the sample driver with a 30-minute token', async () => {
    const session = await signIn({ email: 'ADA.OKAFOR@example.com', password: SAMPLE_PASSWORD });
    expect(session.user).toMatchObject({
      first_name: 'Ada',
      last_name: 'Okafor',
      wallet: { balance: 8500 },
    });
    expect(tokenExpiresAt(session.token)).toBe(clock + 30 * 60 * 1000);
  });

  it('refuses a wrong password without calling the 401 hook', async () => {
    const error = await httpError(signIn({ email: SAMPLE_EMAIL, password: 'nope' }));
    expect(error).toMatchObject({ status: 401, message: 'Invalid credentials' });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('calls the 401 hook once the token expires', async () => {
    clock += 30 * 60 * 1000 + 1;
    await expect(listVehicles()).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it('signs up, verifies with a code and starts empty', async () => {
    const user = await signUp({
      first_name: 'Tolu',
      last_name: 'Adeyemi',
      email: 'tolu@example.com',
      phone: '+2348030000000',
      password: 'secret123',
    });
    expect(user.email_verified).toBe(false);
    expect(
      (await httpError(verifyEmail({ email: user.email, otp: MOCK_INVALID_OTP }))).isExpired,
    ).toBe(false);
    const session = await verifyEmail({ email: user.email, otp: '482913' });
    expect(session.user.email_verified).toBe(true);
    token = session.token;
    expect(await listVehicles()).toEqual([]);
    expect((await getWalletBalance()).balance).toBe(0);
  });

  it('reports field errors on sign-up', async () => {
    const error = await httpError(
      signUp({
        first_name: 'Tolu',
        last_name: '',
        email: 'nope',
        phone: '1',
        password: 'secret123',
      }),
    );
    expect(error.fields).toMatchObject({
      last_name: expect.any(String),
      email: 'email must be a valid email',
    });
  });

  it('handles Google through the mock OAuth code', async () => {
    const url = await getOAuthUrl({ platform: 'google', action: 'signin' });
    expect(url).toBe(`http://app.test/auth/callback?code=${MOCK_OAUTH_CODE}&state=moto`);
    const session = await signIn({ oauth_code: MOCK_OAUTH_CODE, oauth_platform: 'google' });
    expect(session.user.email).toBe(SAMPLE_EMAIL);
  });

  it('resets a password with a code, and knows an expired one', async () => {
    await forgotPassword({ email: SAMPLE_EMAIL });
    const expired = await httpError(
      resetPassword({ email: SAMPLE_EMAIL, otp: MOCK_EXPIRED_OTP, password: 'x' }),
    );
    expect(expired).toMatchObject({ message: 'Expired OTP', isExpired: true });
    await resetPassword({ email: SAMPLE_EMAIL, otp: '123456', password: 'newpass123' });
    await expect(signIn({ email: SAMPLE_EMAIL, password: 'newpass123' })).resolves.toBeTruthy();
  });

  it('updates the profile and password', async () => {
    const user = await updateUser({ first_name: 'Adaeze', address: '1 Marina, Lagos' });
    expect(user).toMatchObject({ first_name: 'Adaeze', address: '1 Marina, Lagos' });
    expect((await getMe()).first_name).toBe('Adaeze');
    await expect(
      updatePassword({ old_password: 'wrong', new_password: 'x' }),
    ).rejects.toMatchObject({
      message: 'Invalid old password',
    });
    await updatePassword({ old_password: SAMPLE_PASSWORD, new_password: 'another123' });
  });

  it('resends the code only for unverified emails', async () => {
    await expect(resendVerificationEmail({ email: SAMPLE_EMAIL })).rejects.toMatchObject({
      message: 'User email has already been verified',
    });
  });

  it('signs out', async () => {
    await expect(signOut()).resolves.toBeUndefined();
  });
});

describe('cars and papers', () => {
  it('returns the four design cars with their statuses', async () => {
    const cars = await listVehicles();
    expect(cars.map((c) => c.plate_number)).toEqual([
      'KJA 731 AE',
      'EKY 219 GD',
      'LSD 482 KJ',
      'APP 105 BC',
    ]);
    const [kja, eky, lsd, app] = cars.map((car) => vehicleStatus(car, TODAY));
    expect(kja!.papers.insurance).toMatchObject({ state: 'due', daysLeft: 9 });
    expect(kja!.papers.vehicle_license.daysLeft).toBe(154);
    expect(eky!.papers.vehicle_license).toMatchObject({ state: 'expired', daysLeft: -13 });
    expect(eky!.papers.roadworthiness.daysLeft).toBe(23);
    expect(lsd!.state).toBe('valid');
    expect(app!.state).toBe('untracked');
    expect(cars[0]!.insurance?.cover_type).toBe('third_party');
  });

  it('adds a car, refuses the same plate twice, and adds its papers', async () => {
    const car = await createVehicle({
      plate_number: 'KTU 604 XR',
      brand: 'Toyota',
      model: 'Corolla',
      color: 'Grey',
      engine_number: '2ZR-6618023',
      chassis_number: '2T1BURHE0KC184362',
      engine_capacity: '1,798 cc',
      is_paid_tier: true,
    });
    expect(car.vehicle_license).toBeNull();

    const duplicate = await httpError(
      createVehicle({ ...car, plate_number: 'ktu-604-xr', is_paid_tier: true }),
    );
    expect(duplicate.status).toBe(409);

    await createVehicleLicense(car.id, { license_pin: 'K7Q2M9XR4D', expiry_date: '2027-03-02' });
    await createInsurance(car.id, {
      cover_type: 'comprehensive',
      vehicle_value: 9_500_000,
      expiry_date: '2027-04-18',
    });
    await createRoadworthiness(car.id, { expiry_date: '2027-01-09' });

    const saved = await getVehicle(car.id);
    expect(saved.vehicle_license).toMatchObject({
      license_pin: 'K7Q2M9XR4D',
      expiry_date: '2027-03-02',
    });
    expect(saved.insurance?.vehicle_value).toBe(9_500_000);
    expect(saved.roadworthiness?.expiry_date).toBe('2027-01-09');
    expect(vehicleStatus(saved, TODAY).state).toBe('valid');
  });

  it('keeps paper history, newest first, and the valid one', async () => {
    await createInsurance(101, {
      cover_type: 'third_party',
      vehicle_value: 1,
      expiry_date: '2027-10-20',
    });
    expect((await listInsurance(101)).map((r) => r.expiry_date)).toEqual([
      '2027-10-20',
      '2026-10-20',
    ]);
    expect((await getValidInsurance(101))?.expiry_date).toBe('2027-10-20');
    expect(await listVehicleLicenses(102)).toHaveLength(1);
    expect(await getValidVehicleLicense(102)).toBeNull();
    expect(await listRoadworthiness(104)).toEqual([]);
    expect(await getValidRoadworthiness(104)).toBeNull();
    expect((await getVehicle(101)).insurance?.expiry_date).toBe('2027-10-20');
  });

  it('validates paper bodies', async () => {
    const error = await httpError(
      createInsurance(101, {
        cover_type: 'fully' as never,
        vehicle_value: 1,
        expiry_date: '20/10/2027',
      }),
    );
    expect(Object.keys(error.fields).sort()).toEqual(['cover_type', 'expiry_date']);
  });

  it('changes colour and deletes', async () => {
    expect((await updateVehicleColor(104, 'Black')).color).toBe('Black');
    await deleteVehicle(104);
    await expect(getVehicle(104)).rejects.toMatchObject({
      status: 400,
      message: 'Vehicle does not exist',
    });
  });

  it('lists the 57 insurers', async () => {
    expect(await listInsuranceCompanies()).toHaveLength(57);
  });
});

describe('payments', () => {
  it('pages and filters transactions', async () => {
    const page = await listTransactions({ per_page: 4 });
    expect(page.items).toHaveLength(4);
    expect(page.meta).toEqual({ page: 1, total: 6, per_page: 4, page_count: 2 });
    const pending = await listTransactions({ status: 'pending' });
    expect(pending.items.map((t) => t.amount)).toEqual([18500, 1000]);
    expect(pending.items[0]).toMatchObject({
      category: 'renewal',
      description: 'Licence renewal',
      vehicle_id: 102,
    });
  });

  it('leaves labels off when the backend has not shipped them', async () => {
    server.use(...createHandlers({ baseUrl: BASE, db, transactionLabels: false }));
    const { items } = await listTransactions();
    expect(items[0]!.category).toBeUndefined();
    expect(items[0]!.transaction_type).toBe('debit');
  });

  it('tops up through the mock Paystack and streams the result', async () => {
    const { auth_url, reference } = await initializeTransaction({
      amount: 20_000,
      transaction_category: 'wallet_transaction',
    });
    expect(auth_url).toBe(
      `http://app.test/payments/callback?reference=${encodeURIComponent(reference)}&trxref=${encodeURIComponent(reference)}`,
    );
    const pending = (await listTransactions({ per_page: 1 })).items[0]!;
    expect(pending).toMatchObject({
      status: 'pending',
      transaction_type: 'credit',
      payment: { reference },
    });

    clock += PAYMENT_SETTLE_MS;
    const response = await fetch(`${BASE}/transactions/completed-payment/${reference}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.headers.get('content-type')).toBe('text/event-stream');
    const body = await response.text();
    expect(body.startsWith(`event: ${reference}\ndata: `)).toBe(true);
    const data = body.split('\n')[1]!.slice('data: '.length);
    expect(parseStreamMessage(data)).toMatchObject({
      status: 'success',
      payment: { amount: 20_000 },
    });

    expect((await getWalletBalance()).balance).toBe(28_500);
    expect((await getTransaction(pending.id)).status).toBe('success');
    expect((await verifyPayment(reference)).status).toBe('success');
  });

  it('fails amounts ending in 13', async () => {
    const { reference } = await initializeTransaction({
      amount: 1013,
      transaction_category: 'wallet_transaction',
    });
    clock += PAYMENT_SETTLE_MS;
    expect((await verifyPayment(reference)).status).toBe('failed');
    expect((await getWalletBalance()).balance).toBe(8500);
  });

  it('pays from the wallet, or refuses when it is short', async () => {
    const paid = await debitWallet({ amount: 2500, category: 'service_charge', vehicle_id: 101 });
    expect(paid.wallet.balance).toBe(6000);
    expect(paid.transaction).toMatchObject({
      status: 'success',
      description: 'Tracking and reminders',
    });
    const short = await httpError(debitWallet({ amount: 1_000_000, category: 'service_charge' }));
    expect(short).toMatchObject({ status: 400, message: 'Insufficient balance' });
  });

  it('serves prices, falling back to the defaults when the endpoint fails', async () => {
    expect(await getPricing()).toEqual(DEFAULT_PRICING);
    server.use(http.get(`${BASE}/pricing`, () => HttpResponse.json({}, { status: 404 })));
    expect(await getPricing()).toEqual(DEFAULT_PRICING);
  });
});

describe('renewals and reminders', () => {
  it('renews from the wallet and moves through each status', async () => {
    const delivery_address = '14 Admiralty Way, Lekki Phase 1, Lagos';
    // Ada has ₦8,500: not enough for a ₦18,500 licence, enough for ₦6,500 roadworthiness.
    const short = await httpError(
      createRenewal(102, {
        document_type: 'vehicle_license',
        pay_with: 'wallet',
        delivery_address,
      }),
    );
    expect(short).toMatchObject({ status: 400, message: 'Insufficient balance' });

    const { renewal, auth_url } = await createRenewal(102, {
      document_type: 'roadworthiness',
      pay_with: 'wallet',
      delivery_address,
    });
    expect(auth_url).toBeUndefined();
    expect(renewal).toMatchObject({ status: 'paid', amount: 6_500, vehicle_id: 102 });
    expect((await getWalletBalance()).balance).toBe(2_000);

    clock += RENEWAL_STEP_MS;
    expect((await listVehicleRenewals(102))[0]!.status).toBe('processing');
    clock += RENEWAL_STEP_MS;
    expect((await listVehicleRenewals(102))[0]!.status).toBe('out_for_delivery');
    clock += RENEWAL_STEP_MS;
    const [delivered] = await listRenewals();
    // One year on from the current expiry (3 Nov 2026), as it hasn't expired yet.
    expect(delivered).toMatchObject({ status: 'delivered', new_expiry_date: '2027-11-03' });
    expect((await getVehicle(102)).roadworthiness?.expiry_date).toBe('2027-11-03');
  });

  it('renews by card through Paystack', async () => {
    const { renewal, auth_url } = await createRenewal(101, {
      document_type: 'insurance',
      pay_with: 'card',
      delivery_address: '14 Admiralty Way',
    });
    expect(renewal.status).toBe('awaiting_payment');
    expect(auth_url).toContain('/payments/callback?reference=MOT-');
    clock += PAYMENT_SETTLE_MS;
    expect((await listVehicleRenewals(101))[0]!.status).toBe('paid');
  });

  it('saves reminder settings', async () => {
    expect(await getNotificationPreferences()).toEqual({
      email: true,
      sms: true,
      whatsapp: false,
      lead_days: [30, 14, 7],
      auto_renew: false,
    });
    const saved = await updateNotificationPreferences({
      email: true,
      sms: false,
      whatsapp: true,
      lead_days: [7, 30, 1],
      auto_renew: true,
    });
    expect(saved.lead_days).toEqual([30, 7, 1]);
  });
});

describe('document reader', () => {
  it('reads the sample licence', async () => {
    configureApi({ docReaderUrl: DEFAULT_DOC_READER_URL });
    const reading = await readVehicleLicence({ base64: 'aGVsbG8=' });
    expect(reading.vehicle.plate_number).toBe('KTU 604 XR');
    expect(reading.licence.expiry_date).toBe('2027-03-02');
  });
});

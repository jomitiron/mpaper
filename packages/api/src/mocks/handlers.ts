import { delay, http, HttpResponse, type HttpHandler, type PathParams } from 'msw';
import { DEFAULT_DOC_READER_URL, isRecord } from '../client';
import { DEFAULT_PRICING, documentTypes, type DocumentType } from '../schemas/gaps';
import { coverTypes } from '../schemas/papers';
import { transactionCategories, transactionStatuses } from '../schemas/transaction';
import { samePlate } from '../plates';
import { createMockDb, type MockDb } from './db';
import {
  SAMPLE_EMAIL,
  SAMPLE_LICENCE_READING,
  type MockAccount,
  type MockRenewal,
  type MockTransaction,
} from './fixtures';
import { INSURANCE_COMPANIES } from './insuranceCompanies';
import { createMockToken, readMockToken } from './token';

/**
 * MSW handlers for every documented endpoint, the endpoints in docs/phases/api-gaps.md and the
 * document reader. See ./README.md for the sample account and the special values that trigger
 * errors.
 */

export interface MockHandlerOptions {
  /** API origin the app calls (VITE_API_BASE_URL). */
  baseUrl: string;
  /** Document reader URL (VITE_DOC_PARSER_URL). */
  docReaderUrl?: string;
  /** Shared data. Defaults to a fresh in-memory database. */
  db?: MockDb;
  /** Web app origin, for the mock Paystack checkout and Google redirects. */
  appOrigin?: string;
  /** Include transaction labels (category, description…). Mirrors VITE_FLAG_TX_LABELS. */
  transactionLabels?: boolean;
  /** Simulated network delay in ms. Keep 0 in tests. */
  latency?: number;
}

export const MOCK_OAUTH_CODE = 'mock-oauth-code';
/** OTP codes with special meaning; any other 6 digits work. */
export const MOCK_INVALID_OTP = '000000';
export const MOCK_EXPIRED_OTP = '999999';

type Ctx = { request: Request; params: PathParams };
type AuthedCtx = Ctx & { account: MockAccount };
type Handler = (ctx: Ctx) => Response | Promise<Response>;

export function createHandlers(options: MockHandlerOptions): HttpHandler[] {
  const base = options.baseUrl.replace(/\/+$/, '');
  const db = options.db ?? createMockDb();
  const latency = options.latency ?? 0;
  const appOrigin = (
    options.appOrigin ??
    (typeof location === 'undefined' ? 'http://localhost:5170' : location.origin)
  ).replace(/\/+$/, '');

  const wait = (ms = latency) => (ms > 0 ? delay(ms + Math.round(Math.random() * ms)) : undefined);

  /** Public endpoint. */
  const open =
    (fn: Handler) =>
    async (ctx: Ctx): Promise<Response> => {
      await wait();
      db.tick();
      return fn(ctx);
    };

  /** Needs `Authorization: Bearer <token>`; a missing or expired token is a 401. */
  const authed =
    (fn: (ctx: AuthedCtx) => Response | Promise<Response>) =>
    async (ctx: Ctx): Promise<Response> => {
      await wait();
      db.tick();
      const token = (ctx.request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
      const claims = token ? readMockToken(token) : null;
      const account =
        claims && claims.exp * 1000 > db.now() ? db.accountById(claims.id) : undefined;
      if (!account) return error(401, 'Unauthorized');
      return fn({ ...ctx, account });
    };

  const session = (account: MockAccount) => ({
    user: db.userView(account),
    token: createMockToken(account.user, db.now()),
  });

  const vehicleOf = (account: MockAccount, params: PathParams) =>
    account.vehicles.find((v) => v.id === Number(params.id));

  const txView = (tx: MockTransaction) => {
    const { settleAt: _s, outcome: _o, renewalId: _r, ...rest } = tx;
    if (options.transactionLabels) return rest;
    const {
      category: _c,
      description: _d,
      vehicle_id: _v,
      document_type: _t,
      ...unlabelled
    } = rest;
    return unlabelled;
  };

  const renewalView = (renewal: MockRenewal) => {
    const { paidAt: _p, ...rest } = renewal;
    return rest;
  };

  const handlers: Array<[method: keyof typeof http, path: string, handler: Handler]> = [
    // ------------------------------------------------------------------ users
    [
      'post',
      '/users/sign-up',
      open(async ({ request }) => {
        const body = await readJson(request);
        if (typeof body.oauth_code === 'string') {
          const typeError = checkOAuthType(body);
          if (typeError) return typeError;
          const account = db.accountByEmail(SAMPLE_EMAIL);
          if (body.oauth_code !== MOCK_OAUTH_CODE || !account) {
            return error(401, 'Invalid credentials');
          }
          return ok({ user: db.userView(account) }, 'Signup successful', 201);
        }
        const fields = missing(body, ['first_name', 'last_name', 'email', 'phone', 'password']);
        if (!fields.email && !/^\S+@\S+\.\S+$/.test(String(body.email))) {
          fields.email = 'email must be a valid email';
        }
        if (Object.keys(fields).length) return failFields(fields);
        // Assumed: the docs don't show the duplicate-email response.
        if (db.accountByEmail(String(body.email))) {
          return error(400, 'An account with this email already exists');
        }
        const account = db.createAccount({
          first_name: String(body.first_name),
          last_name: String(body.last_name),
          email: String(body.email),
          phone: String(body.phone),
          password: String(body.password),
        });
        return ok({ user: db.userView(account) }, 'Signup successful', 201);
      }),
    ],
    [
      'post',
      '/users/verify-email',
      open(async ({ request }) => {
        const body = await readJson(request);
        const account = db.accountByEmail(String(body.email ?? ''));
        const otpError = checkOtp(body.otp);
        if (otpError) return otpError;
        if (!account) return error(400, 'Invalid OTP', { is_expired: false });
        account.user.email_verified = true;
        db.save();
        return ok(session(account), 'Email verified successfully');
      }),
    ],
    [
      'post',
      '/users/sign-in',
      open(async ({ request }) => {
        const body = await readJson(request);
        if (typeof body.oauth_code === 'string') {
          const typeError = checkOAuthType(body);
          if (typeError) return typeError;
          const account = db.accountByEmail(SAMPLE_EMAIL);
          if (body.oauth_code !== MOCK_OAUTH_CODE || !account) {
            return error(401, 'Invalid credentials');
          }
          return ok(session(account), 'Login successful');
        }
        const account = db.accountByEmail(String(body.email ?? ''));
        if (!account || account.password !== body.password) {
          return error(401, 'Invalid credentials');
        }
        // Seen on ijanla-dev: the right password for an unverified email gets a bare 500.
        if (!account.user.email_verified) return error(500, 'Something went wrong');
        return ok(session(account), 'Login successful');
      }),
    ],
    [
      'post',
      '/users/resend-verification-email',
      open(async ({ request }) => {
        const body = await readJson(request);
        const account = db.accountByEmail(String(body.email ?? ''));
        if (!account) return error(401, 'Invalid credentials');
        if (account.user.email_verified) {
          return error(400, 'User email has already been verified');
        }
        return message('Verification email resent successfully');
      }),
    ],
    ['post', '/users/sign-out', authed(() => message('Sign-out successful'))],
    [
      'get',
      '/users/oauth-url',
      open(({ request }) => {
        const url = new URL(request.url);
        const type = url.searchParams.get('type');
        const action = url.searchParams.get('action');
        if (
          !['google', 'facebook'].includes(type ?? '') ||
          !['signin', 'signup'].includes(action ?? '')
        ) {
          return failFields({
            type: 'type must be google or facebook, action signin or signup',
          });
        }
        // The real URL goes to Google or Facebook, which comes back with `action` and `code`; the
        // mock comes straight back to the app.
        return ok(
          `${appOrigin}/auth/callback?action=${action}&code=${MOCK_OAUTH_CODE}&state=moto`,
          'Oauth URL retrieved successfully',
        );
      }),
    ],
    [
      'post',
      '/users/forgot-password',
      open(() => message('Reset-password mail sent successfully')),
    ],
    [
      'post',
      '/users/reset-password',
      open(async ({ request }) => {
        const body = await readJson(request);
        const otpError = checkOtp(body.otp);
        if (otpError) return otpError;
        const account = db.accountByEmail(String(body.email ?? ''));
        if (!account) return error(400, 'Invalid OTP', { is_expired: false });
        if (typeof body.password !== 'string' || !body.password) {
          return failFields({ password: 'password is required' });
        }
        account.password = body.password;
        db.save();
        return message('Password reset successfully');
      }),
    ],
    [
      'put',
      '/users',
      authed(async ({ request, account }) => {
        const body = await readJson(request);
        for (const key of ['first_name', 'last_name', 'phone', 'address'] as const) {
          if (typeof body[key] === 'string') account.user[key] = body[key];
        }
        account.user.updated_at = db.timestamp();
        db.save();
        return ok(db.userView(account), 'User data updated successfully');
      }),
    ],
    [
      'post',
      '/users/password',
      authed(async ({ request, account }) => {
        const body = await readJson(request);
        if (body.old_password !== account.password) return error(400, 'Invalid old password');
        if (typeof body.new_password !== 'string' || !body.new_password) {
          return failFields({ new_password: 'new_password is required' });
        }
        account.password = body.new_password;
        db.save();
        return ok(db.userView(account), 'Password updated successfully');
      }),
    ],
    // Gap: GET /users/me
    [
      'get',
      '/users/me',
      authed(({ account }) => ok(db.userView(account), 'User retrieved successfully')),
    ],
    // Gap: notification preferences
    [
      'get',
      '/users/notification-preferences',
      authed(({ account }) => ok(account.preferences, 'Notification preferences retrieved')),
    ],
    [
      'put',
      '/users/notification-preferences',
      authed(async ({ request, account }) => {
        const body = await readJson(request);
        const prefs = account.preferences;
        for (const key of ['email', 'sms', 'whatsapp', 'auto_renew'] as const) {
          if (typeof body[key] === 'boolean') prefs[key] = body[key];
        }
        if (Array.isArray(body.lead_days) && body.lead_days.every((d) => typeof d === 'number')) {
          prefs.lead_days = [...(body.lead_days as number[])].sort((a, b) => b - a);
        }
        db.save();
        return ok(prefs, 'Notification preferences updated');
      }),
    ],

    // ------------------------------------------------------------------ vehicles
    [
      'get',
      '/vehicles',
      authed(({ account }) =>
        ok(
          account.vehicles.map((v) => db.vehicleView(v, account)),
          'Vehicles successfully retrieved',
        ),
      ),
    ],
    [
      'post',
      '/vehicles',
      authed(async ({ request, account }) => {
        const body = await readJson(request);
        const fields = missing(body, [
          'plate_number',
          'engine_number',
          'engine_capacity',
          'chassis_number',
          'brand',
          'model',
          'color',
        ]);
        if (typeof body.is_paid_tier !== 'boolean')
          fields.is_paid_tier = 'is_paid_tier is required';
        if (Object.keys(fields).length) return failFields(fields);
        // Planned backend behaviour (build plan): 409 for a plate already on the account.
        if (account.vehicles.some((v) => samePlate(v.plate_number, String(body.plate_number)))) {
          return error(409, 'This plate number is already on your account');
        }
        const created_at = db.timestamp();
        const vehicle = {
          id: db.nextId(),
          plate_number: String(body.plate_number),
          brand: String(body.brand),
          model: String(body.model),
          color: String(body.color),
          engine_number: String(body.engine_number),
          chassis_number: String(body.chassis_number),
          engine_capacity: String(body.engine_capacity),
          created_at,
          updated_at: created_at,
          vehicle_licenses: [],
          insurance: [],
          roadworthiness: [],
        };
        account.vehicles.push(vehicle);
        db.save();
        const {
          vehicle_license: _l,
          insurance: _i,
          roadworthiness: _r,
          ...created
        } = db.vehicleView(vehicle, account);
        return ok(created, 'Vehicle created successfully', 201);
      }),
    ],
    [
      'get',
      '/vehicles/:id',
      authed(({ params, account }) => {
        const vehicle = vehicleOf(account, params);
        if (!vehicle) return error(400, 'Vehicle does not exist');
        return ok(db.vehicleView(vehicle, account), 'Vehicle successfully retrieved');
      }),
    ],
    [
      'patch',
      '/vehicles/:id',
      authed(async ({ request, params, account }) => {
        const vehicle = vehicleOf(account, params);
        if (!vehicle) return error(400, 'Vehicle does not exist');
        const body = await readJson(request);
        if (typeof body.color !== 'string' || !body.color.trim()) {
          return failFields({ color: 'color is required' });
        }
        vehicle.color = body.color.trim();
        vehicle.updated_at = db.timestamp();
        db.save();
        const {
          id,
          brand,
          color,
          model,
          plate_number,
          engine_number,
          chassis_number,
          engine_capacity,
        } = vehicle;
        return ok(
          {
            id,
            brand,
            color,
            model,
            user_id: account.user.id,
            plate_number,
            engine_number,
            chassis_number,
            engine_capacity,
          },
          'Vehicle updated successfully',
        );
      }),
    ],
    [
      'delete',
      '/vehicles/:id',
      // Not in the API docs. Assumed to answer like the other endpoints.
      authed(({ params, account }) => {
        const vehicle = vehicleOf(account, params);
        if (!vehicle) return error(400, 'Vehicle does not exist');
        account.vehicles = account.vehicles.filter((v) => v !== vehicle);
        db.save();
        return message('Vehicle deleted successfully');
      }),
    ],

    // ------------------------------------------------------------------ papers
    ...paperRoutes('insurance', 'insurance', 'Insurance'),
    ...paperRoutes('roadworthiness', 'roadworthiness', 'Roadworthiness'),
    ...paperRoutes('vehicle-licenses', 'vehicle_licenses', 'Vehicle License'),

    [
      'get',
      '/insurance-companies',
      authed(() => ok(INSURANCE_COMPANIES, 'Insurance Companies fetched successfully')),
    ],

    // ------------------------------------------------------------------ transactions
    [
      'post',
      '/transactions/initialize',
      authed(async ({ request, account }) => {
        const body = await readJson(request);
        const amount = body.amount;
        const category = body.transaction_category;
        if (typeof amount !== 'number' || !(amount > 0)) {
          return failFields({ amount: 'amount must be a positive number' });
        }
        if (!transactionCategories.includes(category as never)) {
          return failFields({
            transaction_category: `transaction_category must be one of ${transactionCategories.join(', ')}`,
          });
        }
        const label = INITIALIZE_LABELS[category as (typeof transactionCategories)[number]];
        const tx = db.addPaystackPayment(account, {
          amount,
          transaction_type: category === 'wallet_transaction' ? 'credit' : 'debit',
          ...label,
        });
        db.save();
        const reference = tx.payment?.reference ?? tx.reference;
        return ok(
          {
            // Real Paystack checkout comes back to the callback URL; the mock goes straight there.
            auth_url: `${appOrigin}/payments/callback?reference=${encodeURIComponent(reference)}&trxref=${encodeURIComponent(reference)}`,
            reference,
          },
          'Transaction initialized successfully',
        );
      }),
    ],
    [
      'get',
      '/transactions',
      authed(({ request, account }) => {
        const url = new URL(request.url);
        const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1);
        const perPage = Math.max(1, Number(url.searchParams.get('per_page') ?? 20) || 20);
        const status = url.searchParams.get('status');
        if (status && !transactionStatuses.includes(status as never)) {
          return failFields({ status: `status must be one of ${transactionStatuses.join(', ')}` });
        }
        const all = account.transactions.filter((tx) => !status || tx.status === status);
        const items = all.slice((page - 1) * perPage, page * perPage).map(txView);
        return HttpResponse.json({
          status: 'success',
          message: 'Transactions retrieved successfully',
          data: items,
          meta: {
            page,
            total: all.length,
            per_page: perPage,
            page_count: Math.ceil(all.length / perPage),
          },
        });
      }),
    ],
    [
      'get',
      '/transactions/completed-payment/:reference',
      authed(({ request, params, account }) => {
        const reference = String(params.reference);
        return new HttpResponse(paymentStream(db, account, reference, request.signal), {
          headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
        });
      }),
    ],
    // Gap: re-check a pending payment
    [
      'post',
      '/transactions/:reference/verify',
      authed(({ params, account }) => {
        const tx = db.findTransaction(account, String(params.reference));
        if (!tx) return error(400, 'Transaction does not exist');
        return ok(txView(tx), 'Transaction verified');
      }),
    ],
    [
      'get',
      '/transactions/:id',
      authed(({ params, account }) => {
        const tx = account.transactions.find((t) => t.id === Number(params.id));
        if (!tx) return error(400, 'Transaction does not exist');
        return ok(txView(tx), 'Transaction retrieved successfully');
      }),
    ],

    // ------------------------------------------------------------------ wallet
    [
      'get',
      '/wallets/balance',
      authed(({ account }) =>
        ok(
          {
            id: account.user.id,
            email: account.user.email,
            balance: account.walletBalance,
            user_id: account.user.id,
            created_at: account.user.created_at,
            updated_at: db.timestamp(),
          },
          'Wallet balance retrieved successfully',
        ),
      ),
    ],
    // Gap: pay from wallet
    [
      'post',
      '/wallets/debit',
      authed(async ({ request, account }) => {
        const body = await readJson(request);
        const amount = body.amount;
        if (typeof amount !== 'number' || !(amount > 0)) {
          return failFields({ amount: 'amount must be a positive number' });
        }
        if (typeof body.category !== 'string')
          return failFields({ category: 'category is required' });
        const documentType = documentTypes.includes(body.document_type as never)
          ? (body.document_type as DocumentType)
          : null;
        if (account.walletBalance < amount) return error(400, 'Insufficient balance');
        account.walletBalance -= amount;
        const tx = db.addTransaction(account, {
          amount,
          status: 'success',
          transaction_type: 'debit',
          payment: null,
          category: body.category,
          description: describe(body.category, documentType),
          vehicle_id: typeof body.vehicle_id === 'number' ? body.vehicle_id : null,
          document_type: documentType,
        });
        db.save();
        return ok(
          { transaction: txView(tx), wallet: { balance: account.walletBalance } },
          'Wallet debited',
        );
      }),
    ],

    // ------------------------------------------------------------------ renewals (gap)
    [
      'post',
      '/vehicles/:id/renewals',
      authed(async ({ request, params, account }) => {
        const vehicle = vehicleOf(account, params);
        if (!vehicle) return error(400, 'Vehicle does not exist');
        const body = await readJson(request);
        const documentType = body.document_type as DocumentType;
        if (!documentTypes.includes(documentType)) {
          return failFields({
            document_type: `document_type must be one of ${documentTypes.join(', ')}`,
          });
        }
        if (body.pay_with !== 'wallet' && body.pay_with !== 'card') {
          return failFields({ pay_with: 'pay_with must be wallet or card' });
        }
        if (typeof body.delivery_address !== 'string' || !body.delivery_address.trim()) {
          return failFields({ delivery_address: 'delivery_address is required' });
        }
        const amount = renewalPrice(documentType);
        if (body.pay_with === 'wallet' && account.walletBalance < amount) {
          return error(400, 'Insufficient balance');
        }
        const created_at = db.timestamp();
        const renewal: MockRenewal = {
          id: db.nextId(),
          vehicle_id: vehicle.id,
          document_type: documentType,
          status: body.pay_with === 'wallet' ? 'paid' : 'awaiting_payment',
          amount,
          delivery_address: body.delivery_address.trim(),
          new_expiry_date: null,
          created_at,
          updated_at: created_at,
        };
        account.renewals.unshift(renewal);
        const labels = {
          category: 'renewal',
          description: describe('renewal', documentType),
          vehicle_id: vehicle.id,
          document_type: documentType,
          renewalId: renewal.id,
        };
        let authUrl: string | undefined;
        let reference: string | undefined;
        if (body.pay_with === 'wallet') {
          account.walletBalance -= amount;
          renewal.paidAt = db.now();
          db.addTransaction(account, {
            amount,
            status: 'success',
            transaction_type: 'debit',
            payment: null,
            ...labels,
          });
        } else {
          const tx = db.addPaystackPayment(account, {
            amount,
            transaction_type: 'debit',
            ...labels,
          });
          reference = tx.payment?.reference ?? tx.reference;
          authUrl = `${appOrigin}/payments/callback?reference=${encodeURIComponent(reference)}&trxref=${encodeURIComponent(reference)}`;
        }
        db.save();
        return ok(
          {
            renewal: renewalView(renewal),
            ...(authUrl ? { auth_url: authUrl, reference } : {}),
          },
          'Renewal created',
          201,
        );
      }),
    ],
    [
      'get',
      '/vehicles/:id/renewals',
      authed(({ params, account }) => {
        const vehicle = vehicleOf(account, params);
        if (!vehicle) return error(400, 'Vehicle does not exist');
        return ok(
          account.renewals.filter((r) => r.vehicle_id === vehicle.id).map(renewalView),
          'Renewals retrieved',
        );
      }),
    ],
    [
      'get',
      '/renewals',
      authed(({ account }) => ok(account.renewals.map(renewalView), 'Renewals retrieved')),
    ],

    // ------------------------------------------------------------------ pricing (gap)
    ['get', '/pricing', open(() => ok(DEFAULT_PRICING, 'Pricing retrieved'))],
  ];

  function paperRoutes(
    segment: 'insurance' | 'roadworthiness' | 'vehicle-licenses',
    key: 'insurance' | 'roadworthiness' | 'vehicle_licenses',
    label: string,
  ): Array<[keyof typeof http, string, Handler]> {
    const path = `/vehicle/:id/${segment}`;
    return [
      [
        'post',
        path,
        authed(async ({ request, params, account }) => {
          const vehicle = vehicleOf(account, params);
          if (!vehicle) return error(400, 'Vehicle does not exist');
          const body = await readJson(request);
          const fields: Record<string, string> = {};
          if (
            typeof body.expiry_date !== 'string' ||
            !/^\d{4}-\d{2}-\d{2}$/.test(body.expiry_date)
          ) {
            fields.expiry_date = 'expiry_date must be in the YYYY-MM-DD format';
          }
          if (key === 'insurance') {
            if (!coverTypes.includes(body.cover_type as never)) {
              fields.cover_type = 'cover_type must be one of "comprehensive" or "third_party"';
            }
            if (typeof body.vehicle_value !== 'number')
              fields.vehicle_value = 'vehicle_value is required';
          }
          if (
            key === 'vehicle_licenses' &&
            (typeof body.license_pin !== 'string' || !body.license_pin)
          ) {
            fields.license_pin = 'license_pin is required';
          }
          if (Object.keys(fields).length) return failFields(fields);

          const created_at = db.timestamp();
          const common = {
            id: db.nextId(),
            vehicle_id: vehicle.id,
            expiry_date: String(body.expiry_date),
            created_at,
            updated_at: created_at,
          };
          let record;
          if (key === 'insurance') {
            record = {
              ...common,
              cover_type: String(body.cover_type),
              vehicle_value: Number(body.vehicle_value),
            };
            vehicle.insurance.push(record);
          } else if (key === 'roadworthiness') {
            record = { ...common, inspection_date: null, inspection_location: null };
            vehicle.roadworthiness.push(record);
          } else {
            record = { ...common, license_pin: String(body.license_pin) };
            vehicle.vehicle_licenses.push(record);
          }
          vehicle.updated_at = created_at;
          db.save();
          return ok(record, `${label} created successfully`, 201);
        }),
      ],
      [
        'get',
        path,
        authed(({ params, account }) => {
          const vehicle = vehicleOf(account, params);
          if (!vehicle) return error(400, 'Vehicle does not exist');
          return ok([...vehicle[key]].reverse(), `${label} records fetched successfully`);
        }),
      ],
      [
        'get',
        `${path}/valid-document`,
        authed(({ params, account }) => {
          const vehicle = vehicleOf(account, params);
          if (!vehicle) return error(400, 'Vehicle does not exist');
          const today = db.today();
          // Assumed: the docs don't show the response when nothing is valid; null here.
          const valid = [...vehicle[key]].reverse().find((r) => r.expiry_date >= today) ?? null;
          return ok(valid, `${label} fetched successfully`);
        }),
      ],
    ];
  }

  const docReaderUrl = options.docReaderUrl ?? DEFAULT_DOC_READER_URL;

  return [
    ...handlers.map(([method, path, handler]) => http[method](`${base}${path}`, handler)),
    http.post(docReaderUrl, async ({ request }) => {
      await wait(latency > 0 ? 1200 : 0);
      const body = await readJson(request);
      if (typeof body.DOCUMENT !== 'string' || !body.DOCUMENT) {
        return HttpResponse.json({ message: 'DOCUMENT is required' }, { status: 400 });
      }
      return HttpResponse.json(SAMPLE_LICENCE_READING);
    }),
  ];
}

// ---------------------------------------------------------------------- helpers

const INITIALIZE_LABELS = {
  wallet_transaction: { category: 'wallet_topup', description: 'Wallet top-up' },
  service_charge: { category: 'service_charge', description: 'Tracking and reminders' },
  subscription_charge: { category: 'subscription_charge', description: 'Subscription' },
} as const;

const RENEWAL_DESCRIPTIONS: Record<DocumentType, string> = {
  vehicle_license: 'Licence renewal',
  insurance: 'Insurance renewal',
  roadworthiness: 'Roadworthiness renewal',
};

function describe(category: string, documentType: DocumentType | null): string {
  if (category === 'renewal') return documentType ? RENEWAL_DESCRIPTIONS[documentType] : 'Renewal';
  if (category === 'wallet_topup') return 'Wallet top-up';
  if (category === 'service_charge') return 'Tracking and reminders';
  if (category === 'subscription_charge') return 'Subscription';
  return 'Payment';
}

function renewalPrice(type: DocumentType): number {
  const prices = DEFAULT_PRICING.renewal;
  if (type === 'vehicle_license') return prices.vehicle_license;
  if (type === 'insurance') return prices.insurance_third_party;
  return prices.roadworthiness;
}

/** Streams `event: <reference>` once the payment settles, then closes. */
function paymentStream(db: MockDb, account: MockAccount, reference: string, signal: AbortSignal) {
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;
  let closed = false;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      const stop = () => {
        if (closed) return;
        closed = true;
        clearInterval(timer);
        try {
          controller.close();
        } catch {
          // Already closed by the client.
        }
      };
      const check = () => {
        db.tick();
        const tx = db.findTransaction(account, reference);
        if (!tx?.payment || tx.status === 'pending') return;
        const payload = JSON.stringify({
          status: 'success',
          message: 'Payment retrieved successfully',
          data: tx.payment,
        });
        controller.enqueue(encoder.encode(`event: ${reference}\ndata: ${payload}\n\n`));
        stop();
      };
      timer = setInterval(check, 250);
      signal.addEventListener('abort', stop);
      check();
    },
    cancel() {
      closed = true;
      clearInterval(timer);
    },
  });
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json();
    return isRecord(body) ? body : {};
  } catch {
    return {};
  }
}

function missing(body: Record<string, unknown>, keys: string[]): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const key of keys) {
    const value = body[key];
    if (typeof value !== 'string' || !value.trim()) fields[key] = `${key} is required`;
  }
  return fields;
}

function checkOAuthType(body: Record<string, unknown>): Response | null {
  if (body.oauth_type === 'google' || body.oauth_type === 'facebook') return null;
  return failFields({ oauth_type: 'oauth_type must be one of [facebook, google]' });
}

function checkOtp(otp: unknown): Response | null {
  if (otp === MOCK_EXPIRED_OTP) return error(400, 'Expired OTP', { is_expired: true });
  if (typeof otp !== 'string' || !/^\d{6}$/.test(otp) || otp === MOCK_INVALID_OTP) {
    return error(400, 'Invalid OTP', { is_expired: false });
  }
  return null;
}

function ok(data: unknown, msg: string, status = 200): Response {
  return HttpResponse.json({ status: 'success', message: msg, data } as never, { status });
}

function message(msg: string): Response {
  return HttpResponse.json({ status: 'success', message: msg });
}

function error(status: number, msg: string, extra: Record<string, unknown> = {}): Response {
  return HttpResponse.json({ message: msg, status: 'error', ...extra } as never, { status });
}

function failFields(fields: Record<string, string>): Response {
  const first = Object.values(fields)[0] ?? 'Invalid params';
  return HttpResponse.json({ status: 'fail', message: first, data: fields }, { status: 400 });
}

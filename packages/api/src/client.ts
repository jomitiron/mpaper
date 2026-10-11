import type { z } from 'zod';

/**
 * Fetch wrapper for the MotorPapers API.
 *
 * The app calls `configureApi()` once at start-up with the base URL, a token getter and a 401 hook.
 * Every module function goes through `request()`, which sends JSON, adds the bearer token, turns
 * failures into typed errors and validates the response body with a Zod schema.
 */

export const DEFAULT_DOC_READER_URL =
  'https://motorpapers-doc-parser-api.azurewebsites.net/api/vehicleDocument';

export interface ApiConfig {
  /** API origin, e.g. `https://ijanla-dev.azurewebsites.net`. */
  baseUrl: string;
  /** Document reader endpoint (a separate service that takes no token). */
  docReaderUrl: string;
  /** Returns the signed-in driver's token, or null when signed out. */
  getToken: () => string | null | undefined;
  /**
   * Called when a request that carried a token comes back 401. Tokens last 30 minutes and there's
   * no refresh endpoint yet, so the app clears the session and sends the driver to sign in.
   * Not called for requests sent without a token (a wrong password on sign-in is also a 401).
   */
  onUnauthorized: (error: HttpError) => void;
  /** Override for tests. Defaults to the global fetch, looked up on every call. */
  fetch: typeof fetch;
}

let config: ApiConfig = {
  baseUrl: '',
  docReaderUrl: DEFAULT_DOC_READER_URL,
  getToken: () => null,
  onUnauthorized: () => {},
  fetch: (input, init) => globalThis.fetch(input, init),
};

export function configureApi(next: Partial<ApiConfig>): void {
  config = { ...config, ...next };
}

export function getApiConfig(): Readonly<ApiConfig> {
  return config;
}

// ---------------------------------------------------------------- errors

export type ApiErrorKind = 'http' | 'network' | 'schema';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;

  constructor(kind: ApiErrorKind, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ApiError';
    this.kind = kind;
  }
}

/** The API answered with a non-2xx status. `message` is the API's own message when it sent one. */
export class HttpError extends ApiError {
  readonly status: number;
  /** Field errors from a `status: "fail"` response, e.g. `{ email: "email must be a valid email" }`. */
  readonly fields: Record<string, string>;
  /** Set by the OTP endpoints (`verify-email`, `reset-password`). */
  readonly isExpired: boolean | undefined;
  readonly body: unknown;

  constructor(status: number, message: string, body: unknown) {
    super('http', message);
    this.name = 'HttpError';
    this.status = status;
    this.body = body;
    this.fields = readFieldErrors(body);
    this.isExpired =
      isRecord(body) && typeof body.is_expired === 'boolean' ? body.is_expired : undefined;
  }
}

/** The request never got an answer: offline, DNS, CORS or the server dropped the connection. */
export class NetworkError extends ApiError {
  constructor(cause: unknown) {
    super('network', 'Network request failed', { cause });
    this.name = 'NetworkError';
  }
}

/** The API answered, but not in the shape we expect. Usually means the API changed. */
export class SchemaError extends ApiError {
  readonly path: string;
  readonly issues: z.ZodError['issues'];

  constructor(path: string, error: z.ZodError) {
    super('schema', `Unexpected response from ${path}: ${summariseIssues(error)}`, {
      cause: error,
    });
    this.name = 'SchemaError';
    this.path = path;
    this.issues = error.issues;
  }
}

export function isHttpError(error: unknown, status?: number): error is HttpError {
  return error instanceof HttpError && (status === undefined || error.status === status);
}

export function isUnauthorized(error: unknown): error is HttpError {
  return isHttpError(error, 401);
}

export function isAbortError(error: unknown): boolean {
  // Checked by name: DOMException differs between realms (Node, jsdom, the browser).
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}

/** Plain-language message for showing an error to a driver. */
export function errorMessage(error: unknown): string {
  if (error instanceof NetworkError) {
    return "We can't reach MotoPapers right now. Check your connection and try again.";
  }
  if (error instanceof HttpError) {
    if (error.status >= 500) return 'Something went wrong on our side. Try again in a moment.';
    return error.message;
  }
  if (error instanceof SchemaError)
    return 'Something went wrong on our side. Try again in a moment.';
  return 'Something went wrong. Try again.';
}

// ---------------------------------------------------------------- request

export type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions<S extends z.ZodType> {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Undefined and null values are left out. */
  query?: Record<string, QueryValue>;
  /** Sent as JSON. */
  body?: unknown;
  /** Schema for the whole response body (envelope included). */
  schema: S;
  /** Send the bearer token when there is one. Defaults to true. */
  auth?: boolean;
  signal?: AbortSignal;
}

export async function request<S extends z.ZodType>(
  path: string,
  options: RequestOptions<S>,
): Promise<z.output<S>> {
  const { method = 'GET', query, body, schema, auth = true, signal } = options;
  const token = auth ? config.getToken() : null;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await config.fetch(buildUrl(config.baseUrl, path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new NetworkError(error);
  }

  const payload = await readBody(response);

  if (!response.ok) {
    const error = new HttpError(response.status, messageFrom(payload, response), payload);
    if (response.status === 401 && token) config.onUnauthorized(error);
    throw error;
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new SchemaError(`${method} ${path}`, parsed.error);
  return parsed.data;
}

export function buildUrl(
  baseUrl: string,
  path: string,
  query?: Record<string, QueryValue>,
): string {
  const base = baseUrl.replace(/\/+$/, '');
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `${url}?${search}` : url;
}

async function readBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function messageFrom(payload: unknown, response: Response): string {
  if (isRecord(payload) && typeof payload.message === 'string' && payload.message.trim()) {
    return payload.message;
  }
  return `Request failed (${response.status}${response.statusText ? ` ${response.statusText}` : ''})`;
}

function readFieldErrors(body: unknown): Record<string, string> {
  if (!isRecord(body) || !isRecord(body.data)) return {};
  const fields: Record<string, string> = {};
  for (const [key, value] of Object.entries(body.data)) {
    if (typeof value === 'string') fields[key] = value;
  }
  return fields;
}

function summariseIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 3)
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ');
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

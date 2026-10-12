// @ts-check
/**
 * MotoPapers on the meminiNode App Service (docs/deploy/app-service.md).
 *
 * One zip serves the marketing site at `/` and the web app at `/app/`, using only Node built-ins
 * so the deploy needs no `npm install`. Each slot's App Service settings become the app's
 * `/app/config.js` at runtime, so the same package runs in dev, stage and production.
 *
 *   API_BASE_URL=https://ijanla-dev.azurewebsites.net PORT=8080 node server.mjs
 *
 * Layout next to this file: `site/` (apps/site build) and `web/` (apps/web build, base `/app/`).
 */

import { createHash } from 'node:crypto';
import { existsSync, realpathSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer as createHttpServer } from 'node:http';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { brotliCompress, constants as zlib, gzip } from 'node:zlib';

/**
 * @typedef {import('node:http').IncomingMessage} Request
 * @typedef {import('node:http').ServerResponse} Response
 * @typedef {Record<string, string | undefined>} Env
 * @typedef {{ info(...args: unknown[]): void, warn(...args: unknown[]): void, error(...args: unknown[]): void }} Logger
 * @typedef {Record<string, string | number>} Headers
 */

export const APP_BASE = '/app/';

/** Same as DEFAULT_DOC_READER_URL in packages/api (a test keeps them equal). */
export const DEFAULT_DOC_READER_URL =
  'https://motorpapers-doc-parser-api.azurewebsites.net/api/vehicleDocument';

/** The site's policy from apps/site/public/staticwebapp.config.json (a test keeps them equal). */
export const SITE_CSP =
  "default-src 'self'; script-src 'self' https://plausible.io; connect-src 'self' https://plausible.io https://*.sentry.io; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests";

/** Addresses from the old app, which lived at the root of this domain. */
export const LEGACY_ROUTES = new Map([
  ['/home', '/app/'],
  ['/vehicles', '/app/cars'],
  ['/transactions', '/app/payments'],
  ['/settings', '/app/settings'],
  ['/login', '/app/sign-in'],
  ['/signup', '/app/sign-up'],
  ['/forgot-password', '/app/forgot-password'],
  ['/reset-password', '/app/reset-password'],
  // Google sign-in returns here until the API points it at /app/auth/callback.
  ['/complete-onboard', '/app/complete-onboard'],
]);

/** App Service setting → `flags` key in config.js. */
const FLAG_SETTINGS = /** @type {const} */ ({
  renewals: 'FLAG_RENEWALS',
  reminderSettings: 'FLAG_REMINDER_SETTINGS',
  txLabels: 'FLAG_TX_LABELS',
  walletPay: 'FLAG_WALLET_PAY',
  verifyPayment: 'FLAG_VERIFY_PAYMENT',
});

const COMMON_HEADERS = {
  'Strict-Transport-Security': 'max-age=31536000',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy':
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
  'X-Frame-Options': 'DENY',
};

const CACHE = {
  immutable: 'public, max-age=31536000, immutable',
  html: 'no-cache',
  short: 'public, max-age=3600',
  none: 'no-store',
};

/** @type {Record<string, string>} */
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.pdf': 'application/pdf',
};

/** Files the server never hands out, wherever they are. */
const PRIVATE_FILES = new Set(['staticwebapp.config.json']);

/** Smaller than this, compressing isn't worth it. */
const MIN_COMPRESS_BYTES = 512;

// ------------------------------------------------------------------ config.js

/**
 * The app's runtime settings (apps/web/src/env.ts) from App Service settings. Unset values are
 * left out, so the app falls back to what it was built with. Mocks can't be turned on here.
 *
 * @param {Env} env
 * @param {(message: string) => void} [warn]
 */
export function buildConfig(env, warn = () => {}) {
  /** @param {string} name */
  const text = (name) => env[name]?.trim() || undefined;
  /** @param {string} name */
  const url = (name) => {
    const value = text(name);
    if (value === undefined) return undefined;
    if (isHttpUrl(value)) return value;
    warn(`${name} isn't an http(s) address, so it's ignored: ${value}`);
    return undefined;
  };
  /** @type {Record<keyof typeof FLAG_SETTINGS, boolean>} */
  const flags = {
    renewals: false,
    reminderSettings: false,
    txLabels: false,
    walletPay: false,
    verifyPayment: false,
  };
  for (const key of /** @type {(keyof typeof FLAG_SETTINGS)[]} */ (Object.keys(FLAG_SETTINGS))) {
    flags[key] = isOn(env[FLAG_SETTINGS[key]]);
  }
  return {
    apiBaseUrl: url('API_BASE_URL'),
    docReaderUrl: url('DOC_PARSER_URL'),
    appUrl: url('APP_URL'),
    siteUrl: url('SITE_URL'),
    sentryDsn: url('SENTRY_DSN'),
    sentryEnvironment: text('ENVIRONMENT'),
    release: text('RELEASE'),
    flags,
  };
}

/** @typedef {ReturnType<typeof buildConfig>} AppConfig */

/**
 * `window.__MOTOPAPERS_CONFIG__ = {…};`. The JSON is escaped so that no value can close a script
 * tag or break out of the statement, even if this is ever inlined into HTML.
 *
 * @param {AppConfig} config
 */
export function configScript(config) {
  const json = JSON.stringify(config)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  return `window.__MOTOPAPERS_CONFIG__ = ${json};\n`;
}

/**
 * The app's Content-Security-Policy. It may call the API, the document reader and Sentry, and
 * load Google Fonts; nothing else.
 *
 * @param {AppConfig} config
 */
export function appCsp(config) {
  const connect = new Set(["'self'"]);
  for (const value of [
    config.apiBaseUrl,
    config.docReaderUrl ?? DEFAULT_DOC_READER_URL,
    config.sentryDsn,
  ]) {
    if (value) connect.add(new URL(value).origin);
  }
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    `connect-src ${[...connect].join(' ')}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
}

/** @param {string} value */
function isHttpUrl(value) {
  try {
    const { protocol } = new URL(value);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}

/** @param {string | undefined} value */
function isOn(value) {
  return ['true', '1', 'yes', 'on'].includes((value ?? '').trim().toLowerCase());
}

// ------------------------------------------------------------------ requests

/**
 * The request path, or null when it's malformed or tries to leave the served folders.
 *
 * @param {string | undefined} raw
 */
export function parseTarget(raw = '/') {
  if (!raw.startsWith('/')) return null;
  /** @type {URL} */
  let url;
  try {
    url = new URL(raw, 'http://localhost');
  } catch {
    return null;
  }
  // `//` would make a redirect leave the site; `/a//b` is `/a/b` anyway.
  const pathname = url.pathname.replace(/\/{2,}/g, '/');
  /** @type {string} */
  let path;
  try {
    path = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (path.includes('\0') || path.includes('\\')) return null;
  if (path.split('/').some((segment) => segment === '..' || segment === '.')) return null;
  return { pathname, path, search: url.search, query: url.searchParams };
}

/**
 * The best encoding the client accepts: brotli, then gzip, or null for none.
 *
 * @param {string | undefined} header
 * @returns {'br' | 'gzip' | null}
 */
export function pickEncoding(header = '') {
  /** @type {Map<string, number>} */
  const accepted = new Map();
  for (const part of header.toLowerCase().split(',')) {
    const [name = '', ...params] = part.split(';').map((value) => value.trim());
    const q = params.find((param) => param.startsWith('q='));
    if (name) accepted.set(name, q ? Number(q.slice(2)) : 1);
  }
  /** @param {string} name */
  const ok = (name) => (accepted.get(name) ?? accepted.get('*') ?? 0) > 0;
  if (ok('br')) return 'br';
  if (ok('gzip')) return 'gzip';
  return null;
}

/** @param {string} type */
function isCompressible(type) {
  return (
    type.startsWith('text/') ||
    type.startsWith('application/json') ||
    type.startsWith('application/xml') ||
    type.startsWith('application/manifest+json') ||
    type === 'image/svg+xml'
  );
}

/** @param {Request} req */
function isHttps(req) {
  const forwarded = String(req.headers['x-forwarded-proto'] ?? '')
    .split(',')[0]
    ?.trim()
    .toLowerCase();
  return forwarded === 'https' || ('encrypted' in req.socket && req.socket.encrypted === true);
}

/** @param {string} etag @param {string | string[] | undefined} header */
function matchesEtag(etag, header) {
  if (!header) return false;
  const weak = (/** @type {string} */ value) => value.trim().replace(/^W\//, '');
  const wanted = String(header).split(',').map(weak);
  return wanted.includes('*') || wanted.includes(weak(etag));
}

// ------------------------------------------------------------------ files

/**
 * @typedef {{ mtimeMs: number, size: number, body: Buffer, etag: string,
 *   encoded: Map<string, Promise<Buffer>> }} CachedFile
 */

/** Reads files once and keeps them (and their compressed copies) in memory. */
function fileCache() {
  /** @type {Map<string, CachedFile>} */
  const files = new Map();
  return {
    /** @param {string} file */
    async load(file) {
      let info;
      try {
        info = await stat(file);
      } catch {
        return null;
      }
      if (!info.isFile()) return null;
      const cached = files.get(file);
      if (cached && cached.mtimeMs === info.mtimeMs && cached.size === info.size) return cached;
      const body = await readFile(file);
      const etag = `W/"${createHash('sha1').update(body).digest('base64url')}"`;
      /** @type {CachedFile} */
      const entry = { mtimeMs: info.mtimeMs, size: info.size, body, etag, encoded: new Map() };
      files.set(file, entry);
      return entry;
    },
    /** @param {CachedFile} entry @param {'br' | 'gzip'} encoding */
    encode(entry, encoding) {
      let pending = entry.encoded.get(encoding);
      if (!pending) {
        pending =
          encoding === 'br'
            ? promisify(brotliCompress)(entry.body, {
                params: {
                  [zlib.BROTLI_PARAM_QUALITY]: 10,
                  [zlib.BROTLI_PARAM_SIZE_HINT]: entry.body.length,
                },
              })
            : promisify(gzip)(entry.body, { level: 9 });
        // Don't keep a failure: the next request tries again.
        pending.catch(() => entry.encoded.delete(encoding));
        entry.encoded.set(encoding, pending);
      }
      return pending;
    },
  };
}

/**
 * `root/rel` if it's inside root and not hidden, else null.
 *
 * @param {string} root
 * @param {string} rel
 */
function inside(root, rel) {
  const segments = rel.split('/');
  if (segments.some((segment) => segment.startsWith('.') || PRIVATE_FILES.has(segment))) {
    return null;
  }
  const file = join(root, ...segments);
  return file === root || file.startsWith(root + sep) ? file : null;
}

// ------------------------------------------------------------------ the handler

/**
 * @param {{ root: string, env?: Env, log?: Logger }} options
 * @returns {(req: Request, res: Response) => Promise<void>}
 */
export function createHandler(options) {
  const root = resolve(options.root);
  const siteRoot = join(root, 'site');
  const webRoot = join(root, 'web');
  const env = options.env ?? process.env;
  const log = options.log ?? console;

  const config = buildConfig(env, (message) => log.warn(message));
  if (!config.apiBaseUrl) {
    log.warn("API_BASE_URL isn't set: the app at /app/ has no API to call.");
  }
  const script = Buffer.from(configScript(config));
  const environment = config.sentryEnvironment;
  /** @type {Headers} */
  const robots =
    environment && environment !== 'production' ? { 'X-Robots-Tag': 'noindex, nofollow' } : {};
  const policies = { site: SITE_CSP, app: appCsp(config) };
  const files = fileCache();

  /**
   * Security headers for the site or the app. upgrade-insecure-requests only over HTTPS (App
   * Service sets X-Forwarded-Proto): on http://localhost it would send everything to https.
   *
   * @param {Request} req
   * @param {'site' | 'app'} area
   * @returns {Headers}
   */
  const securityHeaders = (req, area) => {
    let csp = policies[area];
    if (!isHttps(req)) csp = csp.replace(/;\s*upgrade-insecure-requests/, '');
    return { ...COMMON_HEADERS, 'Content-Security-Policy': csp, ...robots };
  };

  /**
   * @param {Request} req
   * @param {Response} res
   * @param {number} status
   * @param {Headers} headers
   * @param {Buffer | string} [body]
   */
  const send = (req, res, status, headers, body = '') => {
    const buffer = typeof body === 'string' ? Buffer.from(body) : body;
    res.writeHead(status, { ...headers, 'Content-Length': buffer.length });
    res.end(req.method === 'HEAD' ? undefined : buffer);
  };

  /**
   * @param {Request} req
   * @param {Response} res
   * @param {number} status
   * @param {string} body
   * @param {Headers} [extra]
   */
  const sendText = (req, res, status, body, extra = {}) =>
    send(
      req,
      res,
      status,
      {
        ...COMMON_HEADERS,
        ...robots,
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': CACHE.none,
        ...extra,
      },
      body,
    );

  /**
   * @param {Request} req
   * @param {Response} res
   * @param {301 | 302} status
   * @param {string} location
   */
  const redirect = (req, res, status, location) =>
    send(req, res, status, {
      ...COMMON_HEADERS,
      ...robots,
      Location: location,
      // A permanent redirect is still only kept an hour, so it can be changed later.
      'Cache-Control': status === 301 ? CACHE.short : CACHE.none,
    });

  /**
   * @param {Request} req
   * @param {Response} res
   * @param {CachedFile} file
   * @param {{ name: string, area: 'site' | 'app', status?: number, cache?: string }} how
   */
  const sendFile = async (req, res, file, how) => {
    const type = TYPES[extname(how.name).toLowerCase()] ?? 'application/octet-stream';
    const status = how.status ?? 200;
    const cache = how.cache ?? (type.startsWith('text/html') ? CACHE.html : CACHE.short);
    const compressible = isCompressible(type);
    /** @type {Headers} */
    const headers = {
      ...securityHeaders(req, how.area),
      'Content-Type': type,
      'Cache-Control': cache,
      ETag: file.etag,
      ...(compressible ? { Vary: 'Accept-Encoding' } : {}),
    };
    if (status === 200 && matchesEtag(file.etag, req.headers['if-none-match'])) {
      res.writeHead(304, headers);
      res.end();
      return;
    }
    const encoding =
      compressible && file.body.length >= MIN_COMPRESS_BYTES
        ? pickEncoding(req.headers['accept-encoding'])
        : null;
    if (!encoding) return send(req, res, status, headers, file.body);
    const body = await files.encode(file, encoding);
    send(req, res, status, { ...headers, 'Content-Encoding': encoding }, body);
  };

  /** The site's 404 page, with a 404. @param {Request} req @param {Response} res */
  const notFound = async (req, res) => {
    const page = await files.load(join(siteRoot, '404.html'));
    if (!page) return sendText(req, res, 404, 'Not found');
    await sendFile(req, res, page, { name: '404.html', area: 'site', status: 404 });
  };

  /**
   * `/app/*`: the file if there is one, else the app's index.html for addresses without an
   * extension (the router takes it from there).
   *
   * @param {Request} req
   * @param {Response} res
   * @param {string} rel the path after /app/
   */
  const serveApp = async (req, res, rel) => {
    if (rel === 'config.js') {
      return send(
        req,
        res,
        200,
        {
          ...securityHeaders(req, 'app'),
          'Content-Type': 'text/javascript; charset=utf-8',
          'Cache-Control': CACHE.none,
        },
        script,
      );
    }
    const path = inside(webRoot, rel || 'index.html');
    if (!path) return notFound(req, res);
    const file = await files.load(path);
    if (file) {
      const cache = rel.startsWith('assets/') ? CACHE.immutable : undefined;
      return sendFile(req, res, file, { name: path, area: 'app', cache });
    }
    if (extname(rel.split('/').pop() ?? '')) return notFound(req, res);
    const index = await files.load(join(webRoot, 'index.html'));
    if (!index) return notFound(req, res);
    await sendFile(req, res, index, { name: 'index.html', area: 'app' });
  };

  /**
   * Everything else is the site: the file, else the folder's index.html. Astro links end in a
   * slash, so `/privacy` moves to `/privacy/`.
   *
   * @param {Request} req
   * @param {Response} res
   * @param {{ pathname: string, path: string, search: string }} target
   */
  const serveSite = async (req, res, { pathname, path, search }) => {
    const rel = path.slice(1);
    const isFolder = rel === '' || rel.endsWith('/');
    if (!isFolder) {
      const exact = inside(siteRoot, rel);
      const file = exact && (await files.load(exact));
      if (exact && file) {
        const cache = rel.startsWith('_astro/') ? CACHE.immutable : undefined;
        return sendFile(req, res, file, { name: exact, area: 'site', cache });
      }
    }
    const index = inside(siteRoot, `${rel}${isFolder ? '' : '/'}index.html`);
    const file = index && (await files.load(index));
    if (!file) return notFound(req, res);
    if (!isFolder) return redirect(req, res, 301, `${pathname}/${search}`);
    await sendFile(req, res, file, { name: 'index.html', area: 'site' });
  };

  /** @param {Request} req @param {Response} res */
  const route = async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return sendText(req, res, 405, 'Method not allowed', { Allow: 'GET, HEAD' });
    }
    const target = parseTarget(req.url);
    if (!target) return sendText(req, res, 400, 'Bad request');
    const { path, search, query } = target;

    if (path === '/healthz') return sendText(req, res, 200, 'ok');

    // The old app: Paystack returns (with ?trxref= or ?reference=), then its other addresses.
    const old = path.length > 1 ? path.replace(/\/$/, '') : path;
    if (old === '/' || LEGACY_ROUTES.has(old)) {
      const reference = query.get('trxref') || query.get('reference');
      if (reference) {
        return redirect(
          req,
          res,
          302,
          `${APP_BASE}payments/callback?reference=${encodeURIComponent(reference)}`,
        );
      }
      const to = LEGACY_ROUTES.get(old);
      if (to) return redirect(req, res, 301, `${to}${search}`);
    }

    if (path === '/app') return redirect(req, res, 301, `${APP_BASE}${search}`);
    if (path.startsWith(APP_BASE)) return serveApp(req, res, path.slice(APP_BASE.length));
    return serveSite(req, res, target);
  };

  return async (req, res) => {
    try {
      await route(req, res);
    } catch (error) {
      log.error(`${req.method} ${req.url} failed:`, error);
      if (res.headersSent) res.destroy();
      else sendText(req, res, 500, 'Something went wrong');
    }
  };
}

/** @param {{ root: string, env?: Env, log?: Logger }} options */
export function createServer(options) {
  const handler = createHandler(options);
  const server = createHttpServer((req, res) => void handler(req, res));
  // Longer than the App Service front end keeps idle connections, so it never reuses a closed one.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
  return server;
}

// ------------------------------------------------------------------ start

function main() {
  const root = dirname(fileURLToPath(import.meta.url));
  const port = Number(process.env.PORT) || 8080;
  for (const folder of ['site', 'web']) {
    if (!existsSync(join(root, folder, 'index.html'))) {
      console.warn(`No ${folder}/index.html next to server.mjs: run pnpm package:appservice.`);
    }
  }
  const server = createServer({ root });

  server.listen(port, () => {
    const environment = process.env.ENVIRONMENT || 'unset';
    console.info(`MotoPapers on port ${port} (environment: ${environment}, root: ${root})`);
  });

  // App Service sends SIGTERM on restart, swap and scale-in: finish what's in flight, then stop.
  let closing = false;
  /** @param {NodeJS.Signals} signal */
  const shutdown = (signal) => {
    if (closing) return;
    closing = true;
    console.info(`${signal}: closing`);
    server.close(() => process.exit(0));
    server.closeIdleConnections();
    setTimeout(() => {
      server.closeAllConnections();
      process.exit(0);
    }, 10_000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

/** True when run as `node server.mjs`, false when a test imports it. */
function isEntry() {
  try {
    return pathToFileURL(realpathSync(process.argv[1] ?? '')).href === import.meta.url;
  } catch {
    return false;
  }
}

if (isEntry()) main();

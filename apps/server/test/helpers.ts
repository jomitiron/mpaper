import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { request as httpRequest, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createServer } from '../server.mjs';

export interface Reply {
  status: number;
  headers: IncomingHttpHeaders;
  body: Buffer;
  text: string;
}

/** Long enough to be compressed. */
export const BIG_JS = `export const app = ${JSON.stringify('MotoPapers '.repeat(400))};\n`;
export const BIG_CSS = `.btn{color:var(--ink)}\n`.repeat(80);
export const SECRET = 'top secret, outside the served folders';

/**
 * A package laid out like dist-appservice/ (site/ and web/), in a temp folder with a file next
 * to it that must never be served.
 */
export function makePackage(): { root: string; cleanup: () => void } {
  const base = mkdtempSync(join(tmpdir(), 'motopapers-server-'));
  const root = join(base, 'package');
  const files: Record<string, string> = {
    'site/index.html': '<!doctype html><title>Home</title><h1>Never drive with expired papers</h1>',
    'site/404.html': '<!doctype html><title>Page not found</title><h1>Page not found</h1>',
    'site/privacy/index.html': '<!doctype html><title>Privacy</title>',
    'site/_astro/landing.Ab12Cd.css': BIG_CSS,
    'site/robots.txt': 'User-agent: *\nAllow: /\n',
    'site/favicon.svg': '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
    'site/og.png': 'PNG'.repeat(400),
    'site/staticwebapp.config.json': '{"globalHeaders":{}}',
    'site/.env': 'SECRET=1',
    'web/index.html':
      '<!doctype html><title>MotoPapers</title><script src="/app/config.js"></script><div id="app"></div>',
    'web/config.js': 'window.__MOTOPAPERS_CONFIG__ = {};',
    'web/assets/index-Xy12Ab.js': BIG_JS,
    'web/assets/pdf.worker.min-Q1w2E3.mjs': BIG_JS,
    'web/favicon.svg': '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
    '../secret.txt': SECRET,
  };
  for (const [path, body] of Object.entries(files)) {
    const file = join(root, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, body);
  }
  return { root, cleanup: () => rmSync(base, { recursive: true, force: true }) };
}

export interface Running {
  request(
    path: string,
    options?: { method?: string; headers?: Record<string, string> },
  ): Promise<Reply>;
  warnings: string[];
  close(): Promise<void>;
}

/** Starts the server on a free port with the given App Service settings. */
export async function start(root: string, env: Record<string, string> = {}): Promise<Running> {
  const warnings: string[] = [];
  const log = {
    info: () => {},
    warn: (message: unknown) => warnings.push(String(message)),
    error: () => {},
  };
  const server: Server = createServer({ root, env, log });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    request: (path, options = {}) => send(port, path, options),
    warnings,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

/** A raw request: unlike fetch, it sends the path exactly as given (`..` and all). */
export function send(
  port: number,
  path: string,
  options: { method?: string; headers?: Record<string, string> } = {},
): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      { host: '127.0.0.1', port, path, method: options.method ?? 'GET', headers: options.headers },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const body = Buffer.concat(chunks);
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body,
            text: body.toString(),
          });
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

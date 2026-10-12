// Builds the one package that runs on the meminiNode App Service (docs/deploy/app-service.md):
//
//   dist-appservice/
//     server.mjs     apps/server, Node built-ins only
//     package.json   "start": "node server.mjs", no dependencies
//     site/          the marketing site, served at /
//     web/           the web app, built for /app/
//   dist-appservice.zip
//
// Nothing that differs between slots is baked in: the API address, Sentry and the feature flags
// reach the app at runtime through /app/config.js, from each slot's App Service settings.
//
//   pnpm package:appservice
//   PUBLIC_SITE_URL=https://motorpapers.com RELEASE=<sha> pnpm package:appservice

import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist-appservice');
const zip = join(root, 'dist-appservice.zip');

const siteUrl = process.env.PUBLIC_SITE_URL || 'https://motorpapers.com';
const release = process.env.RELEASE || git(['rev-parse', 'HEAD']) || '';

rmSync(out, { recursive: true, force: true });
rmSync(zip, { force: true });
mkdirSync(out, { recursive: true });

// The site: its "Sign in" and "Get started" links go to /app on the same domain. Empty values
// stop a local .env from leaking in (noindex outside production comes from the server instead).
step('Building the site', () =>
  run('pnpm', ['--filter', 'site', 'exec', 'astro', 'build', '--outDir', join(out, 'site')], {
    PUBLIC_APP_URL: '/app',
    PUBLIC_SITE_URL: siteUrl,
    PUBLIC_NOINDEX: '',
    PUBLIC_ANALYTICS_DOMAIN: process.env.PUBLIC_ANALYTICS_DOMAIN ?? '',
    PUBLIC_SENTRY_DSN: process.env.PUBLIC_SENTRY_DSN ?? '',
    PUBLIC_SENTRY_ENVIRONMENT: process.env.PUBLIC_SENTRY_ENVIRONMENT ?? '',
    PUBLIC_RELEASE: release,
  }),
);

// The app, under /app/, with the mock API off and nothing slot-specific: config.js fills it in.
step('Building the web app', () =>
  run(
    'pnpm',
    [
      '--filter',
      'web',
      'exec',
      'vite',
      'build',
      '--outDir',
      join(out, 'web'),
      '--emptyOutDir',
      '--logLevel',
      'warn',
    ],
    {
      WEB_BASE: '/app/',
      VITE_USE_MOCKS: 'false',
      VITE_API_BASE_URL: '',
      VITE_DOC_PARSER_URL: '',
      VITE_APP_URL: '',
      VITE_SITE_URL: '',
      VITE_SENTRY_DSN: '',
      VITE_SENTRY_ENVIRONMENT: '',
      VITE_RELEASE: release,
      VITE_FLAG_RENEWALS: '',
      VITE_FLAG_REMINDER_SETTINGS: '',
      VITE_FLAG_TX_LABELS: '',
      VITE_FLAG_WALLET_PAY: '',
      VITE_FLAG_VERIFY_PAYMENT: '',
    },
  ),
);

step('Assembling dist-appservice/', () => {
  // Static Web Apps' config and the mock API's worker have no place here, the server writes
  // config.js itself, and Astro leaves its (empty) content maps behind when --outDir is used.
  for (const file of [
    'site/staticwebapp.config.json',
    'site/content-assets.mjs',
    'site/content-modules.mjs',
    'web/staticwebapp.config.json',
    'web/mockServiceWorker.js',
    'web/config.js',
  ]) {
    rmSync(join(out, file), { force: true });
  }
  copyFileSync(join(root, 'apps/server/server.mjs'), join(out, 'server.mjs'));
  const manifest = {
    name: 'motopapers-appservice',
    private: true,
    description: `MotoPapers site and web app for App Service${release ? ` (${release})` : ''}`,
    type: 'module',
    scripts: { start: 'node server.mjs' },
    engines: { node: '>=20' },
  };
  writeFileSync(join(out, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
});

// Files at the top of the zip (not in a folder), as App Service's zip deploy expects.
step('Zipping dist-appservice.zip', () =>
  execFileSync('zip', ['-r', '-q', '-X', zip, '.'], { cwd: out, stdio: 'inherit' }),
);

console.info(
  `\nPackage ready: dist-appservice/ (${mb(sizeOf(out))}) and dist-appservice.zip (${mb(statSync(zip).size)})` +
    `\nRelease: ${release || 'unknown'} · Site URL: ${siteUrl}` +
    '\nTry it: API_BASE_URL=https://ijanla-dev.azurewebsites.net PORT=8080 node dist-appservice/server.mjs',
);

/** @param {string} label @param {() => void} fn */
function step(label, fn) {
  console.info(`\n▸ ${label}`);
  fn();
}

/** @param {string} command @param {string[]} args @param {Record<string, string>} env */
function run(command, args, env) {
  execFileSync(command, args, { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } });
}

/** @param {string[]} args */
function git(args) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

/** @param {string} path @returns {number} */
function sizeOf(path) {
  const info = statSync(path);
  if (!info.isDirectory()) return info.size;
  return readdirSync(path).reduce((total, name) => total + sizeOf(join(path, name)), 0);
}

/** @param {number} bytes */
function mb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

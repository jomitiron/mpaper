// Performance budget for the web app's production build (apps/web/dist).
//
// Initial load = the entry script in index.html, every module it imports statically, and the
// stylesheets index.html links. Each file is gzipped (as Azure Static Web Apps serves it) and
// checked against perf/budgets.json. Also checks that pdf.js, the mock API and Sentry stay out
// of the initial load, and that no lazy page chunk grows past its budget.
//
//   node e2e/perf/web-budget.mjs [path/to/dist]   (build first: pnpm --filter web build)

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(process.argv[2] ?? join(here, '../../apps/web/dist'));
const budgets = JSON.parse(readFileSync(join(here, 'budgets.json'), 'utf8')).web;

if (!existsSync(join(dist, 'index.html'))) {
  console.error(`No build at ${dist}. Run pnpm --filter web build first.`);
  process.exit(1);
}

const kb = (bytes) => bytes / 1024;
const gz = (file) => gzipSync(readFileSync(file), { level: 9 }).length;
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const attr = (tag, name) => tag.match(new RegExp(`${name}="([^"]+)"`))?.[1];
const local = (url) => join(dist, url.replace(/^\//, ''));

// The scripts and stylesheets index.html loads.
const tags = html.match(/<(script|link)\b[^>]*>/g) ?? [];
const entries = tags
  .filter((t) => t.startsWith('<script') && /type="module"/.test(t))
  .map((t) => attr(t, 'src'))
  .concat(tags.filter((t) => /rel="modulepreload"/.test(t)).map((t) => attr(t, 'href')))
  .filter(Boolean)
  .map(local);
const styles = tags
  .filter((t) => /rel="stylesheet"/.test(t) && !/fonts\.googleapis/.test(attr(t, 'href') ?? ''))
  .map((t) => attr(t, 'href'))
  .filter((href) => href && !/^https?:/.test(href))
  .map(local);

// Follow static imports (`import"./x.js"`, `from"./x.js"`); dynamic `import("./x.js")` is lazy.
const initial = new Set();
const queue = [...entries];
while (queue.length) {
  const file = queue.pop();
  if (initial.has(file)) continue;
  initial.add(file);
  const code = readFileSync(file, 'utf8');
  for (const [, spec] of code.matchAll(/(?:\bfrom|\bimport)\s*["'](\.\.?\/[^"']+\.js)["']/g)) {
    queue.push(join(dirname(file), spec));
  }
}

/** Which packages a chunk holds, from its source map. */
function sourcesOf(file) {
  const map = `${file}.map`;
  if (!existsSync(map)) return [];
  return JSON.parse(readFileSync(map, 'utf8')).sources ?? [];
}

const problems = [];
const rows = [];

const initialJs = [...initial].reduce((sum, f) => sum + gz(f), 0);
const initialCss = styles.reduce((sum, f) => sum + gz(f), 0);
rows.push(['Initial JS (gzip)', initialJs, budgets.initialJsKb]);
rows.push(['Initial CSS (gzip)', initialCss, budgets.initialCssKb]);
if (kb(initialJs) > budgets.initialJsKb) problems.push('Initial JS is over budget.');
if (kb(initialCss) > budgets.initialCssKb) problems.push('Initial CSS is over budget.');

for (const file of initial) {
  const heavy = sourcesOf(file).filter((s) =>
    /node_modules\/.*\/(pdfjs-dist|msw|@sentry)\//.test(s),
  );
  if (heavy.length) {
    const what = [...new Set(heavy.map((s) => s.match(/(pdfjs-dist|msw|@sentry)/)[1]))].join(', ');
    problems.push(`${relative(dist, file)} loads ${what} up front; it must be imported lazily.`);
  }
}

// Sentry loads beside the first page when VITE_SENTRY_DSN is set: it has its own budget.
const assets = join(dist, 'assets');
const isSentry = (name) => sourcesOf(join(assets, name)).some((s) => /\/@sentry\//.test(s));
const sentry = readdirSync(assets).filter((n) => n.endsWith('.js') && isSentry(n));
for (const name of sentry) {
  const size = gz(join(assets, name));
  rows.push([`Sentry, loaded after start-up (${name})`, size, budgets.sentryKb]);
  if (kb(size) > budgets.sentryKb) problems.push(`${name} (Sentry) is over budget.`);
}

// Every other lazy chunk but pdf.js, its worker and the mock API (never loaded in production).
const lazy = readdirSync(assets)
  .filter((name) => name.endsWith('.js') && !initial.has(join(assets, name)))
  .filter((name) => !sentry.includes(name))
  .filter(
    (name) => !sourcesOf(join(assets, name)).some((s) => /pdfjs-dist|\/msw\/|\/mocks\//.test(s)),
  )
  .map((name) => ({ name, size: gz(join(assets, name)) }))
  .sort((a, b) => b.size - a.size);
for (const { name, size } of lazy) {
  if (kb(size) > budgets.lazyChunkKb) {
    problems.push(
      `${name} is ${kb(size).toFixed(1)} KB gzipped (budget ${budgets.lazyChunkKb} KB).`,
    );
  }
}
if (lazy[0]) rows.push([`Largest page chunk (${lazy[0].name})`, lazy[0].size, budgets.lazyChunkKb]);

console.info(`Web app budget (${relative(process.cwd(), dist) || dist})`);
for (const [label, bytes, budget] of rows) {
  const ok = kb(bytes) <= budget ? 'ok  ' : 'OVER';
  console.info(`  ${ok} ${label}: ${kb(bytes).toFixed(1)} KB of ${budget} KB`);
}
console.info(`  Initial files: ${[...initial].map((f) => relative(dist, f)).join(', ')}`);

if (problems.length) {
  console.error(`\n${problems.map((p) => `✗ ${p}`).join('\n')}`);
  process.exit(1);
}
console.info('\nWithin budget.');

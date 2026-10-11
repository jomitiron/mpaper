// Renders the social preview card and the square icons to PNGs in public/ with headless Chrome.
// The PNGs are committed; run this again after changing scripts/social/*.html:
//   pnpm --filter site social-images        (set CHROME_PATH if Chrome isn't found)
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const IMAGES = [
  { page: 'card.html', out: 'public/og.png', width: 1200, height: 630 },
  { page: 'icon.html?size=512', out: 'public/logo.png', width: 512, height: 512 },
  { page: 'icon.html?size=180', out: 'public/apple-touch-icon.png', width: 180, height: 180 },
];

const CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];
const chrome = CANDIDATES.find((path) => path && existsSync(path));
if (!chrome) {
  console.error('Chrome not found. Set CHROME_PATH to a Chrome or Chromium binary.');
  process.exit(1);
}

const profile = mkdtempSync(join(tmpdir(), 'motopapers-social-'));

for (const { page, out, width, height } of IMAGES) {
  const target = join(root, out);
  execFileSync(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--allow-file-access-from-files',
      '--force-device-scale-factor=1',
      '--virtual-time-budget=5000',
      `--user-data-dir=${profile}`,
      `--window-size=${width},${height}`,
      `--screenshot=${target}`,
      new URL(page, pathToFileURL(join(root, 'scripts/social/'))).href,
    ],
    { stdio: 'ignore' },
  );
  // A PNG's width and height sit at bytes 16–23 of the IHDR chunk.
  const png = readFileSync(target);
  const size = [png.readUInt32BE(16), png.readUInt32BE(20)];
  if (size[0] !== width || size[1] !== height) {
    console.error(`${out} came out ${size.join('×')}, expected ${width}×${height}.`);
    process.exit(1);
  }
  console.info(`${out} ${width}×${height}`);
}

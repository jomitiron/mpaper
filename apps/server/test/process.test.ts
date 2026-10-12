import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { makePackage, send } from './helpers';

const SERVER = fileURLToPath(new URL('../server.mjs', import.meta.url));

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });
}

describe('node server.mjs', () => {
  it('listens on PORT and shuts down cleanly on SIGTERM', async () => {
    const pkg = makePackage();
    const port = await freePort();
    // The package's own copy, so it finds site/ and web/ next to it.
    const { copyFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const entry = join(pkg.root, 'server.mjs');
    copyFileSync(SERVER, entry);

    const child = spawn(process.execPath, [entry], {
      env: { PATH: process.env.PATH, PORT: String(port), API_BASE_URL: 'https://api.example' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()));
    const exited = new Promise<number | null>((resolve) => child.on('exit', resolve));

    try {
      await expect.poll(() => output, { timeout: 10_000 }).toContain(`MotoPapers on port ${port}`);
      expect(output).not.toContain('No site/index.html');
      const health = await send(port, '/healthz');
      expect(health.text).toBe('ok');
      const home = await send(port, '/');
      expect(home.text).toContain('Never drive with expired papers');

      child.kill('SIGTERM');
      expect(await exited).toBe(0);
      expect(output).toContain('SIGTERM: closing');
    } finally {
      child.kill('SIGKILL');
      pkg.cleanup();
    }
  });
});

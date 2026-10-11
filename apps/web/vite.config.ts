import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

// Port 5170 is this app's (see docs/phases/P0-foundations.md); other phases use their own.
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5170, strictPort: true },
  preview: { port: 5170, strictPort: true },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      onwarn(warning, warn) {
        // Zod's comments confuse Rollup's annotation parser; harmless and not ours to fix.
        if (warning.code === 'INVALID_ANNOTATION' && warning.id?.includes('node_modules')) return;
        warn(warning);
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
    setupFiles: ['test/setup.ts'],
  },
});

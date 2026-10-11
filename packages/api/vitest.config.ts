import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // Far from Lagos on purpose: the date maths must not depend on the machine's time zone.
    env: { TZ: 'Pacific/Kiritimati' },
  },
});

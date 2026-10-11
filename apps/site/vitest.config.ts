import type { ViteUserConfig } from 'astro';
import { getViteConfig } from 'astro/config';
import type { ViteUserConfig as VitestUserConfig } from 'vitest/config';

// Astro's Vite config, so tests can render .astro pages with the container API. Astro and Vitest
// type different copies of Vite, hence the cast.
const config: VitestUserConfig = {
  test: {
    environment: 'node',
    env: { PUBLIC_APP_URL: 'https://app.example.ng' },
  },
};

export default getViteConfig(config as ViteUserConfig);

import { defineConfig } from 'astro/config';

// Port 4320 is this site's (see docs/phases/P0-foundations.md).
// PUBLIC_SITE_URL is set per environment by the deploy workflow; it feeds canonical URLs.
export default defineConfig({
  site: process.env.PUBLIC_SITE_URL || 'http://localhost:4320',
  output: 'static',
  server: { port: 4320 },
  build: { format: 'directory' },
});

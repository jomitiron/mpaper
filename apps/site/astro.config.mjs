import { defineConfig } from 'astro/config';

// Port 4320 is this site's (see docs/phases/P0-foundations.md); phase 5 runs it on 4321.
// PUBLIC_SITE_URL is set per environment by the deploy workflow; it feeds canonical URLs, the
// sitemap and social preview links.
export default defineConfig({
  site: process.env.PUBLIC_SITE_URL || 'http://localhost:4320',
  output: 'static',
  server: { port: 4320 },
  // Pages build to folders (privacy/index.html) and every link ends in a slash, which is how
  // Azure Static Web Apps serves folders.
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'always' },
});

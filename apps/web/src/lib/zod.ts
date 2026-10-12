import { z } from 'zod';

// Zod speeds up object parsing with `new Function`, which a Content-Security-Policy without
// 'unsafe-eval' (the App Service one, apps/server) blocks and reports as a violation. It decides
// when each schema is created, so main.ts imports this first, before any schema exists.
z.config({ jitless: true });

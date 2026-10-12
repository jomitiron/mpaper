import { isAbortError, isUnauthorized } from '@motopapers/api';
import * as Sentry from '@sentry/vue';
import { watch, type App } from 'vue';
import type { Router } from 'vue-router';

/**
 * Error reporting with Sentry, on only when VITE_SENTRY_DSN is set. main.ts loads this file
 * lazily, so the SDK never weighs on the first load when it's off.
 *
 * Errors only: no performance tracing or session replay. Each report carries the release (the
 * commit, VITE_RELEASE), the environment (preview, staging, production) and the driver's id, never
 * their email or anything they typed.
 */

export interface SentryOptions {
  dsn: string;
  release: string;
  environment: string;
  router: Router;
  /** The signed-in driver's id, or null. */
  userId: () => number | null | undefined;
}

export function startSentry(app: App, options: SentryOptions): void {
  Sentry.init({
    app,
    dsn: options.dsn,
    release: options.release ? `motopapers-web@${options.release}` : undefined,
    environment: options.environment,
    sendDefaultPii: false,
    // A 401 signs the driver out (expected after 30 minutes); a cancelled request is not a fault.
    beforeSend(event, hint) {
      const error = hint.originalException;
      if (isUnauthorized(error) || isAbortError(error)) return null;
      return event;
    },
  });

  // Which page the driver was on, as a tag that's easy to filter by.
  options.router.afterEach((to) => {
    Sentry.setTag('route', typeof to.name === 'string' ? to.name : to.path);
  });
  watch(
    options.userId,
    (id) => Sentry.setUser(id === null || id === undefined ? null : { id: String(id) }),
    { immediate: true },
  );
}

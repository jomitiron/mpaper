import { init } from '@sentry/browser';

/**
 * Error reporting for the site, on only when PUBLIC_SENTRY_DSN is set (layouts/Base.astro loads
 * this after the page has loaded). Errors only, tagged with the release (the commit,
 * PUBLIC_RELEASE) and environment; no personal details.
 */
export function startSentry(options: { dsn: string; release: string; environment: string }) {
  init({
    dsn: options.dsn,
    release: options.release ? `motopapers-site@${options.release}` : undefined,
    environment: options.environment,
    sendDefaultPii: false,
  });
}

import { DEFAULT_DOC_READER_URL } from '@motopapers/api';
import { z } from 'zod';

/**
 * The app's settings. Read `env` and `flags`, not import.meta.env.
 *
 * They come from two places, and a runtime value wins:
 *   1. `config.js`, which index.html loads before the app. It sets `window.__MOTOPAPERS_CONFIG__`.
 *      On App Service the server (apps/server) writes it from each slot's settings, so the same
 *      build runs in dev, stage and production. Everywhere else it's the empty default in public/.
 *   2. VITE_* variables, baked in at build time (local dev, Static Web Apps, e2e).
 *
 * The mock API is build-time only: no runtime setting can switch it on.
 */

declare global {
  interface Window {
    __MOTOPAPERS_CONFIG__?: unknown;
  }
}

function bool(value: string | undefined): boolean {
  return ['true', '1', 'yes', 'on'].includes((value ?? '').trim().toLowerCase());
}

// A value that's missing or the wrong shape is ignored (the build-time value is used instead),
// so one bad setting can't stop the app from starting.
const url = z
  .url({ protocol: /^https?$/ })
  .optional()
  .catch(() => undefined);
const text = z
  .string()
  .trim()
  .min(1)
  .optional()
  .catch(() => undefined);
const flag = z
  .boolean()
  .optional()
  .catch(() => undefined);

/** What `config.js` may set. Unknown keys are dropped. */
export const runtimeConfigSchema = z
  .object({
    apiBaseUrl: url,
    docReaderUrl: url,
    appUrl: url,
    siteUrl: url,
    sentryDsn: url,
    sentryEnvironment: text,
    release: text,
    flags: z
      .object({
        renewals: flag,
        reminderSettings: flag,
        txLabels: flag,
        walletPay: flag,
        verifyPayment: flag,
      })
      .optional()
      .catch(() => undefined),
  })
  .catch(() => ({}));

export type RuntimeConfig = z.infer<typeof runtimeConfigSchema>;

/** Merges the runtime config over the build-time variables. */
export function readSettings(runtime: unknown, build: ImportMetaEnv) {
  const config = runtimeConfigSchema.parse(runtime ?? {});

  const env = {
    apiBaseUrl:
      config.apiBaseUrl || build.VITE_API_BASE_URL || 'https://ijanla-dev.azurewebsites.net',
    docReaderUrl: config.docReaderUrl || build.VITE_DOC_PARSER_URL || DEFAULT_DOC_READER_URL,
    appUrl: config.appUrl || build.VITE_APP_URL || '',
    siteUrl: config.siteUrl || build.VITE_SITE_URL || '',
    useMocks: bool(build.VITE_USE_MOCKS),
    sentryDsn: config.sentryDsn || build.VITE_SENTRY_DSN || '',
    /** Sentry's environment tag: development, preview, staging or production. */
    sentryEnvironment: config.sentryEnvironment || build.VITE_SENTRY_ENVIRONMENT || build.MODE,
    /** The commit this build came from, for Sentry's release tag. */
    release: config.release || build.VITE_RELEASE || '',
  } as const;

  /**
   * UI that depends on endpoints the backend hasn't built (docs/phases/api-gaps.md).
   * When a flag is off, hide the feature or use the fallback the gap describes.
   */
  const flags = {
    /** Renew flow and renewal tracker (POST /vehicles/:id/renewals). Off: call or WhatsApp us. */
    renewals: config.flags?.renewals ?? bool(build.VITE_FLAG_RENEWALS),
    /** Reminder settings card (GET/PUT /users/notification-preferences). Off: hidden. */
    reminderSettings: config.flags?.reminderSettings ?? bool(build.VITE_FLAG_REMINDER_SETTINGS),
    /** Transaction labels (category, description, car). Off: label by credit/debit. */
    txLabels: config.flags?.txLabels ?? bool(build.VITE_FLAG_TX_LABELS),
    /** Pay from wallet (POST /wallets/debit). Off: card or bank transfer only. */
    walletPay: config.flags?.walletPay ?? bool(build.VITE_FLAG_WALLET_PAY),
    /** "Check status" on pending payments (POST /transactions/:reference/verify). */
    verifyPayment: config.flags?.verifyPayment ?? bool(build.VITE_FLAG_VERIFY_PAYMENT),
  } as const;

  return { env, flags };
}

const settings = readSettings(
  typeof window === 'undefined' ? undefined : window.__MOTOPAPERS_CONFIG__,
  import.meta.env,
);

export const env = settings.env;
export const flags = settings.flags;

export type FeatureFlag = keyof typeof flags;

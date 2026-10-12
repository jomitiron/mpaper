import { DEFAULT_DOC_READER_URL } from '@motopapers/api';

/** Typed settings from VITE_* variables. Read these, not import.meta.env. */

function bool(value: string | undefined): boolean {
  return ['true', '1', 'yes', 'on'].includes((value ?? '').trim().toLowerCase());
}

export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'https://ijanla-dev.azurewebsites.net',
  docReaderUrl: import.meta.env.VITE_DOC_PARSER_URL || DEFAULT_DOC_READER_URL,
  appUrl: import.meta.env.VITE_APP_URL || '',
  siteUrl: import.meta.env.VITE_SITE_URL || '',
  useMocks: bool(import.meta.env.VITE_USE_MOCKS),
  sentryDsn: import.meta.env.VITE_SENTRY_DSN || '',
  /** Sentry's environment tag: preview, staging or production (set by the deploy workflow). */
  sentryEnvironment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
  /** The commit this build came from (set by the deploy workflow), for Sentry's release tag. */
  release: import.meta.env.VITE_RELEASE || '',
} as const;

/**
 * UI that depends on endpoints the backend hasn't built (docs/phases/api-gaps.md).
 * When a flag is off, hide the feature or use the fallback the gap describes.
 */
export const flags = {
  /** Renew flow and renewal tracker (POST /vehicles/:id/renewals). Off: call or WhatsApp us. */
  renewals: bool(import.meta.env.VITE_FLAG_RENEWALS),
  /** Reminder settings card (GET/PUT /users/notification-preferences). Off: hidden. */
  reminderSettings: bool(import.meta.env.VITE_FLAG_REMINDER_SETTINGS),
  /** Transaction labels (category, description, car). Off: label by credit/debit. */
  txLabels: bool(import.meta.env.VITE_FLAG_TX_LABELS),
  /** Pay from wallet (POST /wallets/debit). Off: card or bank transfer only. */
  walletPay: bool(import.meta.env.VITE_FLAG_WALLET_PAY),
  /** "Check status" on pending payments (POST /transactions/:reference/verify). */
  verifyPayment: bool(import.meta.env.VITE_FLAG_VERIFY_PAYMENT),
} as const;

export type FeatureFlag = keyof typeof flags;

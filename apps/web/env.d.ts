/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** MotorPapers API origin: ijanla-dev, ijanla-stage or ijanla on azurewebsites.net. */
  readonly VITE_API_BASE_URL?: string;
  /** Document reader endpoint. Defaults to the production reader. */
  readonly VITE_DOC_PARSER_URL?: string;
  /** This app's own URL, e.g. https://app.motopapers.ng. */
  readonly VITE_APP_URL?: string;
  /** The marketing site's URL, for links back to it. */
  readonly VITE_SITE_URL?: string;
  /** `true` serves every API call from the MSW mocks in packages/api. */
  readonly VITE_USE_MOCKS?: string;
  /** Sentry DSN. Error reporting is off when it's unset. */
  readonly VITE_SENTRY_DSN?: string;
  /** Sentry's environment tag: preview, staging or production. Defaults to the Vite mode. */
  readonly VITE_SENTRY_ENVIRONMENT?: string;
  /** The commit being built (the deploy workflow passes github.sha), for Sentry's release tag. */
  readonly VITE_RELEASE?: string;
  /** Feature flags for UI that needs an endpoint the backend hasn't shipped (api-gaps.md). */
  readonly VITE_FLAG_RENEWALS?: string;
  readonly VITE_FLAG_REMINDER_SETTINGS?: string;
  readonly VITE_FLAG_TX_LABELS?: string;
  readonly VITE_FLAG_WALLET_PAY?: string;
  readonly VITE_FLAG_VERIFY_PAYMENT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

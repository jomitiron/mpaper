/// <reference types="astro/client" />

interface ImportMetaEnv {
  /** The web app, e.g. https://app.motopapers.ng. Sign in and Get started link there. */
  readonly PUBLIC_APP_URL?: string;
  /** This site's own URL, for canonical links, the sitemap and social previews. */
  readonly PUBLIC_SITE_URL?: string;
  /** Plausible analytics domain. Leave unset to turn analytics off. */
  readonly PUBLIC_ANALYTICS_DOMAIN?: string;
  /** "true" adds noindex and a blocking robots.txt (staging and previews). */
  readonly PUBLIC_NOINDEX?: string;
  /** Sentry DSN. Error reporting is off when it's unset. */
  readonly PUBLIC_SENTRY_DSN?: string;
  /** Sentry's environment tag: preview, staging or production. */
  readonly PUBLIC_SENTRY_ENVIRONMENT?: string;
  /** The commit being built (the deploy workflow passes github.sha), for Sentry's release tag. */
  readonly PUBLIC_RELEASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/// <reference types="astro/client" />

interface ImportMetaEnv {
  /** The web app, e.g. https://app.motopapers.ng. Sign in and Get started link there. */
  readonly PUBLIC_APP_URL?: string;
  /** This site's own URL, for canonical links. */
  readonly PUBLIC_SITE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

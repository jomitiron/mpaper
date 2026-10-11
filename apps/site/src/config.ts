/** The web app's address. Every "Sign in" and "Get started" goes there. */
export const APP_URL = (import.meta.env.PUBLIC_APP_URL || 'http://localhost:5170').replace(
  /\/+$/,
  '',
);

export const appLink = (path: string) => `${APP_URL}${path.startsWith('/') ? path : `/${path}`}`;

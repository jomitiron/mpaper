import 'vue-router';

declare module 'vue-router' {
  interface RouteMeta {
    /** Reachable when signed out. Every other page needs a session. */
    public?: boolean;
    /** Signed-in drivers are sent on to `next` (or Home): sign-in, sign-up. */
    guestOnly?: boolean;
    /** `app` (sidebar and tab bar, the default) or `bare` (full-page: sign-in, 404). */
    layout?: 'app' | 'bare';
    /** Page title; " · MotoPapers" is added. */
    title?: string;
  }
}

export {};

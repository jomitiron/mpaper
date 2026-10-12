import { getOAuthUrl } from '@motopapers/api';
import { oauthState, type OAuthState } from './handoff';

/** Leaves the app for another page. Swapped out in tests. */
export const browser = {
  go(url: string): void {
    window.location.assign(url);
  },
};

/**
 * Sends the driver to Google. Google returns them to the API's redirect address with a `code`,
 * which /auth/callback (or the old app's /complete-onboard) trades for a session.
 */
export async function continueWithGoogle(state: OAuthState): Promise<void> {
  const url = new URL(await getOAuthUrl({ platform: 'google', action: state.action }));
  // Only Google (https) or, with the mock API, this app.
  if (url.protocol !== 'https:' && url.origin !== window.location.origin) {
    throw new Error(`Unexpected sign-in address: ${url.origin}`);
  }
  oauthState.save(state);
  browser.go(url.href);
}

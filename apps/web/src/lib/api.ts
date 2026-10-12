import { configureApi } from '@motopapers/api';
import { useToast } from '@motopapers/ui';
import type { Router } from 'vue-router';
import { env } from '@/env';
import { SIGN_IN_PATH } from '@/router/guards';
import type { useSessionStore } from '@/stores/session';

/**
 * Points the API client at this environment and wires the session into it:
 * every request sends the token, and when the 30-minute token runs out (a 401, or the store's
 * expiry timer) the driver is signed out and sent to /sign-in?next=<where they were>.
 */
export function setupApi(options: {
  router: Router;
  session: ReturnType<typeof useSessionStore>;
}): void {
  const { router, session } = options;

  const sendToSignIn = () => {
    const current = router.currentRoute.value;
    if (current.meta.public) return;
    useToast().info('Your session ended. Sign in again to carry on.');
    void router.replace({ path: SIGN_IN_PATH, query: { next: current.fullPath } });
  };

  configureApi({
    baseUrl: env.apiBaseUrl,
    docReaderUrl: env.docReaderUrl,
    getToken: () => session.token,
    onUnauthorized: () => {
      if (!session.isSignedIn) return; // Already handled (several requests can fail at once).
      void session.signOut({ remote: false }); // The token is no good; don't send it again.
      sendToSignIn();
    },
  });
  session.onExpired(sendToSignIn);
}

import '@motopapers/ui/styles.css';
import './styles/app.css';
import { VueQueryPlugin } from '@tanstack/vue-query';
import { createPinia } from 'pinia';
import { createApp, watch } from 'vue';
import App from './App.vue';
import { env } from './env';
import { setupApi } from './lib/api';
import { createQueryClient } from './lib/queryClient';
import { createAppRouter } from './router';
import { useSessionStore } from './stores/session';

async function start() {
  if (env.useMocks) {
    const { startMocks } = await import('./mocks/browser');
    await startMocks();
  }

  const app = createApp(App);
  const pinia = createPinia();
  app.use(pinia);

  // The API is set up before restore(), which refreshes the driver with GET /users/me.
  const session = useSessionStore(pinia);
  const router = createAppRouter();
  const queryClient = createQueryClient();
  setupApi({ router, session });
  session.restore();

  // Nothing from one driver's session should be left in the cache for the next.
  watch(
    () => session.isSignedIn,
    (signedIn) => {
      if (!signedIn) queryClient.clear();
    },
  );

  app.use(router);
  app.use(VueQueryPlugin, { queryClient });
  await router.isReady();
  app.mount('#app');
}

void start();

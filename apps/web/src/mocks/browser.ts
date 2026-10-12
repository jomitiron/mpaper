import { createHandlers, createMockDb, SAMPLE_EMAIL, SAMPLE_PASSWORD } from '@motopapers/api/mocks';
import { setupWorker } from 'msw/browser';
import { env, flags } from '@/env';

/** Starts the mock API in the browser (VITE_USE_MOCKS=true). See packages/api/src/mocks/README.md. */
export async function startMocks(): Promise<void> {
  const db = createMockDb({ storage: sessionStorageOrNull() });
  const worker = setupWorker(
    ...createHandlers({
      baseUrl: env.apiBaseUrl,
      docReaderUrl: env.docReaderUrl,
      db,
      // The app's own address, base included (/app/ on App Service), for the mock Paystack and
      // Google returns.
      appOrigin: new URL(import.meta.env.BASE_URL, location.origin).href,
      transactionLabels: flags.txLabels,
      latency: 150,
    }),
  );
  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: true,
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
  });

  Object.assign(window, {
    __motopapersMocks: {
      db,
      /** Puts the sample data back and reloads. */
      reset() {
        db.reset();
        location.reload();
      },
    },
  });
  console.info(
    `[MotoPapers] Mock API on. Sign in as ${SAMPLE_EMAIL} / ${SAMPLE_PASSWORD}. Reset with __motopapersMocks.reset().`,
  );
}

function sessionStorageOrNull(): Storage | null {
  try {
    return sessionStorage;
  } catch {
    return null; // Blocked storage: keep the mock data in memory.
  }
}

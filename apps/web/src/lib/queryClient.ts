import { errorMessage, isAbortError, isHttpError, isUnauthorized } from '@motopapers/api';
import { useToast, type ToastQueue } from '@motopapers/ui';
import { MutationCache, QueryCache, QueryClient } from '@tanstack/vue-query';

/**
 * Vue Query client with a global error toast.
 *
 * - A failed query shows a toast, unless it has `meta: { silent: true }` (use that when the page
 *   shows its own error state).
 * - A failed mutation shows a toast unless it has its own `onError` or `meta: { silent: true }`
 *   (forms usually show errors inline).
 * - A 401 shows nothing here: the API's 401 hook signs the driver out instead.
 */
export function createQueryClient(toast: ToastQueue = useToast()): QueryClient {
  const report = (error: unknown) => {
    if (isUnauthorized(error) || isAbortError(error)) return;
    toast.error(errorMessage(error));
  };

  return new QueryClient({
    queryCache: new QueryCache({
      onError(error, query) {
        if (!query.meta?.silent) report(error);
      },
    }),
    mutationCache: new MutationCache({
      onError(error, _variables, _onMutateResult, mutation) {
        if (!mutation.meta?.silent && !mutation.options.onError) report(error);
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Retry network and server errors twice; a 4xx won't change by asking again.
        retry: (failureCount, error) =>
          failureCount < 2 && !(isHttpError(error) && error.status < 500),
      },
      mutations: { retry: false },
    },
  });
}

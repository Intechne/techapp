import { QueryClient } from '@tanstack/react-query';
import { toAppError } from './errors';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, error) => toAppError(error).retryable && count < 2,
    },
    mutations: { retry: false }, // writes are retried only by the user, with the same idempotency key
  },
});

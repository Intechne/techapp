/**
 * fetch with a hard deadline. Every Supabase request (REST, RPC, Auth incl. token refresh, Functions) goes through
 * this, so no request can hang forever on a dead network, an unroutable host or a server that never answers.
 * A caller-provided AbortSignal still works; a timeout surfaces as a "timeout" error (mapped to network_unreachable).
 */
export const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;

export class RequestTimeoutError extends Error {
  constructor(ms: number) {
    super(`Request timeout after ${ms} ms`);
    this.name = 'RequestTimeoutError';
  }
}

export function createTimeoutFetch(timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS, baseFetch: typeof fetch = (...args) => fetch(...args)): typeof fetch {
  return async (input, init = {}) => {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    const outer = init.signal;
    const onOuterAbort = () => controller.abort();
    if (outer) {
      if (outer.aborted) controller.abort();
      else outer.addEventListener('abort', onOuterAbort);
    }
    try {
      return await baseFetch(input, { ...init, signal: controller.signal });
    } catch (error) {
      if (timedOut) throw new RequestTimeoutError(timeoutMs);
      throw error;
    } finally {
      clearTimeout(timer);
      outer?.removeEventListener('abort', onOuterAbort);
    }
  };
}

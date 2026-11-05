// ============================================================================
// UPIPay — Transient Network Failure Recovery
// ============================================================================
// Provides a configurable retry wrapper with exponential back-off for
// outbound calls to PSP Status and Refund endpoints.
//
// Any error that is an instance of UPIPayError and has isRetriable === true
// will be retried — this covers both NetworkError (connection-level failures)
// and PaymentError with HTTP 5xx responses from the upstream PSP.
// Business-logic errors (amount mismatches, invalid order IDs, etc.) have
// isRetriable === false and propagate immediately without further attempts.
//
// Default behaviour: up to 3 attempts with delays of 1 s → 2 s → 4 s.

import { UPIPayError } from '../errors.js';

export interface RetryOptions {
  /**
   * Total number of attempts including the initial call.
   * A value of 1 means no retries — the call is made once and the result
   * (success or failure) is returned to the caller immediately.
   * @default 3
   */
  maxAttempts?: number;

  /**
   * Base delay in milliseconds for the first retry.
   * Each subsequent delay doubles: baseDelayMs, baseDelayMs * 2, …
   * @default 1000
   */
  baseDelayMs?: number;
}

/**
 * Executes `fn` and, on retriable network failures, re-attempts up to
 * `maxAttempts - 1` additional times with exponential back-off between each.
 *
 * Non-retriable errors are re-thrown immediately on the first occurrence.
 *
 * @param fn      - Async factory producing the desired result.
 * @param options - Optional retry behaviour overrides.
 * @returns       The resolved value of `fn()` on the first successful attempt.
 *
 * @example
 * ```typescript
 * const status = await withRetry(
 *   () => this.fetchStatus(orderId),
 *   { maxAttempts: 3, baseDelayMs: 1000 },
 * );
 * ```
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { maxAttempts = 3, baseDelayMs = 1000 } = options;

  let attempt = 0;

  while (true) {
    attempt += 1;
    try {
      return await fn();
    } catch (err) {
      const isRetriable = err instanceof UPIPayError ? err.isRetriable : false;

      if (!isRetriable || attempt >= maxAttempts) {
        throw err;
      }

      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      await sleep(delay);
    }
  }
}

/** Resolves after `ms` milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

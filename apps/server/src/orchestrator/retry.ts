/**
 * Exponential backoff retry for Claude API rate limits
 *
 * Per CONTEXT.md: 1s, 2s, 4s delays, max 3 attempts for 429 errors
 */

import Anthropic from '@anthropic-ai/sdk';

export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

// Per CONTEXT.md: 1s, 2s, 4s delays, max 3 attempts
const DEFAULT_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 4000,
};

/**
 * Check if an error is a 429 rate limit error
 */
export function is429Error(error: unknown): boolean {
  return (
    error instanceof Anthropic.RateLimitError ||
    (error instanceof Anthropic.APIError && error.status === 429)
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute an async operation with exponential backoff retry for 429 errors
 *
 * @param fn - Async function to execute
 * @param config - Retry configuration
 * @returns Result of fn
 * @throws Last error if all retries exhausted, or non-429 error immediately
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_CONFIG
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Only retry on 429 rate limit errors
      if (!is429Error(error)) {
        throw error;
      }

      if (attempt < config.maxAttempts - 1) {
        // Exponential backoff: 1s, 2s, 4s per CONTEXT.md
        const delay = Math.min(
          config.baseDelayMs * Math.pow(2, attempt),
          config.maxDelayMs
        );
        // Add jitter (10-20% random variation) to prevent thundering herd
        const jitter = delay * (0.1 + Math.random() * 0.1);
        await sleep(delay + jitter);
      }
    }
  }

  throw lastError;
}

export interface RecoveryPaths {
  retry: {
    action: 'retryFailedStep';
    label: 'Retry';
  };
  fixPlan: {
    action: 'openFixPlan';
    label: 'Open fix plan';
  };
}

export function getRecoveryPaths(): RecoveryPaths {
  return {
    retry: {
      action: 'retryFailedStep',
      label: 'Retry',
    },
    fixPlan: {
      action: 'openFixPlan',
      label: 'Open fix plan',
    },
  };
}

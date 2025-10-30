/**
 * Retry utility with exponential backoff
 */

import { logger } from './logger.js';

/**
 * Retry configuration options
 */
export interface RetryOptions {
  maxAttempts: number;
  initialDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffMultiplier: number;
  retryableErrors?: string[]; // Error codes that should be retried
  onRetry?: (error: Error, attempt: number) => void;
}

/**
 * Default retry options
 */
const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2,
};

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 */
function calculateDelay(attempt: number, options: RetryOptions): number {
  const delay = options.initialDelay * Math.pow(options.backoffMultiplier, attempt - 1);
  return Math.min(delay, options.maxDelay);
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: Error, options: RetryOptions): boolean {
  // If specific retryable errors are defined, check against them
  if (options.retryableErrors && options.retryableErrors.length > 0) {
    const errorCode = (error as any).code || error.name;
    return options.retryableErrors.includes(errorCode);
  }

  // By default, retry on network errors, timeouts, and rate limits
  const retryablePatterns = [
    /network/i,
    /timeout/i,
    /rate limit/i,
    /ECONNRESET/,
    /ETIMEDOUT/,
    /ENOTFOUND/,
    /429/, // Too Many Requests
    /502/, // Bad Gateway
    /503/, // Service Unavailable
    /504/, // Gateway Timeout
  ];

  const errorMessage = error.message || '';
  return retryablePatterns.some((pattern) => pattern.test(errorMessage));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts: RetryOptions = { ...DEFAULT_RETRY_OPTIONS, ...options };

  let lastError: Error;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Check if we should retry
      if (attempt >= opts.maxAttempts) {
        logger.error(`Max retry attempts (${opts.maxAttempts}) reached`, {
          error: lastError.message,
          stack: lastError.stack,
        });
        throw lastError;
      }

      // Check if error is retryable
      if (!isRetryableError(lastError, opts)) {
        logger.warn('Non-retryable error encountered', {
          error: lastError.message,
          attempt,
        });
        throw lastError;
      }

      // Calculate delay
      const delay = calculateDelay(attempt, opts);

      logger.warn(`Retry attempt ${attempt}/${opts.maxAttempts}`, {
        error: lastError.message,
        delay,
        nextAttempt: attempt + 1,
      });

      // Call retry callback if provided
      if (opts.onRetry) {
        opts.onRetry(lastError, attempt);
      }

      // Wait before retrying
      await sleep(delay);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError!;
}

/**
 * Retry with custom condition
 */
export async function retryWithCondition<T>(
  fn: () => Promise<T>,
  condition: (result: T) => boolean,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts: RetryOptions = { ...DEFAULT_RETRY_OPTIONS, ...options };

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    const result = await fn();

    if (condition(result)) {
      return result;
    }

    if (attempt >= opts.maxAttempts) {
      logger.error('Max retry attempts reached (condition not met)', {
        attempt: opts.maxAttempts,
      });
      throw new Error('Retry condition not met after max attempts');
    }

    const delay = calculateDelay(attempt, opts);

    logger.warn(`Retry condition not met, attempt ${attempt}/${opts.maxAttempts}`, {
      delay,
    });

    await sleep(delay);
  }

  throw new Error('Retry condition not met');
}

/**
 * Create a retryable version of a function
 */
export function makeRetryable<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: Partial<RetryOptions> = {}
): T {
  return ((...args: any[]) => retry(() => fn(...args), options)) as T;
}

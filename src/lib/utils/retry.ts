/**
 * Retry Utility with Exponential Backoff
 *
 * Generic retry logic for any async operation.
 * Used to wrap API calls that may fail transiently.
 */

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  onRetry?: (attempt: number, error: Error, delay: number) => void;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, "onRetry">> = {
  maxRetries: 3,
  baseDelay: 2000,
  maxDelay: 30000,
  backoffMultiplier: 2,
};

/**
 * Retry an async function with exponential backoff
 *
 * @param fn - The async function to retry
 * @param options - Retry configuration
 * @returns The result of the function
 * @throws The last error if all retries are exhausted
 *
 * @example
 * ```typescript
 * const response = await retryWithBackoff(
 *   () => fetch('https://api.example.com/data'),
 *   { maxRetries: 3, baseDelay: 2000 }
 * );
 * ```
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = DEFAULT_OPTIONS.maxRetries,
    baseDelay = DEFAULT_OPTIONS.baseDelay,
    maxDelay = DEFAULT_OPTIONS.maxDelay,
    backoffMultiplier = DEFAULT_OPTIONS.backoffMultiplier,
    onRetry,
  } = options;

  let lastError: Error = new Error("No attempts made");

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxRetries) {
        break;
      }

      const delay = Math.min(baseDelay * Math.pow(backoffMultiplier, attempt), maxDelay);

      if (onRetry) {
        onRetry(attempt + 1, lastError, delay);
      } else {
        console.warn(
          `[Retry] Attempt ${attempt + 1}/${maxRetries} failed: ${lastError.message}. Retrying in ${delay}ms...`
        );
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  isRetryable?: (error: Error) => boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  isRetryable: () => true,
};

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  opts: RetryOptions
): Promise<T> {
  const { maxAttempts, baseDelayMs, maxDelayMs, isRetryable } = {
    ...DEFAULT_OPTIONS,
    ...opts,
  };

  let lastError: Error = new Error('retryWithBackoff: no attempts made');

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt === maxAttempts || !isRetryable(lastError)) {
        throw lastError;
      }

      const delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
      const jitter = delay * (0.5 + Math.random() * 0.5);
      await new Promise((r) => setTimeout(r, jitter));
    }
  }

  throw lastError;
}

import { retryWithBackoff } from '../retryWithBackoff';

describe('retryWithBackoff', () => {
  it('returns result on first success', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const result = await retryWithBackoff(fn, { maxAttempts: 3 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and succeeds', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValue('ok');
    const result = await retryWithBackoff(fn, { maxAttempts: 3, baseDelayMs: 10 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws after max attempts exhausted', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('persistent'));
    await expect(retryWithBackoff(fn, { maxAttempts: 3, baseDelayMs: 10 }))
      .rejects.toThrow('persistent');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry non-retryable errors', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('INVALID_ARGUMENT'));
    await expect(retryWithBackoff(fn, {
      maxAttempts: 3,
      baseDelayMs: 10,
      isRetryable: (e) => !e.message.includes('INVALID_ARGUMENT'),
    })).rejects.toThrow('INVALID_ARGUMENT');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

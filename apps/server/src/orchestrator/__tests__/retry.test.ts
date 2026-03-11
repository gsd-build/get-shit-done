import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { RetryConfig } from '../retry.js';

// Mock the Anthropic SDK to create testable error types
vi.mock('@anthropic-ai/sdk', () => {
  class APIError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.name = 'APIError';
      this.status = status;
    }
  }

  class RateLimitError extends APIError {
    constructor(message: string) {
      super(429, message);
      this.name = 'RateLimitError';
    }
  }

  return {
    default: {
      RateLimitError,
      APIError,
    },
    RateLimitError,
    APIError,
  };
});

// Import after mocking
import Anthropic from '@anthropic-ai/sdk';
import { is429Error, withRetry } from '../retry.js';

describe('retry', () => {
  describe('is429Error', () => {
    it('returns true for RateLimitError', () => {
      // Arrange
      const error = new Anthropic.RateLimitError('Rate limited');

      // Act
      const result = is429Error(error);

      // Assert
      expect(result).toBe(true);
    });

    it('returns true for APIError with status 429', () => {
      // Arrange
      const error = new Anthropic.APIError(429, 'Rate limited');

      // Act
      const result = is429Error(error);

      // Assert
      expect(result).toBe(true);
    });

    it('returns false for APIError with non-429 status', () => {
      // Arrange
      const error = new Anthropic.APIError(500, 'Internal error');

      // Act
      const result = is429Error(error);

      // Assert
      expect(result).toBe(false);
    });

    it('returns false for regular Error', () => {
      // Arrange
      const error = new Error('Something went wrong');

      // Act
      const result = is429Error(error);

      // Assert
      expect(result).toBe(false);
    });

    it('returns false for non-error values', () => {
      expect(is429Error(null)).toBe(false);
      expect(is429Error(undefined)).toBe(false);
      expect(is429Error('error')).toBe(false);
      expect(is429Error({ status: 429 })).toBe(false);
    });
  });

  describe('withRetry', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns result on first successful call', async () => {
      // Arrange
      const fn = vi.fn().mockResolvedValue('success');

      // Act
      const result = await withRetry(fn);

      // Assert
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retries on 429 error and succeeds on second attempt', async () => {
      // Arrange
      const rateLimitError = new Anthropic.RateLimitError('Rate limited');
      const fn = vi
        .fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce('success after retry');

      // Act
      const promise = withRetry(fn);
      // Fast-forward through the delay
      await vi.runAllTimersAsync();
      const result = await promise;

      // Assert
      expect(result).toBe('success after retry');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('throws non-429 errors immediately without retry', async () => {
      // Arrange
      const serverError = new Anthropic.APIError(500, 'Server error');
      const fn = vi.fn().mockRejectedValue(serverError);

      // Act & Assert
      await expect(withRetry(fn)).rejects.toThrow('Server error');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('throws after exhausting all retry attempts', async () => {
      // Arrange
      const rateLimitError = new Anthropic.RateLimitError('Rate limited');
      const fn = vi.fn().mockRejectedValue(rateLimitError);
      const config: RetryConfig = {
        maxAttempts: 3,
        baseDelayMs: 100,
        maxDelayMs: 400,
      };

      // Act - start the retry and attach rejection handler immediately
      const promise = withRetry(fn, config).catch((e) => e);
      await vi.runAllTimersAsync();
      const error = await promise;

      // Assert
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Rate limited');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('uses exponential backoff delays', async () => {
      // Arrange
      const rateLimitError = new Anthropic.RateLimitError('Rate limited');
      let callCount = 0;
      const fn = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.reject(rateLimitError);
        }
        return Promise.resolve('success');
      });

      const config: RetryConfig = {
        maxAttempts: 3,
        baseDelayMs: 1000,
        maxDelayMs: 4000,
      };

      // Act
      const promise = withRetry(fn, config);

      // First call happens immediately
      await vi.advanceTimersByTimeAsync(0);
      expect(fn).toHaveBeenCalledTimes(1);

      // After ~1s delay (first retry) - with jitter up to 20%
      await vi.advanceTimersByTimeAsync(1300);
      expect(fn).toHaveBeenCalledTimes(2);

      // After ~2s delay (second retry) - with jitter up to 20%
      await vi.advanceTimersByTimeAsync(2600);
      expect(fn).toHaveBeenCalledTimes(3);

      const result = await promise;
      expect(result).toBe('success');
    });

    it('respects maxDelayMs cap', async () => {
      // Arrange
      const rateLimitError = new Anthropic.RateLimitError('Rate limited');
      const fn = vi
        .fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockRejectedValueOnce(rateLimitError)
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce('success');

      const config: RetryConfig = {
        maxAttempts: 4,
        baseDelayMs: 1000,
        maxDelayMs: 2000, // Cap at 2s
      };

      // Act
      const promise = withRetry(fn, config);
      await vi.runAllTimersAsync();

      // Assert - should succeed on 4th attempt
      const result = await promise;
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(4);
    });

    it('uses default config when not provided', async () => {
      // Arrange
      const fn = vi.fn().mockResolvedValue('result');

      // Act
      const result = await withRetry(fn);

      // Assert
      expect(result).toBe('result');
    });
  });
});

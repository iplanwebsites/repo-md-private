/**
 * Tests for the utils module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchJson, clearUrlFromCache } from './utils.js';

describe('Utils Module', () => {
  // Generate unique URLs for each test to avoid cache collisions
  let testId = 0;
  const getUniqueUrl = (suffix = '') => `https://example.com/api/test-${++testId}${suffix}`;

  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
  });

  // Helper to create mock fetch response
  const createMockResponse = (data, status = 200, ok = true) => ({
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: () => Promise.resolve(data),
    clone: () => ({
      text: () => Promise.resolve(JSON.stringify(data)),
    }),
    headers: {
      forEach: (cb) => {},
    },
  });

  describe('fetchJson', () => {
    it('should fetch and parse JSON successfully', async () => {
      const testData = { id: 1, name: 'Test' };
      globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse(testData));

      const url = getUniqueUrl();
      const result = await fetchJson(url);

      expect(result).toEqual(testData);
      expect(fetch).toHaveBeenCalledWith(url, expect.any(Object));
    });

    it('should support POST method', async () => {
      const testData = { result: 'success' };
      globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse(testData));

      const url = getUniqueUrl('-post');
      const result = await fetchJson(url, {
        method: 'POST',
        body: JSON.stringify({ action: 'test' }),
      });

      expect(result).toEqual(testData);
      expect(fetch).toHaveBeenCalledWith(
        url,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ action: 'test' }),
        })
      );
    });

    it('should support custom headers', async () => {
      const testData = { result: 'success' };
      globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse(testData));

      const url = getUniqueUrl('-headers');
      await fetchJson(url, {
        headers: {
          'Authorization': 'Bearer token123',
          'Content-Type': 'application/json',
        },
        useCache: false,
      });

      expect(fetch).toHaveBeenCalledWith(
        url,
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer token123',
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should log in debug mode', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse({ test: 'data' }));

      const url = getUniqueUrl('-debug');
      await fetchJson(url, {}, true);

      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should cache GET requests by default', async () => {
      const testData = { id: 1 };
      globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse(testData));

      const url = getUniqueUrl('-cached');

      // First call
      const result1 = await fetchJson(url);

      // Second call - should use cache
      const result2 = await fetchJson(url);

      // Both should return the same data
      expect(result1).toEqual(testData);
      expect(result2).toEqual(testData);

      // Should only have fetched once
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should skip cache when useCache is false', async () => {
      const testData = { id: 1 };
      globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse(testData));

      const url = getUniqueUrl('-nocache');

      await fetchJson(url, { useCache: false });
      await fetchJson(url, { useCache: false });

      // Should have fetched twice
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should not cache POST requests', async () => {
      const testData = { id: 1 };
      globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse(testData));

      const url = getUniqueUrl('-post-nocache');

      await fetchJson(url, {
        method: 'POST',
        body: '{}',
      });

      await fetchJson(url, {
        method: 'POST',
        body: '{}',
      });

      // Should have fetched twice (POST not cached)
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should deduplicate concurrent requests', async () => {
      // Create a slow response
      let resolvePromise;
      const slowPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      globalThis.fetch = vi.fn().mockReturnValue(
        slowPromise.then(() => createMockResponse({ data: 'test' }))
      );

      const url = getUniqueUrl('-concurrent');

      // Start multiple concurrent requests
      const promise1 = fetchJson(url);
      const promise2 = fetchJson(url);
      const promise3 = fetchJson(url);

      // Resolve the slow promise
      resolvePromise();

      const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3]);

      // All should get the same result
      expect(result1).toEqual({ data: 'test' });
      expect(result2).toEqual({ data: 'test' });
      expect(result3).toEqual({ data: 'test' });

      // Should only have made one fetch call
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('clearUrlFromCache', () => {
    it('should clear URL from cache', async () => {
      const testData = { id: 1 };
      globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse(testData));

      const url = getUniqueUrl('-clear');

      // First, cache the URL
      await fetchJson(url);

      // Clear it
      const found = clearUrlFromCache(url);

      expect(found).toBe(true);
    });

    it('should return false for non-cached URL', () => {
      const url = getUniqueUrl('-not-cached-unique');
      const found = clearUrlFromCache(url);

      expect(found).toBe(false);
    });
  });

  describe('Trusted Domain Detection', () => {
    it('should identify trusted repo.md domains', async () => {
      // This is tested implicitly through error handling
      // The module treats api.repo.md and static.repo.md as trusted
      globalThis.fetch = vi.fn().mockResolvedValue(createMockResponse({ success: true }));

      const url = 'https://api.repo.md/v1/test';
      const result = await fetchJson(url);

      expect(result).toEqual({ success: true });
    });
  });
});

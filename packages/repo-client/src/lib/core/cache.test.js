/**
 * Tests for the cache module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import cache, {
  getCached,
  setCached,
  clearCache,
  clearAllCaches,
  configureCache,
  getCacheStats,
} from './cache.js';

describe('Cache Module', () => {
  beforeEach(() => {
    // Clear all caches before each test
    clearAllCaches();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getCached', () => {
    it('should return undefined for non-existent key', () => {
      const result = getCached('non-existent-key');
      expect(result).toBeUndefined();
    });

    it('should return cached value when exists', () => {
      setCached('test-key', 'test-value');
      const result = getCached('test-key');
      expect(result).toBe('test-value');
    });

    it('should use default namespace when not specified', () => {
      setCached('test-key', 'default-value');
      const result = getCached('test-key');
      expect(result).toBe('default-value');
    });

    it('should respect namespaces', () => {
      setCached('test-key', 'posts-value', 'posts');
      setCached('test-key', 'media-value', 'media');

      expect(getCached('test-key', 'posts')).toBe('posts-value');
      expect(getCached('test-key', 'media')).toBe('media-value');
    });

    it('should log cache hit in debug mode', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      setCached('test-key', 'test-value');
      getCached('test-key', 'default', true);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Cache hit'));
    });

    it('should log cache miss in debug mode', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      getCached('non-existent-key', 'default', true);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Cache miss'));
    });
  });

  describe('setCached', () => {
    it('should store value in cache', () => {
      setCached('new-key', 'new-value');
      expect(getCached('new-key')).toBe('new-value');
    });

    it('should overwrite existing value', () => {
      setCached('key', 'original');
      setCached('key', 'updated');
      expect(getCached('key')).toBe('updated');
    });

    it('should store complex objects', () => {
      const complexObject = {
        id: 1,
        name: 'Test',
        nested: { a: 1, b: 2 },
        array: [1, 2, 3],
      };

      setCached('complex-key', complexObject);
      expect(getCached('complex-key')).toEqual(complexObject);
    });

    it('should store in specified namespace', () => {
      setCached('key', 'posts-value', 'posts');

      expect(getCached('key', 'posts')).toBe('posts-value');
      expect(getCached('key', 'default')).toBeUndefined();
    });

    it('should log in debug mode', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      setCached('test-key', 'test-value', 'default', true);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Cached data'));
    });
  });

  describe('clearCache', () => {
    it('should clear specific namespace', () => {
      setCached('key1', 'value1', 'posts');
      setCached('key2', 'value2', 'media');

      clearCache('posts');

      expect(getCached('key1', 'posts')).toBeUndefined();
      expect(getCached('key2', 'media')).toBe('value2');
    });

    it('should handle non-existent namespace gracefully', () => {
      expect(() => clearCache('non-existent')).not.toThrow();
    });

    it('should log in debug mode', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      clearCache('posts', true);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Cleared cache'));
    });
  });

  describe('clearAllCaches', () => {
    it('should clear all namespaces', () => {
      setCached('key1', 'value1', 'posts');
      setCached('key2', 'value2', 'media');
      setCached('key3', 'value3', 'default');

      clearAllCaches();

      expect(getCached('key1', 'posts')).toBeUndefined();
      expect(getCached('key2', 'media')).toBeUndefined();
      expect(getCached('key3', 'default')).toBeUndefined();
    });

    it('should log in debug mode', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      clearAllCaches(true);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Cleared all caches'));
    });
  });

  describe('configureCache', () => {
    it('should configure existing namespace', () => {
      configureCache('posts', { maxSize: 500 });

      // Should still work after reconfiguration
      setCached('test', 'value', 'posts');
      expect(getCached('test', 'posts')).toBe('value');
    });

    it('should create new namespace if not exists', () => {
      configureCache('custom', { maxSize: 100 });

      setCached('key', 'value', 'custom');
      expect(getCached('key', 'custom')).toBe('value');
    });

    it('should log in debug mode', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      configureCache('new-namespace', { maxSize: 100 }, true);

      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('getCacheStats', () => {
    it('should return stats for all namespaces', () => {
      const stats = getCacheStats();

      expect(stats).toBeDefined();
      expect(stats.default).toBeDefined();
      expect(stats.posts).toBeDefined();
      expect(stats.media).toBeDefined();
    });

    it('should include size information', () => {
      setCached('key1', 'value1', 'posts');
      setCached('key2', 'value2', 'posts');

      const stats = getCacheStats();

      expect(stats.posts.size).toBe(2);
    });

    it('should include maxSize information', () => {
      const stats = getCacheStats();

      expect(stats.default.maxSize).toBeDefined();
      expect(typeof stats.default.maxSize).toBe('number');
    });
  });

  describe('Default Cache Export', () => {
    it('should export get function', () => {
      expect(cache.get).toBe(getCached);
    });

    it('should export set function', () => {
      expect(cache.set).toBe(setCached);
    });

    it('should export clear function', () => {
      expect(cache.clear).toBe(clearCache);
    });

    it('should export clearAll function', () => {
      expect(cache.clearAll).toBe(clearAllCaches);
    });

    it('should export configure function', () => {
      expect(cache.configure).toBe(configureCache);
    });

    it('should export stats function', () => {
      expect(cache.stats).toBe(getCacheStats);
    });
  });

  describe('Cache Behavior', () => {
    it('should handle null values', () => {
      setCached('null-key', null);
      expect(getCached('null-key')).toBeNull();
    });

    it('should handle undefined values', () => {
      setCached('undefined-key', undefined);
      // LRU cache may not store undefined, so this might return undefined anyway
      const result = getCached('undefined-key');
      expect(result === undefined || result === null).toBe(true);
    });

    it('should handle boolean values', () => {
      setCached('true-key', true);
      setCached('false-key', false);

      expect(getCached('true-key')).toBe(true);
      expect(getCached('false-key')).toBe(false);
    });

    it('should handle numeric values', () => {
      setCached('zero', 0);
      setCached('negative', -1);
      setCached('float', 3.14);

      expect(getCached('zero')).toBe(0);
      expect(getCached('negative')).toBe(-1);
      expect(getCached('float')).toBe(3.14);
    });

    it('should handle array values', () => {
      const arr = [1, 2, 3, 'a', 'b', { nested: true }];
      setCached('array', arr);
      expect(getCached('array')).toEqual(arr);
    });
  });

  describe('Namespace Isolation', () => {
    it('should isolate keys between namespaces', () => {
      setCached('same-key', 'posts-value', 'posts');
      setCached('same-key', 'media-value', 'media');
      setCached('same-key', 'urls-value', 'urls');

      expect(getCached('same-key', 'posts')).toBe('posts-value');
      expect(getCached('same-key', 'media')).toBe('media-value');
      expect(getCached('same-key', 'urls')).toBe('urls-value');
    });

    it('should clear only targeted namespace', () => {
      setCached('key', 'v1', 'posts');
      setCached('key', 'v2', 'media');

      clearCache('posts');

      expect(getCached('key', 'posts')).toBeUndefined();
      expect(getCached('key', 'media')).toBe('v2');
    });
  });

  describe('Built-in Namespaces', () => {
    it('should have default namespace', () => {
      const stats = getCacheStats();
      expect(stats.default).toBeDefined();
    });

    it('should have posts namespace', () => {
      const stats = getCacheStats();
      expect(stats.posts).toBeDefined();
    });

    it('should have media namespace', () => {
      const stats = getCacheStats();
      expect(stats.media).toBeDefined();
    });

    it('should have urls namespace', () => {
      const stats = getCacheStats();
      expect(stats.urls).toBeDefined();
    });

    it('should have similarity namespace', () => {
      const stats = getCacheStats();
      expect(stats.similarity).toBeDefined();
    });
  });
});

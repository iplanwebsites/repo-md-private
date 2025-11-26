/**
 * Revision-aware cache utilities
 * Eliminates duplicate cache invalidation patterns across 4+ service files
 */

import type { RevisionCacheConfig } from '../types/common.js';

/**
 * Creates a revision-aware cache that automatically invalidates when revision changes
 * Replaces ~80 lines of duplicate code across posts/similarity.ts, media/similarity.ts,
 * posts/search.ts, and posts/retrieval.ts
 *
 * @param config - Cache configuration
 * @returns Cache manager with get/set/clear operations
 *
 * @example
 * const cache = createRevisionAwareCache<PostSimilarity>({
 *   debug: true,
 *   prefix: '[Posts]',
 *   cacheName: 'similarity',
 *   getActiveRev: () => urls.getActiveRevState()
 * });
 *
 * // Later:
 * cache.set(data);        // Stores data with current revision
 * const data = cache.get(); // Returns data if revision matches, null otherwise
 * cache.clear();          // Manually clear cache
 */
export function createRevisionAwareCache<T>(config: RevisionCacheConfig) {
  const { debug, prefix, cacheName, getActiveRev } = config;

  let cached: T | null = null;
  let cacheRevision: string | null = null;

  /**
   * Check if revision changed and invalidate cache if needed
   */
  function checkRevisionAndInvalidate(): boolean {
    if (!getActiveRev || !cacheRevision) {
      return false;
    }

    const currentRev = getActiveRev();
    if (currentRev && currentRev !== cacheRevision) {
      if (debug) {
        console.log(
          `${prefix} 🔄 Revision changed from ${cacheRevision} to ${currentRev}, clearing ${cacheName} cache`
        );
      }
      clear();
      return true;
    }
    return false;
  }

  /**
   * Clear the cache
   */
  function clear(): void {
    if (debug && cached !== null) {
      console.log(`${prefix} 🗑️ Clearing ${cacheName} cache`);
    }
    cached = null;
    cacheRevision = null;
  }

  /**
   * Get cached value (checks revision first)
   */
  function get(): T | null {
    checkRevisionAndInvalidate();
    return cached;
  }

  /**
   * Set cached value with current revision
   */
  function set(value: T): void {
    cached = value;
    cacheRevision = getActiveRev?.() ?? null;
    if (debug) {
      console.log(`${prefix} 💾 Cached ${cacheName} data (revision: ${cacheRevision ?? 'unknown'})`);
    }
  }

  /**
   * Check if cache has valid data
   */
  function has(): boolean {
    checkRevisionAndInvalidate();
    return cached !== null;
  }

  /**
   * Get current cache revision
   */
  function getRevision(): string | null {
    return cacheRevision;
  }

  return {
    get,
    set,
    clear,
    has,
    getRevision,
    checkRevisionAndInvalidate,
  };
}

/**
 * Creates a revision-aware map cache (for key-value caches like similarity scores)
 *
 * @param config - Cache configuration
 * @returns Map cache manager
 *
 * @example
 * const cache = createRevisionAwareMapCache<number>({
 *   debug: true,
 *   prefix: '[Posts]',
 *   cacheName: 'similarity-scores',
 *   getActiveRev: () => urls.getActiveRevState()
 * });
 *
 * cache.set('hash1-hash2', 0.95);
 * const score = cache.get('hash1-hash2');
 */
export function createRevisionAwareMapCache<V>(config: RevisionCacheConfig) {
  const { debug, prefix, cacheName, getActiveRev } = config;

  const cache = new Map<string, V>();
  let cacheRevision: string | null = null;

  /**
   * Check if revision changed and invalidate cache if needed
   */
  function checkRevisionAndInvalidate(): boolean {
    if (!getActiveRev || !cacheRevision) {
      return false;
    }

    const currentRev = getActiveRev();
    if (currentRev && currentRev !== cacheRevision) {
      if (debug) {
        console.log(
          `${prefix} 🔄 Revision changed from ${cacheRevision} to ${currentRev}, clearing ${cacheName} cache`
        );
      }
      clear();
      return true;
    }
    return false;
  }

  /**
   * Clear all cached entries
   */
  function clear(): void {
    if (debug && cache.size > 0) {
      console.log(`${prefix} 🗑️ Clearing ${cacheName} cache (${cache.size} entries)`);
    }
    cache.clear();
    cacheRevision = null;
  }

  /**
   * Get cached value by key (checks revision first)
   */
  function get(key: string): V | undefined {
    checkRevisionAndInvalidate();
    return cache.get(key);
  }

  /**
   * Set cached value (updates revision on first set)
   */
  function set(key: string, value: V): void {
    if (cacheRevision === null) {
      cacheRevision = getActiveRev?.() ?? null;
    }
    cache.set(key, value);
  }

  /**
   * Check if key exists in cache
   */
  function has(key: string): boolean {
    checkRevisionAndInvalidate();
    return cache.has(key);
  }

  /**
   * Get cache size
   */
  function size(): number {
    return cache.size;
  }

  /**
   * Get current cache revision
   */
  function getRevision(): string | null {
    return cacheRevision;
  }

  return {
    get,
    set,
    has,
    clear,
    size,
    getRevision,
    checkRevisionAndInvalidate,
  };
}

/** Type for revision-aware cache */
export type RevisionAwareCache<T> = ReturnType<typeof createRevisionAwareCache<T>>;

/** Type for revision-aware map cache */
export type RevisionAwareMapCache<V> = ReturnType<typeof createRevisionAwareMapCache<V>>;

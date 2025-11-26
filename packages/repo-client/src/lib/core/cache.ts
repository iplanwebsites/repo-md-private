/**
 * Core caching implementation for RepoMD
 * Provides a central caching mechanism used across all modules
 */

import QuickLRU from 'quick-lru';
import { LOG_PREFIXES } from '../logger.js';

const prefix = LOG_PREFIXES.UTILS;

/** Extended QuickLRU interface with properties we use */
interface QuickLRUCache<K, V> extends Map<K, V> {
  maxSize: number;
  maxAge: number;
  resize(newSize: number): void;
}

/** Cache configuration options */
export interface CacheConfig {
  /** Maximum number of items in cache */
  maxSize?: number;
  /** Maximum age of items in milliseconds */
  maxAge?: number;
}

/** Statistics for a single cache namespace */
export interface CacheNamespaceStats {
  size: number;
  maxSize: number;
}

/** Statistics for all cache namespaces */
export type CacheStats = Record<string, CacheNamespaceStats>;

/** Available cache namespace names */
export type CacheNamespace = 'default' | 'posts' | 'media' | 'urls' | 'similarity' | string;

// Default cache configuration
const DEFAULT_CACHE_CONFIG: Required<CacheConfig> = {
  maxSize: 1000,
  maxAge: 60000 * 60, // 1 hour
};

// Create namespaced cache instances to avoid key collisions
const caches: Record<string, QuickLRUCache<string, unknown>> = {
  default: createCache(DEFAULT_CACHE_CONFIG),
  posts: createCache(DEFAULT_CACHE_CONFIG),
  media: createCache(DEFAULT_CACHE_CONFIG),
  urls: createCache(DEFAULT_CACHE_CONFIG),
  similarity: createCache(DEFAULT_CACHE_CONFIG),
};

/**
 * Create a QuickLRU cache with the given config
 */
function createCache(config: CacheConfig = {}): QuickLRUCache<string, unknown> {
  return new QuickLRU({
    maxSize: config.maxSize || DEFAULT_CACHE_CONFIG.maxSize,
    maxAge: config.maxAge || DEFAULT_CACHE_CONFIG.maxAge,
  }) as unknown as QuickLRUCache<string, unknown>;
}

/**
 * Get a value from cache by key
 * @param key - Cache key
 * @param namespace - Cache namespace
 * @param debug - Whether to log debug info
 * @returns Cached value or undefined if not found
 */
export function getCached<T = unknown>(key: string, namespace: CacheNamespace = 'default', debug = false): T | undefined {
  const cache = caches[namespace] || caches.default;

  if (cache.has(key)) {
    if (debug) {
      console.log(`${prefix} ✨ Cache hit for ${namespace}:${key}`);
    }
    return cache.get(key) as T | undefined;
  }

  if (debug) {
    console.log(`${prefix} 🔍 Cache miss for ${namespace}:${key}`);
  }

  return undefined;
}

/**
 * Set a value in cache
 * @param key - Cache key
 * @param value - Value to cache
 * @param namespace - Cache namespace
 * @param debug - Whether to log debug info
 */
export function setCached<T>(key: string, value: T, namespace: CacheNamespace = 'default', debug = false): void {
  const cache = caches[namespace] || caches.default;
  cache.set(key, value);

  if (debug) {
    console.log(`${prefix} 💽 Cached data for ${namespace}:${key} (cache size: ${cache.size})`);
  }
}

/**
 * Clear a specific cache namespace
 * @param namespace - Cache namespace to clear
 * @param debug - Whether to log debug info
 */
export function clearCache(namespace: CacheNamespace = 'default', debug = false): void {
  if (caches[namespace]) {
    caches[namespace].clear();
    if (debug) {
      console.log(`${prefix} 🧹 Cleared cache for namespace: ${namespace}`);
    }
  }
}

/**
 * Clear all caches
 * @param debug - Whether to log debug info
 */
export function clearAllCaches(debug = false): void {
  Object.keys(caches).forEach(namespace => {
    caches[namespace].clear();
  });

  if (debug) {
    console.log(`${prefix} 🧹 Cleared all caches`);
  }
}

/**
 * Configure a specific cache namespace
 * @param namespace - Cache namespace
 * @param config - Cache configuration
 * @param debug - Whether to log debug info
 */
export function configureCache(namespace: CacheNamespace, config: CacheConfig = {}, debug = false): void {
  const existingCache = caches[namespace];
  if (!existingCache) {
    caches[namespace] = createCache(config);
    if (debug) {
      console.log(`${prefix} 🔧 Created new cache namespace: ${namespace}`);
    }
  } else {
    // Resize existing cache if needed
    if (config.maxSize && config.maxSize !== existingCache.maxSize) {
      existingCache.resize(config.maxSize);
      if (debug) {
        console.log(`${prefix} 🔧 Resized cache for namespace: ${namespace}`);
      }
    }
  }
}

/**
 * Get cache statistics for all namespaces
 * @returns Object with cache statistics by namespace
 */
export function getCacheStats(): CacheStats {
  const stats: CacheStats = {};

  Object.keys(caches).forEach(namespace => {
    stats[namespace] = {
      size: caches[namespace].size,
      maxSize: caches[namespace].maxSize,
    };
  });

  return stats;
}

/** Cache manager interface for default export */
export interface CacheManager {
  get: typeof getCached;
  set: typeof setCached;
  clear: typeof clearCache;
  clearAll: typeof clearAllCaches;
  configure: typeof configureCache;
  stats: typeof getCacheStats;
}

const cacheManager: CacheManager = {
  get: getCached,
  set: setCached,
  clear: clearCache,
  clearAll: clearAllCaches,
  configure: configureCache,
  stats: getCacheStats,
};

export default cacheManager;

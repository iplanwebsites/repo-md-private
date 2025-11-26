/**
 * Core module barrel export for RepoMD
 */

import { createUrlGenerator } from './urls.js';
import { createApiClient } from './api.js';
import cache from './cache.js';
import { LOG_PREFIXES } from '../logger.js';
import { fetchJson } from '../utils.js';

export {
  createUrlGenerator,
  createApiClient,
  cache,
  LOG_PREFIXES,
  fetchJson,
};

// Re-export types from cache
export type {
  CacheConfig,
  CacheNamespaceStats,
  CacheStats,
  CacheNamespace,
  CacheManager,
} from './cache.js';

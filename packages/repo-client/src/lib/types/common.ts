/**
 * Common shared types for @repo-md/client
 * Consolidates repeated type definitions across the codebase
 */

// =============================================================================
// Proxy & Integration Options
// =============================================================================

/**
 * Base proxy options shared by all framework integrations
 * Extended by framework-specific options interfaces
 */
export interface BaseProxyOptions {
  /** Project ID (can also be passed as string directly) */
  projectId?: string;
  /** URL prefix for media requests (e.g., '/_repo/medias/') */
  mediaUrlPrefix?: string;
  /** R2 CDN base URL */
  r2Url?: string;
  /** Cache max-age in seconds */
  cacheMaxAge?: number;
  /** Enable debug logging */
  debug?: boolean;
  /** Project path prefix (for multi-project setups) */
  projectPathPrefix?: string;
  /** Route prefix (alternative to mediaUrlPrefix) */
  route?: string;
}

// =============================================================================
// Service Function Types
// =============================================================================

/**
 * Fetch JSON from R2 storage with caching support
 */
export type FetchR2JsonFn = <T>(
  path: string,
  options?: { defaultValue?: T; useCache?: boolean }
) => Promise<T>;

/**
 * Fetch map data (JSON objects) with default value
 */
export type FetchMapDataFn = (
  path: string,
  defaultValue?: unknown
) => Promise<Record<string, unknown> | null>;

/**
 * Get active revision state
 */
export type GetActiveRevFn = (() => string | undefined) | null;

/**
 * Base configuration shared by service factories
 */
export interface BaseServiceConfig {
  /** Enable debug logging */
  debug?: boolean;
  /** Function to get current active revision (for cache invalidation) */
  getActiveRev?: GetActiveRevFn;
}

/**
 * Service config with R2 fetch capabilities
 */
export interface FetchableServiceConfig extends BaseServiceConfig {
  /** Fetch JSON from R2 storage */
  fetchR2Json: FetchR2JsonFn;
  /** Fetch map data with defaults */
  _fetchMapData?: FetchMapDataFn;
}

// =============================================================================
// Search Mode Types
// =============================================================================

/**
 * Available search modes
 */
export type SearchMode = 'memory' | 'vector' | 'vector-text' | 'vector-clip-text' | 'vector-clip-image';

// =============================================================================
// Cache Types
// =============================================================================

/**
 * Cache configuration
 */
export interface CacheConfig {
  /** Maximum cache size */
  maxSize?: number;
  /** Time-to-live in milliseconds */
  ttl?: number;
}

/**
 * Revision-aware cache configuration
 */
export interface RevisionCacheConfig {
  /** Enable debug logging */
  debug: boolean;
  /** Log prefix for debug messages */
  prefix: string;
  /** Cache name for log messages */
  cacheName: string;
  /** Function to get current active revision */
  getActiveRev: GetActiveRevFn;
}

/**
 * Git Cache Types
 * @module @repo-md/git-cache
 */

/**
 * Configuration for GitCache
 */
export interface GitCacheConfig {
  /** R2 bucket for cache storage */
  r2Bucket: R2Bucket;
  /** Prefix for cache keys (default: "git-cache") */
  prefix?: string;
  /** Enable verbose logging */
  verbose?: boolean;
}

/**
 * Metadata for a cached repository
 */
export interface CacheEntry {
  /** Consumer ID that owns this cache */
  consumerId: string;
  /** Repository URL */
  repoUrl: string;
  /** Last commit hash */
  lastCommit: string;
  /** Last updated timestamp */
  lastUpdated: Date;
  /** Size of the cache in bytes */
  sizeBytes: number;
  /** Branch that was cached */
  branch: string;
}

/**
 * Result of a cache restore operation
 */
export interface RestoreResult {
  /** Whether the cache was hit */
  hit: boolean;
  /** Local path where repo was restored */
  localPath: string;
  /** How many commits behind the cache was (0 if fresh clone) */
  staleCommits: number;
  /** Current commit hash after restore */
  currentCommit: string;
  /** Time taken for restore in ms */
  duration: number;
}

/**
 * Git authentication options
 */
export interface GitAuth {
  /** Authentication type */
  type: "token" | "ssh" | "basic";
  /** Personal access token (for "token" type) */
  token?: string;
  /** SSH private key (for "ssh" type) */
  sshKey?: string;
  /** Username (for "basic" type) */
  username?: string;
  /** Password (for "basic" type) */
  password?: string;
}

/**
 * Options for restore operation
 */
export interface RestoreOptions {
  /** Consumer ID */
  consumerId: string;
  /** Repository URL */
  repoUrl: string;
  /** Branch to checkout (default: main) */
  branch?: string;
  /** Target path for the repository */
  targetPath: string;
  /** Authentication credentials */
  auth?: GitAuth;
  /** Specific commit to checkout (optional) */
  commit?: string;
}

/**
 * Options for save operation
 */
export interface SaveOptions {
  /** Consumer ID */
  consumerId: string;
  /** Path to the repository */
  repoPath: string;
}

/**
 * Options for prune operation
 */
export interface PruneOptions {
  /** Remove caches older than this many days */
  olderThanDays: number;
  /** Only report what would be deleted */
  dryRun?: boolean;
}

/**
 * Cache optimization settings
 */
export interface OptimizationSettings {
  /** Maximum shallow clone depth based on repo size */
  shallowCloneDepth: number;
  /** Whether to use sparse checkout */
  useSparseCheckout: boolean;
  /** Paths to include in sparse checkout */
  sparseCheckoutPaths?: string[];
}

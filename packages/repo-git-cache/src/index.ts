/**
 * @repo-md/git-cache
 * Git repository caching layer using R2 to minimize clone bandwidth costs
 *
 * @example
 * ```typescript
 * import { GitCache } from "@repo-md/git-cache";
 *
 * const cache = new GitCache({ r2Bucket: env.GIT_CACHE_BUCKET });
 *
 * // Restore from cache or clone
 * const result = await cache.restore({
 *   consumerId: "consumer-123",
 *   repoUrl: "https://github.com/user/repo",
 *   targetPath: "/tmp/repo",
 *   auth: { type: "token", token: "ghp_xxx" }
 * });
 *
 * // Process the repo...
 *
 * // Save back to cache
 * await cache.save({
 *   consumerId: "consumer-123",
 *   repoPath: "/tmp/repo"
 * });
 * ```
 */

export { GitCache } from "./git-cache.js";

export type {
  GitCacheConfig,
  CacheEntry,
  RestoreResult,
  RestoreOptions,
  SaveOptions,
  PruneOptions,
  GitAuth,
  OptimizationSettings,
} from "./types.js";

export {
  prepareForCache,
  getShallowCloneDepth,
  generateSparseCheckoutConfig,
  countCommitsBetween,
  getCurrentCommit,
  getRemoteUrl,
  hasUncommittedChanges,
  getRepoSize,
  cleanupTempFiles,
} from "./optimizations.js";

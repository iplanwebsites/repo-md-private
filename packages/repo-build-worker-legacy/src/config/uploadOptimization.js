// src/config/uploadOptimization.js

/**
 * Feature flags and configuration for R2 upload optimization
 * These can be overridden at runtime via data parameters
 */
export const UPLOAD_OPTIMIZATION_CONFIG = {
  // Skip upload of files that already exist in R2 (based on object key)
  skipExistingFiles: true,
  
  // Skip upload of files with identical content (requires hash comparison)
  skipIdenticalContent: true,
  
  // Fetch existing assets from R2 before processing
  fetchExistingAssets: true,
  
  // Cache embeddings to avoid recomputation
  cacheEmbeddings: true,
  
  // Use batch operations for R2 checks
  useBatchOperations: true,
  
  // Maximum number of concurrent R2 existence checks
  maxConcurrentChecks: 50,
  
  // Enable detailed logging for optimization
  debugOptimization: false,
  
  // Skip posts that haven't changed (based on hash)
  skipUnchangedPosts: true,
  
  // Skip media that hasn't changed (based on hash)
  skipUnchangedMedia: true,
  
  // Timeout for R2 existence checks (ms)
  existenceCheckTimeout: 5000,
  
  // Retry attempts for failed existence checks
  existenceCheckRetries: 2,
  
  // Use R2 list operations to fetch existing assets
  useListPrefetch: true,
  
  // Maximum keys to fetch in a single list operation
  listMaxKeys: 1000,
};

/**
 * Merge custom configuration with defaults
 * @param {Object} customConfig - Custom configuration to merge
 * @returns {Object} - Merged configuration
 */
export function mergeOptimizationConfig(customConfig = {}) {
  return {
    ...UPLOAD_OPTIMIZATION_CONFIG,
    ...customConfig
  };
}
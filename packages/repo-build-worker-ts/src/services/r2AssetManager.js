// src/services/r2AssetManager.js
import * as r2 from "./r2.js";
import path from "path";

/**
 * R2 Asset Manager - Handles asset listing and comparison for optimization
 */
export class R2AssetManager {
  constructor(projectId, logger = console) {
    this.projectId = projectId;
    this.logger = logger;
    this.existingAssets = new Map();
    this.existingMediaHashes = new Set();
    this.existingPostHashes = new Set();
  }

  /**
   * Fetch all existing assets for a project from R2
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} - Object containing asset maps and sets
   */
  async fetchExistingAssets(options = {}) {
    const { maxKeys = 1000, includeMetadata = false } = options;
    
    this.logger.log("📋 Fetching existing R2 assets for project...", {
      projectId: this.projectId
    });

    try {
      // Fetch assets from different locations in parallel
      const [sharedMedia, sharedPosts, projectAssets] = await Promise.all([
        this.listAssetsWithPrefix(`projects/${this.projectId}/_shared/medias/`, maxKeys),
        this.listAssetsWithPrefix(`projects/${this.projectId}/_shared/posts/`, maxKeys),
        this.listAssetsWithPrefix(`projects/${this.projectId}/`, maxKeys)
      ]);

      // Process shared media
      let hashBasedCount = 0;
      let nonHashBasedCount = 0;
      
      for (const asset of sharedMedia) {
        this.existingAssets.set(asset.Key, {
          size: asset.Size,
          lastModified: asset.LastModified,
          etag: asset.ETag,
          type: 'media'
        });

        // Extract hash from media filename if it follows hash pattern
        const filename = path.basename(asset.Key);
        // Match hash at the beginning, possibly followed by size suffix (e.g., -lg, -md)
        const hashMatch = filename.match(/^([a-f0-9]{32,64})(?:-\w+)?\./i);
        if (hashMatch) {
          this.existingMediaHashes.add(hashMatch[1]);
          hashBasedCount++;
        } else {
          nonHashBasedCount++;
        }
      }
      
      if (nonHashBasedCount > 0) {
        this.logger.log(`📊 Media files: ${hashBasedCount} hash-based, ${nonHashBasedCount} regular names`);
      }

      // Process shared posts
      for (const asset of sharedPosts) {
        this.existingAssets.set(asset.Key, {
          size: asset.Size,
          lastModified: asset.LastModified,
          etag: asset.ETag,
          type: 'post'
        });

        // Extract hash from post filename (expecting hash.json format)
        const filename = path.basename(asset.Key);
        const hashMatch = filename.match(/^([a-f0-9]{32,64})\.json$/i);
        if (hashMatch) {
          this.existingPostHashes.add(hashMatch[1]);
        }
      }

      // Process other project assets (excluding shared folders)
      for (const asset of projectAssets) {
        // Skip if already processed in shared folders
        if (!asset.Key.includes('/_shared/')) {
          this.existingAssets.set(asset.Key, {
            size: asset.Size,
            lastModified: asset.LastModified,
            etag: asset.ETag,
            type: 'content'
          });
        }
      }

      this.logger.log("✅ Fetched existing R2 assets", {
        totalAssets: this.existingAssets.size,
        mediaHashes: this.existingMediaHashes.size,
        postHashes: this.existingPostHashes.size,
        sharedMediaCount: sharedMedia.length,
        sharedPostsCount: sharedPosts.length,
        projectAssetsCount: projectAssets.length
      });
      
      // Debug: log some sample hashes if available
      if (this.existingMediaHashes.size > 0) {
        const sampleHashes = Array.from(this.existingMediaHashes).slice(0, 3);
        this.logger.log("📝 Sample media hashes found:", sampleHashes);
      }

      return {
        existingAssets: this.existingAssets,
        existingMediaHashes: this.existingMediaHashes,
        existingPostHashes: this.existingPostHashes,
        stats: {
          totalAssets: this.existingAssets.size,
          mediaHashes: this.existingMediaHashes.size,
          postHashes: this.existingPostHashes.size
        }
      };
    } catch (error) {
      this.logger.error("❌ Failed to fetch existing R2 assets", {
        error: error.message,
        projectId: this.projectId
      });
      
      // Return empty sets on error to allow processing to continue
      return {
        existingAssets: new Map(),
        existingMediaHashes: new Set(),
        existingPostHashes: new Set(),
        stats: {
          totalAssets: 0,
          mediaHashes: 0,
          postHashes: 0,
          error: error.message
        }
      };
    }
  }

  /**
   * List all assets with a specific prefix
   * @param {string} prefix - The prefix to search for
   * @param {number} maxKeys - Maximum keys per request
   * @returns {Promise<Array>} - Array of asset objects
   */
  async listAssetsWithPrefix(prefix, maxKeys = 1000) {
    const allAssets = [];
    let continuationToken = null;

    do {
      try {
        const response = await r2.listObjects({
          prefix,
          maxKeys,
          continuationToken
        });

        if (response && response.length > 0) {
          allAssets.push(...response);
        }

        // Check if there are more results
        // Note: The r2 service might need to be updated to return continuation token
        continuationToken = response.NextContinuationToken || null;
      } catch (error) {
        this.logger.warn(`⚠️ Error listing assets with prefix ${prefix}:`, error.message);
        break;
      }
    } while (continuationToken);

    return allAssets;
  }

  /**
   * Check if an asset exists by key
   * @param {string} key - The object key to check
   * @returns {boolean} - Whether the asset exists
   */
  assetExists(key) {
    return this.existingAssets.has(key);
  }

  /**
   * Check if a media hash exists
   * @param {string} hash - The media file hash
   * @returns {boolean} - Whether the media with this hash exists
   */
  mediaHashExists(hash) {
    return this.existingMediaHashes.has(hash);
  }

  /**
   * Check if a post hash exists
   * @param {string} hash - The post content hash
   * @returns {boolean} - Whether the post with this hash exists
   */
  postHashExists(hash) {
    return this.existingPostHashes.has(hash);
  }

  /**
   * Get asset info by key
   * @param {string} key - The object key
   * @returns {Object|null} - Asset information or null if not found
   */
  getAssetInfo(key) {
    return this.existingAssets.get(key) || null;
  }

  /**
   * Check multiple assets for existence efficiently
   * @param {Array<string>} keys - Array of object keys to check
   * @returns {Object} - Object with exists and missing arrays
   */
  checkMultipleAssets(keys) {
    const exists = [];
    const missing = [];

    for (const key of keys) {
      if (this.assetExists(key)) {
        exists.push(key);
      } else {
        missing.push(key);
      }
    }

    return { exists, missing };
  }

  /**
   * Get optimization statistics
   * @returns {Object} - Statistics about the current asset state
   */
  getOptimizationStats() {
    const assetsByType = {
      media: 0,
      post: 0,
      content: 0
    };

    for (const [key, info] of this.existingAssets) {
      assetsByType[info.type] = (assetsByType[info.type] || 0) + 1;
    }

    return {
      totalAssets: this.existingAssets.size,
      assetsByType,
      mediaHashes: this.existingMediaHashes.size,
      postHashes: this.existingPostHashes.size
    };
  }

  /**
   * Clear cached data
   */
  clear() {
    this.existingAssets.clear();
    this.existingMediaHashes.clear();
    this.existingPostHashes.clear();
  }

  /**
   * Seed the manager with known hashes from a cache context.
   * This avoids the need to list R2 assets when we already know
   * which hashes exist from the previous deployment.
   *
   * @param {Object} cacheContext - Cache context with media and embeddings
   * @param {Map<string, Object>} [cacheContext.media] - Media cache keyed by hash
   */
  seedFromCache(cacheContext) {
    if (!cacheContext) return;

    let mediaHashCount = 0;

    // Seed media hashes from cache
    if (cacheContext.media && cacheContext.media instanceof Map) {
      for (const hash of cacheContext.media.keys()) {
        this.existingMediaHashes.add(hash);
        mediaHashCount++;
      }
    }

    if (mediaHashCount > 0) {
      this.logger.log(`📦 Seeded R2AssetManager with ${mediaHashCount} media hashes from cache`);
    }
  }
}

/**
 * Create and initialize an R2 Asset Manager
 * @param {string} projectId - The project ID
 * @param {Object} logger - Logger instance
 * @param {Object} options - Options for fetching assets
 * @param {Object} [options.cacheContext] - Cache context to seed known hashes
 * @returns {Promise<R2AssetManager>} - Initialized asset manager
 */
export async function createR2AssetManager(projectId, logger = console, options = {}) {
  const manager = new R2AssetManager(projectId, logger);

  // First seed from cache if available (faster than R2 list)
  if (options.cacheContext) {
    manager.seedFromCache(options.cacheContext);
  }

  // Then optionally fetch additional assets from R2
  if (options.prefetch !== false && !options.skipR2Fetch) {
    await manager.fetchExistingAssets(options);
  }

  return manager;
}
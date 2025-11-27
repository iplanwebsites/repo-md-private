// src/process/fetchExistingAssets.js
import { createR2AssetManager } from "../services/r2AssetManager.js";
import { mergeOptimizationConfig } from "../config/uploadOptimization.js";

/**
 * Fetch existing R2 assets before processing to enable optimization
 * This runs before buildAssets to provide existing hashes for skipping
 * 
 * @param {Object} data - Job data containing project information
 * @returns {Promise<Object>} - Data enriched with existing asset information
 */
async function fetchExistingAssets(data) {
  const logger = data.logger || console;
  
  // Check if optimization is enabled
  const optimizationConfig = mergeOptimizationConfig(data.uploadOptimization || {});
  
  if (!optimizationConfig.fetchExistingAssets) {
    logger.log("🔄 Skipping asset fetch (optimization disabled)");
    return data;
  }
  
  if (!data.projectId) {
    logger.warn("⚠️ Cannot fetch existing assets without projectId");
    return data;
  }
  
  try {
    logger.log("🔍 Pre-fetching existing R2 assets for optimization...", {
      projectId: data.projectId
    });
    
    // Create and initialize the asset manager
    const assetManager = await createR2AssetManager(data.projectId, logger, {
      maxKeys: optimizationConfig.listMaxKeys,
      prefetch: true
    });
    
    const stats = assetManager.getOptimizationStats();
    logger.log("✅ Existing assets fetched successfully", stats);
    
    // Return enriched data with existing hashes
    return {
      ...data,
      existingAssets: {
        assetManager,
        existingMediaHashes: assetManager.existingMediaHashes,
        existingPostHashes: assetManager.existingPostHashes,
        stats
      },
      // Also add these at the root level for backward compatibility
      existingMediaHashes: assetManager.existingMediaHashes,
      existingPostHashes: assetManager.existingPostHashes
    };
  } catch (error) {
    logger.error("❌ Failed to fetch existing assets", {
      error: error.message,
      projectId: data.projectId
    });
    
    // Continue without optimization on error
    return {
      ...data,
      existingAssets: {
        error: error.message,
        existingMediaHashes: new Set(),
        existingPostHashes: new Set()
      },
      existingMediaHashes: new Set(),
      existingPostHashes: new Set()
    };
  }
}

export default fetchExistingAssets;
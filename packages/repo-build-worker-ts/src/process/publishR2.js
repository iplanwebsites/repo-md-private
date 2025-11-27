// src/process/publishR2.js
import fs from "fs/promises";
import path from "path";
import { glob } from "glob";
import * as r2 from "../services/r2.js";
import { createR2AssetManager } from "../services/r2AssetManager.js";
import { mergeOptimizationConfig } from "../config/uploadOptimization.js";
import crypto from "crypto";

/**
 * Calculate SHA-256 hash of a file
 * @param {string} filePath - Path to the file
 * @returns {Promise<string>} - Hex string of the hash
 */
async function calculateFileHash(filePath) {
  const fileBuffer = await fs.readFile(filePath);
  const hash = crypto.createHash('sha256');
  hash.update(fileBuffer);
  return hash.digest('hex');
}

/**
 * Safely uploads a file to R2 storage with fallback mechanisms
 *
 * @param {string} filePath - Path to local file
 * @param {string} objectKey - Key for R2 storage
 * @param {Object} metadata - Metadata for the file
 * @param {Object} options - Upload options including optimization settings
 * @returns {Promise<Object>} - Upload result
 */
async function safeUpload(filePath, objectKey, metadata = {}, options = {}) {
  const { assetManager, optimizationConfig, logger = console } = options;

  // Check if we should skip this upload based on optimization settings
  if (assetManager && optimizationConfig) {
    // Check if file already exists
    if (optimizationConfig.skipExistingFiles && assetManager.assetExists(objectKey)) {
      const existingInfo = assetManager.getAssetInfo(objectKey);
      if (optimizationConfig.debugOptimization) {
        logger.log(`⏭️ Skipping existing file: ${objectKey}`, {
          size: existingInfo.size,
          lastModified: existingInfo.lastModified
        });
      }
      
      return {
        skipped: true,
        reason: 'file_exists',
        objectKey,
        publicUrl: r2.getPublicUrl(objectKey),
        existingInfo
      };
    }

    // Check if we should compare content hash
    if (optimizationConfig.skipIdenticalContent) {
      try {
        // For media files, extract hash from filename instead of calculating
        if (metadata.isMedia === "true") {
          const filename = path.basename(objectKey);
          // Match hash at the beginning, possibly followed by size suffix (e.g., -lg, -md)
          const hashMatch = filename.match(/^([a-f0-9]{32,64})(?:-\w+)?\./i);
          
          if (hashMatch && assetManager.mediaHashExists(hashMatch[1])) {
            if (optimizationConfig.debugOptimization) {
              logger.log(`⏭️ Skipping media with existing hash: ${objectKey}`, {
                hash: hashMatch[1]
              });
            }
            
            return {
              skipped: true,
              reason: 'identical_media_hash',
              objectKey,
              publicUrl: r2.getPublicUrl(objectKey),
              hash: hashMatch[1]
            };
          }
        }
        
        // Check if this is a post file with matching hash
        if (metadata.isPost === "true") {
          // Extract hash from filename if it follows hash.json pattern
          const filename = path.basename(objectKey);
          const hashMatch = filename.match(/^([a-f0-9]{32,64})\.json$/i);
          
          if (hashMatch && assetManager.postHashExists(hashMatch[1])) {
            if (optimizationConfig.debugOptimization) {
              logger.log(`⏭️ Skipping post with existing hash: ${objectKey}`, {
                hash: hashMatch[1]
              });
            }
            
            return {
              skipped: true,
              reason: 'identical_post_hash',
              objectKey,
              publicUrl: r2.getPublicUrl(objectKey),
              hash: hashMatch[1]
            };
          }
        }
        
        // Calculate file hash for metadata (non-media files or if no hash in filename)
        try {
          const fileHash = await calculateFileHash(filePath);
          metadata.contentHash = fileHash;
        } catch (hashError) {
          logger.warn(`⚠️ Failed to calculate hash for ${filePath}:`, hashError.message);
        }
      } catch (error) {
        logger.warn(`⚠️ Error in hash comparison for ${filePath}:`, error.message);
      }
    }
  }

  // Fix for headers[headerName].trim is not a function error
  // Convert all metadata values to strings and remove undefined/null values
  const sanitizedMetadata = {};
  if (metadata && typeof metadata === "object") {
    Object.keys(metadata).forEach((key) => {
      try {
        // Skip keys with non-string names (unlikely but possible)
        if (typeof key !== "string") return;

        // Get the value
        const value = metadata[key];

        // Skip null or undefined values
        if (value === undefined || value === null) return;

        // Handle different types of values
        if (typeof value === "object") {
          // For objects and arrays, stringify them
          sanitizedMetadata[key] = JSON.stringify(value);
        } else {
          // For primitives, convert to string
          sanitizedMetadata[key] = String(value);
        }

        // Additional validation: ensure all metadata keys are valid HTTP headers
        // Replace any characters that might cause issues in HTTP headers
        const sanitizedKey = key.replace(/[^\w-]/g, "_");
        if (sanitizedKey !== key) {
          sanitizedMetadata[sanitizedKey] = sanitizedMetadata[key];
          delete sanitizedMetadata[key];
        }
      } catch (error) {
        // If any error occurs while processing this metadata entry, skip it
        console.warn(
          `⚠️ Skipping problematic metadata entry with key "${key}"`,
          {
            error: error.message,
          }
        );
      }
    });
  }

  try {
    // First attempt: try standard upload with sanitized metadata
    return await r2.uploadFile(filePath, objectKey, {
      metadata: sanitizedMetadata,
    });
  } catch (primaryError) {
    console.warn(
      `⚠️ Primary upload method failed for ${objectKey}, trying alternative`,
      {
        error: primaryError.message,
      }
    );

    try {
      // Second attempt: Try uploading without any metadata
      console.log(`🔄 Retrying upload for ${objectKey} without metadata`);
      const result = await r2.uploadFile(filePath, objectKey, { metadata: {} });

      // Add note about metadata not being applied
      return {
        ...result,
        publicUrl: r2.getPublicUrl(objectKey),
        metadataApplied: false,
        originalError: primaryError.message,
      };
    } catch (secondaryError) {
      console.error(
        `❌ All standard upload attempts failed for ${objectKey}, trying raw upload`,
        {
          primaryError: primaryError.message,
          secondaryError: secondaryError.message,
        }
      );

      try {
        // Third attempt: Try using the most minimal upload approach possible
        // Read the file as a buffer and use the upload method instead of uploadFile
        console.log(
          `🔄 Last resort: Trying raw buffer upload for ${objectKey}`
        );
        const fileBuffer = await fs.readFile(filePath);

        // Set a longer timeout for this final attempt
        const uploadTimeout = setTimeout(() => {
          console.warn(
            `⏱️ Upload taking longer than expected for ${objectKey}`
          );
        }, 10000); // 10 seconds warning

        const result = await r2.upload(fileBuffer, objectKey, {});
        clearTimeout(uploadTimeout);

        //  console.log(`✅ Raw buffer upload succeeded for ${objectKey}`);
        return {
          ...result,
          publicUrl: r2.getPublicUrl(objectKey),
          metadataApplied: false,
          uploadMethod: "raw_buffer",
          originalError: primaryError.message,
        };
      } catch (finalError) {
        console.error(`💥 All upload methods failed for ${objectKey}`, {
          errors: [
            primaryError.message,
            secondaryError.message,
            finalError.message,
          ],
          fileSize: (await fs.stat(filePath)).size,
          objectKey,
        });

        // Last desperate attempt: try with a 5 second delay and minimal content
        try {
          console.log(`🔄 FINAL ATTEMPT with delay for ${objectKey}`);

          // Wait 5 seconds before trying again
          await new Promise((resolve) => setTimeout(resolve, 5000));

          // Try with minimal content and minimal options
          const fileBuffer = await fs.readFile(filePath);
          const result = await r2.upload(fileBuffer, objectKey, {});

          console.log(`✅ Final delayed attempt succeeded for ${objectKey}`);
          return {
            ...result,
            publicUrl: r2.getPublicUrl(objectKey),
            metadataApplied: false,
            uploadMethod: "delayed_raw",
            originalError: primaryError.message,
          };
        } catch (ultimateError) {
          console.error(
            `💥 ALL attempts including delayed upload failed for ${objectKey}`,
            {
              allErrors: [
                primaryError.message,
                secondaryError.message,
                finalError.message,
                ultimateError.message,
              ],
            }
          );
          throw new Error(
            `Failed to upload ${objectKey} after all retry attempts: ${ultimateError.message}`
          );
        }
      }
    }
  }
}

/**
 * Uploads a directory's contents to R2 storage with parallel processing
 *
 * @param {string} sourcePath - Path to the source directory
 * @param {string} contentPath - Path for content files in R2
 * @param {string} mediaPath - Path for media files in R2
 * @param {string} postsPath - Path for posts files in R2 shared folder
 * @param {string} mediaDir - Media directory name in source
 * @param {Object} [options] - Upload options
 * @param {string} [options.pattern] - Glob pattern for files to upload
 * @param {boolean} [options.preserveDirectories=true] - Whether to preserve directory structure
 * @param {boolean} [options.alsoSaveMediasIntoDeploy=false] - Whether to save media files in both shared and deploy folder
 * @param {Object} [options.metadata={}] - Metadata to add to all uploaded files
 * @returns {Promise<Array>} - Array of upload results with public URLs
 */
async function uploadDirectory(
  sourcePath,
  contentPath,
  mediaPath,
  postsPath,
  mediaDir,
  options = {}
) {
  // Set default options
  const pattern = options.pattern || "**/*";
  const preserveDirectories = options.preserveDirectories !== false;
  const alsoSaveMediasIntoDeploy = options.alsoSaveMediasIntoDeploy || false;
  const metadata = options.metadata || {};
  const assetManager = options.assetManager;
  const optimizationConfig = options.optimizationConfig;
  const logger = options.logger || console;

  // Get all files matching the pattern
  const files = await glob(pattern, {
    cwd: sourcePath,
    nodir: true,
    absolute: false,
  });

  if (files.length === 0) {
    logger.log("⚠️ No files found to upload", { sourcePath, pattern });
    return [];
  }

  logger.log(`🔍 Found ${files.length} files to upload`, {
    sourcePath,
    contentPath,
    mediaPath,
    pattern,
    alsoSaveMediasIntoDeploy,
  });

  // Upload files in parallel with a concurrency limit (10 at a time)
  const results = [];
  const concurrencyLimit = 10;
  const chunks = [];

  // Split files into chunks for limited concurrency
  for (let i = 0; i < files.length; i += concurrencyLimit) {
    chunks.push(files.slice(i, i + concurrencyLimit));
  }

  // Process each chunk of files in parallel
  for (const chunk of chunks) {
    const chunkPromises = chunk.map(async (file) => {
      const filePath = path.join(sourcePath, file);

      // Determine if this is a media file based on its location in the directory structure
      const isMedia = file.startsWith(mediaDir + "/") || file === mediaDir;

      // Determine if this is a post JSON file (has .json extension and is in posts directory or subdirectory)
      const isPost =
        file.endsWith(".json") &&
        (file.includes("posts/") || file.includes("/posts.json"));

      // Determine paths for upload
      let primaryObjectKey;
      let secondaryObjectKey = null;
      let tertiaryObjectKey = null; // For shared posts

      if (preserveDirectories) {
        if (isMedia) {
          // Media files go to shared media path
          // Strip media dir prefix to get relative media path
          const relativeMediaPath = file.startsWith(mediaDir + "/")
            ? file.substring(mediaDir.length + 1)
            : path.basename(file);

          primaryObjectKey = path.join(mediaPath, relativeMediaPath);

          // Optionally also save to the deploy-specific folder
          if (alsoSaveMediasIntoDeploy) {
            secondaryObjectKey = path.join(contentPath, file);
          }
        } else if (isPost) {
          // Posts go to version-specific content folder first
          primaryObjectKey = path.join(contentPath, file);

          // Get the filename which should contain the hash
          const filename = path.basename(file);

          // Extract hash from filename if it exists (looking for hash.json format)
          if (/^[a-f0-9]{32,64}\.json$/i.test(filename)) {
            // This is a hash-named file, save to shared posts directory too
            tertiaryObjectKey = path.join(postsPath, filename);
          }
        } else {
          // Other non-media files go to version-specific content folder
          primaryObjectKey = path.join(contentPath, file);
        }
      } else {
        // Flatten directory structure
        if (isMedia) {
          primaryObjectKey = path.join(mediaPath, path.basename(file));

          if (alsoSaveMediasIntoDeploy) {
            secondaryObjectKey = path.join(contentPath, path.basename(file));
          }
        } else if (isPost) {
          // Posts go to version-specific content folder
          primaryObjectKey = path.join(contentPath, path.basename(file));

          // Get the filename which should contain the hash
          const filename = path.basename(file);

          // Extract hash from filename if it exists (looking for hash.json format)
          if (/^[a-f0-9]{32,64}\.json$/i.test(filename)) {
            // This is a hash-named file, save to shared posts directory too
            tertiaryObjectKey = path.join(postsPath, filename);
          }
        } else {
          primaryObjectKey = path.join(contentPath, path.basename(file));
        }
      }

      // Replace backslashes with forward slashes for web URLs
      primaryObjectKey = primaryObjectKey.replace(/\\/g, "/");
      if (secondaryObjectKey) {
        secondaryObjectKey = secondaryObjectKey.replace(/\\/g, "/");
      }
      if (tertiaryObjectKey) {
        tertiaryObjectKey = tertiaryObjectKey.replace(/\\/g, "/");
      }

      try {
        // Get file size for logging
        const fileSize = (await fs.stat(filePath)).size;

        // Skip very large files or handle them differently
        const MAX_SIZE_MB = 50; // 50 MB limit
        const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

        if (fileSize > MAX_SIZE_BYTES) {
          console.warn(
            `⚠️ File exceeds recommended size limit: ${primaryObjectKey}`,
            {
              size: fileSize,
              sizeInMB: (fileSize / 1024 / 1024).toFixed(2) + "MB",
              maxSizeInMB: MAX_SIZE_MB + "MB",
            }
          );
          // We'll still try to upload it but with a warning
        }

        // Create file-specific metadata
        const fileMetadata = {
          ...metadata,
          originalPath: file,
          isMedia: isMedia ? "true" : "false", // Convert to strings for better compatibility
          fileSize: String(fileSize), // Add file size to metadata
          uploadTimestamp: new Date().toISOString(),
        };

        // Upload the file to primary location with safe upload
        const result = await safeUpload(
          filePath,
          primaryObjectKey,
          fileMetadata,
          { assetManager, optimizationConfig, logger }
        );
        /*
     console.log(`✅ Uploaded: ${primaryObjectKey}`, {
          size: fileSize,
          publicUrl: result.publicUrl,
          isMedia,
          uploadMethod: result.uploadMethod || "standard"
        });*/

        // If the file should also be uploaded to a secondary location
        let secondaryResult = null;
        if (secondaryObjectKey) {
          try {
            // For secondary uploads, add extra metadata
            const secondaryMetadata = {
              ...fileMetadata,
              isCopy: "true",
              copyOf: primaryObjectKey,
              copyTimestamp: new Date().toISOString(),
            };

            secondaryResult = await safeUpload(
              filePath,
              secondaryObjectKey,
              secondaryMetadata,
              { assetManager, optimizationConfig, logger }
            );

            /*   console.log(`✅ Also uploaded to: ${secondaryObjectKey}`, {
              size: fileSize,
              publicUrl: secondaryResult.publicUrl,
              uploadMethod: secondaryResult.uploadMethod || "standard"
            });*/
          } catch (secondaryError) {
            console.error(
              `❌ Failed secondary upload to ${secondaryObjectKey}`,
              {
                error: secondaryError.message,
                primaryUploadSucceeded: true,
              }
            );
            // Continue with the primary result if secondary fails
          }
        }

        // If the file is a post that should also be uploaded to the shared posts location
        let tertiaryResult = null;
        if (tertiaryObjectKey) {
          try {
            // For tertiary uploads (shared posts), add extra metadata
            const tertiaryMetadata = {
              ...fileMetadata,
              isCopy: "true",
              copyOf: primaryObjectKey,
              isPost: "true",
              copyTimestamp: new Date().toISOString(),
            };

            tertiaryResult = await safeUpload(
              filePath,
              tertiaryObjectKey,
              tertiaryMetadata,
              { assetManager, optimizationConfig, logger }
            );

            /*  console.log(`✅ Also uploaded post to shared location: ${tertiaryObjectKey}`, {
              size: fileSize,
              publicUrl: tertiaryResult.publicUrl,
              uploadMethod: tertiaryResult.uploadMethod || "standard"
            });*/
          } catch (tertiaryError) {
            console.error(
              `❌ Failed shared post upload to ${tertiaryObjectKey}`,
              {
                error: tertiaryError.message,
                primaryUploadSucceeded: true,
              }
            );
            // Continue with the primary and secondary results if tertiary fails
          }
        }

        return {
          ...result,
          isMedia,
          isPost: isPost || false,
          size: fileSize,
          secondaryUrl: secondaryResult ? secondaryResult.publicUrl : null,
          tertiaryUrl: tertiaryResult ? tertiaryResult.publicUrl : null,
          uploadMethod: result.uploadMethod || (result.skipped ? "skipped" : "standard"),
          skipped: result.skipped || false,
          skipReason: result.reason || null
        };
      } catch (error) {
        console.error(`❌ Failed to upload ${file}`, {
          error: error.message,
          filePath,
          primaryObjectKey,
          isMedia,
        });

        // Try one more time with a delay for potentially transient network issues
        try {
          console.log(`🔄 Final retry for failed file: ${file}`);
          // Wait 3 seconds before retrying
          await new Promise((resolve) => setTimeout(resolve, 3000));

          const fileSize = (await fs.stat(filePath)).size;
          const minimalMetadata = {
            originalPath: file,
            isMedia: isMedia ? "true" : "false",
            retryAttempt: "true",
          };

          // Try final upload with minimal options
          const result = await r2.upload(
            await fs.readFile(filePath),
            primaryObjectKey,
            { metadata: minimalMetadata }
          );

          console.log(`✅ Final retry succeeded for ${file}`, {
            primaryObjectKey,
            size: fileSize,
          });

          return {
            ...result,
            publicUrl: r2.getPublicUrl(primaryObjectKey),
            isMedia,
            size: fileSize,
            uploadMethod: "final_retry",
          };
        } catch (retryError) {
          // Return error information instead of throwing to continue with other files
          console.error(`💥 All attempts failed for ${file}`, {
            originalError: error.message,
            retryError: retryError.message,
          });

          return {
            error: true,
            file,
            primaryObjectKey,
            message: error.message,
            retryMessage: retryError.message,
          };
        }
      }
    });

    // Wait for the current chunk to complete
    const chunkResults = await Promise.all(chunkPromises);
    results.push(...chunkResults);
  }

  // Count successful uploads and skipped files
  const successful = results.filter((r) => !r.error && !r.skipped).length;
  const skipped = results.filter((r) => r.skipped).length;
  const failed = results.filter((r) => r.error).length;
  
  logger.log(`📤 Upload summary: ${successful} uploaded, ${skipped} skipped, ${failed} failed (${files.length} total)`);

  return results;
}

/**
 * Publishes project build files to R2 storage
 * Uploads content files to version-specific folder and media files to shared folder
 *
 * @param {Object} data - Job data containing project and build information
 * @param {Object} data.assets - Asset information generated during build
 * @param {string} data.assets.distFolder - Path to the distribution folder containing built files
 * @param {string} data.projectId - Project identifier
 * @param {string} data.orgId - Organization identifier
 * @param {string} data.jobId - Deploy job identifier used for folder naming
 * @param {string} [data.mediaDir="media"] - Media directory name in source
 * @param {boolean} [data.alsoSaveMediasIntoDeploy=false] - Whether to save media in both shared and build-specific folders
 * @returns {Promise<Object>} - Result with publishing information
 */
async function publishR2(data) {
  const logger = data.logger || console;
  
  logger.log("📤 Publishing project build files to R2...", {
    jobId: data.jobId,
  });

  // Debug: Log the data structure to see what's available
  logger.log("📄 Debug - Data structure:", {
    keys: Object.keys(data),
    hasRepoInfo: !!data.repoInfo,
    hasAssets: !!data.assets,
    repoInfoKeys: data.repoInfo ? Object.keys(data.repoInfo) : [],
    assetsKeys: data.assets ? Object.keys(data.assets) : [],
    jobId: data.jobId,
  });

  // Use the asset's distFolder as the source path
  let sourcePath;
  if (data.assets && data.assets.distFolder) {
    sourcePath = data.assets.distFolder;
    logger.log("✅ Using assets.distFolder as source path:", { sourcePath });
  } else if (data.repoInfo && data.repoInfo.distPath) {
    sourcePath = data.repoInfo.distPath;
    logger.log("✅ Using repoInfo.distPath as source path:", { sourcePath });
  } else {
    throw new Error(
      "Source path is required (expected in data.assets.distFolder or data.repoInfo.distPath)"
    );
  }

  if (!data.projectId) {
    throw new Error("Project ID is required for publishing");
  }

  if (!data.orgId) {
    throw new Error("Organization ID is required for publishing");
  }

  try {
    const jobId = data.jobId;
    const projectId = data.projectId;
    const orgId = data.orgId;
    const alsoSaveMediasIntoDeploy = data.alsoSaveMediasIntoDeploy || false;
    const mediaDir = data.mediaDir || "_media"; // Default media directory name matching processor-core

    // Merge optimization configuration
    const optimizationConfig = mergeOptimizationConfig(data.uploadOptimization || {});
    
    // Initialize asset manager if optimization is enabled
    let assetManager = null;
    
    // Check if we already have an asset manager from fetchExistingAssets
    if (data.existingAssets && data.existingAssets.assetManager) {
      assetManager = data.existingAssets.assetManager;
      logger.log("✅ Using existing asset manager from pre-fetch", {
        stats: assetManager.getOptimizationStats()
      });
    } else if (optimizationConfig.fetchExistingAssets) {
      // If not pre-fetched, fetch now
      try {
        logger.log("🔍 Fetching existing R2 assets for optimization...");
        assetManager = await createR2AssetManager(projectId, logger, {
          maxKeys: optimizationConfig.listMaxKeys,
          prefetch: true
        });
        
        const stats = assetManager.getOptimizationStats();
        logger.log("✅ Asset manager initialized", stats);
      } catch (error) {
        logger.warn("⚠️ Failed to initialize asset manager, continuing without optimization", {
          error: error.message
        });
        // Continue without optimization if asset manager fails
        assetManager = null;
      }
    }

    // Generate the storage base path using only projectId (no org name)
    const basePath = `projects/${projectId}`;
//  const basePath = `${orgId}/${projectId}`; // pre june 2025

    // Generate the destination path in R2 for version-specific content
    const contentPath = `${basePath}/${jobId}`; // `${basePath}/${jobId}/content`;

    // Generate the shared media path for this project's media files
    const mediaPath = `${basePath}/_shared/medias`;

    // Generate the shared posts path for this project's posts files
    const postsPath = `${basePath}/_shared/posts`;

    logger.log("🔄 Publishing build files...", {
      sourcePath,
      contentPath,
      mediaPath,
      postsPath,
      mediaDir,
      jobId,
      projectId,
      orgId,
      alsoSaveMediasIntoDeploy,
    });

    // Validate source directory exists
    try {
      await fs.access(sourcePath);
    } catch (error) {
      throw new Error(`Source directory doesn't exist: ${sourcePath}`);
    }

    // Check that the media directory exists, if not create a fallback plan
    let mediaExists = true;
    try {
      await fs.access(path.join(sourcePath, mediaDir));
    } catch (error) {
      logger.warn(
        `⚠️ Media directory "${mediaDir}" not found, will treat all files as content`,
        {
          sourcePath,
          mediaDir,
        }
      );
      mediaExists = false;
    }

    // Upload all files from the build directory
    const uploadResults = await uploadDirectory(
      sourcePath,
      contentPath,
      mediaPath,
      postsPath,
      mediaDir,
      {
        preserveDirectories: true,
        alsoSaveMediasIntoDeploy,
        metadata: {
          projectId,
          orgId,
          jobId,
          timestamp: new Date().toISOString(),
        },
        assetManager,
        optimizationConfig,
        logger
      }
    );

    // Generate summary stats
    const totalFiles = uploadResults.length;
    const successfulUploads = uploadResults.filter((r) => !r.error && !r.skipped).length;
    const skippedUploads = uploadResults.filter((r) => r.skipped).length;
    const failedUploads = uploadResults.filter((r) => r.error).length;
    const mediaFiles = uploadResults.filter(
      (r) => !r.error && r.isMedia
    ).length;
    const postFiles = uploadResults.filter((r) => !r.error && r.isPost).length;
    const contentFiles = uploadResults.filter(
      (r) => !r.error && !r.isMedia && !r.isPost
    ).length;
    
    // Get skip reasons breakdown
    const skipReasons = {};
    uploadResults.filter(r => r.skipped).forEach(r => {
      skipReasons[r.skipReason] = (skipReasons[r.skipReason] || 0) + 1;
    });

    // Get main public URLs
    const publicContentUrl = r2.getPublicUrl(contentPath);
    const publicMediaUrl = r2.getPublicUrl(mediaPath);
    const publicPostsUrl = r2.getPublicUrl(postsPath);

    logger.log("✅ Build files published successfully", {
      jobId: data.jobId,
      totalFiles,
      successfulUploads,
      skippedUploads,
      failedUploads,
      mediaFiles,
      postFiles,
      contentFiles,
      skipReasons,
      publicContentUrl,
      publicMediaUrl,
      publicPostsUrl,
    });

    return {
      ...data,
      publishInfo: {
        published: true,
        projectId,
        orgId,
        jobId,
        r2ContentPath: contentPath,
        r2MediaPath: mediaPath,
        r2PostsPath: postsPath,
        publicContentUrl,
        publicMediaUrl,
        publicPostsUrl,
        totalFiles,
        successfulUploads,
        skippedUploads,
        failedUploads,
        skipReasons,
        mediaFiles,
        postFiles,
        contentFiles,
        alsoSaveMediasIntoDeploy,
        optimizationEnabled: !!assetManager,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    logger.error("❌ Failed to publish build files", {
      jobId: data.jobId,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

export default publishR2;

// src/process/publishBuildFiles.js
import fs from "fs/promises";
import path from "path";
import { glob } from "glob";
import * as r2 from "../services/r2.js";
import { getResourcePath } from "../utils/resourcePath.js";

/**
 * Uploads a directory's contents to R2 storage with parallel processing
 *
 * @param {string} sourcePath - Path to the source directory
 * @param {string} destinationPath - Base path in R2 storage
 * @param {Object} [options] - Upload options
 * @param {string} [options.pattern=  - Glob pattern for files to upload
 * @param {boolean} [options.preserveDirectories=true] - Whether to preserve directory structure
 * @param {Object} [options.metadata={}] - Metadata to add to all uploaded files
 * @returns {Promise<Array>} - Array of upload results with public URLs
 */
async function uploadDirectory(sourcePath, destinationPath, options = {}) {
  // Set default options
  const pattern = options.pattern || "**/*";
  const preserveDirectories = options.preserveDirectories !== false;
  const metadata = options.metadata || {};

  // Get all files matching the pattern
  const files = await glob(pattern, {
    cwd: sourcePath,
    nodir: true,
    absolute: false,
  });

  if (files.length === 0) {
    console.log("⚠️ No files found to upload", { sourcePath, pattern });
    return [];
  }

  console.log(`🔍 Found ${files.length} files to upload`, {
    sourcePath,
    destinationPath,
    pattern,
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

      // Determine the object key (path in R2)
      let objectKey;
      if (preserveDirectories) {
        // Keep directory structure: destinationPath/subdir/file.ext
        objectKey = path.join(destinationPath, file);
      } else {
        // Flatten directory structure: destinationPath/file.ext
        objectKey = path.join(destinationPath, path.basename(file));
      }

      // Replace backslashes with forward slashes for web URLs
      objectKey = objectKey.replace(/\\/g, "/");

      try {
        // Upload the file with metadata
        const result = await r2.uploadFile(filePath, objectKey, {
          metadata: {
            ...metadata,
            originalPath: file,
          },
        });

        /*  console.log(`✅ Uploaded: ${objectKey}`, {
          size: (await fs.stat(filePath)).size,
          publicUrl: result.publicUrl,
        });
*/
        return result;
      } catch (error) {
        console.error(`❌ Failed to upload ${file}`, { error: error.message });
        // Return error information instead of throwing to continue with other files
        return {
          error: true,
          file,
          message: error.message,
        };
      }
    });

    // Wait for the current chunk to complete
    const chunkResults = await Promise.all(chunkPromises);
    results.push(...chunkResults);
  }

  // Count successful uploads
  const successful = results.filter((r) => !r.error).length;
  console.log(
    `📤 Uploaded ${successful}/${files.length} files to ${destinationPath}`
  );

  return results;
}

/**
 * Publishes build files to R2 storage
 * This runs after deployment and before calling back to the server
 *
 * @param {Object} data - Job data containing repository and job information
 * @param {Object} data.repoInfo - Repository information
 * @param {string} data.repoInfo.distPath - Path to the distribution folder
 * @param {string} data.projectId - Project identifier
 * @param {string} data.jobId - Deploy job identifier used for folder naming
 * @returns {Promise<Object>} - Result with publishing information
 */
async function publishBuildFiles(data) {
  console.log("📤 Publishing build files to R2...", { jobId: data.jobId });

  // Validate required data
  if (!data.repoInfo || !data.repoInfo.distPath) {
    throw new Error("Build dist path is required in repoInfo");
  }

  if (!data.projectId) {
    throw new Error("Project ID is required for publishing");
  }

  try {
    // Get the source path from repoInfo
    const sourcePath = data.repoInfo.distPath;
    const jobId = data.jobId;
    const projectId = data.projectId;

    // Generate the destination path in R2
    const destinationPath = getResourcePath(projectId, jobId);

    console.log("🔄 Publishing build files...", {
      sourcePath,
      destinationPath,
      jobId: jobId,
      projectId,
    });

    // Validate source directory exists
    try {
      await fs.access(sourcePath);
    } catch (error) {
      throw new Error(`Source directory doesn't exist: ${sourcePath}`);
    }

    // Upload all files from the build directory
    const uploadResults = await uploadDirectory(sourcePath, destinationPath, {
      preserveDirectories: true,
      metadata: {
        projectId,
        jobId,
        timestamp: new Date().toISOString(),
      },
    });

    // Generate summary stats
    const totalFiles = uploadResults.length;
    const successfulUploads = uploadResults.filter((r) => !r.error).length;
    const failedUploads = uploadResults.filter((r) => r.error).length;

    // Get main public URL for the build (to the directory root)
    const publicBaseUrl = r2.getPublicUrl(destinationPath);

    console.log("✅ Build files published successfully", {
      jobId: data.jobId,
      totalFiles,
      successfulUploads,
      failedUploads,
      publicBaseUrl,
    });

    return {
      ...data,
      publishInfo: {
        published: true,
        projectId,
        jobId,
        r2Path: destinationPath,
        publicBaseUrl,
        totalFiles,
        successfulUploads,
        failedUploads,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error("❌ Failed to publish build files", {
      jobId: data.jobId,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

export default publishBuildFiles;

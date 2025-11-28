// src/process/buildAssets.js
import fs from "fs/promises";
import path from "path";
import {
  processFolder,
  processMedia,
  jsonStringify,
  writeToFileSync,
  toSlug,
} from "../../../repo-parser/dist/index.js";
//} from "obsidian-parser-dev";
//} from 'obsidian-parser';

/**
 * Build assets from the repository data using obsidian-parser
 * @param {Object} data - Job data containing repository information
 * @returns {Promise<Object>} - Result with asset information
 */
async function buildAssets(data) {
  console.log("🏗️ Building assets...", { jobId: data.jobId });

  // Validate required data
  if (!data.repoInfo || !data.repoInfo.path) {
    throw new Error("Repository path is required in repoInfo");
  }

  // Get the source and dist paths from repoInfo
  const repoPath = data.repoInfo.path;
  const distFolder =
    data.repoInfo.distPath || path.join(path.dirname(repoPath), "dist");

  try {
    // Create dist folder if it doesn't exist
    await fs.mkdir(distFolder, { recursive: true });

    // Create media output folder for assets
    const mediaOutputPath = path.join(distFolder, "_medias");
    await fs.mkdir(mediaOutputPath, { recursive: true });

    // Set parameters for obsidian-parser
    const inputPath = repoPath;
    const outputPath = path.join(distFolder, "content.json");
    const mediaPrefix = data.mediaPrefix || "/_medias";
    const notePrefix = data.notePrefix || "/notes";
    const domain = data.domain || "";
    const skipExisting = true;
    const debugLevel = 1;

    console.log("📦 Converting Obsidian markdown to JSON...", {
      inputPath,
      outputPath,
      distFolder,
      mediaOutput: mediaOutputPath,
      mediaPrefix,
      notePrefix,
      domain,
    });

    /**
     * Default image sizes for optimization
     */
    const DEFAULT_IMAGE_SIZES = [
      { width: 100, height: null, suffix: "xs" },
      { width: 300, height: null, suffix: "sm" },
      { width: 700, height: null, suffix: "md" },
      //{ width: 1920, height: null, suffix: "lg" },
      //xl
      //  { width: 3840, height: null, suffix: "xl" }, // Original
      // { width: null, height: null, suffix: "ori" } // Original size
    ];
    const DEFAULT_IMAGE_FORMATS = [
      // { format: "webp", options: { quality: 80 } },
      // { format: "avif", options: { quality: 65 } },
      { format: "jpeg", options: { quality: 85, mozjpeg: true } },
    ];
    const imageSizes = DEFAULT_IMAGE_SIZES;
    const imageFormats = DEFAULT_IMAGE_FORMATS;

    const skipHashes = [
      "1b3e367843fabb14ca8ed45ff424e01abf01b1642db48e7d53b0eb728e2aa4e1",
    ];

    // Process media files first
    console.log("🔄 Processing media files...");
    const mediaResult = await processMedia(inputPath, {
      imageSizes,
      imageFormats,
      mediaOutputFolder: mediaOutputPath,
      mediaPathPrefix: mediaPrefix,
      optimizeImages: true,
      skipExisting: skipExisting,
      skipHashes, //array of existing hashes to skip (can be pulled from R2)
      forceReprocessMedias: false,
      domain: domain,
      debug: debugLevel,
      exportPosts: true, //creates a _posts directory

      useMediaHash: true,
      useMediaHashSharding: false,
      usePostHash: true,
    });

    const { mediaData, pathMap: mediaPathMap } = mediaResult;
    console.log(`✅ Processed ${mediaData.length} media files`);

    // Save media results for reference
    const mediaResultsPath = path.join(distFolder, "media-results.json");
    writeToFileSync(
      mediaResultsPath,
      jsonStringify({
        mediaData,
        mediaPathMap,
      })
    );

    // Process the markdown files
    console.log("🔄 Processing markdown files...");
    const vaultData = await processFolder(inputPath, {
      debug: debugLevel,
      notePathPrefix: notePrefix,
      assetPathPrefix: mediaPrefix,
      domain: domain,
      imgLinkBuilderOpts: {
        prefix: mediaPrefix,
        toSlug: toSlug,
      },
      mediaData: mediaData,
      mediaPathMap: mediaPathMap,
      useAbsolutePaths: true,
      exportPosts: true,
      postsOutputFolder: path.join(distFolder, "_posts"),
    });

    // Save the processed data to JSON
    console.log("💾 Saving output to JSON...");
    writeToFileSync(outputPath, jsonStringify(vaultData));

    console.log("🏗️ Assets built successfully!", {
      jobId: data.jobId,
      filesProcessed: vaultData.length,
      mediasProcessed: mediaData.length,
      outputPath,
      mediaPath: mediaOutputPath,
    });

    return {
      ...data,
      assets: {
        processed: true,
        distFolder: distFolder,
        contentPath: outputPath,
        mediaPath: mediaOutputPath,
        filesCount: vaultData.length,
        mediaCount: mediaData.length,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error("❌ Failed to build assets", {
      jobId: data.jobId,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

export default buildAssets;

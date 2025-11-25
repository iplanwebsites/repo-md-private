// src/process/buildAssets.js
import fs from "fs/promises";
import path from "path";
import {
  process,
  // jsonStringify,
  // writeToFileSync,
  toSlug,
} from "../../../repo-processor/dist/index.js";
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
    //const mediaOutputPath = path.join(distFolder, "_medias");
    //await fs.mkdir(mediaOutputPath, { recursive: true });

    // Set parameters for processor
    const inputPath = repoPath;
    // const outputPath = path.join(distFolder, "content.json");
    const mediaPrefix = data.mediaPrefix || "/_repo/medias";
    const notePrefix = data.notePrefix || "/_repo/notes";
    const domain = data.domain || "";
    const skipExisting = true;
    const debugLevel = 1;

    console.log("📦 Converting Obsidian markdown to JSON...", {
      inputPath,
      // outputPath,
      distFolder,
      //mediaOutput: mediaOutputPath,
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

    // Configure processing options
    const config = {
      buildDir: distFolder,
      inputPath,
      domain: "https://static.repo.md/org/proj/",
      //  outputPath,
      notePathPrefix: notePrefix,
      assetPathPrefix: mediaPrefix,
      debugLevel,
      //  mediaOutputFolder: mediaOutputPath,
      mediaPathPrefix: mediaPrefix,
      optimizeImages: true,
      skipMedia: false,
      skipExisting,
      forceReprocessMedias: false,
      domain,
      useAbsolutePaths: true,
      mediaResultsPath: path.join(distFolder, "media-results.json"),
      imageSizes,
      imageFormats,
      skipHashes,
      useMediaHash: true,
      useMediaHashSharding: false,
      usePostHash: true,
      exportPosts: true,
      // postsOutputFolder: path.join(distFolder, "_posts2"),
      imgLinkBuilderOpts: {
        prefix: mediaPrefix,
        toSlug: toSlug,
      },
    };

    // Process the vault with the unified process function
    console.log("🔄 Processing repository content...");
    const result = await process(config);

    const { vaultData, mediaData } = result;

    console.log("🏗️ Assets built successfully!", {
      jobId: data.jobId,
      filesProcessed: vaultData.length,
      mediasProcessed: mediaData.length,
      //  outputPath,
      //   mediaPath: mediaOutputPath,
    });

    return {
      ...data,
      assets: {
        processed: true,
        distFolder: distFolder,
        contentPath: path.join(distFolder, "posts.json"),
        //  mediaPath: mediaOutputPath,
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

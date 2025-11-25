// test/portfolio-test.js
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { RepoProcessor, ConfigBuilder } from "../dist/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Process the portfolio test vault
 */
async function processPortfolio() {
  console.log("🏗️ Processing portfolio test vault...");

  // Source and destination paths
  const inputPath = path.join(__dirname, "portfolio");
  const distFolder = path.join(__dirname, "portfolio-dist");

  try {
    // Create dist folder if it doesn't exist
    await fs.mkdir(distFolder, { recursive: true });

    // Set parameters for processor
    const mediaPrefix = "/_repo/medias";
    const notePrefix = "/blog"; /// to prefix with slug// //"/_repo/posts";
    const domain = null; // "https://static.repo.md/org/proj/";
    const skipExisting = true;
    const debugLevel = 3; //ALL

    console.log("📦 Converting markdown to JSON...", {
      inputPath,
      distFolder,
      mediaPrefix,
      notePrefix,
      domain,
    });

    /**
     * Default image sizes for optimization
     */
    const DEFAULT_IMAGE_SIZES = [
      { width: 320, height: null, suffix: "xs" },
      { width: 640, height: null, suffix: "sm" },
      { width: 1024, height: null, suffix: "md" },
      { width: 1920, height: null, suffix: "lg" },
      { width: 3840, height: null, suffix: "xl" },
    ];
    const DEFAULT_IMAGE_FORMATS = [
      { format: "jpeg", options: { quality: 85, mozjpeg: true } },
    ];
    const imageSizes = DEFAULT_IMAGE_SIZES;
    const imageFormats = DEFAULT_IMAGE_FORMATS;

    const skipHashes = [
      "1b3e367843fabb14ca8ed45ff424e01abf01b1642db48e7d53b0eb728e2aa4e1",
    ];

    // Configure processing options using flat configuration object  
    const config = {
      // Core directory configuration
      inputPath: inputPath,
      buildDir: distFolder,
      
      // URL path configuration
      notePathPrefix: notePrefix,
      assetPathPrefix: mediaPrefix,
      mediaPathPrefix: mediaPrefix,
      domain: domain,
      useAbsolutePaths: true,
      
      // Media processing
      optimizeImages: true,
      skipMedia: false,
      skipExisting: skipExisting,
      forceReprocessMedias: false,
      imageSizes: imageSizes,
      imageFormats: imageFormats,
      skipHashes: skipHashes,
      useMediaHash: true,
      useMediaHashSharding: false,
      preferredSize: "md",
      
      // Post processing
      exportPosts: true,
      processAllFiles: true,
      
      // Debug level
      debugLevel: debugLevel,
      
      // Plugin configuration (flat style)
      iframeEmbedOptions: {
        features: {
          mermaid: false // Explicitly disable iframe mermaid
        }
      },
      rehypeMermaidOptions: {
        enabled: true, // Explicitly enable rehype-mermaid  
        strategy: 'inline-svg'
      }
    };

    /* Alternative: You can also use a flat configuration style:
    const config = {
      // Core directory configuration
      inputPath: inputPath,
      buildDir: distFolder,
      
      // URL path configuration
      notePathPrefix: notePrefix,
      assetPathPrefix: mediaPrefix,
      mediaPathPrefix: mediaPrefix,
      domain: domain,
      useAbsolutePaths: true,
      
      // Media processing
      optimizeImages: true,
      skipMedia: false,
      skipExisting: skipExisting,
      forceReprocessMedias: false,
      imageSizes: imageSizes,
      imageFormats: imageFormats,
      skipHashes: skipHashes,
      useMediaHash: true,
      useMediaHashSharding: false,
      preferredSize: "md",
      
      // Post processing
      exportPosts: true,
      processAllFiles: true,
      
      // Debug level
      debugLevel: debugLevel
    };
    */

    // Process the vault with the new class-based RepoProcessor
    console.log("🔄 Processing repository content...");
    const processor = new RepoProcessor(config);
    const result = await processor.process();

    const { vaultData, mediaData } = result;

    console.log("🏗️ Assets built successfully!", {
      filesProcessed: vaultData.length,
      mediasProcessed: mediaData.length,
    });

    return {
      processed: true,
      distFolder: distFolder,
      contentPath: path.join(distFolder, "posts.json"),
      filesCount: vaultData.length,
      mediaCount: mediaData.length,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("❌ Failed to process portfolio", {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

// Run the processor
processPortfolio()
  .then((result) => {
    console.log("✅ Portfolio test completed successfully", result);
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Portfolio test failed", error);
    process.exit(1);
  });

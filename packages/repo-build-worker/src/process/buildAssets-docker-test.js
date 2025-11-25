// src/process/buildAssets.js
import fs from "fs/promises";
import path from "path";
import { RepoProcessor } from "@repo-md/processor";
import computePostEmbeddings from "./computePostEmbeddings.js";
import computeImageEmbeddings from "./computeImageEmbeddings.js";
import createVectraIndex from "./vectra.js";
import buildSqliteDatabase from "./buildSqliteDatabase.js";
import similarity from "compute-cosine-similarity";

/**
 * Save JSON data to a file in the dist folder
 * @param {string} distFolder - The distribution folder path
 * @param {string} filename - The filename to save to
 * @param {Object} data - The data to save
 * @returns {Promise<string>} - The full file path
 */
async function saveJson(distFolder, filename, data, logger) {
  const filePath = path.join(distFolder, filename);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));

  // Use logger if provided, otherwise fall back to console
  if (logger) {
    logger.log(`💾 Saved ${filename} to ${filePath}`);
  } else {
    console.log(`💾 Saved ${filename} to ${filePath}`);
  }

  return filePath;
}

/**
 * Generate file summaries for source and dist directories
 * @param {string} sourceDir - The source directory path
 * @param {string} distDir - The distribution directory path
 * @returns {Promise<Object>} - Result with file summary paths
 */
async function generateFileSummaries(sourceDir, distDir, logger) {
  if (logger) {
    logger.log("📋 Generating file summaries...");
  } else {
    console.log("📋 Generating file summaries...");
  }

  const sourceFiles = await generateDirectorySummary(sourceDir);
  const distFiles = await generateDirectorySummary(distDir);

  // Save summaries to JSON files
  const sourceFilePath = await saveJson(
    distDir,
    "files-source.json",
    sourceFiles,
    logger
  );
  const distFilePath = await saveJson(
    distDir,
    "files-dist.json",
    distFiles,
    logger
  );

  if (logger) {
    logger.log(
      `✅ File summaries generated: ${sourceFiles.length} source files, ${distFiles.length} dist files`
    );
  } else {
    console.log(
      `✅ File summaries generated: ${sourceFiles.length} source files, ${distFiles.length} dist files`
    );
  }

  return {
    sourceFileSummaryPath: sourceFilePath,
    distFileSummaryPath: distFilePath,
    sourceFileCount: sourceFiles.length,
    distFileCount: distFiles.length,
  };
}

/**
 * Generate a summary of all files in a directory
 * @param {string} directory - Directory to summarize
 * @returns {Promise<Array>} - Array of file summaries
 */
async function generateDirectorySummary(directory) {
  const files = [];

  // Recursive function to process directories
  async function processDirectory(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(directory, fullPath);

      if (entry.isDirectory()) {
        // Recursively process subdirectories
        await processDirectory(fullPath);
      } else {
        // Get file stats for size
        const stats = await fs.stat(fullPath);
        const pathInfo = path.parse(fullPath);

        // Create file summary object
        files.push({
          path: relativePath,
          filename: entry.name,
          extension: pathInfo.ext.replace(".", ""),
          size: stats.size,
          folder: relativePath.split("/").slice(0, -1),
        });
      }
    }
  }

  await processDirectory(directory);
  return files;
}

/**
 * Build assets from the repository data using obsidian-parser
 * @param {Object} data - Job data containing repository information
 * @returns {Promise<Object>} - Result with asset information
 */
async function buildAssets(data) {
  // Extract logger from data if available
  const logger = data.logger;

  // Use logger if provided, otherwise fall back to console
  if (logger) {
    logger.log("🏗️ Building assets...", { jobId: data.jobId });
  } else {
    console.log("🏗️ Building assets...", { jobId: data.jobId });
  }

  // Validate required data
  if (!data.repoInfo || !data.repoInfo.path) {
    const error = new Error("Repository path is required in repoInfo");
    if (logger) logger.error(error.message);
    throw error;
  }

  // Get the source and dist paths from repoInfo
  const repoPath = data.repoInfo.path;
  const distFolder =
    data.repoInfo.distPath || path.join(path.dirname(repoPath), "dist");

  try {
    // Create dist folder if it doesn't exist
    await fs.mkdir(distFolder, { recursive: true });

    // Create media output folder for assets
    //await fs.mkdir(mediaOutputPath, { recursive: true });

    // Set parameters for processor
    const inputPath = repoPath;
    // const outputPath = path.join(distFolder, "content.json");
    const mediaPrefix = data.mediaPrefix || "/_repo/medias";
    const notePrefix = data.notePrefix || "/_repo/notes";
    const domain = data.domain || "";
    const skipExisting = true;
    const debugLevel = 1;

    if (logger) {
      logger.log("📦 Converting Obsidian markdown to JSON...", {
        inputPath,
        distFolder,
        mediaPrefix,
        notePrefix,
        domain,
      });
    } else {
      console.log("📦 Converting Obsidian markdown to JSON...", {
        inputPath,
        distFolder,
        mediaPrefix,
        notePrefix,
        domain,
      });
    }

    /**
     * Default image sizes for optimization
     */
    const DEFAULT_IMAGE_SIZES = [
      { width: 100, height: null, suffix: "xs" },
      { width: 300, height: null, suffix: "sm" },
      { width: 700, height: null, suffix: "md" },
      { width: 1400, height: null, suffix: "lg" },
      { width: 2160, height: null, suffix: "xl" },
      //xl
      //  { width: 3840, height: null, suffix: "xl" }, // Original
      // { width: null, height: null, suffix: "ori" } // Original size
    ];
    const DEFAULT_IMAGE_FORMATS = [
      { format: "webp", options: { quality: 80 } },
      // { format: "avif", options: { quality: 65 } },
      { format: "jpeg", options: { quality: 85, mozjpeg: true } },
    ];
    const imageSizes = DEFAULT_IMAGE_SIZES;
    const imageFormats = DEFAULT_IMAGE_FORMATS;

    const skipHashes = [
      "1b3e367843fabb14ca8ed45ff424e01abf01b1642db48e7d53b0eb728e2aa4e1",
    ];

    // Configure processing options using the new nested structure
    const config = {
      // Core directory configuration
      dir: {
        input: inputPath, // Required: input directory path
        output: distFolder, // Output directory path
      },

      // Path configuration
      paths: {
        notesPrefix: notePrefix,
        assetsPrefix: mediaPrefix,
        mediaPrefix: mediaPrefix,
        domain: domain,
        useAbsolutePaths: true,
      },

      // Media processing configuration
      media: {
        optimize: true,
        skip: false,
        skipExisting: skipExisting,
        forceReprocess: false,
        sizes: imageSizes,
        formats: imageFormats,
        skipHashes: skipHashes,
        useHash: true,
        useHashSharding: false,
        preferredSize: "md",
        //  resultsPath: path.join(distFolder, "media-results.json")
      },

      // Post processing configuration
      posts: {
        exportEnabled: true,
        processAllFiles: true, // Process all markdown files regardless of public frontmatter
        useHash: true,
      },

      // Debug level
      debugLevel: debugLevel,

      // Additional options
      imgLinkBuilderOpts: {
        prefix: mediaPrefix,
      },
    };

    // Process the vault with the unified process function
    if (logger) {
      logger.log("🔄 Processing repository content...");
    } else {
      console.log("🔄 Processing repository content...");
    }
    const processor = new RepoProcessor(config);
    const result = await processor.process();
    // const result = await RepoProcessor(config);

    const { vaultData, mediaData } = result;

    if (logger) {
      logger.log("🏗️ Assets built successfully!", {
        jobId: data.jobId,
        filesProcessed: vaultData.length,
        mediasProcessed: mediaData.length,
      });
    } else {
      console.log("🏗️ Assets built successfully!", {
        jobId: data.jobId,
        filesProcessed: vaultData.length,
        mediasProcessed: mediaData.length,
      });
    }

    // Prepare result data
    const assetResult = {
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

    // Generate embeddings for all posts
    if (logger) {
      logger.log("📊 Computing embeddings for posts...");
    } else {
      console.log("📊 Computing embeddings for posts...");
    }

    // Pass posts array directly to embedding function
    const posts = vaultData;
    if (logger) {
      logger.log(`🔍 Found ${posts.length} posts for embeddings generation`);
    } else {
      console.log(`🔍 Found ${posts.length} posts for embeddings generation`);
    }

    // Generate embeddings for posts
    const embeddingsResult = await computePostEmbeddings(posts);

    // Save embeddings maps to files using the helper
    const slugOutputPath = await saveJson(
      distFolder,
      "posts-embedding-slug-map.json",
      embeddingsResult.slugMap,
      logger
    );
    const hashOutputPath = await saveJson(
      distFolder,
      "posts-embedding-hash-map.json",
      embeddingsResult.hashMap,
      logger
    );

    // Compute similarity between all posts
    if (logger) {
      logger.log("🧩 Computing similarity between posts...");
    } else {
      console.log("🧩 Computing similarity between posts...");
    }

    // Create a similarity map between post hashes
    const similarityMap = {};
    // Create a map for storing similar posts for each hash
    const similarPostsMap = {};
    // Track similarities per post for later sorting
    const postSimilarities = {};

    const NB_SIMILAR_POSTS = 10; // Number of similar posts to keep
    const hashKeys = Object.keys(embeddingsResult.hashMap);

    // Only compute if we have at least 2 posts with embeddings
    if (hashKeys.length >= 2) {
      // Sort the hash keys alphabetically once
      const sortedHashKeys = [...hashKeys].sort();

      // Initialize the similarities tracking for each post
      sortedHashKeys.forEach((hash) => {
        postSimilarities[hash] = [];
      });

      // Compute similarity for each unique pair of posts (without duplicates)
      // We only need to process pairs where i < j to avoid duplicate calculations
      for (let i = 0; i < sortedHashKeys.length - 1; i++) {
        const hash1 = sortedHashKeys[i];
        const embedding1 = embeddingsResult.hashMap[hash1];

        for (let j = i + 1; j < sortedHashKeys.length; j++) {
          const hash2 = sortedHashKeys[j];
          const embedding2 = embeddingsResult.hashMap[hash2];

          // Compute cosine similarity between embeddings
          const similarityScore = similarity(embedding1, embedding2);

          // Already using sorted keys, so we can directly create the pair key
          const pairKey = `${hash1}-${hash2}`;
          similarityMap[pairKey] = similarityScore;

          // Store the similarity for both posts to build the similar posts map later
          postSimilarities[hash1].push({ hash: hash2, score: similarityScore });
          postSimilarities[hash2].push({ hash: hash1, score: similarityScore });
        }
      }

      // For each post, get the top 10 most similar posts
      for (const hash of sortedHashKeys) {
        // Sort by similarity score in descending order
        const sortedSimilarities = postSimilarities[hash]
          .sort((a, b) => b.score - a.score)
          .slice(0, NB_SIMILAR_POSTS) // Get top 10
          .map((item) => item.hash); // Only keep the hash

        // Store in the similar posts map
        similarPostsMap[hash] = sortedSimilarities;
      }

      if (logger) {
        logger.log(
          `✅ Computed similarity for ${
            Object.keys(similarityMap).length
          } post pairs`
        );
        logger.log(
          `✅ Created similar posts map for ${
            Object.keys(similarPostsMap).length
          } posts`
        );
      } else {
        console.log(
          `✅ Computed similarity for ${
            Object.keys(similarityMap).length
          } post pairs`
        );
        console.log(
          `✅ Created similar posts map for ${
            Object.keys(similarPostsMap).length
          } posts`
        );
      }
    } else {
      if (logger) {
        logger.log("⚠️ Not enough posts with embeddings to compute similarity");
      } else {
        console.log(
          "⚠️ Not enough posts with embeddings to compute similarity"
        );
      }
    }

    // Save similarity map to file
    const similarityOutputPath = await saveJson(
      distFolder,
      "posts-similarity.json",
      similarityMap,
      logger
    );

    // Save similar posts map to file
    const similarPostsOutputPath = await saveJson(
      distFolder,
      "posts-similar-hash.json",
      similarPostsMap,
      logger
    );

    // Update asset result with post embeddings metadata
    let resultWithEmbeddings = {
      ...assetResult,
      postEmbeddings: {
        ...embeddingsResult.metadata,
        slugMapPath: slugOutputPath,
        hashMapPath: hashOutputPath,
        similarityMapPath: similarityOutputPath,
        similarPostsMapPath: similarPostsOutputPath,
        similarityPairsCount: Object.keys(similarityMap).length,
      },
    };

    // Generate embeddings for all media files (primarily images)
    if (logger) {
      logger.log("📊 Computing embeddings for media files...");
    } else {
      console.log("📊 Computing embeddings for media files...");
    }

    // Get the media files to process
    const media = mediaData;
    if (logger) {
      logger.log(
        `🔍 Found ${media.length} media files for embeddings generation`
      );
    } else {
      console.log(
        `🔍 Found ${media.length} media files for embeddings generation`
      );
    }

    // Generate embeddings for media files - wrapped in try-catch to make embeddings optional
    let imageEmbeddingsResult;
    try {
      // Try to generate embeddings for media files
      imageEmbeddingsResult = await computeImageEmbeddings(media);

      // Check if we have any embeddings
      if (
        !imageEmbeddingsResult.hashMap ||
        Object.keys(imageEmbeddingsResult.hashMap).length === 0
      ) {
        console.error("❌ No image embeddings were generated to save!");
        if (logger) {
          logger.error("❌ No image embeddings were generated to save!");
        }
      } else {
        console.log(
          `✅ Generated ${
            Object.keys(imageEmbeddingsResult.hashMap).length
          } embeddings to save`
        );
        if (logger) {
          logger.log(
            `✅ Generated ${
              Object.keys(imageEmbeddingsResult.hashMap).length
            } embeddings to save`
          );
        }
      }
    } catch (embeddingError) {
      // If embeddings generation fails, log the error but continue the process
      console.error(`❌ Failed to generate image embeddings: ${embeddingError.message}`);
      console.error('Stack trace:', embeddingError.stack);
      if (logger) {
        logger.error(`❌ Failed to generate image embeddings: ${embeddingError.message}`);
        logger.error('Stack trace:', embeddingError.stack);
      }
      
      // Create an empty result to continue without embeddings
      imageEmbeddingsResult = {
        hashMap: {},
        metadata: {
          computed: false,
          count: 0,
          skipped: media.length,
          errors: 1,
          dimension: 0,
          timestamp: new Date().toISOString(),
          model: "failed",
          error: embeddingError.message
        }
      };
      
      console.log("⚠️ Continuing build process without image embeddings");
      if (logger) {
        logger.log("⚠️ Continuing build process without image embeddings");
      }
    }

    // Save media embeddings to file
    const mediaHashOutputPath = await saveJson(
      distFolder,
      "media-embedding-hash-map.json",
      imageEmbeddingsResult.hashMap || {}, // Ensure we always have an object
      logger
    );

    // Verify the saved file exists and has content
    try {
      const stats = await fs.stat(mediaHashOutputPath);
      console.log(
        `✅ Media embeddings file saved: ${mediaHashOutputPath} (${stats.size} bytes)`
      );
      if (stats.size < 10) {
        console.error(
          "⚠️ WARNING: Media embeddings file appears to be empty or very small!"
        );
        if (logger) {
          logger.error(
            "⚠️ WARNING: Media embeddings file appears to be empty or very small!",
            { fileSize: stats.size }
          );
        }
      }
      if (logger) {
        logger.log(
          `✅ Media embeddings file saved and verified: ${mediaHashOutputPath} (${stats.size} bytes)`
        );
      }
    } catch (error) {
      console.error(
        `❌ Failed to verify media embeddings file: ${error.message}`
      );
      if (logger) {
        logger.error(
          `❌ Failed to verify media embeddings file: ${error.message}`
        );
      }
    }

    // Update result with both post and media embeddings metadata
    resultWithEmbeddings = {
      ...resultWithEmbeddings,
      mediaEmbeddings: {
        ...imageEmbeddingsResult.metadata,
        hashMapPath: mediaHashOutputPath,
      },
    };

    // Build the vector database using Vectra
    if (logger) {
      logger.log("🧠 Building Vectra vector database...");
    } else {
      console.log("🧠 Building Vectra vector database...");
    }
    const resultWithVectra = await createVectraIndex(resultWithEmbeddings);

    // Build the SQLite database
    if (logger) {
      logger.log("🗃️ Building SQLite database...");
    } else {
      console.log("🗃️ Building SQLite database...");
    }
    const resultWithSqlite = await buildSqliteDatabase(resultWithVectra);

    // Generate file summaries for source and dist directories
    if (logger) {
      logger.log(
        "📋 Generating file summaries for source and dist directories..."
      );
    } else {
      console.log(
        "📋 Generating file summaries for source and dist directories..."
      );
    }
    const fileSummaries = await generateFileSummaries(
      repoPath,
      distFolder,
      logger
    );

    // Add file summaries to the result
    const finalResult = {
      ...resultWithSqlite,
      fileSummaries,
    };

    return finalResult;
  } catch (error) {
    if (logger) {
      logger.error("❌ Failed to build assets", {
        jobId: data.jobId,
        error: error.message,
        stack: error.stack,
      });
    } else {
      console.error("❌ Failed to build assets", {
        jobId: data.jobId,
        error: error.message,
        stack: error.stack,
      });
    }
    throw error;
  }
}

export default buildAssets;

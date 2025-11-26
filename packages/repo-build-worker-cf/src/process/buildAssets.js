// src/process/buildAssets.js
import fs from "fs/promises";
import path from "path";
import { RepoProcessor } from "@repo-md/processor";
import computePostEmbeddings from "./computePostEmbeddings.js";
import computeImageEmbeddings from "./computeImageEmbeddings.js";
import createVectraIndex from "./vectra.js";
import buildSqliteDatabase from "./buildSqliteDatabase.js";
import scanFrontmatterSchema from "./scanFrontmatterSchema.js";
import similarity from "compute-cosine-similarity";
import { generateRepoJson } from "../lib/specParser.js";
import WorkerIssueCollector from "../services/issueCollector.js";
import * as r2 from "../services/r2.js";

/**
 * Safe logger wrapper that handles missing methods
 * @param {Object} logger - Logger instance
 * @param {string} level - Log level (log, warn, error)
 * @param {...any} args - Arguments to log
 */
function safeLog(logger, level, ...args) {
  if (logger && typeof logger[level] === 'function') {
    logger[level](...args);
  } else if (level === 'warn' || level === 'error') {
    console[level](...args);
  }
}

/**
 * Extract media references from post content
 * @param {string} content - The post content (markdown)
 * @returns {Array<string>} - Array of media file references
 */
function extractMediaReferences(content) {
  if (!content) return [];
  
  const references = new Set();
  
  // Match markdown image syntax: ![alt](path)
  const mdImageRegex = /!\[.*?\]\((.*?)\)/g;
  let match;
  while ((match = mdImageRegex.exec(content)) !== null) {
    references.add(match[1]);
  }
  
  // Match HTML img tags: <img src="path">
  const htmlImgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
  while ((match = htmlImgRegex.exec(content)) !== null) {
    references.add(match[1]);
  }
  
  // Match obsidian-style embeds: ![[filename]]
  const obsidianEmbedRegex = /!\[\[([^\]]+)\]\]/g;
  while ((match = obsidianEmbedRegex.exec(content)) !== null) {
    references.add(match[1]);
  }
  
  return Array.from(references);
}

/**
 * Load embeddings from previous revision in R2
 * @param {string} previousRev - The previous revision ID
 * @param {string} filename - The embeddings filename to load
 * @param {Object} logger - Logger instance
 * @returns {Promise<Object|null>} - The embeddings map or null if not found
 */
async function loadPreviousEmbeddings(previousRev, filename, logger) {
  try {
    const objectKey = `${previousRev}/${filename}`;
    logger.log(`🔄 Attempting to load previous embeddings from: ${objectKey}`);
    
    const buffer = await r2.download(objectKey);
    const embeddings = JSON.parse(buffer.toString());
    
    logger.log(`✅ Successfully loaded ${Object.keys(embeddings).length} embeddings from previous revision`);
    return embeddings;
  } catch (error) {
    safeLog(logger, 'warn', `⚠️ Could not load previous embeddings from ${previousRev}/${filename}: ${error.message}`);
    return null;
  }
}

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
  
  // Initialize issue collector
  const issueCollector = new WorkerIssueCollector();

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
    issueCollector.addConfigWarning({
      setting: 'repoInfo.path',
      message: 'Repository path is required in repoInfo',
      suggestion: 'Ensure data.repoInfo.path is provided'
    });
    throw error;
  }

  // Get the source and dist paths from repoInfo
  const repoPath = data.repoInfo.path;
  const distFolder =
    data.repoInfo.distPath || path.join(path.dirname(repoPath), "dist");

  // If repositoryFolder is specified, use that subfolder as the input path
  // This allows processing only a specific folder within the repo (e.g., "docs/" or "packages/blog/")
  const repositoryFolder = data.repositoryFolder || "";
  const inputBasePath = repositoryFolder
    ? path.join(repoPath, repositoryFolder.replace(/^\/+|\/+$/g, '')) // Remove leading/trailing slashes
    : repoPath;

  if (repositoryFolder && logger) {
    logger.log(`📂 Using repository subfolder: ${repositoryFolder}`);
  }

  try {
    // Create dist folder if it doesn't exist
    await fs.mkdir(distFolder, { recursive: true });

    // Create media output folder for assets
    //await fs.mkdir(mediaOutputPath, { recursive: true });

    // Set parameters for processor
    const inputPath = inputBasePath;
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

    // Get existing hashes from data if provided (from R2 asset manager)
    const existingMediaHashes = data.existingMediaHashes || new Set();
    const existingPostHashes = data.existingPostHashes || new Set();
    
    // Combine with any hardcoded skip hashes
    const skipHashes = [
      "1b3e367843fabb14ca8ed45ff424e01abf01b1642db48e7d53b0eb728e2aa4e1",
      ...Array.from(existingMediaHashes)
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
        preferredSize: "lg", //TODO: use the preferred size from the config passed via options.
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
      if (existingMediaHashes.size > 0 || existingPostHashes.size > 0) {
        logger.log("📊 Using existing asset hashes for optimization:", {
          existingMediaHashes: existingMediaHashes.size,
          existingPostHashes: existingPostHashes.size
        });
      }
    } else {
      console.log("🔄 Processing repository content...");
      if (existingMediaHashes.size > 0 || existingPostHashes.size > 0) {
        console.log("📊 Using existing asset hashes for optimization:", {
          existingMediaHashes: existingMediaHashes.size,
          existingPostHashes: existingPostHashes.size
        });
      }
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

    // Content validation checks
    const contentWarnings = [];

    // Check for empty posts
    if (vaultData.length === 0) {
      issueCollector.addConfigWarning({
        setting: 'content.posts',
        message: 'No markdown posts found in repository',
        suggestion: 'Ensure your repository contains .md files with valid frontmatter'
      });
      contentWarnings.push('no_posts');
      safeLog(logger, 'warn', "⚠️ No markdown posts found in repository");
    }

    // Check for empty media
    if (mediaData.length === 0) {
      issueCollector.addConfigWarning({
        setting: 'content.media',
        message: 'No media files found in repository',
        suggestion: 'Add images, videos, or other media files to enhance your content'
      });
      contentWarnings.push('no_media');
      safeLog(logger, 'warn', "⚠️ No media files found in repository");
    }

    // Check for low content ratio (only if we have some content)
    if (vaultData.length > 0 && mediaData.length > 0) {
      const totalFiles = vaultData.length + mediaData.length;
      const contentRatio = vaultData.length / totalFiles;
      
      if (contentRatio < 0.1) {
        issueCollector.addConfigWarning({
          setting: 'content.ratio',
          message: `Low content ratio detected: ${Math.round(contentRatio * 100)}% posts vs ${Math.round((1 - contentRatio) * 100)}% media`,
          suggestion: 'Consider adding more written content to balance media files'
        });
        contentWarnings.push('low_content_ratio');
        safeLog(logger, 'warn', `⚠️ Low content ratio: ${Math.round(contentRatio * 100)}% posts`);
      }
    }

    // Check for missing frontmatter fields
    if (vaultData.length > 0) {
      const requiredFields = ['title', 'date', 'description'];
      const frontmatterIssues = vaultData.filter(post => {
        const fm = post.frontmatter || {};
        return requiredFields.some(field => !fm[field]);
      });

      if (frontmatterIssues.length > 0) {
        const percentage = Math.round((frontmatterIssues.length / vaultData.length) * 100);
        const missingFieldsBreakdown = {};
        
        // Count which fields are missing most often
        frontmatterIssues.forEach(post => {
          const fm = post.frontmatter || {};
          requiredFields.forEach(field => {
            if (!fm[field]) {
              missingFieldsBreakdown[field] = (missingFieldsBreakdown[field] || 0) + 1;
            }
          });
        });

        issueCollector.addConfigWarning({
          setting: 'content.frontmatter',
          message: `${frontmatterIssues.length} posts (${percentage}%) missing required frontmatter fields`,
          suggestion: 'Add title, date, and description to all posts for better SEO and user experience',
          context: {
            affectedPosts: frontmatterIssues.slice(0, 5).map(p => p.slug || p.name || 'unknown'),
            totalAffected: frontmatterIssues.length,
            missingFields: missingFieldsBreakdown
          }
        });
        contentWarnings.push('incomplete_frontmatter');
        safeLog(logger, 'warn', `⚠️ ${frontmatterIssues.length} posts missing required frontmatter fields`);
      }

      // Check for posts with very short content
      const shortPosts = vaultData.filter(post => {
        const content = post.plain || post.content || '';
        return content.length < 100; // Less than 100 characters is very short
      });

      if (shortPosts.length > 0) {
        const percentage = Math.round((shortPosts.length / vaultData.length) * 100);
        issueCollector.addConfigWarning({
          setting: 'content.length',
          message: `${shortPosts.length} posts (${percentage}%) have very short content (<100 characters)`,
          suggestion: 'Consider expanding these posts with more detailed content',
          context: {
            affectedPosts: shortPosts.slice(0, 5).map(p => ({
              slug: p.slug || p.name || 'unknown',
              length: (p.plain || p.content || '').length
            })),
            totalAffected: shortPosts.length
          }
        });
        contentWarnings.push('short_content');
        safeLog(logger, 'warn', `⚠️ ${shortPosts.length} posts have very short content`);
      }
    }

    // Check for orphaned media (media not referenced in any posts)
    if (mediaData.length > 0 && vaultData.length > 0) {
      const usedMediaPaths = new Set();
      const usedMediaHashes = new Set();
      
      // Collect all media references from posts
      vaultData.forEach(post => {
        // Extract from content
        const contentRefs = extractMediaReferences(post.content || '');
        const plainRefs = extractMediaReferences(post.plain || '');
        
        [...contentRefs, ...plainRefs].forEach(ref => {
          // Normalize the reference path
          const normalizedRef = ref.replace(/^\.\//, '').replace(/^\//, '');
          usedMediaPaths.add(normalizedRef);
          
          // Also add just the filename in case of path variations
          const filename = path.basename(ref);
          usedMediaPaths.add(filename);
        });
        
        // Also check if posts have direct media relationships
        if (post.linkedMedia && Array.isArray(post.linkedMedia)) {
          post.linkedMedia.forEach(media => {
            if (media.hash) usedMediaHashes.add(media.hash);
            if (media.path) usedMediaPaths.add(media.path);
            if (media.fileName) usedMediaPaths.add(media.fileName);
          });
        }
      });
      
      // Find orphaned media
      const orphanedMedia = mediaData.filter(media => {
        // Check various ways the media might be referenced
        const isUsed = 
          (media.hash && usedMediaHashes.has(media.hash)) ||
          (media.fileName && usedMediaPaths.has(media.fileName)) ||
          (media.originalPath && usedMediaPaths.has(media.originalPath)) ||
          (media.originalPath && usedMediaPaths.has(path.basename(media.originalPath)));
          
        return !isUsed;
      });
      
      if (orphanedMedia.length > 0) {
        const percentage = Math.round((orphanedMedia.length / mediaData.length) * 100);
        issueCollector.addConfigWarning({
          setting: 'content.orphaned_media',
          message: `${orphanedMedia.length} media files (${percentage}%) not referenced in any posts`,
          suggestion: 'Consider removing unused media files or creating content that uses them',
          context: {
            orphanedFiles: orphanedMedia.slice(0, 5).map(m => m.fileName || m.originalPath || 'unknown'),
            totalOrphaned: orphanedMedia.length,
            totalMedia: mediaData.length
          }
        });
        contentWarnings.push('orphaned_media');
        safeLog(logger, 'warn', `⚠️ ${orphanedMedia.length} orphaned media files detected`);
      }
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
      contentHealth: {
        warnings: contentWarnings,
        metrics: {
          postCount: vaultData.length,
          mediaCount: mediaData.length,
          contentRatio: vaultData.length > 0 && mediaData.length > 0 
            ? vaultData.length / (vaultData.length + mediaData.length) 
            : vaultData.length > 0 ? 1 : 0
        }
      }
    };

    // Generate embeddings for all posts
    if (logger) {
      logger.log("📊 Computing embeddings for posts...");
    } else {
      console.log("📊 Computing embeddings for posts...");
    }

    // Check for previous revision embeddings
    let existingPostEmbeddings = null;
    let existingMediaEmbeddings = null;
    
    if (data.previousRev) {
      try {
        // Attempt to load previous embeddings from R2
        existingPostEmbeddings = await loadPreviousEmbeddings(
          data.previousRev, 
          'posts-embedding-hash-map.json',
          logger || console
        );
        existingMediaEmbeddings = await loadPreviousEmbeddings(
          data.previousRev,
          'media-embedding-hash-map.json',
          logger || console
        );
        
        if (logger) {
          logger.log(`♻️ Loaded embeddings from previous revision: ${data.previousRev}`);
        }
      } catch (error) {
        if (logger) {
          safeLog(logger, 'warn', 'Could not load previous embeddings, will recompute all', error);
        }
      }
    }

    // Pass posts array directly to embedding function
    const posts = vaultData;
    if (logger) {
      logger.log(`🔍 Found ${posts.length} posts for embeddings generation`);
    } else {
      console.log(`🔍 Found ${posts.length} posts for embeddings generation`);
    }

    // Generate embeddings for posts with potential reuse
    // Check if embeddings should be skipped (useful for CF Workers deployment)
    const skipEmbeddings = process.env.SKIP_EMBEDDINGS === 'true' || data.skipEmbeddings === true;
    let embeddingsResult;

    if (skipEmbeddings) {
      safeLog(logger, 'log', '⏭️ Skipping post embeddings generation (SKIP_EMBEDDINGS=true)');
      embeddingsResult = {
        slugMap: {},
        hashMap: {},
        titleMap: {},
        filesProcessed: 0,
        filesReused: 0,
        error: null,
      };
    } else {
      embeddingsResult = await computePostEmbeddings(posts, existingPostEmbeddings);
    }

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
      // Try to generate embeddings for media files with potential reuse
      // Check if embeddings should be skipped (useful for CF Workers deployment)
      if (skipEmbeddings) {
        safeLog(logger, 'log', '⏭️ Skipping image embeddings generation (SKIP_EMBEDDINGS=true)');
        imageEmbeddingsResult = {
          hashMap: {},
          pathMap: {},
          filesProcessed: 0,
          filesReused: 0,
          error: null,
        };
      } else {
        imageEmbeddingsResult = await computeImageEmbeddings(media, existingMediaEmbeddings);
      }

      // Check if we have any embeddings
      if (
        !imageEmbeddingsResult.hashMap ||
        Object.keys(imageEmbeddingsResult.hashMap).length === 0
      ) {
        console.error("❌ No image embeddings were generated to save!");
        if (logger) {
          logger.error("❌ No image embeddings were generated to save!");
        }
        issueCollector.addEmbeddingError({
          type: 'image',
          filePath: distFolder,
          error: new Error('No image embeddings were generated'),
          operation: 'generate'
        });
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
      console.error(
        `❌ Failed to generate image embeddings: ${embeddingError.message}`
      );
      console.error("Stack trace:", embeddingError.stack);
      if (logger) {
        logger.error(
          `❌ Failed to generate image embeddings: ${embeddingError.message}`
        );
        logger.error("Stack trace:", embeddingError.stack);
      }
      
      // Add to issue collector
      issueCollector.addEmbeddingError({
        type: 'image',
        filePath: distFolder,
        error: embeddingError,
        operation: 'generate'
      });

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
          error: embeddingError.message,
        },
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
        issueCollector.addFileSystemError({
          operation: 'verify',
          path: mediaHashOutputPath,
          error: new Error(`File size too small: ${stats.size} bytes`)
        });
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
      issueCollector.addFileSystemError({
        operation: 'verify',
        path: mediaHashOutputPath,
        error
      });
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

    // Scan frontmatter schema
    if (logger) {
      logger.log("📊 Scanning frontmatter schema...");
    } else {
      console.log("📊 Scanning frontmatter schema...");
    }
    // Ensure tempDir is set for schema scanner
    const schemaData = {
      ...resultWithVectra,
      tempDir: data.tempDir || data.tempFolderPath || path.dirname(distFolder),
      issueReporter: issueCollector
    };
    console.log('📊 Passing to scanFrontmatterSchema:', {
      tempDir: schemaData.tempDir,
      distFolder: schemaData.assets?.distFolder
    });
    const resultWithSchema = await scanFrontmatterSchema(schemaData);

    // Build the SQLite database
    if (logger) {
      logger.log("🗃️ Building SQLite database...");
    } else {
      console.log("🗃️ Building SQLite database...");
    }
    const resultWithSqlite = await buildSqliteDatabase(resultWithSchema);

    // Generate REPO.json from REPO.md if it exists (before file summaries)
    if (logger) {
      logger.log("🤖 Generating REPO.json from REPO.md...");
    } else {
      console.log("🤖 Generating REPO.json from REPO.md...");
    }
    const repoJsonResult = await generateRepoJson(repoPath, distFolder, logger);

    // Generate file summaries for source and dist directories (after REPO.json)
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
      inputPath, // Use inputPath (which may be a subfolder if repositoryFolder is set)
      distFolder,
      logger
    );

    // Check if processor generated issues file
    let processorIssuesPath = null;
    try {
      const processorIssuesFile = path.join(distFolder, "processor-issues.json");
      await fs.access(processorIssuesFile);
      processorIssuesPath = processorIssuesFile;
      if (logger) {
        logger.log("✅ Found processor-issues.json from repo-processor");
      }
    } catch (error) {
      // File doesn't exist, which is fine
      if (logger) {
        logger.log("ℹ️ No processor-issues.json found from repo-processor");
      }
    }
    
    // Generate worker issues report
    const workerIssuesReport = issueCollector.generateReport();
    const workerIssuesPath = await saveJson(
      distFolder,
      "worker-issues.json",
      workerIssuesReport,
      logger
    );
    
    if (logger) {
      logger.log(issueCollector.getSummaryString());
    } else {
      console.log(issueCollector.getSummaryString());
    }

    // Add file summaries, REPO.json result, and issue reports to the final result
    const finalResult = {
      ...resultWithSqlite,
      fileSummaries,
      repoJson: repoJsonResult,
      issues: {
        processorIssuesPath,
        workerIssuesPath,
        workerIssuesSummary: workerIssuesReport.summary
      }
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
    
    // Add the fatal error to issue collector
    issueCollector.addIssue({
      severity: 'error',
      category: 'build-error',
      module: 'build-assets',
      message: `Failed to build assets: ${error.message}`,
      context: {
        jobId: data.jobId,
        errorMessage: error.message,
        errorStack: error.stack
      }
    });
    
    // Still try to save the worker issues report even on failure
    try {
      const workerIssuesReport = issueCollector.generateReport();
      await saveJson(
        data.repoInfo.distPath || path.join(path.dirname(data.repoInfo.path), "dist"),
        "worker-issues.json",
        workerIssuesReport,
        logger
      );
    } catch (saveError) {
      console.error("Failed to save worker issues on error:", saveError);
    }
    
    throw error;
  }
}

export default buildAssets;

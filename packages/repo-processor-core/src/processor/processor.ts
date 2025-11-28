/**
 * Core Processor
 *
 * Main processor class that orchestrates markdown processing with plugins.
 * This is the primary entry point for processing Obsidian vaults.
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import type { ProcessConfig } from '../types/config.js';
import type { ProcessedPost, ProcessedMedia, ProcessResult, MediaSizeVariant, PostCover, PostCoverError } from '../types/output.js';
import type { CacheStats, CachedMediaMetadata } from '../types/cache.js';
import { createEmptyCacheStats } from '../types/cache.js';
import type { LogLevel, PluginContext } from '../plugins/types.js';
import { PluginManager } from '../plugins/manager.js';
import { IssueCollector } from '../services/issueCollector.js';
import {
  processMarkdown,
  extractFirstParagraph,
  extractHeadings,
  buildToc,
  mdastToText,
} from '../markdown/pipeline.js';
import { countWords } from '../markdown/wordCount.js';
import { hashContent, hashBuffer } from '../utils/hash.js';
import { SlugManager } from '../utils/slug.js';
import {
  findMarkdownFiles,
  getFileName,
  ensureDir,
  writeJson,
  readText,
  getStats,
  normalizePath,
} from '../utils/file.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for creating a processor
 */
export interface ProcessorOptions {
  readonly config: ProcessConfig;
  readonly log?: (message: string, level?: LogLevel) => void;
}

/**
 * Internal state during processing
 */
interface ProcessingState {
  readonly inputDir: string;
  readonly outputDir: string;
  readonly posts: ProcessedPost[];
  readonly media: ProcessedMedia[];
  readonly slugManager: SlugManager;
  readonly issues: IssueCollector;
  /** Maps original media paths to processed media info */
  readonly mediaPathMap: Map<string, ProcessedMedia>;
  /** Cache statistics for tracking cache hits/misses */
  readonly cacheStats: {
    mediaCacheHits: number;
    mediaCacheMisses: number;
    textEmbeddingCacheHits: number;
    textEmbeddingCacheMisses: number;
    imageEmbeddingCacheHits: number;
    imageEmbeddingCacheMisses: number;
  };
}

// ============================================================================
// Default Logger
// ============================================================================

const createDefaultLogger = (debugLevel: number) => {
  return (message: string, level: LogLevel = 'info') => {
    const levelNum =
      level === 'debug' ? 3 : level === 'info' ? 2 : level === 'warn' ? 1 : 0;

    if (levelNum <= debugLevel) {
      const prefix = '[processor-core]';
      switch (level) {
        case 'error':
          console.error(`${prefix} ERROR: ${message}`);
          break;
        case 'warn':
          console.warn(`${prefix} WARN: ${message}`);
          break;
        case 'debug':
          console.log(`${prefix} DEBUG: ${message}`);
          break;
        default:
          console.log(`${prefix} ${message}`);
      }
    }
  };
};

// ============================================================================
// Processor Class
// ============================================================================

/**
 * Core Processor for Obsidian vaults
 *
 * Processes markdown files and media, generating structured JSON output.
 * Uses a plugin architecture for extensibility.
 */
export class Processor {
  private readonly config: ProcessConfig;
  private readonly pluginManager: PluginManager;
  private readonly issues: IssueCollector;
  private readonly log: (message: string, level?: LogLevel) => void;
  private initialized = false;

  constructor(options: ProcessorOptions) {
    this.config = options.config;
    this.issues = new IssueCollector();
    this.log = options.log ?? createDefaultLogger(this.config.debug?.level ?? 1);

    this.pluginManager = new PluginManager({
      config: this.config,
      outputDir: this.resolveOutputDir(),
      issues: this.issues,
      log: this.log,
    });
  }

  // --------------------------------------------------------------------------
  // Initialization
  // --------------------------------------------------------------------------

  /**
   * Initialize the processor and plugins
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.log('Initializing processor...', 'info');

    // Initialize plugins
    await this.pluginManager.initialize();

    this.initialized = true;
    this.log('Processor initialized', 'info');
  }

  /**
   * Dispose the processor and cleanup resources
   */
  async dispose(): Promise<void> {
    await this.pluginManager.dispose();
    this.initialized = false;
  }

  // --------------------------------------------------------------------------
  // Path Resolution
  // --------------------------------------------------------------------------

  private resolveInputDir(): string {
    const base = this.config.dir.base ?? process.cwd();
    return path.resolve(base, this.config.dir.input);
  }

  private resolveOutputDir(): string {
    const base = this.config.dir.base ?? process.cwd();
    return path.resolve(base, this.config.dir.output ?? 'build');
  }

  // --------------------------------------------------------------------------
  // Processing
  // --------------------------------------------------------------------------

  /**
   * Process the vault and generate output
   */
  async process(): Promise<ProcessResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    const inputDir = this.resolveInputDir();
    const outputDir = this.resolveOutputDir();

    this.log(`Processing vault: ${inputDir}`, 'info');
    this.log(`Output directory: ${outputDir}`, 'info');

    // Ensure output directory exists
    await ensureDir(outputDir);

    // Create processing state
    const state: ProcessingState = {
      inputDir,
      outputDir,
      posts: [],
      media: [],
      slugManager: new SlugManager('number'),
      issues: this.issues,
      mediaPathMap: new Map(),
      cacheStats: {
        mediaCacheHits: 0,
        mediaCacheMisses: 0,
        textEmbeddingCacheHits: 0,
        textEmbeddingCacheMisses: 0,
        imageEmbeddingCacheHits: 0,
        imageEmbeddingCacheMisses: 0,
      },
    };

    // Step 1: Process media files (if not skipped)
    if (!this.config.media?.skip) {
      await this.processMedia(state);
    } else {
      this.log('Skipping media processing', 'info');
    }

    // Step 2: Process markdown files
    await this.processMarkdownFiles(state);

    // Step 3: Generate embeddings (if plugin available)
    await this.generateEmbeddings(state);

    // Step 4: Generate similarity data (if plugin available)
    await this.generateSimilarity(state);

    // Step 5: Build database (if plugin available)
    await this.buildDatabase(state);

    // Step 6: Write output files
    const outputFiles = await this.writeOutput(state);

    // Generate final report
    const issueReport = this.issues.generateReport();
    this.log(this.issues.getSummaryString(), 'info');

    // Build cache stats if cache was used
    const hasCacheActivity =
      state.cacheStats.mediaCacheHits > 0 ||
      state.cacheStats.mediaCacheMisses > 0 ||
      state.cacheStats.textEmbeddingCacheHits > 0 ||
      state.cacheStats.imageEmbeddingCacheHits > 0;

    if (hasCacheActivity) {
      this.log(
        `Cache stats: media ${state.cacheStats.mediaCacheHits}/${state.cacheStats.mediaCacheHits + state.cacheStats.mediaCacheMisses} hits, ` +
        `text embeddings ${state.cacheStats.textEmbeddingCacheHits}/${state.cacheStats.textEmbeddingCacheHits + state.cacheStats.textEmbeddingCacheMisses} hits, ` +
        `image embeddings ${state.cacheStats.imageEmbeddingCacheHits}/${state.cacheStats.imageEmbeddingCacheHits + state.cacheStats.imageEmbeddingCacheMisses} hits`,
        'info'
      );
    }

    return {
      posts: state.posts,
      media: state.media,
      outputDir,
      outputFiles,
      issues: issueReport,
      cacheStats: this.config.cache ? state.cacheStats : undefined,
    };
  }

  // --------------------------------------------------------------------------
  // Media Processing
  // --------------------------------------------------------------------------

  private async processMedia(state: ProcessingState): Promise<void> {
    this.log('Processing media files...', 'info');

    const imageProcessor = this.pluginManager.getPluginByKey('imageProcessor');
    if (!imageProcessor) {
      this.log('No image processor plugin, skipping media optimization', 'debug');
      return;
    }

    // Find media files in input directory
    const mediaExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.svg'];
    const mediaFiles: string[] = [];

    const findMedia = async (dir: string) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await findMedia(fullPath);
        } else if (
          entry.isFile() &&
          mediaExtensions.some((ext) => entry.name.toLowerCase().endsWith(ext))
        ) {
          mediaFiles.push(fullPath);
        }
      }
    };

    await findMedia(state.inputDir);
    this.log(`Found ${mediaFiles.length} media files`, 'info');

    // Process each media file
    // Use dir.mediaOutput config (default: '_media')
    const mediaOutputDir = path.join(state.outputDir, this.config.dir.mediaOutput ?? '_media');
    await ensureDir(mediaOutputDir);

    // Get image config
    const imageSizes = this.config.media?.sizes ?? [];
    const imageFormat = this.config.media?.format ?? 'webp';
    const imageQuality = this.config.media?.quality ?? 80;
    const useHash = this.config.media?.useHash ?? true;
    const useSharding = this.config.media?.useSharding ?? false;

    for (const mediaPath of mediaFiles) {
      try {
        const relativePath = normalizePath(path.relative(state.inputDir, mediaPath));
        const fileName = path.basename(mediaPath);

        // Read file content for hashing
        const fileBuffer = await fs.readFile(mediaPath);
        const contentHash = hashBuffer(fileBuffer);
        const shortContentHash = contentHash.substring(0, 16); // Use first 16 chars for filename

        // Check cache for this media file
        const mediaCache = this.config.cache?.media;
        const cachedMedia = mediaCache?.get(contentHash);

        if (cachedMedia) {
          // Cache hit! Use cached metadata instead of processing
          state.cacheStats.mediaCacheHits++;
          this.log(`Cache hit for ${fileName} (${contentHash.substring(0, 8)}...)`, 'debug');

          const processedMedia: ProcessedMedia = {
            originalPath: relativePath,
            outputPath: cachedMedia.outputPath,
            fileName,
            type: 'image',
            metadata: {
              width: cachedMedia.width,
              height: cachedMedia.height,
              format: cachedMedia.format,
              size: cachedMedia.size,
              originalSize: cachedMedia.originalSize,
              hash: contentHash,
            },
            sizes: cachedMedia.sizes.length > 0 ? cachedMedia.sizes.map(s => ({
              suffix: s.suffix,
              outputPath: s.outputPath,
              width: s.width,
              height: s.height,
              size: s.size,
            })) : undefined,
          };

          state.media.push(processedMedia);
          state.mediaPathMap.set(relativePath, processedMedia);
          continue; // Skip to next file - no need to process
        }

        // Cache miss - need to process this file
        state.cacheStats.mediaCacheMisses++;

        // Determine output filename based on useHash config
        let outputFileName: string;
        let outputSubDir = mediaOutputDir;

        if (useHash) {
          outputFileName = `${shortContentHash}.${imageFormat}`;

          // Apply sharding if enabled (first 2 chars as subdirectory)
          if (useSharding) {
            const shardDir = contentHash.substring(0, 2);
            outputSubDir = path.join(mediaOutputDir, shardDir);
            await ensureDir(outputSubDir);
          }
        } else {
          // Use original filename (legacy behavior)
          const fileNameWithoutExt = path.basename(mediaPath, path.extname(mediaPath));
          outputFileName = `${fileNameWithoutExt}.${imageFormat}`;
        }

        const outputPath = path.join(outputSubDir, outputFileName);

        // Get original stats
        const stats = await getStats(mediaPath);

        // Process with plugin
        if (imageProcessor.canProcess(mediaPath)) {
          // Get original dimensions first
          const metadata = await imageProcessor.getMetadata(mediaPath);
          const originalWidth = metadata.width;

          // Process the main (full-size) image
          const result = await imageProcessor.process(mediaPath, outputPath, {
            format: imageFormat,
            quality: imageQuality,
          });

          // Generate thumbnails for each configured size
          const sizeVariants: MediaSizeVariant[] = [];

          for (const sizeConfig of imageSizes) {
            // Skip if no width specified or if width is larger than original (no upscaling)
            if (sizeConfig.width === null || sizeConfig.width >= originalWidth) {
              continue;
            }

            try {
              // Use hash-based naming for thumbnails too
              let sizeOutputFileName: string;
              if (useHash) {
                sizeOutputFileName = `${shortContentHash}-${sizeConfig.suffix}.${imageFormat}`;
              } else {
                const fileNameWithoutExt = path.basename(mediaPath, path.extname(mediaPath));
                sizeOutputFileName = `${fileNameWithoutExt}-${sizeConfig.suffix}.${imageFormat}`;
              }

              const sizeOutputPath = path.join(outputSubDir, sizeOutputFileName);

              const sizeResult = await imageProcessor.process(mediaPath, sizeOutputPath, {
                width: sizeConfig.width,
                height: sizeConfig.height ?? undefined,
                format: imageFormat,
                quality: imageQuality,
              });

              sizeVariants.push({
                suffix: sizeConfig.suffix,
                outputPath: normalizePath(path.relative(state.outputDir, sizeResult.outputPath)),
                width: sizeResult.width,
                height: sizeResult.height,
                size: sizeResult.size,
              });
            } catch (sizeError) {
              const sizeErrorMsg = sizeError instanceof Error ? sizeError.message : String(sizeError);
              this.log(`Failed to generate ${sizeConfig.suffix} size for ${fileName}: ${sizeErrorMsg}`, 'warn');
            }
          }

          const processedMedia: ProcessedMedia = {
            originalPath: relativePath,
            outputPath: normalizePath(path.relative(state.outputDir, result.outputPath)),
            fileName,
            type: 'image',
            metadata: {
              width: result.width,
              height: result.height,
              format: result.format,
              size: result.size,
              originalSize: stats.size,
              hash: contentHash,
            },
            sizes: sizeVariants.length > 0 ? sizeVariants : undefined,
          };
          state.media.push(processedMedia);
          // Add to mediaPathMap for frontmatter rewriting
          state.mediaPathMap.set(relativePath, processedMedia);
        } else {
          // Just copy the file (non-processable files keep original extension)
          const ext = path.extname(mediaPath);
          let copyOutputPath: string;
          if (useHash) {
            const copyFileName = `${shortContentHash}${ext}`;
            copyOutputPath = path.join(outputSubDir, copyFileName);
          } else {
            copyOutputPath = path.join(outputSubDir, fileName);
          }

          await imageProcessor.copy(mediaPath, copyOutputPath);

          const copiedMedia: ProcessedMedia = {
            originalPath: relativePath,
            outputPath: normalizePath(path.relative(state.outputDir, copyOutputPath)),
            fileName,
            type: 'media',
            metadata: {
              size: stats.size,
              originalSize: stats.size,
              hash: contentHash,
            },
          };
          state.media.push(copiedMedia);
          // Add to mediaPathMap for frontmatter rewriting
          state.mediaPathMap.set(relativePath, copiedMedia);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.issues.addMediaProcessingError({
          filePath: mediaPath,
          mediaPath,
          operation: 'read',
          errorMessage,
        });
      }
    }

    this.log(`Processed ${state.media.length} media files`, 'info');
  }

  // --------------------------------------------------------------------------
  // Markdown Processing
  // --------------------------------------------------------------------------

  private async processMarkdownFiles(state: ProcessingState): Promise<void> {
    this.log('Processing markdown files...', 'info');

    // Find all markdown files
    const mdFiles = await findMarkdownFiles(state.inputDir);
    this.log(`Found ${mdFiles.length} markdown files`, 'info');

    // Parse all files first
    const parsedFiles: Array<{
      filePath: string;
      content: string;
      stats: { created: Date; modified: Date };
    }> = [];

    for (const filePath of mdFiles) {
      try {
        const content = await readText(filePath);
        const stats = await getStats(filePath);
        parsedFiles.push({ filePath, content, stats });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.log(`Failed to read ${filePath}: ${errorMessage}`, 'warn');
      }
    }

    // Process each file
    for (const { filePath, content, stats } of parsedFiles) {
      try {
        const post = await this.processMarkdownFile(state, filePath, content, stats);
        if (post) {
          state.posts.push(post);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.log(`Failed to process ${filePath}: ${errorMessage}`, 'error');
      }
    }

    this.log(`Processed ${state.posts.length} posts`, 'info');
  }

  private async processMarkdownFile(
    state: ProcessingState,
    filePath: string,
    content: string,
    stats: { created: Date; modified: Date }
  ): Promise<ProcessedPost | null> {
    const relativePath = normalizePath(path.relative(state.inputDir, filePath));
    const fileName = getFileName(filePath);

    // Process markdown with pipeline config
    const pipelineConfig = this.config.pipeline ?? {};
    const result = await processMarkdown(content, {
      gfm: pipelineConfig.gfm ?? true,
      allowRawHtml: pipelineConfig.allowRawHtml ?? true,
      // Note: syntaxHighlighting, parseFormulas, removeDeadLinks require
      // additional rehype/remark plugins to be added to the pipeline
    });

    // Skip if not published (unless processAllFiles is enabled)
    const isPublished =
      result.frontmatter.published !== false &&
      result.frontmatter.draft !== true;

    if (!isPublished && !this.config.content?.processAllFiles) {
      this.log(`Skipping unpublished: ${relativePath}`, 'debug');
      return null;
    }

    // Generate slug
    const parentFolder = path.dirname(relativePath);
    const slugInfo = state.slugManager.reserve(filePath, {
      fileName,
      parentFolder: parentFolder !== '.' ? parentFolder : undefined,
      frontmatterSlug: result.frontmatter.slug as string | undefined,
    });

    if (slugInfo.wasModified) {
      this.issues.addSlugConflict({
        filePath: relativePath,
        originalSlug: slugInfo.originalSlug,
        finalSlug: slugInfo.slug,
        conflictingFiles: [],
      });
    }

    // Extract content data
    const plainText = mdastToText(result.mdast);
    const headings = extractHeadings(result.mdast);
    const toc = buildToc(headings);
    const firstParagraph = extractFirstParagraph(result.mdast);
    const wordCount = countWords(plainText);

    // Generate hash
    const hash = hashContent(content);

    // Determine title
    const title =
      (result.frontmatter.title as string) ||
      (headings.length > 0 && headings[0]!.depth === 1
        ? headings[0]!.text
        : fileName);

    // Resolve cover image from frontmatter
    const cover = this.resolveCover(
      result.frontmatter,
      relativePath,
      state.mediaPathMap
    );

    // Build the post object
    const post: ProcessedPost = {
      hash,
      slug: slugInfo.slug,
      fileName,
      title,
      content: result.html,
      markdown: result.markdown,
      frontmatter: result.frontmatter,
      plainText,
      excerpt: firstParagraph,
      wordCount,
      toc,
      originalPath: relativePath,
      metadata: {
        createdAt: stats.created.toISOString(),
        modifiedAt: stats.modified.toISOString(),
        processedAt: new Date().toISOString(),
      },
    };

    // Add cover if present (either resolved or error)
    if (cover) {
      (post as any).cover = cover;
    }

    return post;
  }

  /**
   * Build absolute URL from relative path using domain config
   * URL structure: {domain}/_shared/medias/{filename}
   */
  private buildAbsoluteUrl(relativePath: string): string | undefined {
    const domain = this.config.media?.domain;
    if (!domain) {
      return undefined;
    }

    // Get the filename from the path (e.g., "_media/abc123.webp" -> "abc123.webp")
    const filename = relativePath.split('/').pop();
    if (!filename) {
      return undefined;
    }

    // Build URL: domain + /_shared/medias/ + filename
    const baseUrl = domain.replace(/\/$/, ''); // Remove trailing slash

    return `${baseUrl}/_shared/medias/${filename}`;
  }

  /**
   * Resolve cover image from frontmatter
   * Returns PostCover if found, PostCoverError if specified but not found, undefined if not specified
   */
  private resolveCover(
    frontmatter: Readonly<Record<string, unknown>>,
    postPath: string,
    mediaPathMap: Map<string, ProcessedMedia>
  ): PostCover | PostCoverError | undefined {
    // Check for cover in frontmatter (support multiple field names)
    const coverFields = ['cover', 'image', 'thumbnail', 'coverImage', 'cover_image'];
    let coverValue: string | undefined;

    for (const field of coverFields) {
      const value = frontmatter[field];
      if (typeof value === 'string' && value.length > 0) {
        coverValue = value;
        break;
      }
    }

    // No cover specified in frontmatter
    if (!coverValue) {
      return undefined;
    }

    const postDir = path.dirname(postPath);

    // Try multiple path resolution strategies:
    // 1. First try the value as-is (path relative to input root, e.g., "media/image.jpg")
    // 2. Then try relative to post's directory (e.g., "../media/image.jpg" from posts/)
    // 3. Then try with leading slash removed
    const pathsToTry = [
      normalizePath(coverValue), // Direct path from root
      normalizePath(path.join(postDir, coverValue)), // Relative to post directory
      normalizePath(coverValue.replace(/^\//, '')), // Remove leading slash if present
    ];

    let mediaInfo: ProcessedMedia | undefined;
    for (const tryPath of pathsToTry) {
      mediaInfo = mediaPathMap.get(tryPath);
      if (mediaInfo) {
        break;
      }
    }

    // Cover specified but image not found
    if (!mediaInfo) {
      this.log(`Cover image not found for "${postPath}": "${coverValue}"`, 'warn');
      return {
        original: coverValue,
        error: `Cover image not found: "${coverValue}"`,
      };
    }

    // Successfully resolved cover - build with absolute URLs if domain configured
    const cover: PostCover = {
      original: coverValue,
      path: mediaInfo.outputPath,
      url: this.buildAbsoluteUrl(mediaInfo.outputPath),
      hash: mediaInfo.metadata?.hash,
      width: mediaInfo.metadata?.width,
      height: mediaInfo.metadata?.height,
      sizes: mediaInfo.sizes?.map((s) => ({
        suffix: s.suffix,
        path: s.outputPath,
        url: this.buildAbsoluteUrl(s.outputPath),
        width: s.width,
        height: s.height,
      })),
    };

    return cover;
  }

  // --------------------------------------------------------------------------
  // Embeddings
  // --------------------------------------------------------------------------

  private async generateEmbeddings(state: ProcessingState): Promise<void> {
    const textEmbedder = this.pluginManager.getPluginByKey('textEmbedder');
    if (!textEmbedder || textEmbedder.dimensions === 0) {
      this.log('No text embedder plugin, skipping embeddings', 'debug');
      return;
    }

    this.log('Generating text embeddings...', 'info');

    // Check cache for text embeddings
    const textEmbeddingsCache = this.config.cache?.textEmbeddings;

    try {
      // Separate posts into cached and uncached
      const uncachedPosts: Array<{ index: number; text: string }> = [];
      const cachedCount = { hits: 0, misses: 0 };

      for (let i = 0; i < state.posts.length; i++) {
        const post = state.posts[i];
        if (!post) continue;

        const cachedEmbedding = textEmbeddingsCache?.get(post.hash);
        if (cachedEmbedding) {
          // Cache hit - use cached embedding
          (post as any).embedding = cachedEmbedding;
          cachedCount.hits++;
          state.cacheStats.textEmbeddingCacheHits++;
        } else {
          // Cache miss - need to generate
          uncachedPosts.push({ index: i, text: post.plainText });
          cachedCount.misses++;
          state.cacheStats.textEmbeddingCacheMisses++;
        }
      }

      // Generate embeddings only for uncached posts
      if (uncachedPosts.length > 0) {
        const texts = uncachedPosts.map((p) => p.text);
        const embeddings = await textEmbedder.batchEmbed(texts);

        // Attach embeddings to posts
        for (let i = 0; i < uncachedPosts.length; i++) {
          const postInfo = uncachedPosts[i];
          if (!postInfo) continue;
          const post = state.posts[postInfo.index];
          if (post && embeddings[i]) {
            (post as any).embedding = embeddings[i];
          }
        }

        this.log(`Generated ${embeddings.length} text embeddings (${cachedCount.hits} from cache)`, 'info');
      } else {
        this.log(`All ${cachedCount.hits} text embeddings loaded from cache`, 'info');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.issues.addEmbeddingError({
        embeddingType: 'text',
        operation: 'batch',
        errorMessage,
      });
    }

    // Generate image embeddings if plugin available
    const imageEmbedder = this.pluginManager.getPluginByKey('imageEmbedder');
    if (imageEmbedder && imageEmbedder.dimensions > 0 && state.media.length > 0) {
      this.log('Generating image embeddings...', 'info');

      // Check cache for image embeddings
      const imageEmbeddingsCache = this.config.cache?.imageEmbeddings;
      let cachedCount = 0;
      let generatedCount = 0;

      for (const media of state.media) {
        if (media.type === 'image') {
          const mediaHash = media.metadata?.hash;

          // Check cache first
          const cachedEmbedding = mediaHash ? imageEmbeddingsCache?.get(mediaHash) : undefined;
          if (cachedEmbedding) {
            // Cache hit - use cached embedding
            (media as any).embedding = cachedEmbedding;
            cachedCount++;
            state.cacheStats.imageEmbeddingCacheHits++;
          } else {
            // Cache miss - generate embedding
            state.cacheStats.imageEmbeddingCacheMisses++;
            try {
              const mediaPath = path.join(state.outputDir, media.outputPath);
              const embedding = await imageEmbedder.embedFile(mediaPath);
              (media as any).embedding = embedding;
              generatedCount++;
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              this.issues.addEmbeddingError({
                filePath: media.originalPath,
                embeddingType: 'image',
                operation: 'embed',
                errorMessage,
              });
            }
          }
        }
      }

      this.log(`Image embeddings: ${generatedCount} generated, ${cachedCount} from cache`, 'info');
    }
  }

  // --------------------------------------------------------------------------
  // Similarity
  // --------------------------------------------------------------------------

  private async generateSimilarity(state: ProcessingState): Promise<void> {
    const similarity = this.pluginManager.getPluginByKey('similarity');
    if (!similarity) {
      this.log('No similarity plugin, skipping similarity computation', 'debug');
      return;
    }

    this.log('Generating similarity data...', 'info');

    try {
      const result = await similarity.generateSimilarityMap(state.posts);

      // Write similarity data
      const similarityPath = path.join(state.outputDir, 'similarity.json');
      await writeJson(similarityPath, {
        pairwiseScores: Object.fromEntries(result.pairwiseScores),
        similarPosts: Object.fromEntries(result.similarPosts),
        metadata: result.metadata,
      });

      this.log(
        `Generated similarity data: ${result.metadata.pairCount} pairs`,
        'info'
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log(`Failed to generate similarity: ${errorMessage}`, 'error');
    }
  }

  // --------------------------------------------------------------------------
  // Database
  // --------------------------------------------------------------------------

  private async buildDatabase(state: ProcessingState): Promise<void> {
    const database = this.pluginManager.getPluginByKey('database');
    if (!database) {
      this.log('No database plugin, skipping database generation', 'debug');
      return;
    }

    this.log('Building database...', 'info');

    try {
      const result = await database.build({
        posts: state.posts,
        media: state.media,
      });

      this.log(
        `Database built: ${result.tables.length} tables, ${result.hasVectorSearch ? 'with' : 'without'} vector search`,
        'info'
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log(`Failed to build database: ${errorMessage}`, 'error');
    }
  }

  // --------------------------------------------------------------------------
  // Output
  // --------------------------------------------------------------------------

  private async writeOutput(
    state: ProcessingState
  ): Promise<ProcessResult['outputFiles']> {
    const { outputDir, posts, media } = state;

    this.log('Writing output files...', 'info');

    // File paths (medias.json plural for client compatibility)
    const postsPath = path.join(outputDir, 'posts.json');
    const mediaPath = path.join(outputDir, 'medias.json');
    const slugMapPath = path.join(outputDir, 'posts-slug-map.json');
    const pathMapPath = path.join(outputDir, 'posts-path-map.json');
    const issuesPath = path.join(outputDir, 'processor-issues.json');

    // Generate maps
    const slugMap: Record<string, string> = {};
    const pathMap: Record<string, string> = {};

    for (const post of posts) {
      slugMap[post.slug] = post.hash;
      pathMap[post.originalPath] = post.hash;
    }

    // Write files
    await Promise.all([
      writeJson(postsPath, posts),
      writeJson(mediaPath, media),
      writeJson(slugMapPath, slugMap),
      writeJson(pathMapPath, pathMap),
      writeJson(issuesPath, this.issues.generateReport()),
    ]);

    this.log(`Output written to ${outputDir}`, 'info');

    return {
      posts: postsPath,
      media: mediaPath,
      slugMap: slugMapPath,
      pathMap: pathMapPath,
      issues: issuesPath,
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create and initialize a processor
 */
export const createProcessor = async (
  config: ProcessConfig
): Promise<Processor> => {
  const processor = new Processor({ config });
  await processor.initialize();
  return processor;
};

/**
 * Process a vault with the given configuration
 * Convenience function that creates, processes, and disposes a processor
 */
export const processVault = async (config: ProcessConfig): Promise<ProcessResult> => {
  const processor = await createProcessor(config);
  try {
    return await processor.process();
  } finally {
    await processor.dispose();
  }
};

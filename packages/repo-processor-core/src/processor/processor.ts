/**
 * Core Processor
 *
 * Main processor class that orchestrates markdown processing with plugins.
 * This is the primary entry point for processing Obsidian vaults.
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import type { ProcessConfig } from '../types/config.js';
import type { ProcessedPost, ProcessedMedia, ProcessResult } from '../types/output.js';
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
import { hashContent } from '../utils/hash.js';
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

    return {
      posts: state.posts,
      media: state.media,
      outputDir,
      outputFiles,
      issues: issueReport,
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
    const mediaOutputDir = path.join(state.outputDir, this.config.media?.outputFolder ?? '_media');
    await ensureDir(mediaOutputDir);

    for (const mediaPath of mediaFiles) {
      try {
        const relativePath = normalizePath(path.relative(state.inputDir, mediaPath));
        const fileName = path.basename(mediaPath);
        const outputPath = path.join(mediaOutputDir, fileName);

        // Get original stats
        const stats = await getStats(mediaPath);

        // Process with plugin
        if (imageProcessor.canProcess(mediaPath)) {
          const result = await imageProcessor.process(mediaPath, outputPath, {
            format: 'webp',
            quality: 80,
          });

          state.media.push({
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
            },
          });
        } else {
          // Just copy the file
          await imageProcessor.copy(mediaPath, outputPath);

          state.media.push({
            originalPath: relativePath,
            outputPath: normalizePath(path.relative(state.outputDir, outputPath)),
            fileName,
            type: 'media',
            metadata: {
              size: stats.size,
              originalSize: stats.size,
            },
          });
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

    // Process markdown
    const result = await processMarkdown(content, {
      gfm: true,
      allowRawHtml: true,
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

    return {
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

    try {
      const texts = state.posts.map((p) => p.plainText);
      const embeddings = await textEmbedder.batchEmbed(texts);

      // Attach embeddings to posts
      for (let i = 0; i < state.posts.length; i++) {
        const post = state.posts[i];
        if (post && embeddings[i]) {
          (post as any).embedding = embeddings[i];
        }
      }

      this.log(`Generated ${embeddings.length} text embeddings`, 'info');
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

      for (const media of state.media) {
        if (media.type === 'image') {
          try {
            const mediaPath = path.join(state.outputDir, media.outputPath);
            const embedding = await imageEmbedder.embedFile(mediaPath);
            (media as any).embedding = embedding;
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

      this.log(`Processed image embeddings for ${state.media.length} files`, 'info');
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

    // File paths
    const postsPath = path.join(outputDir, 'posts.json');
    const mediaPath = path.join(outputDir, 'media.json');
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

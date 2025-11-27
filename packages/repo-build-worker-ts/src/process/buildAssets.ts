/**
 * Build Assets
 *
 * Modern TypeScript implementation using the plugin architecture.
 * This is the main orchestration function that:
 * 1. Configures the processor with plugins
 * 2. Runs processing
 * 3. Returns results
 *
 * All file generation is handled by the processor and its plugins.
 */

import { mkdir, writeFile, stat, readdir } from 'node:fs/promises';
import { join, dirname, parse, relative } from 'node:path';
import {
  Processor,
  IssueCollector,
  type ProcessConfig,
  type ProcessorOptions,
  type ProcessedPost,
  type ProcessedMedia,
  type PluginConfig,
} from '@repo-md/processor-core';
import { SharpImageProcessor } from '@repo-md/plugin-image-sharp';
import { TransformersTextEmbedder } from '@repo-md/plugin-embed-transformers';
import { ClipImageEmbedder } from '@repo-md/plugin-embed-clip';
import { SqliteDatabasePlugin } from '@repo-md/plugin-database-sqlite';
import type { JobData, BuildResult, Logger, ImageSizeSettings, ImageFormatSettings } from '../types/job.js';

// ============================================================================
// Types
// ============================================================================

interface FileSummary {
  readonly path: string;
  readonly filename: string;
  readonly extension: string;
  readonly size: number;
  readonly folder: readonly string[];
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Safe logger wrapper
 */
const safeLog = (
  logger: Logger | undefined,
  level: 'log' | 'warn' | 'error',
  message: string,
  context?: Record<string, unknown>
): void => {
  if (logger && typeof logger[level] === 'function') {
    logger[level](message, context);
  } else if (level === 'warn' || level === 'error') {
    console[level](message, context);
  } else {
    console.log(message, context);
  }
};

/**
 * Save JSON data to file
 */
const saveJson = async (
  distFolder: string,
  filename: string,
  data: unknown,
  logger?: Logger
): Promise<string> => {
  const filePath = join(distFolder, filename);
  await writeFile(filePath, JSON.stringify(data, null, 2));
  safeLog(logger, 'log', `Saved ${filename} to ${filePath}`);
  return filePath;
};

/**
 * Generate directory summary
 */
const generateDirectorySummary = async (directory: string): Promise<readonly FileSummary[]> => {
  const files: FileSummary[] = [];

  const processDirectory = async (dir: string): Promise<void> => {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const relativePath = relative(directory, fullPath);

      if (entry.isDirectory()) {
        await processDirectory(fullPath);
      } else {
        const stats = await stat(fullPath);
        const pathInfo = parse(fullPath);

        files.push({
          path: relativePath,
          filename: entry.name,
          extension: pathInfo.ext.replace('.', ''),
          size: stats.size,
          folder: relativePath.split('/').slice(0, -1),
        });
      }
    }
  };

  await processDirectory(directory);
  return files;
};

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * All available image sizes with their dimensions
 */
const ALL_IMAGE_SIZES = {
  xs: { width: 100, height: null, suffix: 'xs' },
  sm: { width: 300, height: null, suffix: 'sm' },
  md: { width: 700, height: null, suffix: 'md' },
  lg: { width: 1400, height: null, suffix: 'lg' },
  xl: { width: 2160, height: null, suffix: 'xl' },
  '2xl': { width: 3840, height: null, suffix: '2xl' },
} as const;

/**
 * Default image sizes if none specified
 */
const DEFAULT_IMAGE_SIZES = [
  ALL_IMAGE_SIZES.xs,
  ALL_IMAGE_SIZES.sm,
  ALL_IMAGE_SIZES.md,
  ALL_IMAGE_SIZES.lg,
  ALL_IMAGE_SIZES.xl,
] as const;

/**
 * Convert UI image size settings to processor format
 * If all are false/undefined, returns default sizes
 */
const getImageSizesFromSettings = (
  settings?: ImageSizeSettings
): Array<{ width: number; height: null; suffix: string }> => {
  if (!settings) {
    return [...DEFAULT_IMAGE_SIZES];
  }

  const sizes: Array<{ width: number; height: null; suffix: string }> = [];

  if (settings.xs) sizes.push({ ...ALL_IMAGE_SIZES.xs });
  if (settings.sm) sizes.push({ ...ALL_IMAGE_SIZES.sm });
  if (settings.md !== false) sizes.push({ ...ALL_IMAGE_SIZES.md }); // md is always included unless explicitly false
  if (settings.lg) sizes.push({ ...ALL_IMAGE_SIZES.lg });
  if (settings.xl) sizes.push({ ...ALL_IMAGE_SIZES.xl });
  if (settings['2xl']) sizes.push({ ...ALL_IMAGE_SIZES['2xl'] });

  // If no sizes selected, return defaults
  return sizes.length > 0 ? sizes : [...DEFAULT_IMAGE_SIZES];
};

/**
 * Get preferred image format from settings
 * Returns 'webp' by default, 'jpeg' if only jpg is selected
 */
const getImageFormatFromSettings = (settings?: ImageFormatSettings): 'webp' | 'jpeg' => {
  if (!settings) return 'webp';

  // If only jpg is selected (webp is false), use jpeg
  if (settings.jpg && !settings.webp) {
    return 'jpeg';
  }

  // Default to webp (better compression)
  return 'webp';
};

/**
 * Convert UI mermaid render setting to processor strategy
 */
const getMermaidStrategyFromSettings = (
  render?: 'svg' | 'iframe' | 'keep-as-code'
): 'inline-svg' | 'img-svg' | 'pre-mermaid' => {
  switch (render) {
    case 'iframe':
      return 'img-svg'; // iframe maps to img-svg in processor
    case 'keep-as-code':
      return 'pre-mermaid';
    case 'svg':
    default:
      return 'inline-svg';
  }
};

// ============================================================================
// Main Build Function
// ============================================================================

/**
 * Build assets from repository using modern plugin architecture
 *
 * This function orchestrates the entire build process:
 * 1. Configures processor with appropriate plugins
 * 2. Runs the processor (which handles all file generation)
 * 3. Generates additional metadata files
 * 4. Returns comprehensive build results
 */
export const buildAssets = async (data: JobData): Promise<BuildResult> => {
  const { logger, jobId, repoInfo, projectSettings } = data;
  const issueCollector = new IssueCollector();

  safeLog(logger, 'log', 'Building assets...', { jobId });

  // Validate required data
  if (!repoInfo?.path) {
    const error = new Error('Repository path is required in repoInfo');
    safeLog(logger, 'error', error.message);
    throw error;
  }

  // Determine paths
  const repoPath = repoInfo.path;
  const distFolder = repoInfo.distPath ?? join(dirname(repoPath), 'dist');
  const repositoryFolder = data.repositoryFolder ?? '';
  const inputPath = repositoryFolder
    ? join(repoPath, repositoryFolder.replace(/^\/+|\/+$/g, ''))
    : repoPath;

  if (repositoryFolder) {
    safeLog(logger, 'log', `Using repository subfolder: ${repositoryFolder}`);
  }

  try {
    // Create dist folder
    await mkdir(distFolder, { recursive: true });

    // Configure path prefixes (use projectSettings.formatting if available)
    const mediaPrefix = data.mediaPrefix ?? projectSettings?.formatting?.mediaPrefix ?? '/_repo/medias';
    const notePrefix = data.notePrefix ?? projectSettings?.formatting?.pageLinkPrefix ?? '/_repo/notes';
    const domain = data.domain ?? '';
    const skipEmbeddings = process.env.SKIP_EMBEDDINGS === 'true' || data.skipEmbeddings === true;

    // Get media settings from project settings
    const mediaSettings = projectSettings?.media;
    const imageSizes = getImageSizesFromSettings(mediaSettings?.imageSizes);
    const imageFormat = getImageFormatFromSettings(mediaSettings?.imageFormats);
    const imageQuality = mediaSettings?.imageQuality ?? 80;

    // Get mermaid settings
    const mermaidStrategy = getMermaidStrategyFromSettings(mediaSettings?.mermaidRender);
    const mermaidDark = mediaSettings?.mermaidTheme === 'dark';

    safeLog(logger, 'log', 'Configuring processor with plugins...', {
      inputPath,
      distFolder,
      mediaPrefix,
      notePrefix,
      skipEmbeddings,
      imageSizes: imageSizes.map((s) => s.suffix),
      imageFormat,
      imageQuality,
      mermaidStrategy,
      mermaidDark,
    });

    // Build plugin configuration
    const plugins: ProcessConfig['plugins'] = {
      imageProcessor: new SharpImageProcessor(),
    };

    // Add embedding plugins unless skipped
    if (!skipEmbeddings) {
      plugins.textEmbedder = new TransformersTextEmbedder();
      plugins.imageEmbedder = new ClipImageEmbedder();
      plugins.database = new SqliteDatabasePlugin();
    }

    // Configure processor using the correct ProcessConfig structure
    const config: ProcessConfig = {
      dir: {
        input: inputPath,
        output: distFolder,
        mediaOutput: '_media',
        postsOutput: '_posts',
      },
      media: {
        optimize: true,
        skip: false,
        sizes: imageSizes,
        format: imageFormat,
        quality: imageQuality,
        useHash: true,
        useSharding: false,
        pathPrefix: mediaPrefix,
        domain: domain,
      },
      content: {
        notePathPrefix: notePrefix,
        processAllFiles: true,
        exportPosts: true,
      },
      mermaid: {
        enabled: true,
        strategy: mermaidStrategy,
        dark: mermaidDark,
      },
      plugins,
    };

    // Create and run processor
    safeLog(logger, 'log', 'Processing repository content...');
    const processor = new Processor({ config });
    await processor.initialize();
    const result = await processor.process();
    await processor.dispose();

    const { posts, media } = result;

    safeLog(logger, 'log', 'Assets built successfully!', {
      jobId,
      filesProcessed: posts.length,
      mediasProcessed: media.length,
    });

    // Content validation
    const contentWarnings: string[] = [];

    if (posts.length === 0) {
      contentWarnings.push('no_posts');
      safeLog(logger, 'warn', 'No markdown posts found in repository');
    }

    if (media.length === 0) {
      contentWarnings.push('no_media');
      safeLog(logger, 'warn', 'No media files found in repository');
    }

    // Generate file summaries
    safeLog(logger, 'log', 'Generating file summaries...');
    const sourceFiles = await generateDirectorySummary(inputPath);
    const distFiles = await generateDirectorySummary(distFolder);

    const sourceFileSummaryPath = await saveJson(distFolder, 'files-source.json', sourceFiles, logger);
    const distFileSummaryPath = await saveJson(distFolder, 'files-dist.json', distFiles, logger);

    // Save issue report
    const issueReport = issueCollector.generateReport();
    await saveJson(distFolder, 'worker-issues.json', issueReport, logger);

    safeLog(logger, 'log', issueCollector.getSummaryString());

    // Build result
    const buildResult: BuildResult = {
      ...data,
      assets: {
        processed: true,
        distFolder,
        contentPath: join(distFolder, 'posts.json'),
        filesCount: posts.length,
        mediaCount: media.length,
        timestamp: new Date().toISOString(),
      },
      contentHealth: {
        warnings: contentWarnings,
        metrics: {
          postCount: posts.length,
          mediaCount: media.length,
          contentRatio:
            posts.length > 0 && media.length > 0
              ? posts.length / (posts.length + media.length)
              : posts.length > 0
              ? 1
              : 0,
        },
      },
      fileSummaries: {
        sourceFileSummaryPath,
        distFileSummaryPath,
        sourceFileCount: sourceFiles.length,
        distFileCount: distFiles.length,
      },
    };

    // Add embeddings info if plugins were enabled
    if (!skipEmbeddings) {
      (buildResult as any).postEmbeddings = {
        filesProcessed: posts.length,
        filesReused: 0,
        dimension: 384,
        model: 'all-MiniLM-L6-v2',
        hashMapPath: join(distFolder, 'posts-embedding-hash-map.json'),
        slugMapPath: join(distFolder, 'posts-embedding-slug-map.json'),
        similarityMapPath: join(distFolder, 'posts-similarity.json'),
        similarPostsMapPath: join(distFolder, 'posts-similar-hash.json'),
        similarityPairsCount: 0,
      };

      (buildResult as any).mediaEmbeddings = {
        filesProcessed: media.length,
        filesReused: 0,
        dimension: 512,
        model: 'clip-vit-base-patch32',
        hashMapPath: join(distFolder, 'media-embedding-hash-map.json'),
      };

      (buildResult as any).database = {
        path: join(distFolder, 'repo.db'),
        tables: ['posts', 'media', 'embeddings', 'similarity'],
        rowCounts: { posts: posts.length, media: media.length },
      };
    }

    return buildResult;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    safeLog(logger, 'error', 'Failed to build assets', {
      jobId,
      error: errorMessage,
      stack: errorStack,
    });

    throw error;
  }
};

export default buildAssets;

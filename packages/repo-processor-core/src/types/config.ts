/**
 * Configuration types for @repo-md/processor-core
 */

import type { PluginConfig } from '../plugins/types.js';

// ============================================================================
// Image Size Configuration
// ============================================================================

export interface ImageSizeConfig {
  readonly width: number | null;
  readonly height: number | null;
  readonly suffix: string;
}

/** Default image sizes for responsive images */
export const DEFAULT_IMAGE_SIZES: readonly ImageSizeConfig[] = [
  { width: 320, height: null, suffix: 'xs' },
  { width: 640, height: null, suffix: 'sm' },
  { width: 1024, height: null, suffix: 'md' },
  { width: 1920, height: null, suffix: 'lg' },
  { width: 3840, height: null, suffix: 'xl' },
] as const;

// ============================================================================
// Directory Configuration
// ============================================================================

export interface DirectoryConfig {
  /** Base directory for resolving relative paths (default: cwd) */
  readonly base?: string;

  /** Input directory (vault root) */
  readonly input: string;

  /** Output directory for generated files (default: input + '/dist') */
  readonly output?: string;

  /** Media output subdirectory (default: '_media') */
  readonly mediaOutput?: string;

  /** Posts output subdirectory for individual post JSON files */
  readonly postsOutput?: string;
}

// ============================================================================
// Media Configuration
// ============================================================================

export interface MediaConfig {
  /** Skip media processing entirely */
  readonly skip?: boolean;

  /** Whether to optimize images (default: true if imageProcessor plugin available) */
  readonly optimize?: boolean;

  /** Image sizes to generate */
  readonly sizes?: readonly ImageSizeConfig[];

  /** Output format for optimized images (default: 'webp') */
  readonly format?: 'webp' | 'avif' | 'jpeg' | 'png';

  /** Quality for lossy formats (default: 80) */
  readonly quality?: number;

  /** Whether to use content hash for filenames (default: true) */
  readonly useHash?: boolean;

  /** Whether to shard hashed files by first 2 chars (default: false) */
  readonly useSharding?: boolean;

  /** Domain for absolute URLs */
  readonly domain?: string;

  /** Asset path prefix (default: '/_media') */
  readonly pathPrefix?: string;
}

// ============================================================================
// Content Configuration
// ============================================================================

export interface ContentConfig {
  /** URL prefix for notes (default: '/content') */
  readonly notePathPrefix?: string;

  /** Whether to process all files regardless of 'public' frontmatter */
  readonly processAllFiles?: boolean;

  /** Files to ignore during processing */
  readonly ignoreFiles?: readonly string[];

  /** Whether to export individual post JSON files */
  readonly exportPosts?: boolean;

  /** Whether to track relationships between posts */
  readonly trackRelationships?: boolean;

  /** Include slug tracking information in output */
  readonly includeSlugTracking?: boolean;

  /** Strategy for resolving slug conflicts */
  readonly slugConflictStrategy?: 'number' | 'hash';
}

// ============================================================================
// Mermaid Configuration
// ============================================================================

export interface MermaidConfig {
  /** Whether mermaid rendering is enabled (default: true) */
  readonly enabled?: boolean;

  /** Rendering strategy (default: 'inline-svg') */
  readonly strategy?: 'img-png' | 'img-svg' | 'inline-svg' | 'pre-mermaid';

  /** Enable dark mode support */
  readonly dark?: boolean;

  /** Custom mermaid configuration */
  readonly mermaidConfig?: Readonly<Record<string, unknown>>;
}

// ============================================================================
// Debug Configuration
// ============================================================================

export interface DebugConfig {
  /** Debug level (0=off, 1=basic, 2=verbose) */
  readonly level?: number;

  /** Log timing information */
  readonly timing?: boolean;
}

// ============================================================================
// Main Process Configuration
// ============================================================================

export interface ProcessConfig {
  /** Directory configuration */
  readonly dir: DirectoryConfig;

  /** Plugin configuration */
  readonly plugins?: PluginConfig;

  /** Media processing configuration */
  readonly media?: MediaConfig;

  /** Content processing configuration */
  readonly content?: ContentConfig;

  /** Mermaid rendering configuration */
  readonly mermaid?: MermaidConfig;

  /** Debug configuration */
  readonly debug?: DebugConfig;
}

// ============================================================================
// Configuration Helpers
// ============================================================================

/**
 * Merge configuration with defaults
 */
export const withDefaults = (config: ProcessConfig): Required<ProcessConfig> => ({
  dir: config.dir,
  plugins: config.plugins ?? {},
  media: {
    optimize: true,
    sizes: DEFAULT_IMAGE_SIZES,
    format: 'webp',
    quality: 80,
    useHash: true,
    useSharding: false,
    pathPrefix: '/_media',
    ...config.media,
  },
  content: {
    notePathPrefix: '/content',
    processAllFiles: false,
    ignoreFiles: ['CONTRIBUTING.md', 'README.md', 'readme.md', 'LICENSE.md'],
    exportPosts: false,
    trackRelationships: false,
    includeSlugTracking: false,
    slugConflictStrategy: 'number',
    ...config.content,
  },
  mermaid: {
    enabled: true,
    strategy: 'inline-svg',
    dark: false,
    ...config.mermaid,
  },
  debug: {
    level: 0,
    timing: false,
    ...config.debug,
  },
});

/**
 * Get output directory from config
 */
export const getOutputDir = (config: ProcessConfig): string =>
  config.dir.output ?? `${config.dir.input}/dist`;

/**
 * Get media output directory from config
 */
export const getMediaOutputDir = (config: ProcessConfig): string => {
  const outputDir = getOutputDir(config);
  const mediaSubdir = config.dir.mediaOutput ?? '_media';
  return `${outputDir}/${mediaSubdir}`;
};

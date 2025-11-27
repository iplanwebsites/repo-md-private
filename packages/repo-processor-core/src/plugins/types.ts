/**
 * Plugin system types for @repo-md/processor-core
 *
 * Plugins extend the processor with optional functionality like:
 * - Image optimization (Sharp, Jimp, etc.)
 * - Text embeddings (HuggingFace, OpenAI, Cloudflare)
 * - Image embeddings (CLIP)
 * - Database generation (SQLite)
 * - Diagram rendering (Mermaid)
 */

import type { IssueCollector } from '../services/issueCollector.js';
import type { ProcessConfig } from '../types/config.js';
import type { ProcessedPost, ProcessedMedia } from '../types/output.js';

// ============================================================================
// Base Plugin Types
// ============================================================================

/**
 * Context provided to plugins during initialization
 */
export interface PluginContext {
  /** Output directory for generated files */
  readonly outputDir: string;

  /** Issue collector for reporting problems */
  readonly issues: IssueCollector;

  /** Logger function */
  readonly log: (message: string, level?: LogLevel) => void;

  /** Access to other initialized plugins */
  readonly getPlugin: <T extends Plugin>(name: string) => T | undefined;

  /** Current processor configuration */
  readonly config: ProcessConfig;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Base interface for all plugins
 */
export interface Plugin {
  /** Unique plugin identifier */
  readonly name: string;

  /**
   * Names of plugins this plugin depends on.
   * Dependencies are initialized before this plugin.
   */
  readonly requires?: readonly string[];

  /** Initialize the plugin with context */
  initialize(context: PluginContext): Promise<void>;

  /** Check if plugin is ready to use */
  isReady(): boolean;

  /** Optional cleanup method */
  dispose?(): Promise<void>;
}

// ============================================================================
// Image Processor Plugin
// ============================================================================

export interface ImageMetadata {
  readonly width: number;
  readonly height: number;
  readonly format: string;
}

export interface ImageProcessOptions {
  readonly width?: number;
  readonly height?: number;
  readonly format: 'webp' | 'avif' | 'jpeg' | 'png';
  readonly quality?: number;
}

export interface ImageProcessResult {
  readonly outputPath: string;
  readonly width: number;
  readonly height: number;
  readonly format: string;
  readonly size: number;
}

/**
 * Plugin for processing and optimizing images
 */
export interface ImageProcessorPlugin extends Plugin {
  readonly name: 'imageProcessor';

  /** Check if this processor can handle the file type */
  canProcess(filePath: string): boolean;

  /** Get image metadata without processing */
  getMetadata(filePath: string): Promise<ImageMetadata>;

  /** Process/optimize an image */
  process(
    inputPath: string,
    outputPath: string,
    options: ImageProcessOptions
  ): Promise<ImageProcessResult>;

  /** Copy file without processing */
  copy(inputPath: string, outputPath: string): Promise<void>;
}

// ============================================================================
// Text Embedding Plugin
// ============================================================================

/**
 * Plugin for generating text embeddings
 */
export interface TextEmbeddingPlugin extends Plugin {
  readonly name: 'textEmbedder';

  /** Model identifier (e.g., "Xenova/all-MiniLM-L6-v2") */
  readonly model: string;

  /** Embedding vector dimensions */
  readonly dimensions: number;

  /** Generate embedding for a single text */
  embed(text: string): Promise<readonly number[]>;

  /** Generate embeddings for multiple texts */
  batchEmbed(texts: readonly string[]): Promise<readonly (readonly number[])[]>;
}

// ============================================================================
// Image Embedding Plugin
// ============================================================================

/**
 * Plugin for generating image embeddings (e.g., CLIP)
 */
export interface ImageEmbeddingPlugin extends Plugin {
  readonly name: 'imageEmbedder';

  /** Model identifier */
  readonly model: string;

  /** Embedding vector dimensions */
  readonly dimensions: number;

  /** Generate embedding from image file path */
  embedFile(filePath: string): Promise<readonly number[]>;

  /** Generate embedding from image buffer */
  embedBuffer(buffer: Buffer, mimeType: string): Promise<readonly number[]>;
}

// ============================================================================
// Similarity Plugin
// ============================================================================

export interface SimilarityResult {
  /** Map of "hash1-hash2" -> similarity score */
  readonly pairwiseScores: ReadonlyMap<string, number>;

  /** Map of hash -> array of similar hashes (sorted by similarity) */
  readonly similarPosts: ReadonlyMap<string, readonly string[]>;

  /** Metadata about the computation */
  readonly metadata: {
    readonly computedAt: string;
    readonly postCount: number;
    readonly pairCount: number;
  };
}

/**
 * Plugin for computing post similarity
 * Requires: textEmbedder
 */
export interface SimilarityPlugin extends Plugin {
  readonly name: 'similarity';
  readonly requires: readonly ['textEmbedder'];

  /** Compute cosine similarity between two embedding vectors */
  computeSimilarity(a: readonly number[], b: readonly number[]): number;

  /** Generate similarity data for all posts */
  generateSimilarityMap(
    posts: readonly ProcessedPost[]
  ): Promise<SimilarityResult>;
}

// ============================================================================
// Database Plugin
// ============================================================================

export interface DatabaseBuildInput {
  readonly posts: readonly ProcessedPost[];
  readonly media: readonly ProcessedMedia[];
  readonly embeddings?: ReadonlyMap<string, readonly number[]>;
  readonly imageEmbeddings?: ReadonlyMap<string, readonly number[]>;
}

export interface DatabaseResult {
  readonly databasePath: string;
  readonly tables: readonly string[];
  readonly rowCounts: Readonly<Record<string, number>>;
  readonly hasVectorSearch: boolean;
}

/**
 * Plugin for building a database from processed content
 */
export interface DatabasePlugin extends Plugin {
  readonly name: 'database';

  /** Build database from processed data */
  build(input: DatabaseBuildInput): Promise<DatabaseResult>;
}

// ============================================================================
// Mermaid Renderer Plugin
// ============================================================================

export type MermaidStrategy = 'img-png' | 'img-svg' | 'inline-svg' | 'pre-mermaid';

export interface MermaidRenderOptions {
  readonly strategy: MermaidStrategy;
  readonly dark?: boolean;
}

export interface MermaidResult {
  /** Rendered output (SVG string, base64 PNG, or original code) */
  readonly output: string;
  /** Strategy that was actually used */
  readonly strategy: MermaidStrategy;
}

/**
 * Plugin for rendering Mermaid diagrams
 */
export interface MermaidRendererPlugin extends Plugin {
  readonly name: 'mermaidRenderer';

  /** Render mermaid code to specified format */
  render(code: string, options: MermaidRenderOptions): Promise<MermaidResult>;

  /** Check if renderer is available (e.g., has browser) */
  isAvailable(): Promise<boolean>;
}

// ============================================================================
// Plugin Configuration Map
// ============================================================================

/**
 * Type-safe plugin configuration for ProcessConfig
 */
export interface PluginConfig {
  /** Image processor plugin */
  imageProcessor?: ImageProcessorPlugin;

  /** Text embedding plugin */
  textEmbedder?: TextEmbeddingPlugin;

  /** Image embedding plugin */
  imageEmbedder?: ImageEmbeddingPlugin;

  /** Similarity computation plugin */
  similarity?: SimilarityPlugin;

  /** Database generation plugin */
  database?: DatabasePlugin;

  /** Mermaid rendering plugin */
  mermaidRenderer?: MermaidRendererPlugin;
}

/**
 * Union type of all plugin names
 */
export type PluginName = keyof PluginConfig;

/**
 * Get plugin type by name
 */
export type PluginByName<N extends PluginName> = NonNullable<PluginConfig[N]>;

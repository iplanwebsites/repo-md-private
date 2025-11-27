/**
 * Default No-Op Plugins
 *
 * Minimal implementations that allow the processor to work without
 * external dependencies. These are used as fallbacks when plugins
 * aren't configured.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  PluginContext,
  ImageProcessorPlugin,
  ImageMetadata,
  ImageProcessOptions,
  ImageProcessResult,
  MermaidRendererPlugin,
  MermaidRenderOptions,
  MermaidResult,
  TextEmbeddingPlugin,
  ImageEmbeddingPlugin,
  SimilarityPlugin,
  SimilarityResult,
  DatabasePlugin,
  DatabaseBuildInput,
  DatabaseResult,
} from './types.js';
import type { ProcessedPost } from '../types/output.js';

// ============================================================================
// Copy-Only Image Processor
// ============================================================================

/**
 * Minimal image processor that only copies files without optimization.
 * Used when Sharp or similar libraries aren't available.
 */
export class CopyOnlyImageProcessor implements ImageProcessorPlugin {
  readonly name = 'imageProcessor' as const;
  private ready = false;
  private context: PluginContext | null = null;

  async initialize(context: PluginContext): Promise<void> {
    this.context = context;
    this.ready = true;
    context.log('CopyOnlyImageProcessor initialized (no optimization)', 'debug');
  }

  isReady(): boolean {
    return this.ready;
  }

  canProcess(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.svg'].includes(ext);
  }

  async getMetadata(filePath: string): Promise<ImageMetadata> {
    // Without an image library, we can't read actual dimensions
    // Return placeholder values
    const ext = path.extname(filePath).toLowerCase().slice(1);
    return {
      width: 0,
      height: 0,
      format: ext || 'unknown',
    };
  }

  async process(
    inputPath: string,
    outputPath: string,
    _options: ImageProcessOptions
  ): Promise<ImageProcessResult> {
    // Just copy the file without processing
    await this.copy(inputPath, outputPath);

    const stats = await fs.stat(outputPath);
    const ext = path.extname(inputPath).toLowerCase().slice(1);

    return {
      outputPath,
      width: 0,
      height: 0,
      format: ext || 'unknown',
      size: stats.size,
    };
  }

  async copy(inputPath: string, outputPath: string): Promise<void> {
    // Ensure output directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.copyFile(inputPath, outputPath);
  }
}

// ============================================================================
// Passthrough Mermaid Renderer
// ============================================================================

/**
 * Mermaid renderer that passes through code as-is.
 * Leaves rendering to the client-side.
 */
export class PassthroughMermaidRenderer implements MermaidRendererPlugin {
  readonly name = 'mermaidRenderer' as const;
  private ready = false;

  async initialize(context: PluginContext): Promise<void> {
    this.ready = true;
    context.log('PassthroughMermaidRenderer initialized (client-side rendering)', 'debug');
  }

  isReady(): boolean {
    return this.ready;
  }

  async isAvailable(): Promise<boolean> {
    // Always available since we don't actually render
    return true;
  }

  async render(code: string, _options: MermaidRenderOptions): Promise<MermaidResult> {
    // Return the mermaid code as-is for client-side rendering
    return {
      output: code,
      strategy: 'pre-mermaid',
    };
  }
}

// ============================================================================
// No-Op Text Embedder
// ============================================================================

/**
 * Text embedder that returns empty embeddings.
 * Used when embedding functionality isn't needed or available.
 */
export class NoOpTextEmbedder implements TextEmbeddingPlugin {
  readonly name = 'textEmbedder' as const;
  readonly model = 'none';
  readonly dimensions = 0;
  private ready = false;

  async initialize(context: PluginContext): Promise<void> {
    this.ready = true;
    context.log('NoOpTextEmbedder initialized (embeddings disabled)', 'debug');
  }

  isReady(): boolean {
    return this.ready;
  }

  async embed(_text: string): Promise<readonly number[]> {
    return [];
  }

  async batchEmbed(texts: readonly string[]): Promise<readonly (readonly number[])[]> {
    return texts.map(() => []);
  }
}

// ============================================================================
// No-Op Image Embedder
// ============================================================================

/**
 * Image embedder that returns empty embeddings.
 * Used when image embedding functionality isn't needed or available.
 */
export class NoOpImageEmbedder implements ImageEmbeddingPlugin {
  readonly name = 'imageEmbedder' as const;
  readonly model = 'none';
  readonly dimensions = 0;
  private ready = false;

  async initialize(context: PluginContext): Promise<void> {
    this.ready = true;
    context.log('NoOpImageEmbedder initialized (image embeddings disabled)', 'debug');
  }

  isReady(): boolean {
    return this.ready;
  }

  async embedFile(_filePath: string): Promise<readonly number[]> {
    return [];
  }

  async embedBuffer(_buffer: Buffer, _mimeType: string): Promise<readonly number[]> {
    return [];
  }
}

// ============================================================================
// No-Op Similarity Plugin
// ============================================================================

/**
 * Similarity plugin that returns empty results.
 * Used when similarity computation isn't needed.
 */
export class NoOpSimilarity implements SimilarityPlugin {
  readonly name = 'similarity' as const;
  readonly requires = ['textEmbedder'] as const;
  private ready = false;

  async initialize(context: PluginContext): Promise<void> {
    this.ready = true;
    context.log('NoOpSimilarity initialized (similarity disabled)', 'debug');
  }

  isReady(): boolean {
    return this.ready;
  }

  computeSimilarity(_a: readonly number[], _b: readonly number[]): number {
    return 0;
  }

  async generateSimilarityMap(posts: readonly ProcessedPost[]): Promise<SimilarityResult> {
    return {
      pairwiseScores: new Map(),
      similarPosts: new Map(),
      metadata: {
        computedAt: new Date().toISOString(),
        postCount: posts.length,
        pairCount: 0,
      },
    };
  }
}

// ============================================================================
// No-Op Database Plugin
// ============================================================================

/**
 * Database plugin that doesn't create a database.
 * Used when database generation isn't needed.
 */
export class NoOpDatabase implements DatabasePlugin {
  readonly name = 'database' as const;
  private ready = false;

  async initialize(context: PluginContext): Promise<void> {
    this.ready = true;
    context.log('NoOpDatabase initialized (database generation disabled)', 'debug');
  }

  isReady(): boolean {
    return this.ready;
  }

  async build(_input: DatabaseBuildInput): Promise<DatabaseResult> {
    return {
      databasePath: '',
      tables: [],
      rowCounts: {},
      hasVectorSearch: false,
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a set of default no-op plugins
 */
export const createDefaultPlugins = (): {
  imageProcessor: ImageProcessorPlugin;
  mermaidRenderer: MermaidRendererPlugin;
} => ({
  imageProcessor: new CopyOnlyImageProcessor(),
  mermaidRenderer: new PassthroughMermaidRenderer(),
});

/**
 * Create all no-op plugins (for testing)
 */
export const createAllNoOpPlugins = (): {
  imageProcessor: ImageProcessorPlugin;
  mermaidRenderer: MermaidRendererPlugin;
  textEmbedder: TextEmbeddingPlugin;
  imageEmbedder: ImageEmbeddingPlugin;
  similarity: SimilarityPlugin;
  database: DatabasePlugin;
} => ({
  imageProcessor: new CopyOnlyImageProcessor(),
  mermaidRenderer: new PassthroughMermaidRenderer(),
  textEmbedder: new NoOpTextEmbedder(),
  imageEmbedder: new NoOpImageEmbedder(),
  similarity: new NoOpSimilarity(),
  database: new NoOpDatabase(),
});

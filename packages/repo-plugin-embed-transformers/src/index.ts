/**
 * Transformers.js Text Embedding Plugin
 *
 * Uses HuggingFace Transformers.js for local text embeddings.
 * Supports various sentence transformer models.
 */

import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';
import type {
  TextEmbeddingPlugin,
  PluginContext,
} from '@repo-md/processor-core';

// ============================================================================
// Types
// ============================================================================

export interface TransformersEmbedderOptions {
  /** Model ID from HuggingFace (default: 'Xenova/all-MiniLM-L6-v2') */
  readonly modelId?: string;
  /** Pooling strategy (default: 'mean') */
  readonly pooling?: 'mean' | 'cls' | 'none';
  /** Normalize embeddings (default: true) */
  readonly normalize?: boolean;
  /** Maximum sequence length (default: 512) */
  readonly maxLength?: number;
}

// ============================================================================
// Model Configuration
// ============================================================================

const DEFAULT_MODEL = 'Xenova/all-MiniLM-L6-v2';
const MODEL_DIMENSIONS: Record<string, number> = {
  'Xenova/all-MiniLM-L6-v2': 384,
  'Xenova/all-mpnet-base-v2': 768,
  'Xenova/paraphrase-MiniLM-L6-v2': 384,
  'Xenova/bge-small-en-v1.5': 384,
  'Xenova/bge-base-en-v1.5': 768,
};

// ============================================================================
// Transformers Text Embedder Plugin
// ============================================================================

/**
 * Text embedder using HuggingFace Transformers.js
 */
export class TransformersTextEmbedder implements TextEmbeddingPlugin {
  readonly name = 'textEmbedder' as const;
  readonly model: string;
  readonly dimensions: number;

  private ready = false;
  private context: PluginContext | null = null;
  private pipeline: FeatureExtractionPipeline | null = null;
  private initPromise: Promise<void> | null = null;
  private options: Required<TransformersEmbedderOptions>;

  constructor(options: TransformersEmbedderOptions = {}) {
    this.options = {
      modelId: options.modelId ?? DEFAULT_MODEL,
      pooling: options.pooling ?? 'mean',
      normalize: options.normalize ?? true,
      maxLength: options.maxLength ?? 512,
    };

    this.model = this.options.modelId;
    this.dimensions = MODEL_DIMENSIONS[this.model] ?? 384;
  }

  async initialize(context: PluginContext): Promise<void> {
    this.context = context;

    context.log(`Initializing TransformersTextEmbedder with ${this.model}...`, 'info');

    try {
      // Load the pipeline
      this.pipeline = await pipeline('feature-extraction', this.model);

      context.log(
        `TransformersTextEmbedder initialized (${this.dimensions} dimensions)`,
        'info'
      );

      this.ready = true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      context.log(`Failed to initialize embedding model: ${msg}`, 'error');
      throw error;
    }
  }

  isReady(): boolean {
    return this.ready;
  }

  async dispose(): Promise<void> {
    this.pipeline = null;
    this.ready = false;
  }

  async embed(text: string): Promise<readonly number[]> {
    if (!this.pipeline) {
      throw new Error('TransformersTextEmbedder not initialized');
    }

    const result = await this.pipeline(text, {
      pooling: this.options.pooling,
      normalize: this.options.normalize,
    });

    // Extract the embedding from the result
    return this.extractEmbedding(result);
  }

  async batchEmbed(texts: readonly string[]): Promise<readonly (readonly number[])[]> {
    if (!this.pipeline) {
      throw new Error('TransformersTextEmbedder not initialized');
    }

    // Process in batches to avoid memory issues
    const batchSize = 16;
    const results: (readonly number[])[] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);

      // Process each text individually (batch processing can be added later)
      for (const text of batch) {
        const result = await this.pipeline(text, {
          pooling: this.options.pooling,
          normalize: this.options.normalize,
        });
        results.push(this.extractEmbedding(result));
      }

      // Log progress for large batches
      if (texts.length > 50 && this.context) {
        this.context.log(
          `Embedding progress: ${Math.min(i + batchSize, texts.length)}/${texts.length}`,
          'debug'
        );
      }
    }

    return results;
  }

  /**
   * Extract embedding vector from pipeline result
   */
  private extractEmbedding(result: any): readonly number[] {
    // Handle different result formats from transformers.js
    if (result && typeof result.tolist === 'function') {
      const list = result.tolist();
      if (Array.isArray(list) && list.length === 1) {
        return list[0] as readonly number[];
      }
      return list as readonly number[];
    }

    if (result && result.data) {
      return Array.from(result.data) as readonly number[];
    }

    if (Array.isArray(result)) {
      if (Array.isArray(result[0])) {
        return result[0] as readonly number[];
      }
      return result as readonly number[];
    }

    // Fallback: return zeros
    return new Array(this.dimensions).fill(0);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a Transformers.js text embedder plugin
 */
export const createTransformersEmbedder = (
  options?: TransformersEmbedderOptions
): TextEmbeddingPlugin => {
  return new TransformersTextEmbedder(options);
};

// Default export
export default TransformersTextEmbedder;

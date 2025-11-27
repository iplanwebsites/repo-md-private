/**
 * CLIP Image Embedding Plugin
 *
 * Uses HuggingFace Transformers.js with CLIP models for image embeddings.
 * Enables semantic image search and similarity comparison.
 */

import { pipeline, type ImageFeatureExtractionPipeline } from '@huggingface/transformers';
import { readFile } from 'node:fs/promises';
import type {
  ImageEmbeddingPlugin,
  PluginContext,
} from '@repo-md/processor-core';

// ============================================================================
// Types
// ============================================================================

export interface ClipEmbedderOptions {
  /** Model ID from HuggingFace (default: 'Xenova/clip-vit-base-patch32') */
  readonly modelId?: string;
  /** Normalize embeddings (default: true) */
  readonly normalize?: boolean;
}

// ============================================================================
// Model Configuration
// ============================================================================

const DEFAULT_MODEL = 'Xenova/clip-vit-base-patch32';
const MODEL_DIMENSIONS: Record<string, number> = {
  'Xenova/clip-vit-base-patch32': 512,
  'Xenova/clip-vit-base-patch16': 512,
  'Xenova/clip-vit-large-patch14': 768,
  'Xenova/mobileclip_s0': 512,
  'Xenova/mobileclip_s1': 512,
  'Xenova/mobileclip_s2': 512,
};

// ============================================================================
// CLIP Image Embedder Plugin
// ============================================================================

/**
 * Image embedder using HuggingFace CLIP models
 */
export class ClipImageEmbedder implements ImageEmbeddingPlugin {
  readonly name = 'imageEmbedder' as const;
  readonly model: string;
  readonly dimensions: number;

  private ready = false;
  private context: PluginContext | null = null;
  private pipeline: ImageFeatureExtractionPipeline | null = null;
  private options: Required<ClipEmbedderOptions>;

  constructor(options: ClipEmbedderOptions = {}) {
    this.options = {
      modelId: options.modelId ?? DEFAULT_MODEL,
      normalize: options.normalize ?? true,
    };

    this.model = this.options.modelId;
    this.dimensions = MODEL_DIMENSIONS[this.model] ?? 512;
  }

  async initialize(context: PluginContext): Promise<void> {
    this.context = context;

    context.log(`Initializing ClipImageEmbedder with ${this.model}...`, 'info');

    try {
      // Load the image feature extraction pipeline
      this.pipeline = await pipeline('image-feature-extraction', this.model);

      context.log(
        `ClipImageEmbedder initialized (${this.dimensions} dimensions)`,
        'info'
      );

      this.ready = true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      context.log(`Failed to initialize CLIP model: ${msg}`, 'error');
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

  /**
   * Generate embedding from image file path
   */
  async embedFile(filePath: string): Promise<readonly number[]> {
    if (!this.pipeline) {
      throw new Error('ClipImageEmbedder not initialized');
    }

    try {
      // Read image file and convert to data URL for transformers.js
      const imageBuffer = await readFile(filePath);
      const base64 = imageBuffer.toString('base64');
      const mimeType = this.getMimeType(filePath);
      const dataUrl = `data:${mimeType};base64,${base64}`;

      const result = await this.pipeline(dataUrl, {
        normalize: this.options.normalize,
      } as any);

      return this.extractEmbedding(result);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.context?.log(`Failed to embed image ${filePath}: ${msg}`, 'error');
      throw error;
    }
  }

  /**
   * Generate embedding from image buffer
   */
  async embedBuffer(buffer: Buffer, mimeType: string): Promise<readonly number[]> {
    if (!this.pipeline) {
      throw new Error('ClipImageEmbedder not initialized');
    }

    try {
      const base64 = buffer.toString('base64');
      const dataUrl = `data:${mimeType};base64,${base64}`;

      const result = await this.pipeline(dataUrl, {
        normalize: this.options.normalize,
      } as any);

      return this.extractEmbedding(result);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.context?.log(`Failed to embed image buffer: ${msg}`, 'error');
      throw error;
    }
  }

  /**
   * Batch embed multiple images
   */
  async batchEmbedFiles(filePaths: readonly string[]): Promise<readonly (readonly number[])[]> {
    const results: (readonly number[])[] = [];

    for (const filePath of filePaths) {
      try {
        const embedding = await this.embedFile(filePath);
        results.push(embedding);
      } catch (error) {
        // Log error but continue with other images
        const msg = error instanceof Error ? error.message : String(error);
        this.context?.log(`Skipping image ${filePath}: ${msg}`, 'warn');
        // Push zero embedding for failed images
        results.push(new Array(this.dimensions).fill(0));
      }
    }

    return results;
  }

  /**
   * Get MIME type from file extension
   */
  private getMimeType(filePath: string): string {
    const ext = filePath.toLowerCase().split('.').pop();
    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      avif: 'image/avif',
      bmp: 'image/bmp',
      tiff: 'image/tiff',
      tif: 'image/tiff',
    };
    return mimeTypes[ext ?? ''] ?? 'image/jpeg';
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
 * Create a CLIP image embedder plugin
 */
export const createClipEmbedder = (
  options?: ClipEmbedderOptions
): ImageEmbeddingPlugin => {
  return new ClipImageEmbedder(options);
};

// Default export
export default ClipImageEmbedder;

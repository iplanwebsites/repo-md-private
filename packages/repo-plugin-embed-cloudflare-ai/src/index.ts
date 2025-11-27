/**
 * Cloudflare Workers AI Text Embedding Plugin
 *
 * Uses Cloudflare Workers AI for text embeddings.
 * Supports both:
 * - Binding mode: When running inside a Cloudflare Worker (env.AI)
 * - REST API mode: When running outside CF (uses fetch)
 *
 * Available models:
 * - @cf/baai/bge-small-en-v1.5 (384 dims, fast, English)
 * - @cf/baai/bge-base-en-v1.5 (768 dims, balanced, English)
 * - @cf/baai/bge-large-en-v1.5 (1024 dims, best quality, English)
 * - @cf/baai/bge-m3 (1024 dims, multilingual)
 *
 * @see https://developers.cloudflare.com/workers-ai/models/
 */

import type { TextEmbeddingPlugin, PluginContext } from '@repo-md/processor-core';

// ============================================================================
// Types
// ============================================================================

/**
 * Cloudflare AI binding interface (available in Workers runtime)
 */
export interface CloudflareAIBinding {
  run<T = unknown>(model: string, input: Record<string, unknown>): Promise<T>;
}

/**
 * Pooling strategy for embeddings
 * - 'mean': Average of all token embeddings (default, backward-compatible)
 * - 'cls': Use [CLS] token embedding (more accurate for retrieval)
 */
export type PoolingStrategy = 'mean' | 'cls';

export interface CloudflareAIEmbedderOptions {
  /**
   * Cloudflare Workers AI binding (env.AI)
   * When provided, uses direct binding (faster, no auth needed)
   * When not provided, falls back to REST API
   */
  readonly binding?: CloudflareAIBinding;

  /**
   * Cloudflare Account ID (required for REST API mode)
   */
  readonly accountId?: string;

  /**
   * Cloudflare API Token with Workers AI permissions (required for REST API mode)
   */
  readonly apiToken?: string;

  /**
   * Model ID (default: '@cf/baai/bge-small-en-v1.5')
   * Options:
   * - '@cf/baai/bge-small-en-v1.5' (384 dims, fast)
   * - '@cf/baai/bge-base-en-v1.5' (768 dims)
   * - '@cf/baai/bge-large-en-v1.5' (1024 dims)
   * - '@cf/baai/bge-m3' (1024 dims, multilingual)
   */
  readonly modelId?: string;

  /**
   * Pooling strategy (default: 'cls' for better accuracy)
   * Note: Embeddings from different pooling strategies are NOT compatible
   */
  readonly pooling?: PoolingStrategy;

  /**
   * Batch size for concurrent requests (default: 100)
   * Workers AI supports batching in a single request
   */
  readonly batchSize?: number;

  /**
   * Request timeout in ms (default: 30000)
   */
  readonly timeout?: number;
}

/**
 * Response from Cloudflare AI embedding endpoint
 */
interface CloudflareEmbeddingResponse {
  readonly result?: {
    readonly shape: readonly number[];
    readonly data: readonly (readonly number[])[];
  };
  readonly success: boolean;
  readonly errors?: readonly { message: string }[];
}

// ============================================================================
// Model Configuration
// ============================================================================

const DEFAULT_MODEL = '@cf/baai/bge-small-en-v1.5';

const MODEL_DIMENSIONS: Record<string, number> = {
  '@cf/baai/bge-small-en-v1.5': 384,
  '@cf/baai/bge-base-en-v1.5': 768,
  '@cf/baai/bge-large-en-v1.5': 1024,
  '@cf/baai/bge-m3': 1024,
};

// ============================================================================
// Cloudflare AI Text Embedder Plugin
// ============================================================================

/**
 * Text embedder using Cloudflare Workers AI
 *
 * Usage with binding (in CF Worker):
 * ```ts
 * const embedder = new CloudflareAITextEmbedder({
 *   binding: env.AI,
 *   pooling: 'cls',
 * });
 * ```
 *
 * Usage with REST API (external):
 * ```ts
 * const embedder = new CloudflareAITextEmbedder({
 *   accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
 *   apiToken: process.env.CLOUDFLARE_API_TOKEN,
 *   pooling: 'cls',
 * });
 * ```
 */
export class CloudflareAITextEmbedder implements TextEmbeddingPlugin {
  readonly name = 'textEmbedder' as const;
  readonly model: string;
  readonly dimensions: number;

  private ready = false;
  private context: PluginContext | null = null;
  private options: Required<Omit<CloudflareAIEmbedderOptions, 'binding' | 'accountId' | 'apiToken'>> & {
    binding?: CloudflareAIBinding;
    accountId?: string;
    apiToken?: string;
  };

  constructor(options: CloudflareAIEmbedderOptions = {}) {
    this.options = {
      binding: options.binding,
      accountId: options.accountId,
      apiToken: options.apiToken,
      modelId: options.modelId ?? DEFAULT_MODEL,
      pooling: options.pooling ?? 'cls', // Default to cls for better accuracy
      batchSize: options.batchSize ?? 100,
      timeout: options.timeout ?? 30000,
    };

    this.model = this.options.modelId;
    this.dimensions = MODEL_DIMENSIONS[this.model] ?? 384;
  }

  async initialize(context: PluginContext): Promise<void> {
    this.context = context;

    const mode = this.options.binding ? 'binding' : 'REST API';
    context.log(
      `Initializing CloudflareAITextEmbedder (${mode} mode, model: ${this.model}, pooling: ${this.options.pooling})`,
      'info'
    );

    // Validate configuration
    if (!this.options.binding && (!this.options.accountId || !this.options.apiToken)) {
      throw new Error(
        'CloudflareAITextEmbedder requires either a binding (env.AI) or accountId + apiToken for REST API mode'
      );
    }

    // Test the connection with a simple embedding
    try {
      await this.embed('test');
      context.log(
        `CloudflareAITextEmbedder initialized (${this.dimensions} dimensions)`,
        'info'
      );
      this.ready = true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      context.log(`Failed to initialize Cloudflare AI embedder: ${msg}`, 'error');
      throw error;
    }
  }

  isReady(): boolean {
    return this.ready;
  }

  async dispose(): Promise<void> {
    this.ready = false;
  }

  async embed(text: string): Promise<readonly number[]> {
    const results = await this.batchEmbed([text]);
    const result = results[0];
    if (!result) {
      throw new Error('Failed to generate embedding');
    }
    return result;
  }

  async batchEmbed(texts: readonly string[]): Promise<readonly (readonly number[])[]> {
    if (texts.length === 0) {
      return [];
    }

    const results: (readonly number[])[] = [];
    const batchSize = this.options.batchSize;

    // Process in batches
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchResults = await this.embedBatch(batch);
      results.push(...batchResults);

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
   * Embed a single batch of texts
   */
  private async embedBatch(texts: readonly string[]): Promise<readonly (readonly number[])[]> {
    if (this.options.binding) {
      return this.embedWithBinding(texts);
    }
    return this.embedWithRestApi(texts);
  }

  /**
   * Embed using Cloudflare AI binding (in-worker, faster)
   */
  private async embedWithBinding(texts: readonly string[]): Promise<readonly (readonly number[])[]> {
    const binding = this.options.binding!;

    interface BindingResponse {
      readonly shape: readonly number[];
      readonly data: readonly (readonly number[])[];
    }

    const response = await binding.run<BindingResponse>(this.model, {
      text: texts,
      pooling: this.options.pooling,
    });

    if (!response?.data) {
      throw new Error('Invalid response from Cloudflare AI binding');
    }

    return response.data;
  }

  /**
   * Embed using Cloudflare REST API (external, requires auth)
   */
  private async embedWithRestApi(texts: readonly string[]): Promise<readonly (readonly number[])[]> {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.options.accountId}/ai/run/${this.model}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.options.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: texts,
          pooling: this.options.pooling,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Cloudflare AI API error (${response.status}): ${errorText}`);
      }

      const data = (await response.json()) as CloudflareEmbeddingResponse;

      if (!data.success || !data.result?.data) {
        const errorMsg = data.errors?.[0]?.message ?? 'Unknown error';
        throw new Error(`Cloudflare AI API error: ${errorMsg}`);
      }

      return data.result.data;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a Cloudflare AI text embedder with binding (for use in CF Workers)
 */
export const createCloudflareAIEmbedderWithBinding = (
  binding: CloudflareAIBinding,
  options?: Omit<CloudflareAIEmbedderOptions, 'binding' | 'accountId' | 'apiToken'>
): TextEmbeddingPlugin => {
  return new CloudflareAITextEmbedder({ ...options, binding });
};

/**
 * Create a Cloudflare AI text embedder with REST API (for external use)
 */
export const createCloudflareAIEmbedderWithRestApi = (
  accountId: string,
  apiToken: string,
  options?: Omit<CloudflareAIEmbedderOptions, 'binding' | 'accountId' | 'apiToken'>
): TextEmbeddingPlugin => {
  return new CloudflareAITextEmbedder({ ...options, accountId, apiToken });
};

/**
 * Create a Cloudflare AI text embedder from environment variables
 * Looks for: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN
 */
export const createCloudflareAIEmbedderFromEnv = (
  options?: Omit<CloudflareAIEmbedderOptions, 'binding' | 'accountId' | 'apiToken'>
): TextEmbeddingPlugin => {
  const accountId = process.env['CLOUDFLARE_ACCOUNT_ID'];
  const apiToken = process.env['CLOUDFLARE_API_TOKEN'];

  if (!accountId || !apiToken) {
    throw new Error(
      'CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN environment variables are required'
    );
  }

  return new CloudflareAITextEmbedder({ ...options, accountId, apiToken });
};

// ============================================================================
// Exports
// ============================================================================

export {
  DEFAULT_MODEL as CLOUDFLARE_DEFAULT_MODEL,
  MODEL_DIMENSIONS as CLOUDFLARE_MODEL_DIMENSIONS,
};

export default CloudflareAITextEmbedder;

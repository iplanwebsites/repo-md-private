/**
 * Cache types for @repo-md/processor-core
 *
 * These types support incremental builds by allowing the processor
 * to skip re-processing files that haven't changed.
 */

import type { MediaMetadata, MediaSizeVariant } from './output.js';

// ============================================================================
// Cached Media Metadata
// ============================================================================

/**
 * Cached metadata for a previously processed media file.
 * Contains all information needed to skip image processing
 * while still generating correct HTML output with dimensions.
 */
export interface CachedMediaMetadata {
  /** Original image width */
  readonly width: number;
  /** Original image height */
  readonly height: number;
  /** Output format (webp, avif, jpeg, png) */
  readonly format: string;
  /** Output file size in bytes */
  readonly size: number;
  /** Original file size in bytes */
  readonly originalSize?: number;
  /** Output file path relative to media output dir */
  readonly outputPath: string;
  /** Responsive size variants */
  readonly sizes: readonly CachedMediaSizeVariant[];
}

/**
 * Cached size variant for responsive images
 */
export interface CachedMediaSizeVariant {
  /** Size suffix (xs, sm, md, lg, xl) */
  readonly suffix: string;
  /** Output file path relative to media output dir */
  readonly outputPath: string;
  /** Width of this variant */
  readonly width: number;
  /** Height of this variant */
  readonly height: number;
  /** File size in bytes */
  readonly size: number;
}

// ============================================================================
// Cache Context
// ============================================================================

/**
 * Cache context passed to the processor for incremental builds.
 * All caches are keyed by content hash (SHA-256).
 */
export interface CacheContext {
  /**
   * Cached media metadata keyed by content hash.
   * When a media file's hash matches a cached entry, processing can be skipped
   * and the cached metadata used for HTML rendering (dimensions, paths).
   */
  readonly media?: ReadonlyMap<string, CachedMediaMetadata>;

  /**
   * Cached text embeddings keyed by post content hash.
   * When a post's hash matches a cached entry, embedding generation
   * can be skipped and the cached vector used directly.
   */
  readonly textEmbeddings?: ReadonlyMap<string, readonly number[]>;

  /**
   * Cached image embeddings keyed by media content hash.
   * When a media file's hash matches a cached entry, CLIP embedding
   * generation can be skipped and the cached vector used directly.
   */
  readonly imageEmbeddings?: ReadonlyMap<string, readonly number[]>;
}

// ============================================================================
// Cache Statistics
// ============================================================================

/**
 * Statistics about cache usage during processing
 */
export interface CacheStats {
  /** Number of media files that used cached metadata */
  readonly mediaCacheHits: number;
  /** Number of media files that were processed fresh */
  readonly mediaCacheMisses: number;
  /** Number of posts that used cached text embeddings */
  readonly textEmbeddingCacheHits: number;
  /** Number of posts that required fresh text embedding generation */
  readonly textEmbeddingCacheMisses: number;
  /** Number of media files that used cached image embeddings */
  readonly imageEmbeddingCacheHits: number;
  /** Number of media files that required fresh image embedding generation */
  readonly imageEmbeddingCacheMisses: number;
}

/**
 * Create empty cache statistics
 */
export const createEmptyCacheStats = (): CacheStats => ({
  mediaCacheHits: 0,
  mediaCacheMisses: 0,
  textEmbeddingCacheHits: 0,
  textEmbeddingCacheMisses: 0,
  imageEmbeddingCacheHits: 0,
  imageEmbeddingCacheMisses: 0,
});

// ============================================================================
// Cache Builder Utilities
// ============================================================================

/**
 * Build a media cache from a medias.json file structure
 */
export function buildMediaCacheFromManifest(
  medias: readonly { metadata?: MediaMetadata; outputPath: string; sizes?: readonly MediaSizeVariant[] }[]
): Map<string, CachedMediaMetadata> {
  const cache = new Map<string, CachedMediaMetadata>();

  for (const media of medias) {
    const hash = media.metadata?.hash;
    if (!hash || !media.metadata?.width || !media.metadata?.height) continue;

    cache.set(hash, {
      width: media.metadata.width,
      height: media.metadata.height,
      format: media.metadata.format ?? 'webp',
      size: media.metadata.size ?? 0,
      originalSize: media.metadata.originalSize,
      outputPath: media.outputPath,
      sizes: (media.sizes ?? []).map(s => ({
        suffix: s.suffix,
        outputPath: s.outputPath,
        width: s.width,
        height: s.height,
        size: s.size,
      })),
    });
  }

  return cache;
}

/**
 * Build an embedding cache from an embedding hash map file structure
 */
export function buildEmbeddingCacheFromManifest(
  embeddingMap: Record<string, readonly number[]>
): Map<string, readonly number[]> {
  const cache = new Map<string, readonly number[]>();

  for (const [hash, embedding] of Object.entries(embeddingMap)) {
    if (Array.isArray(embedding) && embedding.length > 0) {
      cache.set(hash, embedding);
    }
  }

  return cache;
}

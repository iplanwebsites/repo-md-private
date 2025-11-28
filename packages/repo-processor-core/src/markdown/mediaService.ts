/**
 * Media Service for Markdown Processing
 *
 * Provides path resolution and URL generation for media files.
 * Used by remark plugins to transform image paths to optimized URLs.
 */

import path from 'node:path';
import type { ProcessedMedia, MediaSizeVariant } from '../types/output.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Media lookup map: original path -> processed media info
 */
export type MediaLookupMap = Map<string, ProcessedMedia>;

/**
 * Options for the media service
 */
export interface MediaServiceOptions {
  /** Map of original paths to processed media info */
  readonly mediaPathMap?: MediaLookupMap;
  /** Default image path for missing media */
  readonly defaultImage?: string;
  /** Base path prefix for URLs */
  readonly basePath?: string;
  /** Preferred size variant to use */
  readonly preferredSize?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Whether to add CSS aspect-ratio style */
  readonly enableCssRatio?: boolean;
  /** Domain for absolute URLs */
  readonly domain?: string;
}

/**
 * Result of resolving a media path
 */
export interface MediaResolveResult {
  readonly found: boolean;
  readonly url?: string;
  readonly width?: number;
  readonly height?: number;
  readonly originalPath?: string;
}

// ============================================================================
// Media Service
// ============================================================================

/**
 * Service for resolving and transforming media paths in markdown
 */
export class MediaService {
  private readonly mediaPathMap: MediaLookupMap;
  private readonly mediaByName: Map<string, ProcessedMedia[]>;
  private readonly defaultImage: string;
  private readonly basePath: string;
  private readonly preferredSize: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  private readonly enableCssRatio: boolean;
  private readonly domain: string;
  private isFirstImage = true;

  constructor(options: MediaServiceOptions = {}) {
    this.mediaPathMap = options.mediaPathMap ?? new Map();
    this.defaultImage = options.defaultImage ?? '/placeholder/400/300';
    this.basePath = options.basePath ?? '';
    this.preferredSize = options.preferredSize ?? 'lg';
    this.enableCssRatio = options.enableCssRatio ?? true;
    this.domain = options.domain ?? '';

    // Build name-based lookup for flexible matching
    this.mediaByName = this.buildNameLookup();
  }

  /**
   * Build a lookup map by filename for flexible matching
   */
  private buildNameLookup(): Map<string, ProcessedMedia[]> {
    const byName = new Map<string, ProcessedMedia[]>();

    for (const [originalPath, media] of this.mediaPathMap) {
      const fileName = path.basename(originalPath).toLowerCase();

      if (!byName.has(fileName)) {
        byName.set(fileName, []);
      }
      byName.get(fileName)!.push(media);
    }

    return byName;
  }

  /**
   * Reset first image flag for a new document
   */
  resetFirstImageFlag(): void {
    this.isFirstImage = true;
  }

  /**
   * Create path variations for flexible matching
   */
  createPathVariations(mediaPath: string, currentFilePath?: string): string[] {
    const variations: string[] = [];
    const normalized = mediaPath.replace(/\\/g, '/');

    // Original path
    variations.push(normalized);

    // Without leading slash
    if (normalized.startsWith('/')) {
      variations.push(normalized.slice(1));
    }

    // Lowercase version
    const lower = normalized.toLowerCase();
    if (lower !== normalized) {
      variations.push(lower);
    }

    // Relative to current file
    if (currentFilePath) {
      const currentDir = path.dirname(currentFilePath);
      const relative = path.join(currentDir, normalized).replace(/\\/g, '/');
      variations.push(relative);
      variations.push(relative.toLowerCase());
    }

    // Just the filename
    const fileName = path.basename(normalized);
    variations.push(fileName);
    variations.push(fileName.toLowerCase());

    return [...new Set(variations)];
  }

  /**
   * Find media by path variations
   */
  findMedia(mediaPath: string, currentFilePath?: string): ProcessedMedia | undefined {
    const variations = this.createPathVariations(mediaPath, currentFilePath);

    // Try path-based lookup first
    for (const variation of variations) {
      const media = this.mediaPathMap.get(variation);
      if (media) return media;
    }

    // Try name-based lookup as fallback
    const fileName = path.basename(mediaPath).toLowerCase();
    const byName = this.mediaByName.get(fileName);

    if (byName && byName.length > 0) {
      // If we have multiple matches, prefer one in the same directory
      if (currentFilePath && byName.length > 1) {
        const currentDir = path.dirname(currentFilePath);
        const sameDirMatch = byName.find((m) =>
          m.originalPath.startsWith(currentDir)
        );
        if (sameDirMatch) return sameDirMatch;
      }
      return byName[0];
    }

    return undefined;
  }

  /**
   * Get the best size variant for a media item
   */
  getBestSizeVariant(media: ProcessedMedia): MediaSizeVariant | undefined {
    if (!media.sizes || media.sizes.length === 0) return undefined;

    // Find preferred size
    const preferred = media.sizes.find((s) => s.suffix === this.preferredSize);
    if (preferred) return preferred;

    // Fallback order: lg -> md -> sm -> first available
    const fallbackOrder = ['lg', 'md', 'sm', 'xs', 'xl'];
    for (const size of fallbackOrder) {
      const variant = media.sizes.find((s) => s.suffix === size);
      if (variant) return variant;
    }

    return media.sizes[0];
  }

  /**
   * Build the URL for a media item
   */
  buildUrl(media: ProcessedMedia, variant?: MediaSizeVariant): string {
    const outputPath = variant?.outputPath ?? media.outputPath;

    if (this.domain) {
      // Build absolute URL
      const fileName = outputPath.split('/').pop();
      return `${this.domain}/_shared/medias/${fileName}`;
    }

    return `${this.basePath}/${outputPath}`.replace(/\/+/g, '/');
  }

  /**
   * Resolve a media path to URL and metadata
   */
  resolve(mediaPath: string, currentFilePath?: string): MediaResolveResult {
    // Skip external URLs
    if (/^(https?|ftp|data):/.test(mediaPath)) {
      return { found: false };
    }

    const media = this.findMedia(mediaPath, currentFilePath);

    if (!media) {
      return { found: false };
    }

    const variant = this.getBestSizeVariant(media);
    const url = this.buildUrl(media, variant);

    return {
      found: true,
      url,
      width: variant?.width ?? media.metadata?.width,
      height: variant?.height ?? media.metadata?.height,
      originalPath: media.originalPath,
    };
  }

  /**
   * Create HTML properties for an image
   */
  createHtmlProperties(result: MediaResolveResult, className: string): Record<string, unknown> {
    const props: Record<string, unknown> = {
      class: className,
    };

    if (result.width) props.width = result.width;
    if (result.height) props.height = result.height;

    // Add lazy loading for non-first images
    if (!this.isFirstImage) {
      props.loading = 'lazy';
    } else {
      this.isFirstImage = false;
    }

    // Add aspect ratio if enabled and dimensions available
    if (this.enableCssRatio && result.width && result.height) {
      props.style = `aspect-ratio: ${result.width} / ${result.height};`;
    }

    return props;
  }

  /**
   * Get default image properties for missing media
   */
  getDefaultImageProps(alt: string, className: string): {
    url: string;
    title: string;
    hProperties: Record<string, unknown>;
  } {
    return {
      url: this.defaultImage,
      title: `Image not found: ${alt}`,
      hProperties: {
        width: 400,
        height: 300,
        class: `${className} placeholder`,
      },
    };
  }
}

/**
 * Create a media service from processed media array
 */
export const createMediaService = (
  media: readonly ProcessedMedia[],
  options: Omit<MediaServiceOptions, 'mediaPathMap'> = {}
): MediaService => {
  const mediaPathMap = new Map<string, ProcessedMedia>();

  for (const item of media) {
    mediaPathMap.set(item.originalPath, item);
    // Also add lowercase version for case-insensitive matching
    mediaPathMap.set(item.originalPath.toLowerCase(), item);
  }

  return new MediaService({
    ...options,
    mediaPathMap,
  });
};

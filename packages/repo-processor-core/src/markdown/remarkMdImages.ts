/**
 * Remark Plugin: Markdown Images
 *
 * Transforms standard Markdown image syntax (![alt](path)) to use optimized paths.
 * Resolves local image paths using the MediaService.
 */

import path from 'node:path';
import type { Plugin } from 'unified';
import type { Root, Image } from 'mdast';
import { visit } from 'unist-util-visit';
import type { MediaService } from './mediaService.js';

// ============================================================================
// Types
// ============================================================================

export interface RemarkMdImagesOptions {
  /** Media service for path resolution */
  readonly mediaService?: MediaService;
  /** Current file path for relative resolution */
  readonly currentFilePath?: string;
  /** CSS class prefix for images */
  readonly classPrefix?: string;
}

// ============================================================================
// Plugin
// ============================================================================

/**
 * Check if URL is external
 */
const isExternalUrl = (url: string): boolean => {
  return /^(https?|ftp|data):/.test(url);
};

/**
 * Plugin to transform markdown images to use optimized paths
 */
export const remarkMdImages: Plugin<[RemarkMdImagesOptions?], Root> = (options = {}) => {
  const { mediaService, currentFilePath, classPrefix = 'md-image' } = options;

  return (tree: Root) => {
    // Reset first image flag if media service is provided
    mediaService?.resetFirstImageFlag();

    visit(tree, 'image', (node: Image) => {
      // Skip external URLs and data URIs
      if (isExternalUrl(node.url)) {
        return;
      }

      // Skip if no media service
      if (!mediaService) {
        return;
      }

      const fileName = path.basename(node.url);
      const alt = node.alt || fileName;

      // Try to resolve the media path
      const result = mediaService.resolve(node.url, currentFilePath);

      if (result.found && result.url) {
        // Update the node with optimized URL
        node.url = result.url;

        // Add HTML properties
        const hProperties = mediaService.createHtmlProperties(result, classPrefix);
        node.data = node.data || {};
        (node.data as any).hProperties = hProperties;
      } else {
        // Media not found - use placeholder
        const defaultProps = mediaService.getDefaultImageProps(alt, classPrefix);
        node.url = defaultProps.url;
        node.title = defaultProps.title;
        node.data = node.data || {};
        (node.data as any).hProperties = defaultProps.hProperties;
      }
    });
  };
};

export default remarkMdImages;

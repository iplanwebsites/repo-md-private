/**
 * Remark Plugin: Obsidian Media Embeds
 *
 * Transforms Obsidian wiki-style media links (![[media.png]]) into HTML images.
 * Resolves paths using the MediaService and adds optimized URLs.
 */

import path from 'node:path';
import type { Plugin } from 'unified';
import type { Root, PhrasingContent, Text, Image } from 'mdast';
import { visit } from 'unist-util-visit';
import type { MediaService } from './mediaService.js';

// ============================================================================
// Types
// ============================================================================

export interface RemarkObsidianMediaOptions {
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
 * Regular expression to match Obsidian media syntax
 * Matches: ![[filename.ext]] or ![[path/to/filename.ext]]
 * Also supports: ![[filename.ext|alt text]]
 */
const OBSIDIAN_MEDIA_REGEX = /!\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g;

/**
 * Check if a string is an image file
 */
const isImageFile = (filePath: string): boolean => {
  const ext = path.extname(filePath).toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.svg'].includes(ext);
};

/**
 * Plugin to transform Obsidian media embeds to HTML images
 */
export const remarkObsidianMedia: Plugin<[RemarkObsidianMediaOptions?], Root> = (
  options = {}
) => {
  const { mediaService, currentFilePath, classPrefix = 'obsidian-media' } = options;

  return (tree: Root) => {
    // Reset first image flag if media service is provided
    mediaService?.resetFirstImageFlag();

    visit(tree, 'text', (node: Text, index, parent) => {
      if (!parent || typeof index !== 'number') return;

      const text = node.value;
      const matches = [...text.matchAll(OBSIDIAN_MEDIA_REGEX)];

      if (matches.length === 0) return;

      // Process text and extract media links
      const newNodes: PhrasingContent[] = [];
      let lastIndex = 0;

      for (const match of matches) {
        const fullMatch = match[0];
        const mediaPath = match[1];
        const altText = match[2];
        const matchIndex = match.index ?? 0;

        // Skip if no media path captured
        if (!mediaPath) {
          lastIndex = matchIndex + fullMatch.length;
          continue;
        }

        // Add text before the match
        if (matchIndex > lastIndex) {
          newNodes.push({
            type: 'text',
            value: text.slice(lastIndex, matchIndex),
          });
        }

        // Only process image files
        if (!isImageFile(mediaPath)) {
          // Keep non-image embeds as text for now
          newNodes.push({
            type: 'text',
            value: fullMatch,
          });
          lastIndex = matchIndex + fullMatch.length;
          continue;
        }

        const fileName = path.basename(mediaPath);
        const alt = altText || fileName;

        // Try to resolve the media path
        if (mediaService) {
          const result = mediaService.resolve(mediaPath, currentFilePath);

          if (result.found && result.url) {
            const hProperties = mediaService.createHtmlProperties(result, classPrefix);

            const imageNode: Image = {
              type: 'image',
              url: result.url,
              alt,
              title: fileName,
              data: { hProperties: hProperties as Record<string, string | number | boolean | null | undefined | (string | number)[]> },
            };
            newNodes.push(imageNode as unknown as PhrasingContent);
          } else {
            // Media not found - use placeholder
            const defaultProps = mediaService.getDefaultImageProps(alt, classPrefix);
            const imageNode: Image = {
              type: 'image',
              url: defaultProps.url,
              alt,
              title: defaultProps.title,
              data: { hProperties: defaultProps.hProperties as Record<string, string | number | boolean | null | undefined | (string | number)[]> },
            };
            newNodes.push(imageNode as unknown as PhrasingContent);
          }
        } else {
          // No media service - create basic image node
          const imageNode: Image = {
            type: 'image',
            url: mediaPath,
            alt,
            title: fileName,
          };
          newNodes.push(imageNode as unknown as PhrasingContent);
        }

        lastIndex = matchIndex + fullMatch.length;
      }

      // Add remaining text
      if (lastIndex < text.length) {
        newNodes.push({
          type: 'text',
          value: text.slice(lastIndex),
        });
      }

      // Replace the original node with new nodes
      if (newNodes.length > 0) {
        parent.children.splice(index, 1, ...newNodes);
      }
    });
  };
};

export default remarkObsidianMedia;

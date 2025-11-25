// remarkmdimages.ts
import { Plugin } from 'unified';
import { Root, Image } from 'mdast';
import { visit } from 'unist-util-visit';

// Import the new MediaService
import { MediaService, MediaServiceOptions } from '../lib/mediaService';

// Import types from centralized type system
import type { MediaFileData, MediaPathMap } from '../types';

// Re-export the options interface for backward compatibility
export interface RemarkMdImagesOptions extends MediaServiceOptions {
  enableCssRatio?: boolean;
  // Add current file path for context-aware resolution
  currentFilePath?: string;
}

/**
 * Plugin to transform standard Markdown image syntax (![alt](path)) into optimized image paths
 * Processes all images, including those with relative and absolute paths
 */
export const remarkMdImages: Plugin<[RemarkMdImagesOptions?], Root> = (options = {}) => {
  // Create the media service with the provided options
  const mediaService = new MediaService({
    ...options,
    enableCssRatio: options.enableCssRatio
  });
  
  return (tree: Root) => {
    // Visit all image nodes
    visit(tree, 'image', (node: Image) => {
      // Process the image using the shared media service
      // Convert node to the type expected by processMarkdownImageNode
      const imageNode = {
        url: node.url,
        alt: node.alt || undefined,
        title: node.title || undefined,
        data: node.data
      };
      mediaService.processMarkdownImageNode(imageNode, 'md-image', options.currentFilePath);
      
      // Copy the processed properties back to the original node
      node.url = imageNode.url;
      node.title = imageNode.title;
      node.data = imageNode.data;
    });
  };
};
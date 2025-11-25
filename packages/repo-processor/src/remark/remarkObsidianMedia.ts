// remarkObsidianMedia.ts
import { Plugin } from 'unified';
import { Root, PhrasingContent } from 'mdast';
import { visit } from 'unist-util-visit';

// Import the new MediaService
import { MediaService, MediaServiceOptions } from '../lib/mediaService';

// Import types from centralized type system
import type { MediaFileData, MediaPathMap } from '../types';

// Re-export the options interface for backward compatibility
export interface RemarkObsidianMediaOptions extends MediaServiceOptions {
  // Explicitly define enableCssRatio property for better documentation
  enableCssRatio?: boolean;
  // Add current file path for context-aware resolution
  currentFilePath?: string;
}

/**
 * Plugin to transform Obsidian wiki-style media links (![[media.png]]) into HTML images
 * Prioritizes using the provided mediaPathMap for direct path conversion
 */
export const remarkObsidianMedia: Plugin<[RemarkObsidianMediaOptions?], Root> = (options = {}) => {
  // Create the media service with the provided options
  const mediaService = new MediaService({
    ...options,
    // Ensure enableCssRatio is passed to MediaService
    enableCssRatio: options.enableCssRatio
  });
  
  // Regular expression to match Obsidian media syntax
  // This matches ![[filename.ext]] or ![[path/to/filename.ext]]
  const mediaRegex = /!\[\[(.*?)\]\]/g;
  
  return (tree: Root) => {
    visit(tree, 'text', (node, index, parent) => {
      // Ensure index and parent are defined before proceeding
      if (!parent || typeof index !== 'number') return;
      
      // Process the text content to extract and convert media links
      const { newNodes, matched } = mediaService.processObsidianMediaText(
        node.value, 
        mediaRegex,
        'obsidian-media',
        options.currentFilePath
      );
      
      // If we found matches, replace the original node with the new nodes
      if (matched && newNodes.length > 0) {
        parent.children.splice(index, 1, ...newNodes);
        
        // Skip the nodes we just inserted
        return index + newNodes.length - 1;
      }
      
      return undefined;
    });
  };
};
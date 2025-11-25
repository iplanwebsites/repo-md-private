// remarkMarkdownMedia.ts
import { Plugin } from 'unified';
import { Root, Image, PhrasingContent, Text } from 'mdast';
import { visit } from 'unist-util-visit';
import path from 'path';

// Import types from processMedia.ts
import type { MediaFileData, MediaPathMap } from './processMedia';

// Default placeholder image path
const DEFAULT_IMAGE = '/placeholder/400/300';

export interface RemarkMarkdownMediaOptions {
  mediaData?: MediaFileData[];
  mediaPathMap?: MediaPathMap;
  defaultImage?: string;
  basePath?: string;
  useAbsolutePaths?: boolean;
  preferredSize?: 'sm' | 'md' | 'lg';
}

/**
 * Plugin to transform standard Markdown image syntax (![alt](path)) into optimized image paths
 * Only processes images with relative paths, not absolute URLs
 */
export const remarkMarkdownMedia: Plugin<[RemarkMarkdownMediaOptions?], Root> = (options = {}) => {
  const {
    mediaData = [],
    mediaPathMap = {},
    defaultImage = DEFAULT_IMAGE,
    basePath = '',
    useAbsolutePaths = false,
    preferredSize = 'md'
  } = options;
  
  // Create maps for quicker lookups - same as in remarkObsidianMedia
  const mediaByName = new Map<string, MediaFileData>();
  const mediaByPath = new Map<string, MediaFileData>();
  const mediaByEffectivePath = new Map<string, MediaFileData>();
  const mediaByHashPath = new Map<string, MediaFileData>();
  
  // Create a reverse-lookup map to quickly check which path should be used
  // This maps from an original path to its optimized path
  const bestPathLookup = new Map<string, string>();
  
  mediaData.forEach(item => {
    // Store by filename (lowercase for case-insensitive matching)
    mediaByName.set(item.fileName.toLowerCase(), item);
    
    // Store by original path
    mediaByPath.set(item.originalPath.toLowerCase(), item);
    
    // Store by effective path (used in rendered HTML)
    if (item.effectivePath) {
      mediaByEffectivePath.set(item.effectivePath.toLowerCase(), item);
    }
    
    // Store by hash path if available
    if (item.hashPath) {
      mediaByHashPath.set(item.hashPath.toLowerCase(), item);
    }
    
    // Also add without folder path for more flexible matching
    const nameOnly = path.basename(item.originalPath);
    if (nameOnly.toLowerCase() !== item.fileName.toLowerCase()) {
      mediaByName.set(nameOnly.toLowerCase(), item);
    }
    
    // Pre-calculate the best path for each media item and store it for quick lookup
    if (item.sizes) {
      // Get the preferred size with fallbacks
      const sizes = item.sizes[preferredSize] || 
                   item.sizes.md || 
                   item.sizes.sm || 
                   item.sizes.lg || 
                   item.sizes.original;
                   
      if (sizes && sizes.length > 0) {
        // Find the best format (prefer webp)
        const webpFormat = sizes.find(s => s.format === 'webp');
        const avifFormat = sizes.find(s => s.format === 'avif');
        const jpegFormat = sizes.find(s => s.format === 'jpeg' || s.format === 'jpg');
        const bestSize = webpFormat || avifFormat || jpegFormat || sizes[0];
        
        // Use absolute path if requested and available
        const bestPath = useAbsolutePaths && bestSize.absolutePublicPath
          ? bestSize.absolutePublicPath 
          : bestSize.publicPath;
          
        // Store this mapping
        bestPathLookup.set(item.originalPath.toLowerCase(), bestPath);
        
        // Also store for effective path
        if (item.effectivePath) {
          bestPathLookup.set(item.effectivePath.toLowerCase(), bestPath);
        }
        
        // And for hash path
        if (item.hashPath) {
          bestPathLookup.set(item.hashPath.toLowerCase(), bestPath);
        }
      }
    }
  });

  return (tree: Root) => {
    // Visit all image nodes
    visit(tree, 'image', (node) => {
      // Skip external URLs with protocol (http://, https://, etc.)
      if (node.url.match(/^(https?|ftp):\/\//)) {
        return;
      }
      
      // Also skip absolute URLs starting with / or data: URLs
      if (node.url.startsWith('/') || node.url.startsWith('data:')) {
        return;
      }
      
      // Get the filename for alt text if not already provided
      const mediaFileName = path.basename(node.url);
      const alt = node.alt || mediaFileName;
      
      // Normalize the path with consistent handling
      const normalizedMediaLink = node.url.replace(/\\/g, '/');
      
      // Create normalized variations for better matching
      const withLeadingSlash = normalizedMediaLink.startsWith('/') ? normalizedMediaLink : `/${normalizedMediaLink}`;
      const withoutLeadingSlash = normalizedMediaLink.startsWith('/') ? normalizedMediaLink.substring(1) : normalizedMediaLink;
      
      // List of path variations to check (in order of priority)
      const pathVariations: string[] = [
        normalizedMediaLink,
        normalizedMediaLink.toLowerCase(),
        withLeadingSlash,
        withLeadingSlash.toLowerCase(),
        withoutLeadingSlash,
        withoutLeadingSlash.toLowerCase(),
        path.basename(normalizedMediaLink),
        path.basename(normalizedMediaLink).toLowerCase()
      ];
      
      // PRIORITY 1: Check if we have a match in bestPathLookup
      let found = false;
      for (const pathVar of pathVariations) {
        if (bestPathLookup.has(pathVar)) {
          const bestPath = bestPathLookup.get(pathVar)!;
          // Update the node url with optimized path
          node.url = bestPath;
          // Add additional properties to the node
          node.data = node.data || {};
          node.data.hProperties = {
            loading: 'lazy',
            class: 'markdown-media best-path'
          };
          found = true;
          break;
        }
      }
      
      // PRIORITY 2: Check the mediaPathMap if not found in bestPathLookup
      if (!found) {
        for (const pathVar of pathVariations) {
          if (mediaPathMap[pathVar]) {
            // Update the node url with optimized path
            node.url = mediaPathMap[pathVar];
            // Add additional properties to the node
            node.data = node.data || {};
            node.data.hProperties = {
              loading: 'lazy',
              class: 'markdown-media mapped'
            };
            found = true;
            break;
          }
        }
      }
      
      // PRIORITY 3: Fall back to mediaData lookup
      if (!found) {
        const normalizedPath = normalizedMediaLink.toLowerCase();
        const normalizedName = mediaFileName.toLowerCase();
        
        // Find the media item by checking multiple possible keys
        const mediaItem: MediaFileData | undefined = mediaByPath.get(normalizedPath) || 
                        mediaByEffectivePath.get(normalizedPath) ||
                        mediaByHashPath.get(normalizedPath) ||
                        mediaByName.get(normalizedName) || 
                        mediaByName.get(normalizedPath);
        
        if (mediaItem) {
          // Get the preferred size with fallbacks
          const sizes = mediaItem.sizes[preferredSize] || 
                       mediaItem.sizes.md || 
                       mediaItem.sizes.sm || 
                       mediaItem.sizes.lg || 
                       mediaItem.sizes.original;
          
          if (sizes && sizes.length > 0) {
            // Find the best format (prefer webp)
            const webpFormat = sizes.find(s => s.format === 'webp');
            const avifFormat = sizes.find(s => s.format === 'avif');
            const jpegFormat = sizes.find(s => s.format === 'jpeg' || s.format === 'jpg');
            const bestSize = webpFormat || avifFormat || jpegFormat || sizes[0];
            
            // Use absolute path if requested and available
            const imagePath = useAbsolutePaths && bestSize.absolutePublicPath
              ? bestSize.absolutePublicPath 
              : bestSize.publicPath;
            
            // Update the node url with optimized path
            node.url = imagePath;
            // Add additional properties to the node
            node.data = node.data || {};
            node.data.hProperties = {
              width: bestSize.width,
              height: bestSize.height,
              loading: 'lazy',
              class: `markdown-media size-${preferredSize}`
            };
            
            // Update the title with dimensions if available
            node.title = `${node.title || mediaFileName} (${bestSize.width}x${bestSize.height})`;
          } else {
            // No size variants found, use default
            node.url = defaultImage;
            node.title = `Image not found: ${mediaFileName}`;
            node.data = node.data || {};
            node.data.hProperties = {
              width: 400,
              height: 300,
              class: 'markdown-media placeholder'
            };
          }
        } else {
          // Media not found, use default image
          node.url = defaultImage;
          node.title = `Image not found: ${mediaFileName}`;
          node.data = node.data || {};
          node.data.hProperties = {
            width: 400,
            height: 300,
            class: 'markdown-media placeholder'
          };
        }
      }
    });
  };
};
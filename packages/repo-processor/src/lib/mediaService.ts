// mediaService.ts
import path from 'path';

// Import types from centralized type system
import type { MediaFileData, MediaPathMap } from '../types';

// Import unified resolution utilities
import { resolveFile, createPathVariations as createBasePathVariations } from './fileResolver';

// Default placeholder image path
const DEFAULT_IMAGE = '/placeholder/400/300';

export interface MediaServiceOptions {
  mediaData?: MediaFileData[];
  mediaPathMap?: MediaPathMap;
  defaultImage?: string;
  basePath?: string;
  useAbsolutePaths?: boolean;
  preferredSize?: 'sm' | 'md' | 'lg';
  enableCssRatio?: boolean;
}

/**
 * MediaService provides shared functionality for processing media in markdown and Obsidian formats
 */
export class MediaService {
  private mediaByName: Map<string, MediaFileData[]>; // Changed to array for multiple files with same name
  private mediaByPath: Map<string, MediaFileData>;
  private mediaByEffectivePath: Map<string, MediaFileData>;
  private mediaByHashPath: Map<string, MediaFileData>;
  private bestPathLookup: Map<string, string>;
  private mediaPathMap: MediaPathMap;
  private defaultImage: string;
  private basePath: string;
  private useAbsolutePaths: boolean;
  private preferredSize: 'sm' | 'md' | 'lg'| 'xl'| 'xs';
  private enableCssRatio: boolean;
  private isFirstImage: boolean = true;

  constructor(options: MediaServiceOptions = {}) {
    const {
      mediaData = [],
      mediaPathMap = {},
      defaultImage = DEFAULT_IMAGE,
      basePath = '',
      useAbsolutePaths = false,
      preferredSize = 'lg',
      enableCssRatio = true
    } = options;

    this.mediaPathMap = mediaPathMap;
    this.defaultImage = defaultImage;
    this.basePath = basePath;
    this.useAbsolutePaths = useAbsolutePaths;
    this.preferredSize = preferredSize;
    this.enableCssRatio = enableCssRatio;
    this.isFirstImage = true;

    // Initialize lookup maps
    const maps = this.createMediaLookupMaps(mediaData);
    this.mediaByName = maps.mediaByName;
    this.mediaByPath = maps.mediaByPath;
    this.mediaByEffectivePath = maps.mediaByEffectivePath;
    this.mediaByHashPath = maps.mediaByHashPath;
    this.bestPathLookup = maps.bestPathLookup;
  }

  /**
   * Reset the first image flag for a new document
   */
  public resetFirstImageFlag(): void {
    this.isFirstImage = true;
  }

  /**
   * Get the first image URL that would be used
   * @param mediaLink The media link to check
   * @param currentFilePath The path of the current markdown file being processed
   * @returns The first image URL or null if not found
   */
  public getFirstImageUrl(mediaLink: string, currentFilePath?: string): string | null {
    // Get the filename for alt text
    const mediaFileName = path.basename(mediaLink);
    
    // Get path variations for matching
    const pathVariations = this.createPathVariations(mediaLink, currentFilePath);
    
    // Try to find the best path
    const bestPathResult = this.findBestMediaPath(pathVariations);
    
    if (bestPathResult.found && bestPathResult.path) {
      return bestPathResult.path;
    }
    
    // Try to find the media item directly
    if (!mediaLink.match(/^(https?|ftp):\/\//)) {
      const normalizedPath = mediaLink.toLowerCase();
      const normalizedName = mediaFileName.toLowerCase();
      
      // Find the media item
      const mediaItem = this.findMediaItem(normalizedPath, normalizedName, currentFilePath);
      
      if (mediaItem) {
        // Get the best size variant
        const bestVariant = this.getBestSizeVariant(mediaItem);
        
        if (bestVariant) {
          return bestVariant.imagePath;
        }
      }
    }
    
    return null;
  }

  /**
   * Creates media lookup maps for efficient media matching
   */
  private createMediaLookupMaps(mediaData: MediaFileData[]): {
    mediaByName: Map<string, MediaFileData[]>;
    mediaByPath: Map<string, MediaFileData>;
    mediaByEffectivePath: Map<string, MediaFileData>;
    mediaByHashPath: Map<string, MediaFileData>;
    bestPathLookup: Map<string, string>;
  } {
    const mediaByName = new Map<string, MediaFileData[]>();
    const mediaByPath = new Map<string, MediaFileData>();
    const mediaByEffectivePath = new Map<string, MediaFileData>();
    const mediaByHashPath = new Map<string, MediaFileData>();
    const bestPathLookup = new Map<string, string>();

    mediaData.forEach(item => {
      // Store by filename (case-insensitive) - support multiple files with same name
      const lowerFileName = item.fileName.toLowerCase();
      if (!mediaByName.has(lowerFileName)) {
        mediaByName.set(lowerFileName, []);
      }
      mediaByName.get(lowerFileName)!.push(item);
      
      // Store by original path (case-insensitive for lookups)
      mediaByPath.set(item.originalPath.toLowerCase(), item);
      
      // Also store with original case for exact matches
      mediaByPath.set(item.originalPath, item);
      
      // Store by effective path (used in rendered HTML)
      if (item.effectivePath) {
        mediaByEffectivePath.set(item.effectivePath.toLowerCase(), item);
        mediaByEffectivePath.set(item.effectivePath, item);
      }
      
      // Store by hash path if available
      if (item.hashPath) {
        mediaByHashPath.set(item.hashPath.toLowerCase(), item);
        mediaByHashPath.set(item.hashPath, item);
      }
      
      // Also add without folder path for more flexible matching
      const nameOnly = path.basename(item.originalPath);
      const lowerNameOnly = nameOnly.toLowerCase();
      if (lowerNameOnly !== lowerFileName) {
        if (!mediaByName.has(lowerNameOnly)) {
          mediaByName.set(lowerNameOnly, []);
        }
        mediaByName.get(lowerNameOnly)!.push(item);
      }
      
      // Build the best path lookup for quick access
      this.buildBestPathForItem(bestPathLookup, item);
    });

    return {
      mediaByName,
      mediaByPath,
      mediaByEffectivePath,
      mediaByHashPath,
      bestPathLookup
    };
  }

  /**
   * Builds the best path mapping for a media item
   */
  private buildBestPathForItem(bestPathLookup: Map<string, string>, item: MediaFileData): void {
    if (!item.sizes) return;

    // Get the preferred size with fallbacks
    const sizes = item.sizes[this.preferredSize] || 
                 item.sizes.lg || 
                 item.sizes.md || 
                 item.sizes.sm || 
                 item.sizes.original;
                 
    if (sizes && sizes.length > 0) {
      // Find the best format (prefer webp)
      const bestSize = this.selectBestFormat(sizes);
      
      // Use absolute path if requested and available
      const bestPath = this.useAbsolutePaths && bestSize.absolutePublicPath
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

  /**
   * Selects the best format from available size variants
   */
  private selectBestFormat(sizes: any[]): any {
    // Find the best format (prefer webp)
    const webpFormat = sizes.find((s: {format: string}) => s.format === 'webp');
    const avifFormat = sizes.find((s: {format: string}) => s.format === 'avif');
    const jpegFormat = sizes.find((s: {format: string}) => s.format === 'jpeg' || s.format === 'jpg');
    return webpFormat || avifFormat || jpegFormat || sizes[0];
  }

  /**
   * Normalizes paths and creates variations for flexible matching
   */
  public createPathVariations(mediaLink: string, currentFilePath?: string): string[] {
    // Use the unified path variation creator
    return createBasePathVariations(mediaLink, currentFilePath);
  }

  /**
   * Finds the best media path from different lookup sources
   */
  public findBestMediaPath(pathVariations: string[]): {
    found: boolean;
    path?: string;
    lookupType?: 'best-path' | 'mapped'
  } {
    // PRIORITY 1: Check if we have a match in bestPathLookup (case-sensitive first, then case-insensitive)
    for (const pathVar of pathVariations) {
      if (this.bestPathLookup.has(pathVar)) {
        return {
          found: true,
          path: this.bestPathLookup.get(pathVar)!,
          lookupType: 'best-path'
        };
      }
      // Also try lowercase version
      const lowerPathVar = pathVar.toLowerCase();
      if (lowerPathVar !== pathVar && this.bestPathLookup.has(lowerPathVar)) {
        return {
          found: true,
          path: this.bestPathLookup.get(lowerPathVar)!,
          lookupType: 'best-path'
        };
      }
    }

    // PRIORITY 2: Check the mediaPathMap if not found in bestPathLookup (case-sensitive)
    for (const pathVar of pathVariations) {
      if (this.mediaPathMap[pathVar]) {
        return {
          found: true,
          path: this.mediaPathMap[pathVar],
          lookupType: 'mapped'
        };
      }
    }

    // PRIORITY 3: Case-insensitive fallback for mediaPathMap
    // Build a lowercase map of mediaPathMap keys for comparison
    const mediaPathMapKeys = Object.keys(this.mediaPathMap);
    for (const pathVar of pathVariations) {
      const lowerPathVar = pathVar.toLowerCase();
      for (const mapKey of mediaPathMapKeys) {
        if (mapKey.toLowerCase() === lowerPathVar) {
          return {
            found: true,
            path: this.mediaPathMap[mapKey],
            lookupType: 'mapped'
          };
        }
      }
    }

    return { found: false };
  }

  /**
   * Finds a media item in various lookup maps
   */
  public findMediaItem(normalizedPath: string, normalizedName: string, currentFilePath?: string): MediaFileData | undefined {
    // Use the unified resolver
    const resolved = resolveFile(normalizedPath, {
      byPath: this.combinePathMaps(),
      byName: this.mediaByName,
      currentFilePath,
      extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.mp4', '.webm']
    });
    
    return resolved || undefined;
  }
  
  /**
   * Combine all path-based maps for unified resolution
   */
  private combinePathMaps(): Map<string, MediaFileData> {
    const combined = new Map<string, MediaFileData>();
    
    // Add all entries from path maps
    for (const [key, value] of this.mediaByPath) {
      combined.set(key, value);
    }
    
    for (const [key, value] of this.mediaByEffectivePath) {
      combined.set(key, value);
    }
    
    for (const [key, value] of this.mediaByHashPath) {
      combined.set(key, value);
    }
    
    return combined;
  }

  /**
   * Get the best size variant for a media item
   */
  public getBestSizeVariant(mediaItem: MediaFileData): { 
    imagePath: string;
    width?: number;
    height?: number;
    format?: string;
    size?: any;
  } | undefined {
    if (!mediaItem.sizes) return undefined;

    // Get the preferred size with fallbacks
    const sizes = mediaItem.sizes[this.preferredSize] || 
                 mediaItem.sizes.lg || 
                 mediaItem.sizes.md || 
                 mediaItem.sizes.sm || 
                 mediaItem.sizes.original;
    
    if (!sizes || sizes.length === 0) return undefined;

    // Find the best format
    const bestSize = this.selectBestFormat(sizes);
    
    // Use absolute path if requested and available
    const imagePath = this.useAbsolutePaths && bestSize.absolutePublicPath
      ? bestSize.absolutePublicPath 
      : bestSize.publicPath;
    
    return {
      imagePath,
      width: bestSize.width,
      height: bestSize.height,
      format: bestSize.format,
      size: bestSize
    };
  }

  /**
   * Create default image properties when media is not found
   */
  public createDefaultImageProperties(alt: string, classPrefix: string): {
    url: string;
    title: string;
    width: number;
    height: number;
    class: string;
  } {
    return {
      url: this.defaultImage,
      title: `Image not found: ${alt}`,
      width: 400,
      height: 300,
      class: `${classPrefix} placeholder`
    };
  }

  /**
   * Process a markdown image node
   * @param node The image node to process
   * @param classPrefix The CSS class prefix to use for the image
   * @param currentFilePath The path of the current markdown file being processed
   */
  public processMarkdownImageNode(node: { 
    url: string; 
    alt?: string; 
    title?: string; 
    data?: any 
  }, classPrefix: string = 'md-image', currentFilePath?: string): void {
    // Skip data: URLs
    if (node.url.startsWith('data:')) {
      return;
    }
    
    // Get the filename for alt text if not already provided
    const mediaFileName = path.basename(node.url);
    const alt = node.alt || mediaFileName;
    
    // Get path variations for matching
    const pathVariations = this.createPathVariations(node.url, currentFilePath);
    
    // Try to find the best path
    const bestPathResult = this.findBestMediaPath(pathVariations);
    
    if (bestPathResult.found && bestPathResult.path) {
      // Update the node url with optimized path
      node.url = bestPathResult.path;
      
      // Add additional properties to the node
      node.data = node.data || {};
      
      // Check if we can find the media item to get dimensions for aspect ratio
      const normalizedPath = node.url.toLowerCase();
      const normalizedName = mediaFileName.toLowerCase();
      const mediaItem = this.findMediaItem(normalizedPath, normalizedName, currentFilePath);
      
      if (mediaItem) {
        const bestVariant = this.getBestSizeVariant(mediaItem);
        
        if (bestVariant && bestVariant.width && bestVariant.height) {
          // We have dimensions, so we can create enhanced properties
          const classNames = [`${classPrefix}`, bestPathResult.lookupType];
          if (this.isFirstImage) {
            classNames.push('first-image');
            this.isFirstImage = false;
          }
          
          const hProperties: any = {
            width: bestVariant.width,
            height: bestVariant.height,
            class: classNames.join(' ')
          };
          
          // Only add loading="lazy" if this is not the first image
          if (!this.isFirstImage) {
            hProperties.loading = 'lazy';
          }
          
          // Add aspect ratio if enabled
          this.addAspectRatioIfEnabled(hProperties, bestVariant.width, bestVariant.height);
          
          node.data.hProperties = hProperties;
          return;
        }
      }
      
      // Default case without dimensions or aspect ratio
      const classNames = [`${classPrefix}`, bestPathResult.lookupType];
      if (this.isFirstImage) {
        classNames.push('first-image');
        this.isFirstImage = false;
      }
      
      const hProperties: any = {
        class: classNames.join(' ')
      };
      
      // Only add loading="lazy" if this is not the first image
      if (!this.isFirstImage) {
        hProperties.loading = 'lazy';
      }
      
      node.data.hProperties = hProperties;
      return;
    }
    
    // Try to find the media item if not a remote URL
    if (!node.url.match(/^(https?|ftp):\/\//)) {
      const normalizedPath = node.url.toLowerCase();
      const normalizedName = mediaFileName.toLowerCase();
      
      // Find the media item
      const mediaItem = this.findMediaItem(normalizedPath, normalizedName, currentFilePath);
      
      if (mediaItem) {
        // Get the best size variant
        const bestVariant = this.getBestSizeVariant(mediaItem);
        
        if (bestVariant) {
          // Update the node url with optimized path
          node.url = bestVariant.imagePath;
          
          // Add additional properties to the node
          node.data = node.data || {};
          const classNames = [`${classPrefix}`, `size-${this.preferredSize}`];
          if (this.isFirstImage) {
            classNames.push('first-image');
            this.isFirstImage = false;
          }
          
          const hProperties: any = {
            width: bestVariant.width,
            height: bestVariant.height,
            class: classNames.join(' ')
          };
          
          // Only add loading="lazy" if this is not the first image
          if (!this.isFirstImage) {
            hProperties.loading = 'lazy';
          }
          
          // Add aspect ratio if enabled
          this.addAspectRatioIfEnabled(hProperties, bestVariant.width, bestVariant.height);
          
          node.data.hProperties = hProperties;
          
          // Update the title with dimensions if available
          node.title = `${node.title || mediaFileName} (${bestVariant.width}x${bestVariant.height})`;
          return;
        }
      }
      
      // If we get here, we couldn't find a suitable media item
      const defaultProps = this.createDefaultImageProperties(mediaFileName, classPrefix);
      node.url = defaultProps.url;
      node.title = defaultProps.title;
      node.data = node.data || {};
      node.data.hProperties = {
        width: defaultProps.width,
        height: defaultProps.height,
        class: defaultProps.class
      };
    }
  }

  /**
   * Process Obsidian media text and extract media links
   */
  public processObsidianMediaText(
    text: string, 
    mediaRegex: RegExp, 
    classPrefix: string = 'obsidian-media',
    currentFilePath?: string
  ): {
    newNodes: Array<any>; // Using Array<any> instead of any[] for clearer type definition
    matched: boolean;
  } {
    const newNodes: any[] = [];
    let lastIndex = 0;
    
    // Find all matches in the text node
    const matches = Array.from(text.matchAll(mediaRegex));
    
    if (matches.length === 0) {
      return { newNodes: [], matched: false };
    }
    
    for (const match of matches) {
      const [fullMatch, mediaLink] = match;
      const matchIndex = match.index as number;
      
      // Add text before the match
      if (matchIndex > lastIndex) {
        const textNode = { type: 'text', value: text.slice(lastIndex, matchIndex) };
        newNodes.push(textNode);
      }
      
      // Get the filename for alt text
      const mediaFileName = path.basename(mediaLink);
      
      // Get path variations for matching
      const pathVariations = this.createPathVariations(mediaLink);
      
      // Try to find the best path
      const bestPathResult = this.findBestMediaPath(pathVariations);
      
      if (bestPathResult.found && bestPathResult.path) {
        // Check if we can find the media item to get dimensions
        const normalizedPath = mediaLink.toLowerCase();
        const normalizedName = mediaFileName.toLowerCase();
        const mediaItem = this.findMediaItem(normalizedPath, normalizedName, currentFilePath);
        
        if (mediaItem) {
          const bestVariant = this.getBestSizeVariant(mediaItem);
          
          if (bestVariant && bestVariant.width && bestVariant.height) {
            // We have dimensions, so we can create an enhanced image node
            const classNames = [`${classPrefix}`, bestPathResult.lookupType];
            if (this.isFirstImage) {
              classNames.push('first-image');
              this.isFirstImage = false;
            }
            
            const hProperties: any = {
              width: bestVariant.width,
              height: bestVariant.height,
              loading: 'lazy',
              class: classNames.join(' ')
            };
            
            // Add aspect ratio if enabled
            this.addAspectRatioIfEnabled(hProperties, bestVariant.width, bestVariant.height);
            
            newNodes.push({
              type: 'image',
              url: bestPathResult.path,
              alt: mediaFileName,
              title: mediaFileName,
              data: { hProperties }
            });
            
            lastIndex = matchIndex + fullMatch.length;
            continue;
          }
        }
        
        // Default case without dimensions or aspect ratio
        const classNames = [`${classPrefix}`, bestPathResult.lookupType];
        if (this.isFirstImage) {
          classNames.push('first-image');
          this.isFirstImage = false;
        }
        
        const hProperties: any = {
          class: classNames.join(' ')
        };
        
        // Only add loading="lazy" if this is not the first image
        if (!this.isFirstImage) {
          hProperties.loading = 'lazy';
        }
        
        newNodes.push({
          type: 'image',
          url: bestPathResult.path,
          alt: mediaFileName,
          title: mediaFileName,
          data: { hProperties }
        });
      } else {
        // Try to find the media item directly
        const normalizedPath = mediaLink.toLowerCase();
        const normalizedName = mediaFileName.toLowerCase();
        
        // Find the media item
        const mediaItem = this.findMediaItem(normalizedPath, normalizedName, currentFilePath);
        
        if (mediaItem) {
          // Get the best size variant
          const bestVariant = this.getBestSizeVariant(mediaItem);
          
          if (bestVariant) {
            // Create image node
            const classNames = [`${classPrefix}`, `size-${this.preferredSize}`];
            if (this.isFirstImage) {
              classNames.push('first-image');
              this.isFirstImage = false;
            }
            
            const hProperties: any = {
              width: bestVariant.width,
              height: bestVariant.height,
              loading: 'lazy',
              class: classNames.join(' ')
            };
            
            // Add aspect ratio if enabled
            this.addAspectRatioIfEnabled(hProperties, bestVariant.width, bestVariant.height);
            
            newNodes.push({
              type: 'image',
              url: bestVariant.imagePath,
              alt: mediaFileName,
              title: `${mediaFileName} (${bestVariant.width}x${bestVariant.height})`,
              data: {
                hProperties
              }
            });
          } else {
            // No size variants found, use default
            newNodes.push(this.createDefaultImageNode(mediaFileName, classPrefix));
          }
        } else {
          // Media not found, use default image
          newNodes.push(this.createDefaultImageNode(mediaFileName, classPrefix));
        }
      }
      
      lastIndex = matchIndex + fullMatch.length;
    }
    
    // Add any remaining text
    if (lastIndex < text.length) {
      const textNode = { type: 'text', value: text.slice(lastIndex) };
      newNodes.push(textNode);
    }
    
    return { newNodes, matched: true };
  }

  /**
   * Create a default image node
   */
  private createDefaultImageNode(alt: string, classPrefix: string): any {
    const defaultProps = this.createDefaultImageProperties(alt, classPrefix);
    return {
      type: 'image',
      url: defaultProps.url,
      alt,
      title: defaultProps.title,
      data: {
        hProperties: {
          width: defaultProps.width,
          height: defaultProps.height,
          class: defaultProps.class
        }
      }
    };
  }
  
  /**
   * Adds aspect ratio to hProperties if enableCssRatio is true and dimensions are available
   */
  private addAspectRatioIfEnabled(hProperties: any, width?: number, height?: number): void {
    if (this.enableCssRatio && width && height) {
      hProperties.style = `aspect-ratio: ${width} / ${height};`;
    }
  }
}
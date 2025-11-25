// Media processing types

/**
 * Interface for media file data
 */
export interface MediaFileData {
  originalPath: string;
  fileName: string;
  fileExt: string;
  mimeType: string;
  effectivePath: string; // The effective path used in rendered HTML
  hashPath?: string; // The hash-based path if using hashing
  sizes: {
    [key: string]: {
      width: number;
      height: number;
      format: string;
      outputPath: string;
      publicPath: string;
      absolutePublicPath?: string; // New property for absolute URL with domain
      size: number; // File size in bytes
      skippedOptimization?: boolean; // Flag to indicate if optimization was skipped
    }[];
  };
  metadata?: {
    width?: number;
    height?: number;
    format?: string;
    size?: number;
    hash?: string; // File hash
    // No exif data included
  };
}

/**
 * Options for processing media files
 */
export interface ProcessMediaOptions {
  mediaOutputFolder?: string;
  mediaPathPrefix?: string;
  optimizeImages?: boolean;
  imageSizes?: Array<{ width: number | null; height: number | null; suffix: string }>;
  imageFormats?: Array<{ format: string; options: any }>;
  skipExisting?: boolean; // Option to skip existing files
  forceReprocessMedias?: boolean; // New option to force reprocessing of media files
  domain?: string; // Option for domain to create absolute URLs
  useMediaHash?: boolean; // Option to use file hash for storing media files
  useMediaHashSharding?: boolean; // Option to shard hashed media files by first 2 characters
  skipHashes?: string[]; // List of file hashes to skip processing
  debug?: number;
  issueCollector?: any; // Optional issue collector for tracking processing issues
}

/**
 * Media path mapping for image replacement
 */
export interface MediaPathMap {
  /** Maps original relative paths to optimized public paths */
  [originalPath: string]: string;
}

/**
 * Return type for the processMedia function
 */
export interface ProcessMediaResult {
  /** Array of processed media file data */
  mediaData: MediaFileData[];
  /** Maps original paths to optimized paths */
  pathMap: MediaPathMap;
  /** Maps original paths to file hashes */
  pathHashMap: Record<string, string>;
  /** Maps original paths to best URLs */
  pathUrlMap: Record<string, string>;
}

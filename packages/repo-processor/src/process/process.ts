// process.ts - Main entry point for programmatic processing

import path from "node:path";
import fs from "node:fs";
import { processFolder } from "./processFolder";
import { processMedia } from "./processMedia";
import { jsonStringify, writeToFileSync, toSlug, calculateFileHash } from "../lib/utility";

// Import types
import type { 
  FileData, 
  ProcessOptions, 
  ProcessMediaOptions, 
  MediaFileData, 
  MediaPathMap,
  GraphData
} from "../types";
import type { ProcessingIssues } from "../types/issues";
import { IssueCollector } from "../services/issueCollector";

/**
 * Interface for image size configuration
 */
interface ImageSize {
  width: number | null;
  height: number | null;
  suffix: string;
}

/**
 * Interface for image format configuration
 */
interface ImageFormat {
  format: string;
  options: any;
}

/**
 * Interface for directory configuration
 */
interface DirectoryConfig {
  base?: string;                   // Base directory for resolving paths (default: cwd)
  input: string;                   // Input directory path (Obsidian vault)
  output?: string;                 // Main output directory (default: "./build")
}

/**
 * Interface for file naming configuration
 */
interface FileConfig {
  // Post files
  postsFilename?: string;          // Filename for output JSON (default: "posts.json")
  postsFolder?: string;            // Folder name for post JSON files (default: "_posts")
  slugMapFilename?: string;        // Filename for slug-to-hash map (default: "posts-slug-map.json")
  pathMapFilename?: string;        // Filename for path-to-hash map (default: "posts-path-map.json")
  
  // Media files
  mediaFolderName?: string;        // Folder name for media files (default: "_media")
  mediaResultsFilename?: string;   // Filename for media results (default: "media-results.json")
  mediaPathMapFilename?: string;   // Filename for media path map (default: "media-path-map.json")
  mediaPathUrlMapFilename?: string;// Filename for media path-to-url map (default: "media-path-url-map.json")
  mediaPathHashMapFilename?: string;// Filename for media path-to-hash map (default: "media-path-hash-map.json")
}

/**
 * Interface for URL path configuration
 */
interface PathConfig {
  notesPrefix?: string;            // Notes path prefix (default: "/notes")
  assetsPrefix?: string;           // Assets path prefix (default: "/assets")
  mediaPrefix?: string;            // Media path prefix (default: "/media")
  domain?: string;                 // Domain for absolute public paths
  useAbsolutePaths?: boolean;      // Use absolute paths with domain (default: true)
}

/**
 * Interface for media processing configuration
 */
interface MediaConfig {
  skip?: boolean;                  // Skip media processing (default: false)
  optimize?: boolean;              // Optimize images (default: true)
  skipExisting?: boolean;          // Skip processing existing files (default: false)
  forceReprocess?: boolean;        // Force reprocessing of files (default: false)
  sizes?: ImageSize[];             // Image sizes for optimization
  formats?: ImageFormat[];         // Image formats for conversion
  useHash?: boolean;               // Use hash-based paths (default: false)
  useHashSharding?: boolean;       // Use sharding for hash-based paths (default: false)
  skipHashes?: string[];           // Skip processing for specified file hashes
  preferredSize?: 'sm' | 'md' | 'lg'; // Preferred size (default: 'lg')
}

/**
 * Interface for post processing configuration
 */
interface PostConfig {
  exportEnabled?: boolean;         // Export individual posts (default: false)
  includeMediaData?: boolean;      // Include media data in first page (default: false)
  processAllFiles?: boolean;       // Process all files regardless of frontmatter (default: false)
}

/**
 * Main configuration interface for the RepoProcessor
 * Uses a nested structure for organization
 */
interface ProcessConfigNested {
  // Core directory configuration - the only required property is dir.input
  dir: DirectoryConfig;
  
  // File naming configuration (all optional with defaults)
  files?: FileConfig;
  
  // Path prefixes configuration
  paths?: PathConfig;
  
  // Media processing options
  media?: MediaConfig;
  
  // Post processing options
  posts?: PostConfig;
  
  // Debug level (0-3)
  debugLevel?: number;
  
  // Iframe embed options
  iframeEmbedOptions?: {
    baseUrl?: string;
    features?: {
      mermaid?: boolean;
      html?: boolean;
      markdown?: boolean;
      code?: boolean;
      video?: boolean;
      midi?: boolean;
      model3d?: boolean;
    };
    iframeAttributes?: Record<string, string>;
    encoding?: {
      method?: 'base64' | 'url';
      urlEncode?: boolean;
    };
    processNakedUrls?: boolean;
    processLinks?: boolean;
  };
  
  // Rehype Mermaid options  
  rehypeMermaidOptions?: {
    enabled?: boolean;
    strategy?: 'img-png' | 'img-svg' | 'inline-svg' | 'pre-mermaid';
    dark?: boolean;
    prefix?: string;
    mermaidConfig?: Record<string, any>;
  };
  
  // Additional options
  imgLinkBuilderOpts?: Record<string, any>; // Options for the image link builder
}

/**
 * Configuration interface that supports both flat and grouped structures
 */
export interface ProcessConfig {
  // --- Flat configuration (direct properties) ---
  
  // Core directory configuration
  inputPath?: string;                // Input directory path (Obsidian vault)
  outputPath?: string;              // Output JSON file path (default: "build/posts.json")
  buildDir?: string;                // Build directory (default: "build")
  baseDir?: string;                 // Base directory for resolving paths (default: cwd)
  
  // File naming
  postsFilename?: string;           // Filename for output JSON (default: "posts.json")
  postsFolder?: string;             // Folder name for post JSON files (default: "_posts")
  slugMapFilename?: string;         // Filename for slug-to-hash map (default: "posts-slug-map.json")
  pathMapFilename?: string;         // Filename for path-to-hash map (default: "posts-path-map.json")
  mediaFolderName?: string;         // Folder name for media files (default: "_medias")
  mediaResultsFilename?: string;    // Filename for media results (default: "media-results.json")
  mediaPathMapFilename?: string;    // Filename for media path map (default: "media-path-map.json")
  mediaPathUrlMapFilename?: string; // Filename for media path-to-url map (default: "media-path-url-map.json")
  mediaPathHashMapFilename?: string;// Filename for media path-to-hash map (default: "media-path-hash-map.json")
  
  // URL path configuration
  notePathPrefix?: string;          // Notes path prefix (default: "/notes")
  assetPathPrefix?: string;         // Assets path prefix (default: "/assets")
  mediaPathPrefix?: string;         // Media path prefix (default: "/media")
  domain?: string;                  // Domain for absolute public paths
  useAbsolutePaths?: boolean;       // Use absolute paths with domain (default: true)
  
  // Media processing
  skipMedia?: boolean;              // Skip media processing (default: false)
  optimizeImages?: boolean;         // Optimize images (default: true)
  skipExisting?: boolean;           // Skip processing existing files (default: false)
  forceReprocessMedias?: boolean;   // Force reprocessing of files (default: false)
  imageSizes?: Array<{width: number|null, height: number|null, suffix: string}>;
  imageFormats?: Array<{format: string, options: any}>;
  useMediaHash?: boolean;           // Use hash-based paths (default: false)
  useMediaHashSharding?: boolean;   // Use sharding for hash-based paths (default: false)
  skipHashes?: string[];            // Skip processing for specified file hashes
  preferredSize?: 'sm' | 'md' | 'lg'; // Preferred size (default: 'lg')
  
  // Post processing
  exportPosts?: boolean;            // Export individual posts (default: false)
  includeMediaData?: boolean;       // Include media data in first page (default: false)
  processAllFiles?: boolean;        // Process all files regardless of frontmatter (default: false)
  
  // Miscellaneous
  debugLevel?: number;              // Debug level (0-3)
  imgLinkBuilderOpts?: Record<string, any>; // Options for the image link builder
  
  // Plugin configuration
  iframeEmbedOptions?: ProcessOptions['iframeEmbedOptions'];
  rehypeMermaidOptions?: ProcessOptions['rehypeMermaidOptions'];
  
  // --- Grouped configuration (nested properties) ---
  
  // Core directory configuration
  dir?: DirectoryConfig;
  
  // File naming configuration 
  files?: FileConfig;
  
  // Path prefixes configuration
  paths?: PathConfig;
  
  // Media processing options
  media?: MediaConfig;
  
  // Post processing options
  posts?: PostConfig;
}

/**
 * RepoProcessor - A class for processing Obsidian vaults with media files
 */
class RepoProcessor {
  private config: ProcessConfigNested;
  private cwd: string;
  private buildDir: string;
  private inputPath: string;
  private outputPath: string;
  private mediaOutputFolder: string;
  private mediaResultsPath: string;
  private notePathPrefix: string;
  private assetPathPrefix: string;
  private mediaPathPrefix: string;
  private debugLevel: number;
  private postsDir?: string;
  private issueCollector: IssueCollector;

  /**
   * Create a new RepoProcessor instance
   * @param config Configuration options
   */
  /**
   * Convert flat/mixed config to consistent nested format
   * @param config User-provided configuration (flat, nested, or mixed)
   * @returns Configuration in a standardized nested format
   */
  private static convertToNestedConfig(config: ProcessConfig): ProcessConfigNested {
    // Create a properly typed nested config
    const nestedConfig: ProcessConfigNested = {
      dir: { 
        input: config.inputPath || (config.dir?.input || ''),
        output: config.buildDir || config.dir?.output,
        base: config.baseDir || config.dir?.base
      },
      files: {
        postsFilename: config.postsFilename || config.files?.postsFilename,
        postsFolder: config.postsFolder || config.files?.postsFolder,
        slugMapFilename: config.slugMapFilename || config.files?.slugMapFilename,
        pathMapFilename: config.pathMapFilename || config.files?.pathMapFilename,
        mediaFolderName: config.mediaFolderName || config.files?.mediaFolderName,
        mediaResultsFilename: config.mediaResultsFilename || config.files?.mediaResultsFilename,
        mediaPathMapFilename: config.mediaPathMapFilename || config.files?.mediaPathMapFilename,
        mediaPathUrlMapFilename: config.mediaPathUrlMapFilename || config.files?.mediaPathUrlMapFilename,
        mediaPathHashMapFilename: config.mediaPathHashMapFilename || config.files?.mediaPathHashMapFilename
      },
      paths: {
        notesPrefix: config.notePathPrefix || config.paths?.notesPrefix,
        assetsPrefix: config.assetPathPrefix || config.paths?.assetsPrefix,
        mediaPrefix: config.mediaPathPrefix || config.paths?.mediaPrefix,
        domain: config.domain !== undefined ? config.domain : config.paths?.domain,
        useAbsolutePaths: config.useAbsolutePaths !== undefined ? config.useAbsolutePaths : config.paths?.useAbsolutePaths
      },
      media: {
        skip: config.skipMedia !== undefined ? config.skipMedia : config.media?.skip,
        optimize: config.optimizeImages !== undefined ? config.optimizeImages : config.media?.optimize,
        skipExisting: config.skipExisting !== undefined ? config.skipExisting : config.media?.skipExisting,
        forceReprocess: config.forceReprocessMedias !== undefined ? config.forceReprocessMedias : config.media?.forceReprocess,
        sizes: config.imageSizes || config.media?.sizes,
        formats: config.imageFormats || config.media?.formats,
        useHash: config.useMediaHash !== undefined ? config.useMediaHash : config.media?.useHash,
        useHashSharding: config.useMediaHashSharding !== undefined ? config.useMediaHashSharding : config.media?.useHashSharding,
        skipHashes: config.skipHashes || config.media?.skipHashes,
        preferredSize: config.preferredSize || config.media?.preferredSize
      },
      posts: {
        exportEnabled: config.exportPosts !== undefined ? config.exportPosts : config.posts?.exportEnabled,
        includeMediaData: config.includeMediaData !== undefined ? config.includeMediaData : config.posts?.includeMediaData,
        processAllFiles: config.processAllFiles !== undefined ? config.processAllFiles : config.posts?.processAllFiles
      },
      debugLevel: config.debugLevel,
      imgLinkBuilderOpts: config.imgLinkBuilderOpts,
      iframeEmbedOptions: config.iframeEmbedOptions,
      rehypeMermaidOptions: config.rehypeMermaidOptions
    };
    
    return nestedConfig;
  }
  
  /**
   * Create a normalized configuration object with all defaults applied
   * @param config User-provided configuration
   * @returns Fully normalized configuration with all defaults
   */
  private static normalizeConfig(config: ProcessConfigNested): ProcessConfigNested {
    // Get Node's process.cwd() via a safe import
    const nodeProcess = globalThis.process;
    const currentCwd = nodeProcess?.cwd?.() || ".";
    
    // Normalize directory configuration
    const normalizedDir: DirectoryConfig = {
      base: config.dir.base || currentCwd,
      input: config.dir.input,
      output: config.dir.output || "build"
    };
    
    // Normalize file naming configuration
    const normalizedFiles: FileConfig = {
      // Post files
      postsFilename: config.files?.postsFilename || "posts.json",
      postsFolder: config.files?.postsFolder || "_posts",
      slugMapFilename: config.files?.slugMapFilename || "posts-slug-map.json",
      pathMapFilename: config.files?.pathMapFilename || "posts-path-map.json",
      
      // Media files
      mediaFolderName: config.files?.mediaFolderName || "_medias",
      mediaResultsFilename: config.files?.mediaResultsFilename || "medias.json",
      mediaPathMapFilename: config.files?.mediaPathMapFilename || "media-path-map.json",
      mediaPathUrlMapFilename: config.files?.mediaPathUrlMapFilename || "media-path-url-map.json",
      mediaPathHashMapFilename: config.files?.mediaPathHashMapFilename || "media-path-hash-map.json"
    };
    
    // Normalize path configuration
    const normalizedPaths: PathConfig = {
      notesPrefix: config.paths?.notesPrefix || "/notes",
      assetsPrefix: config.paths?.assetsPrefix || "/assets",
      mediaPrefix: config.paths?.mediaPrefix || "/media",
      domain: config.paths?.domain || "",// "https://static.repo.md", ///erronous - needs projectID
      useAbsolutePaths: config.paths?.useAbsolutePaths ?? false
    };
    
    // Normalize media configuration
    const normalizedMedia: MediaConfig = {
      skip: config.media?.skip ?? false,
      optimize: config.media?.optimize ?? true,
      skipExisting: config.media?.skipExisting ?? false,
      forceReprocess: config.media?.forceReprocess ?? false,
      sizes: config.media?.sizes,
      formats: config.media?.formats,
      useHash: config.media?.useHash ?? false,
      useHashSharding: config.media?.useHashSharding ?? false,
      skipHashes: config.media?.skipHashes || [],
      preferredSize: config.media?.preferredSize || 'lg'
    };
    
    // Normalize post configuration
    const normalizedPosts: PostConfig = {
      exportEnabled: config.posts?.exportEnabled ?? false,
      includeMediaData: config.posts?.includeMediaData ?? false,
      processAllFiles: config.posts?.processAllFiles ?? false
    };
    
    // Normalize iframe embed options with new defaults
    const normalizedIframeEmbedOptions = {
      ...config.iframeEmbedOptions,
      features: {
        mermaid: false, // Default to false (use rehype-mermaid instead)
        html: false,
        markdown: false,
        code: false,
        video: true,
        midi: true,
        model3d: true,
        ...config.iframeEmbedOptions?.features
      }
    };

    // Normalize rehype-mermaid options with defaults
    const normalizedRehypeMermaidOptions = {
      enabled: true, // Default to true
      strategy: 'inline-svg' as const,
      ...config.rehypeMermaidOptions
    };
    

    // Return the fully normalized config
    return {
      dir: normalizedDir,
      files: normalizedFiles,
      paths: normalizedPaths,
      media: normalizedMedia,
      posts: normalizedPosts,
      debugLevel: config.debugLevel ?? 1,
      imgLinkBuilderOpts: config.imgLinkBuilderOpts,
      iframeEmbedOptions: normalizedIframeEmbedOptions,
      rehypeMermaidOptions: normalizedRehypeMermaidOptions
    };
  }

  /**
   * Validate the configuration
   * @param config The configuration to validate
   * @throws Error if configuration is invalid
   */
  private static validateConfig(config: ProcessConfig): void {
    const hasNestedInput = config.dir && typeof config.dir === 'object' && 'input' in config.dir && !!config.dir.input;
    const hasFlatInput = !!config.inputPath;
    
    // Require at least one form of input path
    if (!hasNestedInput && !hasFlatInput) {
      throw new Error("Input path is required (either inputPath or dir.input)");
    }
  }

  constructor(config: ProcessConfig) {
    // Validate the configuration
    RepoProcessor.validateConfig(config);
    
    // Convert to nested format if needed
    const nestedConfig = RepoProcessor.convertToNestedConfig(config);
    
    // Normalize the configuration
    this.config = RepoProcessor.normalizeConfig(nestedConfig);
    
    
    // Set up instance variables from the normalized config
    this.cwd = this.config.dir.base!;
    this.buildDir = path.resolve(this.cwd, this.config.dir.output!);
    this.inputPath = path.resolve(this.cwd, this.config.dir.input);
    
    // Set output paths
    this.outputPath = path.join(this.buildDir, this.config.files!.postsFilename!);
    this.mediaOutputFolder = path.join(this.buildDir, this.config.files!.mediaFolderName!);
    this.mediaResultsPath = path.join(this.buildDir, this.config.files!.mediaResultsFilename!);

    // Set path prefixes
    this.notePathPrefix = this.config.paths!.notesPrefix!;
    this.assetPathPrefix = this.config.paths!.assetsPrefix!;
    this.mediaPathPrefix = this.config.paths!.mediaPrefix!;
    this.debugLevel = this.config.debugLevel!;
    
    // Setup posts directory if needed
    if (this.config.posts!.exportEnabled) {
      this.postsDir = path.join(this.buildDir, this.config.files!.postsFolder!);
    }
    
    // Initialize issue collector
    this.issueCollector = new IssueCollector();
  }

  /**
   * Log a message if the level is below or equal to the debug level
   * @param messageLevel Debug level of the message
   * @param message Message to log
   */
  private log(messageLevel: number, message: string): void {
    if (messageLevel <= this.debugLevel) {
      console.log(message);
    }
  }

  /**
   * Create the build directory if it doesn't exist
   */
  private initBuildDir(): void {
    if (!fs.existsSync(this.buildDir)) {
      fs.mkdirSync(this.buildDir, { recursive: true });
      this.log(1, `📁 Created build directory: ${this.buildDir}`);
    }
  }

  /**
   * Process media files and return the results
   * @returns Object containing media data and path mappings
   */
  private async processMediaFiles(): Promise<{
    mediaData: MediaFileData[];
    mediaPathMap: MediaPathMap;
    mediaPathHashMap: Record<string, string>;
    mediaPathUrlMap: Record<string, string>;
  }> {
    // Use the normalized config
    const mediaConfig = this.config.media!;
    
    if (mediaConfig.skip) {
      this.log(1, `⏭️ Skipping media processing`);
      return { 
        mediaData: [], 
        mediaPathMap: {},
        mediaPathHashMap: {},
        mediaPathUrlMap: {}
      };
    }

    this.log(1, `🔄 Processing media files...`);

    // Create media processing options
    const mediaOptions: ProcessMediaOptions = {
      mediaOutputFolder: this.mediaOutputFolder,
      mediaPathPrefix: this.mediaPathPrefix,
      optimizeImages: mediaConfig.optimize,
      skipExisting: mediaConfig.skipExisting || false,
      forceReprocessMedias: mediaConfig.forceReprocess || false,
      domain: this.config.paths!.domain,
      debug: this.debugLevel,
    };

    // Add optional parameters if provided
    if (mediaConfig.sizes) mediaOptions.imageSizes = mediaConfig.sizes;
    if (mediaConfig.formats) mediaOptions.imageFormats = mediaConfig.formats;
    if (mediaConfig.useHash) mediaOptions.useMediaHash = mediaConfig.useHash;
    if (mediaConfig.useHashSharding) mediaOptions.useMediaHashSharding = mediaConfig.useHashSharding;
    if (mediaConfig.skipHashes && mediaConfig.skipHashes.length > 0) mediaOptions.skipHashes = mediaConfig.skipHashes;
    
    // Pass issue collector to media processing
    mediaOptions.issueCollector = this.issueCollector;

    const mediaResult = await processMedia(this.inputPath, mediaOptions);
    
    this.log(1, `✅ Processed ${mediaResult.mediaData.length} media files`);

    // Return all media path maps
    return { 
      mediaData: mediaResult.mediaData, 
      mediaPathMap: mediaResult.pathMap,
      mediaPathHashMap: mediaResult.pathHashMap,
      mediaPathUrlMap: mediaResult.pathUrlMap
    };
  }

  /**
   * Save media results to JSON files
   * @param mediaData Array of media file data
   * @param mediaPathMap Mapping of original paths to processed paths
   * @param mediaPathHashMap Mapping of original paths to file hashes
   * @param mediaPathUrlMap Mapping of original paths to best URLs
   */
  private saveMediaResults(
    mediaData: MediaFileData[],
    mediaPathMap: MediaPathMap,
    mediaPathHashMap: Record<string, string>,
    mediaPathUrlMap: Record<string, string>
  ): void {
    // Save the main media results file (just the array, not in an object)
    const mediaResultsJson = jsonStringify(mediaData);
    writeToFileSync(this.mediaResultsPath, mediaResultsJson);
    this.log(1, `📝 Media results saved to: ${this.mediaResultsPath}`);
    
    // Save the media path map
    const mediaPathMapPath = path.join(this.buildDir, this.config.files!.mediaPathMapFilename!);
    writeToFileSync(mediaPathMapPath, jsonStringify(mediaPathMap));
    this.log(1, `📝 Media path map saved to: ${mediaPathMapPath}`);
    
    // Save the media path-to-url map
    const mediaPathUrlMapPath = path.join(this.buildDir, this.config.files!.mediaPathUrlMapFilename!);
    writeToFileSync(mediaPathUrlMapPath, jsonStringify(mediaPathUrlMap));
    this.log(1, `📝 Media path-to-URL map saved to: ${mediaPathUrlMapPath}`);
    
    // Save the media path-to-hash map
    const mediaPathHashMapPath = path.join(this.buildDir, this.config.files!.mediaPathHashMapFilename!);
    writeToFileSync(mediaPathHashMapPath, jsonStringify(mediaPathHashMap));
    this.log(1, `📝 Media path-to-hash map saved to: ${mediaPathHashMapPath}`);
    
    // Create and save media hash-to-url map
    const mediaHashUrlMap: Record<string, string> = {};
    // Convert pathHashMap and pathUrlMap to hash-to-url map
    for (const [originalPath, hash] of Object.entries(mediaPathHashMap)) {
      if (mediaPathUrlMap[originalPath]) {
        mediaHashUrlMap[hash] = mediaPathUrlMap[originalPath];
      }
    }
    const mediaHashUrlMapPath = path.join(this.buildDir, "media-hash-url-map.json");
    writeToFileSync(mediaHashUrlMapPath, jsonStringify(mediaHashUrlMap));
    this.log(1, `📝 Media hash-to-URL map saved to: ${mediaHashUrlMapPath}`);
  }

  /**
   * Process markdown files in the vault
   * @param mediaData Array of media file data
   * @param mediaPathMap Mapping of original paths to processed paths
   * @returns Array of processed file data
   */
  private async processMarkdownFiles(
    mediaData: MediaFileData[], 
    mediaPathMap: MediaPathMap
  ): Promise<FileData[]> {
    this.log(1, `🔄 Processing markdown files...`);

    // Get normalized configs
    const pathsConfig = this.config.paths!;
    const postsConfig = this.config.posts!;
    const mediaConfig = this.config.media!;

    // If posts export is enabled, log where they will be created
    if (this.postsDir) {
      this.log(1, `📁 Post export enabled. Will create posts in: ${this.postsDir}`);
    }

    // Create folder processing options
    const folderOptions: ProcessOptions = {
      debug: this.debugLevel,
      notePathPrefix: this.notePathPrefix,
      assetPathPrefix: this.assetPathPrefix,
      mediaData,
      mediaPathMap,
      useAbsolutePaths: pathsConfig.useAbsolutePaths !== false,
      includeMediaData: postsConfig.includeMediaData || false,
      exportPosts: postsConfig.exportEnabled || false,
      postsOutputFolder: this.postsDir,
      preferredSize: mediaConfig.preferredSize || 'lg',
      processAllFiles: postsConfig.processAllFiles || false,
      mediaOptions: {
        domain: pathsConfig.domain
      },
      toLinkBuilderOpts: {
        prefix: this.assetPathPrefix,
        toSlug,
        filePathAllowSet: new Set() // This will be overridden by processFolder
      },
      iframeEmbedOptions: this.config.iframeEmbedOptions,
      rehypeMermaidOptions: this.config.rehypeMermaidOptions
    };
    

    return await processFolder(this.inputPath, folderOptions);
  }

  /**
   * Generate slug-to-hash mapping for quick lookups
   * @param vaultData Array of processed file data  
   * @returns Map of slugs to file hashes
   */
  private generateSlugMap(vaultData: FileData[]): Record<string, string> {
    const slugMap: Record<string, string> = {};
    
    for (const file of vaultData) {
      // Use the pre-calculated hash property
      // Add the slug -> hash mapping
      if (file.slug) {
        slugMap[file.slug] = file.hash;
      }
    }
    
    return slugMap;
  }
  
  /**
   * Generate path-to-hash mapping for quick lookups
   * @param vaultData Array of processed file data
   * @returns Map of original file paths to file hashes
   */
  private generatePathMap(vaultData: FileData[]): Record<string, string> {
    const pathMap: Record<string, string> = {};
    
    for (const file of vaultData) {
      // Use the pre-calculated hash property
      // Add the originalFilePath -> hash mapping
      if (file.originalFilePath) {
        pathMap[file.originalFilePath] = file.hash;
      }
    }
    
    return pathMap;
  }
  
  /**
   * Generate graph data for relationships between posts and media files
   * @param vaultData Array of processed file data
   * @param mediaData Array of processed media data
   * @param options Processing options containing relationship information
   * @returns Graph data containing nodes and edges
   */
  private generateGraphData(
    vaultData: FileData[], 
    mediaData: MediaFileData[],
    options: {
      postToPostLinks?: Map<string, Set<string>>;
      postToImageLinks?: Map<string, Set<string>>;
    }
  ): GraphData {
    this.log(1, `🔄 Generating graph data...`);
    
    const graphData: GraphData = {
      nodes: [],
      edges: []
    };
    
    // Create a set to track which nodes we've already added
    const addedNodeIds = new Set<string>();
    
    // Add all post nodes
    for (const file of vaultData) {
      if (!addedNodeIds.has(file.hash)) {
        graphData.nodes.push({
          id: file.hash,
          type: 'post',
          label: file.fileName
        });
        addedNodeIds.add(file.hash);
      }
    }
    
    // Add all media nodes that are referenced
    for (const media of mediaData) {
      const mediaHash = media.metadata?.hash || calculateFileHash(media.originalPath);
      
      if (!addedNodeIds.has(mediaHash)) {
        graphData.nodes.push({
          id: mediaHash,
          type: 'media',
          label: media.fileName
        });
        addedNodeIds.add(mediaHash);
      }
    }
    
    // Add POST_LINKS_TO_POST edges
    if (options.postToPostLinks) {
      for (const [sourceHash, targetHashes] of options.postToPostLinks.entries()) {
        for (const targetHash of targetHashes) {
          graphData.edges.push({
            source: sourceHash,
            target: targetHash,
            type: 'POST_LINKS_TO_POST'
          });
        }
      }
    }
    
    // Add POST_USE_IMAGE edges
    if (options.postToImageLinks) {
      for (const [postHash, imageHashes] of options.postToImageLinks.entries()) {
        for (const imageHash of imageHashes) {
          graphData.edges.push({
            source: postHash,
            target: imageHash,
            type: 'POST_USE_IMAGE'
          });
        }
      }
    }
    
    this.log(1, `✅ Generated graph with ${graphData.nodes.length} nodes and ${graphData.edges.length} edges`);
    
    return graphData;
  }

  /**
   * Save vault data and additional index files
   * @param vaultData Array of processed file data
   * @param graphData Optional graph data to save
   */
  private saveVaultData(vaultData: FileData[], graphData?: GraphData): void {
    this.log(1, `💾 Saving output to JSON...`);
    
    // Save main data file
    const jsonString = jsonStringify(vaultData);
    writeToFileSync(this.outputPath, jsonString);
    this.log(1, `📝 Output saved to: ${this.outputPath}`);
    
    // Generate and save slug map
    const slugMap = this.generateSlugMap(vaultData);
    const slugMapPath = path.join(this.buildDir, this.config.files!.slugMapFilename!);
    writeToFileSync(slugMapPath, jsonStringify(slugMap));
    this.log(1, `📝 Slug map saved to: ${slugMapPath}`);
    
    // Generate and save path map
    const pathMap = this.generatePathMap(vaultData);
    const pathMapPath = path.join(this.buildDir, this.config.files!.pathMapFilename!);
    writeToFileSync(pathMapPath, jsonStringify(pathMap));
    this.log(1, `📝 Path map saved to: ${pathMapPath}`);
    
    // Save graph data if provided
    if (graphData) {
      const graphPath = path.join(this.buildDir, "graph.json");
      writeToFileSync(graphPath, jsonStringify(graphData));
      this.log(1, `📝 Graph data saved to: ${graphPath} (${graphData.nodes.length} nodes, ${graphData.edges.length} edges)`);
    } else {
      this.log(1, `ℹ️ No graph data to save`);
    }
    
    this.log(1, `✨ Successfully processed ${vaultData.length} files`);
  }

  /**
   * Process the Obsidian vault with the configured options
   * @returns The processed vault data and related information
   */
  public async process(): Promise<{ 
    vaultData: FileData[]; 
    mediaData: MediaFileData[]; 
    mediaPathMap: MediaPathMap;
    mediaPathHashMap: Record<string, string>;
    mediaPathUrlMap: Record<string, string>;
    buildDir: string;
    graphData?: GraphData;
    outputFiles: {
      postsJson: string;
      mediaResults: string;
      postsDir?: string;
      slugMapJson: string;
      pathMapJson: string;
      mediaPathMapJson: string;
      mediaPathUrlMapJson: string;
      mediaPathHashMapJson: string;
      mediaHashUrlMapJson: string;
      graphJson?: string;
    };
    processingIssues: ProcessingIssues;
  }> {
    // Initialize and log basic information
    this.initBuildDir();
    
    this.log(1, `🚀 Starting Obsidian vault processing`);
    this.log(1, `📂 Input: ${this.inputPath}`);
    this.log(1, `📂 Build directory: ${this.buildDir}`);
    this.log(1, `📄 Output: ${this.outputPath}`);
    this.log(1, `🖼️ Media output: ${this.mediaOutputFolder}`);
    
    // Get the normalized configs
    const mediaConfig = this.config.media!;
    const pathsConfig = this.config.paths!;
    
    if (mediaConfig.skipExisting) {
      this.log(1, `⏭️ Skip existing files: Enabled`);
    }
    if (mediaConfig.forceReprocess) {
      this.log(1, `🔄 Force reprocessing of media files: Enabled`);
    }
    if (pathsConfig.domain) {
      this.log(1, `🌐 Domain for absolute paths: ${pathsConfig.domain}`);
    }

    // Process media files if not skipped
    const { mediaData, mediaPathMap, mediaPathHashMap, mediaPathUrlMap } = await this.processMediaFiles();
    
    // Always save media results, even if there are no media files
    this.saveMediaResults(mediaData, mediaPathMap, mediaPathHashMap, mediaPathUrlMap);

    // Create a path to hash map for relationship tracking
    const pathHashMap: Record<string, string> = {};
    
    // Enable relationship tracking by default
    const trackRelationships = true; // Always enabled by default
    
    // Process markdown files in the vault with relationship tracking
    const folderOptions: ProcessOptions = {
      debug: this.debugLevel,
      notePathPrefix: this.notePathPrefix,
      assetPathPrefix: this.assetPathPrefix,
      mediaData,
      mediaPathMap,
      useAbsolutePaths: pathsConfig.useAbsolutePaths !== false,
      includeMediaData: this.config.posts!.includeMediaData || false,
      exportPosts: this.config.posts!.exportEnabled || false,
      postsOutputFolder: this.postsDir,
      preferredSize: mediaConfig.preferredSize || 'lg',
      processAllFiles: this.config.posts!.processAllFiles || false,
      mediaOptions: {
        domain: pathsConfig.domain
      },
      toLinkBuilderOpts: {
        prefix: this.assetPathPrefix,
        toSlug,
        filePathAllowSet: new Set() // This will be overridden by processFolder
      },
      // Enable relationship tracking
      trackRelationships,
      pathHashMap,
      // Plugin configuration
      iframeEmbedOptions: this.config.iframeEmbedOptions,
      rehypeMermaidOptions: this.config.rehypeMermaidOptions,
      // Pass issue collector
      issueCollector: this.issueCollector
    };
    
    // Process the files
    const vaultData = await processFolder(this.inputPath, folderOptions);
    
    // Generate graph data if relationship tracking was enabled
    let graphData: GraphData | undefined;
    
    if (trackRelationships) {
      if (folderOptions.postToPostLinks && folderOptions.postToImageLinks) {
        this.log(1, "🔄 Generating graph data from collected relationships");
        graphData = this.generateGraphData(vaultData, mediaData, {
          postToPostLinks: folderOptions.postToPostLinks,
          postToImageLinks: folderOptions.postToImageLinks
        });
      } else {
        this.log(1, "⚠️ No relationship data was collected during processing, cannot generate graph.json");
      }
    }
    
    // Save vault data to JSON including graph data if available
    this.saveVaultData(vaultData, graphData);

    // Define paths for index files
    const slugMapPath = path.join(this.buildDir, this.config.files!.slugMapFilename!);
    const pathMapPath = path.join(this.buildDir, this.config.files!.pathMapFilename!);
    const mediaPathUrlMapPath = path.join(this.buildDir, this.config.files!.mediaPathUrlMapFilename!);
    const mediaPathHashMapPath = path.join(this.buildDir, this.config.files!.mediaPathHashMapFilename!);
    const graphPath = path.join(this.buildDir, "graph.json");
    
    // Build output file information
    const outputFiles: {
      postsJson: string;
      mediaResults: string;
      postsDir?: string;
      slugMapJson: string;
      pathMapJson: string;
      mediaPathMapJson: string;
      mediaPathUrlMapJson: string;
      mediaPathHashMapJson: string;
      mediaHashUrlMapJson: string;
      graphJson?: string;
    } = {
      postsJson: this.outputPath,
      mediaResults: this.mediaResultsPath,
      postsDir: this.postsDir,
      slugMapJson: slugMapPath,
      pathMapJson: pathMapPath,
      mediaPathMapJson: path.join(this.buildDir, this.config.files!.mediaPathMapFilename!),
      mediaPathUrlMapJson: mediaPathUrlMapPath,
      mediaPathHashMapJson: mediaPathHashMapPath,
      mediaHashUrlMapJson: path.join(this.buildDir, "media-hash-url-map.json")
    };
    
    // Add graph.json to output files if generated
    if (graphData) {
      outputFiles.graphJson = graphPath;
    }
    
    // Generate and save processing issues report
    const issuesReport = this.issueCollector.generateReport();
    const issuesPath = path.join(this.buildDir, "processor-issues.json");
    writeToFileSync(issuesPath, jsonStringify(issuesReport));
    this.log(1, `📝 Processing issues saved to: ${issuesPath}`);
    
    // Log issue summary
    const summary = this.issueCollector.getSummaryString();
    this.log(1, summary);

    // Return the processed data and build information
    return {
      vaultData,
      mediaData,
      mediaPathMap,
      mediaPathHashMap,
      mediaPathUrlMap,
      buildDir: this.buildDir,
      graphData,
      outputFiles,
      processingIssues: issuesReport
    };
  }
}

/**
 * Creates a configuration builder for easier config creation with method chaining
 * This has been reimplemented to create a flat config structure
 */
class ConfigBuilder {
  private config: Partial<ProcessConfig> = {};

  /**
   * Set the input and output directories
   * @param input Input directory path (required)
   * @param output Output directory path (optional, defaults to 'build')
   * @returns The builder instance for chaining
   */
  withDirectories(input: string, output?: string): ConfigBuilder {
    this.config.inputPath = input;
    if (output) this.config.buildDir = output;
    return this;
  }

  /**
   * Set the base directory for resolving relative paths
   * @param base Base directory path
   * @returns The builder instance for chaining
   */
  withBaseDir(base: string): ConfigBuilder {
    this.config.baseDir = base;
    return this;
  }

  /**
   * Configure file and folder naming
   * @param naming File naming configuration
   * @returns The builder instance for chaining
   */
  withFileNaming(naming: FileConfig): ConfigBuilder {
    // Map each property from the nested structure to the flat structure
    if (naming.postsFilename) this.config.postsFilename = naming.postsFilename;
    if (naming.postsFolder) this.config.postsFolder = naming.postsFolder;
    if (naming.slugMapFilename) this.config.slugMapFilename = naming.slugMapFilename;
    if (naming.pathMapFilename) this.config.pathMapFilename = naming.pathMapFilename;
    if (naming.mediaFolderName) this.config.mediaFolderName = naming.mediaFolderName;
    if (naming.mediaResultsFilename) this.config.mediaResultsFilename = naming.mediaResultsFilename;
    if (naming.mediaPathUrlMapFilename) this.config.mediaPathUrlMapFilename = naming.mediaPathUrlMapFilename;
    if (naming.mediaPathHashMapFilename) this.config.mediaPathHashMapFilename = naming.mediaPathHashMapFilename;
    return this;
  }
  
  /**
   * Configure post index files
   * @param slugMapFilename Filename for slug-to-hash map
   * @param pathMapFilename Filename for path-to-hash map
   * @returns The builder instance for chaining
   */
  withPostIndexFiles(slugMapFilename?: string, pathMapFilename?: string): ConfigBuilder {
    if (slugMapFilename) this.config.slugMapFilename = slugMapFilename;
    if (pathMapFilename) this.config.pathMapFilename = pathMapFilename;
    return this;
  }
  
  /**
   * Configure media index files
   * @param pathMapFilename Filename for media path map
   * @param pathUrlMapFilename Filename for path-to-url map
   * @param pathHashMapFilename Filename for path-to-hash map
   * @returns The builder instance for chaining
   */
  withMediaIndexFiles(pathMapFilename?: string, pathUrlMapFilename?: string, pathHashMapFilename?: string): ConfigBuilder {
    if (pathMapFilename) this.config.mediaPathMapFilename = pathMapFilename;
    if (pathUrlMapFilename) this.config.mediaPathUrlMapFilename = pathUrlMapFilename;
    if (pathHashMapFilename) this.config.mediaPathHashMapFilename = pathHashMapFilename;
    return this;
  }
  
  /**
   * Configure all index files
   * This is a convenience method that calls both withPostIndexFiles and withMediaIndexFiles
   * @param options Object containing all index file names
   * @returns The builder instance for chaining
   */
  withAllIndexFiles(options: {
    slugMapFilename?: string;
    pathMapFilename?: string;
    mediaPathMapFilename?: string;
    mediaPathUrlMapFilename?: string;
    mediaPathHashMapFilename?: string;
  }): ConfigBuilder {
    // Post index files
    this.withPostIndexFiles(options.slugMapFilename, options.pathMapFilename);
    
    // Media index files
    this.withMediaIndexFiles(options.mediaPathMapFilename, options.mediaPathUrlMapFilename, options.mediaPathHashMapFilename);
    
    return this;
  }

  /**
   * Configure URL path prefixes
   * @param paths Path configuration
   * @returns The builder instance for chaining
   */
  withPaths(paths: PathConfig): ConfigBuilder {
    // Map each property from the nested structure to the flat structure
    if (paths.notesPrefix) this.config.notePathPrefix = paths.notesPrefix;
    if (paths.assetsPrefix) this.config.assetPathPrefix = paths.assetsPrefix;
    if (paths.mediaPrefix) this.config.mediaPathPrefix = paths.mediaPrefix;
    if (paths.domain) this.config.domain = paths.domain;
    if (paths.useAbsolutePaths !== undefined) this.config.useAbsolutePaths = paths.useAbsolutePaths;
    return this;
  }

  /**
   * Configure media processing options
   * @param media Media configuration
   * @returns The builder instance for chaining
   */
  withMediaOptions(media: MediaConfig): ConfigBuilder {
    // Map each property from the nested structure to the flat structure
    if (media.skip !== undefined) this.config.skipMedia = media.skip;
    if (media.optimize !== undefined) this.config.optimizeImages = media.optimize;
    if (media.skipExisting !== undefined) this.config.skipExisting = media.skipExisting;
    if (media.forceReprocess !== undefined) this.config.forceReprocessMedias = media.forceReprocess;
    if (media.sizes) this.config.imageSizes = media.sizes;
    if (media.formats) this.config.imageFormats = media.formats;
    if (media.useHash !== undefined) this.config.useMediaHash = media.useHash;
    if (media.useHashSharding !== undefined) this.config.useMediaHashSharding = media.useHashSharding;
    if (media.skipHashes) this.config.skipHashes = media.skipHashes;
    if (media.preferredSize) this.config.preferredSize = media.preferredSize;
    return this;
  }

  /**
   * Configure post processing options
   * @param posts Post configuration
   * @returns The builder instance for chaining
   */
  withPostOptions(posts: PostConfig): ConfigBuilder {
    // Map each property from the nested structure to the flat structure
    if (posts.exportEnabled !== undefined) this.config.exportPosts = posts.exportEnabled;
    if (posts.includeMediaData !== undefined) this.config.includeMediaData = posts.includeMediaData;
    if (posts.processAllFiles !== undefined) this.config.processAllFiles = posts.processAllFiles;
    return this;
  }

  /**
   * Set the debug level
   * @param level Debug level (0-3)
   * @returns The builder instance for chaining
   */
  withDebugLevel(level: number): ConfigBuilder {
    this.config.debugLevel = level;
    return this;
  }

  /**
   * Build the final configuration object
   * @returns The complete configuration object
   */
  build(): ProcessConfig {
    if (!this.config.inputPath) {
      throw new Error('Input directory (inputPath) is required');
    }
    return this.config as ProcessConfig;
  }
}

// Export the RepoProcessor class and ConfigBuilder
export { RepoProcessor, ConfigBuilder };
// No default export to avoid confusion
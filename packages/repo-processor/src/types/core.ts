// Core type definitions
import { Root as HastRoot } from "hast";
import { Root as MdastRoot } from "mdast";
import { Processor } from "unified";
import { Link, ToLink } from "remark-obsidian-link";
import { MediaFileData, MediaPathMap } from "./media";

// Basic types
export type MdastLink = Link;

// Slug tracking types
export interface SlugInfo {
  desiredSlug: string;
  disambiguatedSlug: string;
  finalSlug: string;
  isDisambiguated: boolean;
}

// File processing types
export interface FileData {
  fileName: string;
  slug: string;
  title: string; // Title from frontmatter or processed filename
  firstParagraphText: string;
  plain: string;
  wordCount: number;
  frontmatter: Record<string, any>;
  html: string;
  toc: TocItem[];
  originalFilePath: string; // useful for debugging + referencing
  folder: string; // Folder path relative to vault root (e.g., "articles/bob")
  hash: string; // file hash for consistent identification
  links?: string[]; // Optional array of hash IDs that this file links to
  url?: string; // Final URL for this file (prefix + slug)
  firstImage?: string; // URL of the first image in the content (for cover image)
  fsCreated: Date; // File system creation time
  fsModified: Date; // File system modification time
  gitCreated?: Date; // Git creation time (first commit)
  gitModified?: Date; // Git modification time (last commit)
  _slugInfo?: SlugInfo; // Information about how the slug was generated
  _slugTracking?: {
    allSlugs: Record<string, SlugInfo>;
    usedSlugs: Record<string, string>;
  };
}

export interface TocItem {
  title: string;
  depth: number;
  id: string;
}

// Graph/relationship types
export type RelationshipType = 'POST_LINKS_TO_POST' | 'POST_USE_IMAGE';

export interface GraphNode {
  id: string; // File hash or path
  type: 'post' | 'media';
  label: string; // File name
}

export interface GraphEdge {
  source: string; // Source node ID (hash)
  target: string; // Target node ID (hash)
  type: RelationshipType; // Type of relationship
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// Unified processor builder types
export type FilePathAllowSetBuilder = (dirPath: string) => Set<string>;

export type UnifiedProcessorBuilder = (_: {
  toLink: ToLink;
}) => Processor<MdastRoot, MdastRoot, HastRoot, HastRoot, string>;

// ToLink builder types
export type ToLinkBuilderOpts = {
  filePathAllowSet: Set<string>;
  toSlug: (s: string) => string;
  /**
   * The prefix to use for links. If notePathPrefix is provided in ProcessOptions,
   * it will override the default '/content'
   */
  prefix: string;
};

export type ToLinkBuilder = (_: ToLinkBuilderOpts) => ToLink;

/**
 * Interface for processing options passed to processFolder
 */
export interface ProcessOptions {
  debug?: number;
  assetPathPrefix?: string;
  notePathPrefix?: string;
  filePathAllowSetBuilder?: (dirPath: string) => Set<string>;
  filePathAllowSet?: Set<string>;
  toLinkBuilderOpts?: Record<string, any>;

  // Media-related options
  mediaData?: MediaFileData[];
  mediaPathMap?: MediaPathMap;
  useAbsolutePaths?: boolean;
  includeMediaData?: boolean;
  preferredSize?: 'sm' | 'md' | 'lg';
  mediaOptions?: {
    domain?: string;
  };

  // Post export options
  exportPosts?: boolean;
  postsOutputFolder?: string; // Base directory for post exports (hash and slug subdirectories will be created)

  // File selection options
  processAllFiles?: boolean; // Process all markdown files regardless of public frontmatter

  // Relationship tracking options
  trackRelationships?: boolean; // Whether to track relationships between posts and images
  pathHashMap?: Record<string, string>; // Map of paths to hashes for resolving links
  postToPostLinks?: Map<string, Set<string>>; // Source post hash -> Set of target post hashes
  postToImageLinks?: Map<string, Set<string>>; // Post hash -> Set of image hashes

  // Slug tracking options
  includeSlugTracking?: boolean; // Whether to include slug tracking information in the output
  slugConflictResolutionStrategy?: 'number' | 'hash'; // Strategy for resolving slug conflicts

  // File ignore options
  ignoreFiles?: string[]; // Array of file names to ignore during processing (defaults to ['CONTRIBUTING.md', 'README.md', 'readme.md', 'LICENSE.md'])
  
  // Iframe embed options
  // Note: iframe embed is no longer used for mermaid blocks by default
  // Set features.mermaid to true to enable mermaid iframe substitution (legacy behavior)
  iframeEmbedOptions?: {
    baseUrl?: string;
    features?: {
      mermaid?: boolean; // Default: false. Set to true to use iframe rendering for mermaid
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
  // Uses rehype-mermaid to render mermaid diagrams locally
  // Requires playwright to be installed for non-browser environments
  rehypeMermaidOptions?: {
    enabled?: boolean; // Default: true. Set to false to disable rehype-mermaid
    strategy?: 'img-png' | 'img-svg' | 'inline-svg' | 'pre-mermaid'; // Default: 'inline-svg'
    dark?: boolean; // Enable dark mode support (only for img-png and img-svg)
    prefix?: string; // Custom prefix for IDs (default: 'mermaid')
    mermaidConfig?: Record<string, any>; // Custom mermaid configuration
  };
  
  // Issue tracking
  issueCollector?: any; // Optional issue collector instance for tracking processing issues
}

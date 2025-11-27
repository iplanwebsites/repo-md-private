/**
 * Output types for @repo-md/processor-core
 */

import type { IssueReport } from './issues.js';

// ============================================================================
// Table of Contents
// ============================================================================

export interface TocItem {
  readonly text: string;
  readonly depth: number;
  readonly slug: string;
}

// ============================================================================
// Post Metadata
// ============================================================================

export interface PostMetadata {
  readonly createdAt: string;
  readonly modifiedAt: string;
  readonly processedAt: string;
  readonly gitCreatedAt?: string;
  readonly gitModifiedAt?: string;
}

// ============================================================================
// Post Cover
// ============================================================================

export interface PostCoverSize {
  /** Size suffix (xs, sm, md, lg, xl) */
  readonly suffix: string;
  /** Output file path relative to output dir */
  readonly path: string;
  /** Full URL if domain configured */
  readonly url?: string;
  /** Width of this variant */
  readonly width: number;
  /** Height of this variant */
  readonly height: number;
}

export interface PostCover {
  /** Original path from frontmatter */
  readonly original: string;
  /** Output file path relative to output dir */
  readonly path: string;
  /** Full URL if domain configured */
  readonly url?: string;
  /** Content hash */
  readonly hash?: string;
  /** Image width */
  readonly width?: number;
  /** Image height */
  readonly height?: number;
  /** Responsive image size variants */
  readonly sizes?: readonly PostCoverSize[];
}

export interface PostCoverError {
  /** Original path from frontmatter */
  readonly original: string;
  /** Error message explaining why cover couldn't be resolved */
  readonly error: string;
}

// ============================================================================
// Processed Post
// ============================================================================

export interface ProcessedPost {
  /** Content hash for identification */
  readonly hash: string;

  /** URL-friendly slug */
  readonly slug: string;

  /** Post title (from frontmatter or filename) */
  readonly title: string;

  /** Original filename without extension */
  readonly fileName: string;

  /** Original file path relative to vault */
  readonly originalPath: string;

  /** Rendered HTML content */
  readonly content: string;

  /** Original markdown content */
  readonly markdown: string;

  /** Plain text content (for search/embeddings) */
  readonly plainText: string;

  /** Excerpt/summary text */
  readonly excerpt: string;

  /** Word count */
  readonly wordCount: number;

  /** Table of contents */
  readonly toc: readonly TocItem[];

  /** Frontmatter data */
  readonly frontmatter: Readonly<Record<string, unknown>>;

  /** Timestamps and metadata */
  readonly metadata: PostMetadata;

  /** Cover image (resolved from frontmatter.cover) */
  readonly cover?: PostCover | PostCoverError;

  /** URL of first image (for cover) */
  readonly firstImage?: string;

  /** Hashes of posts this post links to */
  readonly links?: readonly string[];

  /** Text embedding vector */
  readonly embedding?: readonly number[];
}

// ============================================================================
// Processed Media
// ============================================================================

export interface MediaMetadata {
  readonly width?: number;
  readonly height?: number;
  readonly format?: string;
  readonly size?: number;
  readonly originalSize?: number;
  readonly hash?: string;
}

export interface MediaSizeVariant {
  /** Size suffix (xs, sm, md, lg, xl) */
  readonly suffix: string;
  /** Output file path relative to output dir */
  readonly outputPath: string;
  /** Width of this variant */
  readonly width: number;
  /** Height of this variant */
  readonly height: number;
  /** File size in bytes */
  readonly size: number;
}

export interface ProcessedMedia {
  /** Original file path relative to input */
  readonly originalPath: string;

  /** Output file path relative to output dir */
  readonly outputPath: string;

  /** Original filename */
  readonly fileName: string;

  /** Media type */
  readonly type: 'image' | 'video' | 'audio' | 'media';

  /** File metadata */
  readonly metadata?: MediaMetadata;

  /** Responsive image size variants */
  readonly sizes?: readonly MediaSizeVariant[];

  /** Image embedding vector */
  readonly embedding?: readonly number[];
}

// ============================================================================
// Graph/Relationship Data
// ============================================================================

export type RelationshipType = 'POST_LINKS_TO_POST' | 'POST_USE_IMAGE';

export interface GraphNode {
  readonly id: string;
  readonly type: 'post' | 'media';
  readonly label: string;
}

export interface GraphEdge {
  readonly source: string;
  readonly target: string;
  readonly type: RelationshipType;
}

export interface GraphData {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
}

// ============================================================================
// Path Maps
// ============================================================================

/** Maps original paths to optimized public paths */
export type MediaPathMap = Readonly<Record<string, string>>;

/** Maps original paths to content hashes */
export type PathHashMap = Readonly<Record<string, string>>;

/** Maps slugs to post hashes */
export type SlugHashMap = Readonly<Record<string, string>>;

/** Maps hashes to embedding vectors */
export type EmbeddingMap = ReadonlyMap<string, readonly number[]>;

// ============================================================================
// Output Files
// ============================================================================

export interface OutputFiles {
  readonly posts: string;
  readonly media: string;
  readonly slugMap: string;
  readonly pathMap: string;
  readonly issues: string;
  readonly graph?: string;
  readonly similarity?: string;
  readonly database?: string;
}

// ============================================================================
// Process Result
// ============================================================================

export interface ProcessResult {
  /** Processed posts */
  readonly posts: readonly ProcessedPost[];

  /** Processed media files */
  readonly media: readonly ProcessedMedia[];

  /** Output directory path */
  readonly outputDir: string;

  /** Output file paths */
  readonly outputFiles: OutputFiles;

  /** Processing issues report */
  readonly issues: IssueReport;

  /** Graph data (if trackRelationships enabled) */
  readonly graph?: GraphData;
}

// ============================================================================
// Output File Names
// ============================================================================

export const OUTPUT_FILES = {
  POSTS: 'posts.json',
  POSTS_SLUG_MAP: 'posts-slug-map.json',
  POSTS_PATH_MAP: 'posts-path-map.json',
  MEDIAS: 'media.json',
  MEDIA_PATH_MAP: 'media-path-map.json',
  GRAPH: 'graph.json',
  TEXT_EMBEDDINGS: 'posts-embedding-hash-map.json',
  IMAGE_EMBEDDINGS: 'media-embedding-hash-map.json',
  SIMILARITY: 'similarity.json',
  DATABASE: 'repo.db',
  ISSUES: 'processor-issues.json',
} as const;

/**
 * Post and content type definitions for @repo-md/client
 * These types align with the processor's FileData output
 */

// =============================================================================
// Table of Contents
// =============================================================================

/**
 * Table of contents item representing a heading in the document
 */
export interface TocItem {
  /** Unique ID for the heading (used for anchor links) */
  id: string;
  /** Heading text content */
  title: string;
  /** Heading level (1-6, corresponding to h1-h6) */
  depth: number;
}

// =============================================================================
// Frontmatter
// =============================================================================

/**
 * Common frontmatter fields found in markdown files.
 * Extend this interface for custom frontmatter schemas.
 *
 * @example
 * ```typescript
 * interface MyFrontmatter extends PostFrontmatter {
 *   customField: string;
 *   requiredTag: string;
 * }
 *
 * const post = await client.getPostBySlug('my-post') as Post<MyFrontmatter>;
 * const custom = post.frontmatter?.customField; // string | undefined
 * ```
 */
export interface PostFrontmatter {
  /** Post title (overrides filename-derived title) */
  title?: string;
  /** Subtitle or tagline */
  subtitle?: string;
  /** Meta description for SEO */
  description?: string;
  /** Author name */
  author?: string;
  /** Author avatar URL */
  author_avatar?: string;
  /** Publication date (ISO 8601 string) */
  date?: string;
  /** Primary category */
  category?: string;
  /** Array of tags for categorization */
  tags?: string[];
  /** Cover image URL */
  cover?: string;
  /** Alternative image field (some themes use this) */
  image?: string;
  /** Whether this post should be featured */
  featured?: boolean;
  /** Whether this is a draft (not published) */
  draft?: boolean;
  /** Whether this post is public (processed by repo.md) */
  public?: boolean;
  /** Allow additional custom fields */
  [key: string]: unknown;
}

// =============================================================================
// Post
// =============================================================================

/**
 * A processed markdown post/document.
 *
 * This interface represents the output from @repo-md/processor after
 * a markdown file has been parsed, transformed, and enriched.
 *
 * @typeParam TFrontmatter - Custom frontmatter type (defaults to PostFrontmatter)
 *
 * @example
 * ```typescript
 * // Basic usage
 * const posts = await client.getAllPosts();
 * const post = posts[0];
 * console.log(post.title, post.html);
 *
 * // With custom frontmatter
 * interface BlogFrontmatter extends PostFrontmatter {
 *   series?: string;
 *   part?: number;
 * }
 * const blogPost = post as Post<BlogFrontmatter>;
 * console.log(blogPost.frontmatter?.series);
 * ```
 */
export interface Post<TFrontmatter = PostFrontmatter> {
  // ---------------------------------------------------------------------------
  // Identity (Required)
  // ---------------------------------------------------------------------------

  /**
   * Unique content hash for cache invalidation.
   * Generated from file contents using SHA-256.
   */
  hash: string;

  /**
   * URL-friendly identifier derived from filename or frontmatter.
   * Used for routing and lookups.
   */
  slug: string;

  // ---------------------------------------------------------------------------
  // File Metadata
  // ---------------------------------------------------------------------------

  /**
   * Original filename without extension.
   * @example "my-blog-post" for "my-blog-post.md"
   */
  fileName?: string;

  /**
   * Original file path relative to the vault root.
   * Useful for debugging and source references.
   * @example "blog/2024/my-post.md"
   */
  originalFilePath?: string;

  /**
   * File path (alias for originalFilePath).
   * @deprecated Use originalFilePath for clarity
   */
  path?: string;

  /**
   * Folder path relative to vault root (without filename).
   * @example "blog/2024" for "blog/2024/my-post.md"
   */
  folder?: string;

  /**
   * Full URL path for this post (prefix + slug).
   * Only present if urlPrefix was configured during processing.
   * @example "/blog/my-post"
   */
  url?: string;

  // ---------------------------------------------------------------------------
  // Content
  // ---------------------------------------------------------------------------

  /**
   * Post title from frontmatter or derived from filename.
   */
  title?: string;

  /**
   * Rendered HTML content with syntax highlighting and processed links.
   * This is the primary content for display.
   */
  html?: string;

  /**
   * Plain text version of content (markdown stripped).
   * Useful for search indexing and excerpts.
   */
  plain?: string;

  /**
   * First paragraph text extracted for previews/excerpts.
   */
  firstParagraphText?: string;

  /**
   * Legacy content field.
   * @deprecated Use `html` or `plain` instead
   */
  content?: string;

  // ---------------------------------------------------------------------------
  // Metadata
  // ---------------------------------------------------------------------------

  /**
   * YAML frontmatter parsed from the document header.
   * Use generics to type custom frontmatter schemas.
   */
  frontmatter?: TFrontmatter;

  /** Total word count of the document */
  wordCount?: number;

  /**
   * URL of the first image found in the content.
   * Useful as a fallback cover image.
   */
  firstImage?: string;

  // ---------------------------------------------------------------------------
  // Dates
  // ---------------------------------------------------------------------------

  /**
   * Publication date from frontmatter (ISO 8601 string).
   * Used for sorting and display.
   */
  date?: string;

  /**
   * File system creation time (ISO 8601 string).
   * When the file was first created on disk.
   */
  fsCreated?: string;

  /**
   * File system modification time (ISO 8601 string).
   * When the file was last modified on disk.
   */
  fsModified?: string;

  /**
   * Git creation time (ISO 8601 string).
   * Time of the first commit containing this file.
   */
  gitCreated?: string;

  /**
   * Git modification time (ISO 8601 string).
   * Time of the most recent commit modifying this file.
   */
  gitModified?: string;

  // ---------------------------------------------------------------------------
  // Structure
  // ---------------------------------------------------------------------------

  /**
   * Table of contents extracted from document headings.
   * Useful for navigation and document structure display.
   */
  toc?: TocItem[];

  /**
   * Array of hash IDs for posts this document links to.
   * Used for relationship graphs and related content.
   */
  links?: string[];

  // ---------------------------------------------------------------------------
  // Extensibility
  // ---------------------------------------------------------------------------

  /**
   * Allow additional fields for forward compatibility.
   * New fields from processor updates will be accessible.
   */
  [key: string]: unknown;
}

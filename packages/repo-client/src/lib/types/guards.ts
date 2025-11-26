/**
 * Runtime type guards for @repo-md/client
 *
 * These utilities help with runtime type checking and narrowing,
 * complementing TypeScript's static type system.
 */

import type { Post, PostFrontmatter, TocItem } from './post.js';

// =============================================================================
// Post Type Guards
// =============================================================================

/**
 * Check if a value is a valid Post object.
 *
 * @param value - Unknown value to check
 * @returns True if value has required Post properties (hash, slug)
 *
 * @example
 * ```typescript
 * const data = await fetchSomeData();
 * if (isPost(data)) {
 *   console.log(data.slug); // TypeScript knows data is Post
 * }
 * ```
 */
export function isPost(value: unknown): value is Post {
  return (
    typeof value === 'object' &&
    value !== null &&
    'hash' in value &&
    'slug' in value &&
    typeof (value as Post).hash === 'string' &&
    typeof (value as Post).slug === 'string'
  );
}

/**
 * Check if a post has HTML content.
 *
 * @param post - Post to check
 * @returns True if post has non-empty html property
 *
 * @example
 * ```typescript
 * if (hasHtmlContent(post)) {
 *   element.innerHTML = post.html; // html is guaranteed to be string
 * }
 * ```
 */
export function hasHtmlContent(post: Post): post is Post & { html: string } {
  return typeof post.html === 'string' && post.html.length > 0;
}

/**
 * Check if a post has plain text content.
 *
 * @param post - Post to check
 * @returns True if post has non-empty plain property
 *
 * @example
 * ```typescript
 * if (hasPlainContent(post)) {
 *   searchIndex.add(post.plain); // plain is guaranteed to be string
 * }
 * ```
 */
export function hasPlainContent(post: Post): post is Post & { plain: string } {
  return typeof post.plain === 'string' && post.plain.length > 0;
}

/**
 * Check if a post has frontmatter.
 *
 * @param post - Post to check
 * @returns True if post has frontmatter object
 *
 * @example
 * ```typescript
 * if (hasFrontmatter(post)) {
 *   console.log(post.frontmatter.title);
 * }
 * ```
 */
export function hasFrontmatter<TFrontmatter = PostFrontmatter>(
  post: Post<TFrontmatter>
): post is Post<TFrontmatter> & { frontmatter: TFrontmatter } {
  return (
    typeof post.frontmatter === 'object' &&
    post.frontmatter !== null
  );
}

/**
 * Check if a post has a table of contents.
 *
 * @param post - Post to check
 * @returns True if post has non-empty toc array
 *
 * @example
 * ```typescript
 * if (hasToc(post)) {
 *   renderTableOfContents(post.toc);
 * }
 * ```
 */
export function hasToc(post: Post): post is Post & { toc: TocItem[] } {
  return Array.isArray(post.toc) && post.toc.length > 0;
}

/**
 * Check if a post has links to other posts.
 *
 * @param post - Post to check
 * @returns True if post has non-empty links array
 *
 * @example
 * ```typescript
 * if (hasLinks(post)) {
 *   const relatedPosts = await Promise.all(
 *     post.links.map(hash => client.getPostByHash(hash))
 *   );
 * }
 * ```
 */
export function hasLinks(post: Post): post is Post & { links: string[] } {
  return Array.isArray(post.links) && post.links.length > 0;
}

/**
 * Check if a post has a cover image (from firstImage or frontmatter).
 *
 * @param post - Post to check
 * @returns True if post has a cover image
 *
 * @example
 * ```typescript
 * if (hasCoverImage(post)) {
 *   const coverUrl = post.firstImage || post.frontmatter?.cover || post.frontmatter?.image;
 * }
 * ```
 */
export function hasCoverImage(post: Post): boolean {
  return (
    typeof post.firstImage === 'string' ||
    (hasFrontmatter(post) && (
      typeof post.frontmatter.cover === 'string' ||
      typeof post.frontmatter.image === 'string'
    ))
  );
}

/**
 * Get the cover image URL from a post.
 * Checks firstImage, then frontmatter.cover, then frontmatter.image.
 *
 * @param post - Post to get cover image from
 * @returns Cover image URL or undefined
 *
 * @example
 * ```typescript
 * const coverUrl = getCoverImage(post);
 * if (coverUrl) {
 *   img.src = coverUrl;
 * }
 * ```
 */
export function getCoverImage(post: Post): string | undefined {
  if (typeof post.firstImage === 'string') {
    return post.firstImage;
  }
  if (hasFrontmatter(post)) {
    if (typeof post.frontmatter.cover === 'string') {
      return post.frontmatter.cover;
    }
    if (typeof post.frontmatter.image === 'string') {
      return post.frontmatter.image;
    }
  }
  return undefined;
}

// =============================================================================
// TocItem Type Guards
// =============================================================================

/**
 * Check if a value is a valid TocItem.
 *
 * @param value - Unknown value to check
 * @returns True if value is a valid TocItem
 */
export function isTocItem(value: unknown): value is TocItem {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'title' in value &&
    'depth' in value &&
    typeof (value as TocItem).id === 'string' &&
    typeof (value as TocItem).title === 'string' &&
    typeof (value as TocItem).depth === 'number'
  );
}

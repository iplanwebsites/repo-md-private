/**
 * Post Similarity module for RepoMD
 * Provides functions for computing and retrieving post similarities
 */

import { LOG_PREFIXES } from "../logger.js";
import { cosineSimilarity } from "../vector.js";
import type { Post, AugmentOptions } from './retrieval.js';

const prefix = LOG_PREFIXES.REPO_MD;

/** Post similarity configuration */
export interface PostSimilarityConfig {
  fetchR2Json: <T>(path: string, options?: { defaultValue?: T; useCache?: boolean }) => Promise<T>;
  _fetchMapData: (path: string, defaultValue?: unknown) => Promise<Record<string, unknown> | null>;
  getRecentPosts: (count?: number) => Promise<Post[]>;
  getPostBySlug: (slug: string) => Promise<Post | null>;
  augmentPostsByProperty: (keys: string[], property: string, options?: AugmentOptions) => Promise<Post[]>;
  debug?: boolean;
  getActiveRev?: (() => string | undefined) | null;
}

/** Post similarity service interface */
export interface PostSimilarityService {
  getPostsEmbeddings: () => Promise<Record<string, number[]>>;
  getPostsSimilarity: () => Promise<Record<string, number> | null>;
  getPostsSimilarityByHashes: (hash1: string, hash2: string) => Promise<number>;
  getTopSimilarPostsHashes: () => Promise<Record<string, string[]> | null>;
  getSimilarPostsHashByHash: (hash: string, limit?: number) => Promise<string[]>;
  getSimilarPostsByHash: (hash: string, count?: number, options?: AugmentOptions) => Promise<Post[]>;
  getSimilarPostsSlugBySlug: (slug: string, limit?: number) => Promise<string[]>;
  getSimilarPostsBySlug: (slug: string, count?: number, options?: AugmentOptions) => Promise<Post[]>;
  clearSimilarityCache: () => void;
}

/**
 * Create a post similarity service
 * @param config - Configuration object
 * @returns Post similarity functions
 */
export function createPostSimilarity(config: PostSimilarityConfig): PostSimilarityService {
  const {
    _fetchMapData,
    getRecentPosts,
    getPostBySlug,
    augmentPostsByProperty,
    debug = false,
    getActiveRev = null, // For cache invalidation on revision change
  } = config;

  // Local caches for similarity data with revision tracking
  let similarityData: Record<string, number> | null = null;
  let similarPostsHashes: Record<string, string[]> | null = null;
  let cacheRevision: string | null = null; // Track which revision the cache is for
  const similarityCache: Record<string, number> = {}; // Memory cache for similarity scores

  /**
   * Clear similarity caches (called when revision changes)
   */
  function clearSimilarityCache(): void {
    if (debug && (similarityData || similarPostsHashes)) {
      console.log(`${prefix} 🗑️ Clearing post similarity cache (revision changed)`);
    }
    similarityData = null;
    similarPostsHashes = null;
    cacheRevision = null;
    for (const key in similarityCache) {
      delete similarityCache[key];
    }
  }

  /**
   * Check and invalidate cache if revision changed
   */
  function checkRevisionAndInvalidate(): void {
    if (getActiveRev && cacheRevision) {
      const currentRev = getActiveRev();
      if (currentRev && currentRev !== cacheRevision) {
        if (debug) {
          console.log(`${prefix} 🔄 Revision changed from ${cacheRevision} to ${currentRev}, invalidating similarity cache`);
        }
        clearSimilarityCache();
      }
    }
  }

  /**
   * Get pre-computed post similarities
   * @returns Similarity data
   */
  async function getPostsSimilarity(): Promise<Record<string, number> | null> {
    checkRevisionAndInvalidate();

    if (!similarityData) {
      if (debug) {
        console.log(`${prefix} 📡 Loading pre-computed post similarity data`);
      }
      const data = await _fetchMapData("/posts-similarity.json", {});
      similarityData = data as Record<string, number> | null;
      if (getActiveRev) {
        cacheRevision = getActiveRev() || null;
      }
    }
    return similarityData;
  }

  /**
   * Get posts embeddings map
   * @returns Embeddings map
   */
  async function getPostsEmbeddings(): Promise<Record<string, number[]>> {
    if (debug) {
      console.log(`${prefix} 📡 Fetching posts embeddings map`);
    }

    const data = await _fetchMapData("/posts-embedding-hash-map.json");
    return (data as Record<string, number[]>) || {};
  }

  /**
   * Calculate similarity between two posts by hash
   * @param hash1 - First post hash
   * @param hash2 - Second post hash
   * @returns Similarity score (0-1)
   * @throws If hash parameters are missing or invalid
   */
  async function getPostsSimilarityByHashes(hash1: string, hash2: string): Promise<number> {
    // Validate hash1 parameter
    if (!hash1) {
      throw new Error('Hash1 is required for getPostsSimilarityByHashes operation');
    }

    if (typeof hash1 !== 'string') {
      throw new Error('Hash1 must be a string value');
    }

    // Validate hash2 parameter
    if (!hash2) {
      throw new Error('Hash2 is required for getPostsSimilarityByHashes operation');
    }

    if (typeof hash2 !== 'string') {
      throw new Error('Hash2 must be a string value');
    }

    if (hash1 === hash2) return 1.0; // Same post has perfect similarity

    // Create a cache key (ordered alphabetically for consistency)
    const cacheKey = [hash1, hash2].sort().join("-");

    // Check in-memory cache first
    if (similarityCache[cacheKey] !== undefined) {
      if (debug) {
        console.log(
          `${prefix} 💾 Using memory-cached similarity for ${hash1} and ${hash2}`
        );
      }
      return similarityCache[cacheKey];
    }

    // Try to get from pre-computed similarity data
    const similarityDataMap = await getPostsSimilarity();

    if (similarityDataMap && similarityDataMap[cacheKey] !== undefined) {
      const similarity = similarityDataMap[cacheKey];

      // Cache the result in memory
      similarityCache[cacheKey] = similarity;

      if (debug) {
        console.log(
          `${prefix} 💾 Using pre-computed similarity ${similarity.toFixed(
            4
          )} for ${hash1} and ${hash2}`
        );
      }

      return similarity;
    }

    // Fall back to computing on the fly if no pre-computed data available
    if (debug) {
      console.log(
        `${prefix} ⚠️ No pre-computed similarity found for ${cacheKey}, computing on the fly`
      );
    }

    // Get embeddings map
    const embeddingsMap = await getPostsEmbeddings();

    // Ensure we have both embeddings
    if (!embeddingsMap[hash1] || !embeddingsMap[hash2]) {
      if (debug) {
        console.log(
          `${prefix} ❌ Missing embedding for hash: ${
            !embeddingsMap[hash1] ? hash1 : hash2
          }`
        );
      }
      return 0; // No similarity if we don't have the embeddings
    }

    // Calculate similarity
    const similarity = cosineSimilarity(
      embeddingsMap[hash1],
      embeddingsMap[hash2]
    );

    // Cache the result
    similarityCache[cacheKey] = similarity;

    if (debug) {
      console.log(
        `${prefix} 🧮 Calculated similarity ${similarity.toFixed(
          4
        )} for ${hash1} and ${hash2}`
      );
    }

    return similarity;
  }

  /**
   * Get pre-computed similar post hashes
   * @returns Similar posts hashes map
   */
  async function getTopSimilarPostsHashes(): Promise<Record<string, string[]> | null> {
    if (!similarPostsHashes) {
      if (debug) {
        console.log(`${prefix} 📡 Loading pre-computed similar post hashes`);
      }
      const data = await _fetchMapData("/posts-similar-hash.json", {});
      similarPostsHashes = data as Record<string, string[]> | null;
    }
    return similarPostsHashes;
  }

  /**
   * Get similar post hashes by hash
   * @param hash - Post hash
   * @param limit - Maximum number of similar hashes to return
   * @returns Array of similar post hashes
   * @throws If hash parameter is missing or invalid
   */
  async function getSimilarPostsHashByHash(hash: string, limit = 10): Promise<string[]> {
    // Validate hash parameter
    if (!hash) {
      throw new Error('Hash is required for getSimilarPostsHashByHash operation');
    }

    if (typeof hash !== 'string') {
      throw new Error('Hash must be a string value');
    }

    // Validate limit parameter
    if (limit !== undefined && (typeof limit !== 'number' || limit < 0)) {
      throw new Error('Limit must be a positive number or zero');
    }

    if (debug) {
      console.log(
        `${prefix} 📡 Fetching similar post hashes for hash: ${hash}`
      );
    }

    // Try to get from pre-computed similar hashes map first
    const similarHashesMap = await getTopSimilarPostsHashes();

    // If we have pre-computed similar hashes, use them
    if (similarHashesMap && similarHashesMap[hash]) {
      if (debug) {
        console.log(
          `${prefix} 💾 Using pre-computed similar hashes for ${hash}`
        );
      }
      return similarHashesMap[hash].slice(0, limit);
    }

    // Fall back to the old implementation if no pre-computed data available
    if (debug) {
      console.log(
        `${prefix} ⚠️ No pre-computed similar hashes found for ${hash}, falling back to on-the-fly computation`
      );
    }

    // First try to get from the pre-computed embeddings map
    const embeddingsMap = await getPostsEmbeddings();

    // If no pre-computed similar posts, compute similarities on the fly
    if (debug) {
      console.log(`${prefix} 🧮 Computing similarities for ${hash} on the fly`);
    }

    // Get all post hashes from the embeddings map
    const allHashes = Object.keys(embeddingsMap);

    // Skip if the target hash is not in the embeddings map
    if (!allHashes.includes(hash)) {
      if (debug) {
        console.log(
          `${prefix} ❌ No embedding found for post with hash: ${hash}`
        );
      }
      return [];
    }

    // Calculate similarities for all posts
    const similarities: Array<{ hash: string; similarity: number }> = [];

    for (const otherHash of allHashes) {
      if (otherHash === hash) continue; // Skip the target post
      const similarity = await getPostsSimilarityByHashes(hash, otherHash);
      similarities.push({
        hash: otherHash,
        similarity,
      });
    }

    // Sort by similarity (highest first) and take the top 'limit'
    const sortedSimilarities = similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    // Return just the hashes
    return sortedSimilarities.map((item) => item.hash);
  }

  /**
   * Get similar posts by hash
   * @param hash - Post hash
   * @param count - Maximum number of similar posts to return
   * @param options - Options for augmentation
   * @returns Array of similar posts
   * @throws If hash parameter is missing or invalid
   */
  async function getSimilarPostsByHash(hash: string, count = 5, options: AugmentOptions = {}): Promise<Post[]> {
    // Validate hash parameter
    if (!hash) {
      throw new Error('Hash is required for getSimilarPostsByHash operation');
    }

    if (typeof hash !== 'string') {
      throw new Error('Hash must be a string value');
    }

    // Validate count parameter
    if (count !== undefined && (typeof count !== 'number' || count < 0)) {
      throw new Error('Count must be a positive number or zero');
    }

    if (debug) {
      console.log(`${prefix} 📡 Fetching similar posts for hash: ${hash}`);
    }

    // Get array of similar post hashes
    const similarHashes = await getSimilarPostsHashByHash(hash, count);

    if (!similarHashes.length) {
      // Fall back to recent posts if no similar posts found
      return await getRecentPosts(count);
    }

    // Use augmentation helper to get full post objects
    return await augmentPostsByProperty(similarHashes, "hash", {
      count,
      ...options,
    });
  }

  /**
   * Get similar post slugs by slug
   * @param slug - Post slug
   * @param limit - Maximum number of similar slugs to return
   * @returns Array of similar post slugs
   */
  async function getSimilarPostsSlugBySlug(slug: string, limit = 10): Promise<string[]> {
    if (debug) {
      console.log(`${prefix} 📡 Fetching similar post slugs for slug: ${slug}`);
    }

    const embeddingsMap = await _fetchMapData("/posts-embedding-slug-map.json");

    if (
      embeddingsMap &&
      embeddingsMap[slug] &&
      Array.isArray(embeddingsMap[slug])
    ) {
      return (embeddingsMap[slug] as string[]).slice(0, limit);
    }

    return [];
  }

  /**
   * Get similar posts by slug
   * @param slug - Post slug
   * @param count - Maximum number of similar posts to return
   * @param options - Options for augmentation
   * @returns Array of similar posts
   * @throws If slug parameter is missing or invalid
   */
  async function getSimilarPostsBySlug(slug: string, count = 5, options: AugmentOptions = {}): Promise<Post[]> {
    // Validate slug parameter
    if (!slug) {
      throw new Error('Slug is required for getSimilarPostsBySlug operation');
    }

    if (typeof slug !== 'string') {
      throw new Error('Slug must be a string value');
    }

    // Validate count parameter
    if (count !== undefined && (typeof count !== 'number' || count < 0)) {
      throw new Error('Count must be a positive number or zero');
    }

    if (debug) {
      console.log(`${prefix} 📡 Fetching similar posts for slug: ${slug}`);
    }

    // Get array of similar post slugs
    const similarSlugs = await getSimilarPostsSlugBySlug(slug, count);

    if (similarSlugs.length > 0) {
      // Use augmentation helper to get full post objects
      return await augmentPostsByProperty(similarSlugs, "slug", {
        count,
        ...options,
      });
    }

    // Try to get the post hash and find similar posts by hash if no similar posts by slug
    try {
      const post = await getPostBySlug(slug);
      if (post && post.hash) {
        return await getSimilarPostsByHash(post.hash, count, options);
      }
    } catch (error) {
      if (debug) {
        console.error(
          `${prefix} ❌ Error getting similar posts by hash for slug ${slug}:`,
          error
        );
      }
    }

    // Fall back to recent posts if no similar posts found
    return await getRecentPosts(count);
  }

  return {
    getPostsEmbeddings,
    getPostsSimilarity,
    getPostsSimilarityByHashes,
    getTopSimilarPostsHashes,
    getSimilarPostsHashByHash,
    getSimilarPostsByHash,
    getSimilarPostsSlugBySlug,
    getSimilarPostsBySlug,
    clearSimilarityCache,
  };
}

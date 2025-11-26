/**
 * Post Retrieval module for RepoMD
 * Provides functions for fetching and retrieving blog posts
 */

import { LOG_PREFIXES } from '../logger.js';
import type { Post } from '../types/post.js';

// Re-export Post type for backward compatibility
export type { Post } from '../types/post.js';

const prefix = LOG_PREFIXES.REPO_MD;

/** Stats tracking for post operations */
export interface PostStats {
  posts: {
    totalLoaded: number;
    byMethod: {
      memoryCache: number;
      directSlugFile: number;
      directHashFile: number;
      directPath: number;
      pathMap: number;
      allPosts: number;
    };
    allPostsLoaded: boolean;
    individualLoads: number;
    lastUpdated: number | null;
  };
}

/** Configuration for post retrieval service */
export interface PostRetrievalConfig {
  getRevisionUrl: (path: string) => Promise<string>;
  getProjectUrl: (path: string) => string;
  getSharedFolderUrl: (path: string) => string;
  fetchR2Json: <T>(path: string, options?: { defaultValue?: T; useCache?: boolean }) => Promise<T>;
  fetchJson: <T>(url: string, options?: { defaultValue?: T; useCache?: boolean }) => Promise<T>;
  _fetchMapData: (path: string) => Promise<Record<string, string> | null>;
  stats?: PostStats;
  debug?: boolean;
  getActiveRev?: (() => string | undefined) | null;
}

/** Options for augmenting posts */
export interface AugmentOptions {
  loadIndividually?: number;
  count?: number;
  useCache?: boolean;
}

/** Post retrieval service interface */
export interface PostRetrievalService {
  getAllPosts: (useCache?: boolean, forceRefresh?: boolean) => Promise<Post[]>;
  getPostByPath: (path: string) => Promise<Post | null>;
  getPostBySlug: (slug: string) => Promise<Post | null>;
  getPostByHash: (hash: string) => Promise<Post | null>;
  augmentPostsByProperty: (keys: string[], property: string, options?: AugmentOptions) => Promise<Post[]>;
  sortPostsByDate: (posts: Post[]) => Post[];
  getRecentPosts: (count?: number) => Promise<Post[]>;
  clearPostsCache: () => void;
  _findPostByProperty: (posts: Post[] | null | undefined, property: string, value: unknown) => Post | null;
}

/**
 * Create a post retrieval service
 * @param config - Configuration object
 * @returns Post retrieval functions
 */
export function createPostRetrieval(config: PostRetrievalConfig): PostRetrievalService {
  const { getSharedFolderUrl, fetchR2Json, fetchJson, _fetchMapData, stats, debug = false, getActiveRev = null } = config;

  // Local post cache reference with revision tracking
  let postsCache: Post[] | null = null;
  let postsCacheRevision: string | null = null; // Track which revision the cache is for

  /**
   * Clear the posts cache (called when revision changes)
   */
  function clearPostsCache(): void {
    if (debug && postsCache) {
      console.log(`${prefix} 🗑️ Clearing posts cache (revision changed)`);
    }
    postsCache = null;
    postsCacheRevision = null;
  }

  /**
   * Helper function to find post in array by property
   * @param posts - Array of posts
   * @param property - Property name to match
   * @param value - Value to match
   * @returns Found post or null
   */
  function _findPostByProperty(posts: Post[] | null | undefined, property: string, value: unknown): Post | null {
    return posts?.find((post) => post[property] === value) || null;
  }

  /**
   * Get all blog posts
   * @param useCache - Whether to use cache
   * @param forceRefresh - Whether to force refresh from R2
   * @returns Array of posts
   */
  async function getAllPosts(useCache = true, forceRefresh = false): Promise<Post[]> {
    const startTime = performance.now();

    // Check if revision has changed - invalidate cache if so
    if (postsCache && getActiveRev) {
      const currentRev = getActiveRev();
      if (currentRev && postsCacheRevision && currentRev !== postsCacheRevision) {
        if (debug) {
          console.log(
            `${prefix} 🔄 Revision changed from ${postsCacheRevision} to ${currentRev}, invalidating posts cache`
          );
        }
        clearPostsCache();
      }
    }

    // Return cached posts if available and refresh not forced
    if (useCache && postsCache && !forceRefresh) {
      const duration = (performance.now() - startTime).toFixed(2);
      if (debug) {
        console.log(
          `${prefix} 💾 Using cached posts array (${postsCache.length} posts) in ${duration}ms`
        );
      }

      // Update stats for memory cache usage
      if (stats) {
        stats.posts.byMethod.memoryCache++;
        stats.posts.lastUpdated = Date.now();
      }

      return postsCache;
    }

    // Fetch posts from R2
    const posts = await fetchR2Json<Post[]>("/posts.json", {
      defaultValue: [],
      useCache,
    });

    // Cache the posts for future use
    if (useCache) {
      postsCache = posts;
      // Store the revision this cache is for
      if (getActiveRev) {
        postsCacheRevision = getActiveRev() || null;
      }
      const duration = (performance.now() - startTime).toFixed(2);
      if (debug) {
        console.log(
          `${prefix} 📄 Cached ${posts.length} posts in memory for revision ${postsCacheRevision} in ${duration}ms`
        );
      }

      // Update stats for all posts loaded
      if (stats) {
        stats.posts.totalLoaded += posts.length;
        stats.posts.byMethod.allPosts++;
        stats.posts.allPostsLoaded = true;
        stats.posts.lastUpdated = Date.now();
      }
    }

    return posts;
  }

  /**
   * Get a post by its direct path
   * @param path - Post path
   * @returns Post object or null
   * @throws If path parameter is missing or invalid
   */
  async function getPostByPath(path: string): Promise<Post | null> {
    // Validate path parameter
    if (!path) {
      throw new Error('Path is required for getPostByPath operation');
    }

    if (typeof path !== 'string') {
      throw new Error('Path must be a string value');
    }

    if (debug) {
      console.log(`${prefix} 📡 Fetching post by path: ${path}`);
    }

    try {
      const post = await fetchR2Json<Post | null>(path, {
        defaultValue: null,
        useCache: true,
      });

      if (post && stats) {
        stats.posts.totalLoaded++;
        stats.posts.byMethod.directPath++;
        stats.posts.individualLoads++;
        stats.posts.lastUpdated = Date.now();
      }

      return post;
    } catch (error) {
      if (debug) {
        console.error(`${prefix} ❌ Error fetching post at path ${path}:`, error);
      }
      return null;
    }
  }


  /**
   * Get a single blog post by slug
   * @param slug - Post slug
   * @returns Post object or null
   * @throws If slug parameter is missing or invalid
   */
  async function getPostBySlug(slug: string): Promise<Post | null> {
    // Validate slug parameter
    if (!slug) {
      throw new Error('Slug is required for getPostBySlug operation');
    }

    if (typeof slug !== 'string') {
      throw new Error('Slug must be a string value');
    }

    const startTime = performance.now();
    let lookupMethod = 'unknown';

    if (debug) {
      console.log(`${prefix} 📡 Fetching post with slug: ${slug}`);
    }

    // First check if we already have posts in memory
    if (postsCache) {
      if (debug) {
        console.log(`${prefix} 💾 Searching for slug in cached posts array`);
      }
      const post = _findPostByProperty(postsCache, 'slug', slug);
      if (post) {
        lookupMethod = 'memory-cache';
        const duration = (performance.now() - startTime).toFixed(2);
        if (debug) {
          console.log(
            `${prefix} ✅ Found post in cache by slug: ${
              post.title || slug
            } in ${duration}ms`
          );
        }

        // Update stats for memory cache usage
        if (stats) {
          stats.posts.byMethod.memoryCache++;
          stats.posts.lastUpdated = Date.now();
        }

        return post;
      }
    }

    // Try to directly load the post by its slug from the individual JSON file
    const slugPath = `/_posts/slug/${slug}.json`;
    if (debug) {
      console.log(
        `${prefix} 🔍 Trying to load individual post file directly: ${slugPath}`
      );
    }

    try {
      const post = await fetchR2Json<Post | null>(slugPath, {
        defaultValue: null,
        useCache: true,
      });

      if (post) {
        lookupMethod = 'direct-slug-file';
        const duration = (performance.now() - startTime).toFixed(2);
        if (debug) {
          console.log(
            `${prefix} ✅ Successfully loaded post directly from slug file in ${duration}ms`
          );
        }

        // Update stats for direct slug file usage
        if (stats) {
          stats.posts.totalLoaded++;
          stats.posts.byMethod.directSlugFile++;
          stats.posts.individualLoads++;
          stats.posts.lastUpdated = Date.now();

          // Check if we should side-load all posts
          if (!postsCache && stats.posts.individualLoads >= 5 && !stats.posts.allPostsLoaded) {
            if (debug) {
              console.log(
                `${prefix} 🔄 Individual post loads threshold reached (${stats.posts.individualLoads}), side-loading all posts for better performance`
              );
            }

            // Side-load all posts in the background (don't await)
            getAllPosts().then(posts => {
              if (debug) {
                console.log(
                  `${prefix} ✅ Side-loaded ${posts.length} posts after threshold reached`
                );
              }
            }).catch(error => {
              if (debug) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.error(
                  `${prefix} ❌ Error side-loading all posts: ${errorMessage}`
                );
              }
            });
          }
        }

        return post;
      }
    } catch (error) {
      if (debug) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(
          `${prefix} ⚠️ Could not load post directly from slug file: ${errorMessage}`
        );
      }
      // Continue to fallback options
    }

    // Fallback: Try to get post hash from slug map
    const slugMap = await _fetchMapData('/posts-slug-map.json');

    if (slugMap && slugMap[slug]) {
      // If we have a hash, use getPostByHash
      if (debug) {
        console.log(
          `${prefix} 🔍 Found hash for slug in slugMap: ${slugMap[slug]}`
        );
      }
      const post = await getPostByHash(slugMap[slug]);
      if (post) {
        lookupMethod = 'slug-map';
        const duration = (performance.now() - startTime).toFixed(2);
        if (debug) {
          console.log(
            `${prefix} ✅ Successfully loaded post via hash from slug mapping in ${duration}ms`
          );
        }

        // Stats are already updated by getPostByHash, no need to update here

        return post;
      }
    }

    // Last resort: Fall back to loading all posts and filtering
    if (debug) {
      console.log(
        `${prefix} 📡 Falling back to loading all posts to find slug: ${slug}`
      );
    }
    const posts = await getAllPosts();
    const post = _findPostByProperty(posts, 'slug', slug);

    const duration = (performance.now() - startTime).toFixed(2);
    if (post) {
      lookupMethod = 'all-posts';
      if (debug) {
        console.log(
          `${prefix} ✅ Found post by slug in full posts list in ${duration}ms using ${lookupMethod}`
        );
      }

      // Update stats for all posts usage (if not already updated by getAllPosts)
      if (stats && !stats.posts.allPostsLoaded) {
        stats.posts.byMethod.allPosts++;
        stats.posts.allPostsLoaded = true;
        stats.posts.lastUpdated = Date.now();
      }
    } else {
      if (debug) {
        console.log(
          `${prefix} ❓ Post with slug not found even after loading all posts (search took ${duration}ms)`
        );
      }
    }

    return post;
  }

  /**
   * Get a single blog post by hash
   * @param hash - Post hash
   * @returns Post object or null
   * @throws If hash parameter is missing or invalid
   */
  async function getPostByHash(hash: string): Promise<Post | null> {
    // Validate hash parameter
    if (!hash) {
      throw new Error('Hash is required for getPostByHash operation');
    }

    if (typeof hash !== 'string') {
      throw new Error('Hash must be a string value');
    }

    const startTime = performance.now();
    let lookupMethod = 'unknown';

    if (debug) {
      console.log(`${prefix} 📡 Fetching post with hash: ${hash}`);
    }

    // First check if we already have posts in memory
    if (postsCache) {
      if (debug) {
        console.log(`${prefix} 💾 Searching for hash in cached posts array`);
      }
      const post = _findPostByProperty(postsCache, 'hash', hash);
      if (post) {
        lookupMethod = 'memory-cache';
        const duration = (performance.now() - startTime).toFixed(2);
        if (debug) {
          console.log(
            `${prefix} ✅ Found post in cache by hash: ${
              post.title || hash
            } in ${duration}ms`
          );
        }

        // Update stats for memory cache usage
        if (stats) {
          stats.posts.byMethod.memoryCache++;
          stats.posts.lastUpdated = Date.now();
        }

        return post;
      } else {
        if (debug) {
          console.log(
            `${prefix} ❓ Post with hash not found in cache: ${hash}`
          );
        }
      }
    }

    // Try to directly load the post by its hash from the shared folder
    // This path is in the shared folder and doesn't need a revision number
    const hashPath = `/posts/${hash}.json`;
    if (debug) {
      console.log(
        `${prefix} 🔍 Trying to load individual post file directly from shared folder: ${hashPath}`
      );
    }

    try {
      // Get the URL using the shared folder URL generator
      const url = getSharedFolderUrl(hashPath);

      if (debug) {
        console.log(`${prefix} 🔗 Loading from shared URL: ${url}`);
      }

      const post = await fetchJson<Post | null>(url, {
        defaultValue: null,
        useCache: true,
      });

      if (post) {
        lookupMethod = 'direct-hash-file';
        const duration = (performance.now() - startTime).toFixed(2);
        if (debug) {
          console.log(
            `${prefix} ✅ Successfully loaded post directly from hash file in ${duration}ms`
          );
        }

        // Update stats for direct hash file usage
        if (stats) {
          stats.posts.totalLoaded++;
          stats.posts.byMethod.directHashFile++;
          stats.posts.individualLoads++;
          stats.posts.lastUpdated = Date.now();

          // Check if we should side-load all posts
          if (!postsCache && stats.posts.individualLoads >= 5 && !stats.posts.allPostsLoaded) {
            if (debug) {
              console.log(
                `${prefix} 🔄 Individual post loads threshold reached (${stats.posts.individualLoads}), side-loading all posts for better performance`
              );
            }

            // Side-load all posts in the background (don't await)
            getAllPosts().then(posts => {
              if (debug) {
                console.log(
                  `${prefix} ✅ Side-loaded ${posts.length} posts after threshold reached`
                );
              }
            }).catch(error => {
              if (debug) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.error(
                  `${prefix} ❌ Error side-loading all posts: ${errorMessage}`
                );
              }
            });
          }
        }

        return post;
      }
    } catch (error) {
      if (debug) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(
          `${prefix} ⚠️ Could not load post directly from hash file: ${errorMessage}`
        );
      }
      // Continue to fallback options
    }

    // Fallback: Try to get post path from path map
    const pathMap = await _fetchMapData('/posts-path-map.json');

    if (pathMap && pathMap[hash]) {
      // If we have a path, use getPostByPath
      if (debug) {
        console.log(
          `${prefix} 🔍 Found path for hash in pathMap: ${pathMap[hash]}`
        );
      }
      const post = await getPostByPath(pathMap[hash]);
      if (post) {
        lookupMethod = 'path-map';
        const duration = (performance.now() - startTime).toFixed(2);
        if (debug) {
          console.log(
            `${prefix} ✅ Successfully loaded post by path from hash mapping in ${duration}ms`
          );
        }

        // Update stats for path map usage
        if (stats) {
          stats.posts.totalLoaded++;
          stats.posts.byMethod.pathMap++;
          stats.posts.lastUpdated = Date.now();
        }

        return post;
      }
    }

    // Last resort: Fall back to loading all posts and filtering
    if (debug) {
      console.log(
        `${prefix} 📡 Falling back to loading all posts to find hash: ${hash}`
      );
    }
    const posts = await getAllPosts();
    const post = _findPostByProperty(posts, 'hash', hash);

    const duration = (performance.now() - startTime).toFixed(2);
    if (post) {
      lookupMethod = 'all-posts';
      if (debug) {
        console.log(
          `${prefix} ✅ Found post by hash in full posts list: ${
            post.title || hash
          } in ${duration}ms using ${lookupMethod}`
        );
      }

      // Update stats for all posts usage (if not already updated by getAllPosts)
      if (stats && !stats.posts.allPostsLoaded) {
        stats.posts.byMethod.allPosts++;
        stats.posts.allPostsLoaded = true;
        stats.posts.lastUpdated = Date.now();
      }
    } else {
      if (debug) {
        console.log(
          `${prefix} ❓ Post with hash not found even after loading all posts: ${hash} (search took ${duration}ms)`
        );
      }
    }
    return post;
  }

  /**
   * Helper to augment an array of keys with their corresponding posts
   * @param keys - Array of keys
   * @param property - Property to match (hash, slug, id)
   * @param options - Options
   * @returns Array of posts
   */
  async function augmentPostsByProperty(keys: string[], property: string, options: AugmentOptions = {}): Promise<Post[]> {
    if (!keys || !keys.length) return [];

    const {
      loadIndividually = 3, // Threshold for switching to bulk loading
      count = keys.length, // How many posts to return
      useCache = true, // Whether to use cache
    } = options;

    // Slice to requested count
    const targetKeys = keys.slice(0, count);

    if (debug) {
      console.log(
        `${prefix} 📡 Augmenting ${targetKeys.length} posts by ${property}`
      );
    }

    // For small number of posts (<= loadIndividually), load individually
    if (targetKeys.length <= loadIndividually) {
      if (debug) {
        console.log(`${prefix} 📡 Loading ${targetKeys.length} posts individually`);
      }

      // Use the appropriate getter method based on property
      const getterMethod =
        property === 'hash'
          ? getPostByHash
          : property === 'slug'
          ? getPostBySlug
          : null;

      // If we don't have a getter method for this property (like 'id'), use general lookup
      if (!getterMethod) {
        if (debug) {
          console.log(`${prefix} ⚠️ No direct getter for property '${property}', using all posts lookup`);
        }
        const allPosts = await getAllPosts();
        const posts = targetKeys
          .map(key => _findPostByProperty(allPosts, property, key))
          .filter((post): post is Post => post !== null);
        return posts;
      }

      // Fetch all posts in parallel using the appropriate getter
      const posts = await Promise.all(
        targetKeys.map((key) => getterMethod(key))
      );

      return posts.filter((post): post is Post => post !== null); // Filter out null values
    }

    // For larger sets, check if posts are already cached
    if (useCache && postsCache) {
      if (debug) {
        console.log(`${prefix} 💾 Using cached posts for bulk augmentation`);
      }

      // Create a lookup map for efficient filtering
      const postsMap: Record<string, Post> = {};
      postsCache.forEach((post) => {
        const key = post[property];
        if (typeof key === 'string') {
          postsMap[key] = post;
        }
      });

      // Map keys to full post objects
      return targetKeys.map((key) => postsMap[key]).filter((post): post is Post => post !== undefined);
    }

    // Otherwise load all posts and filter
    if (debug) {
      console.log(`${prefix} 📡 Loading all posts for bulk augmentation`);
    }

    const allPosts = await getAllPosts(useCache);
    const postsMap: Record<string, Post> = {};

    // Create a lookup map for efficient filtering
    allPosts.forEach((post) => {
      const key = post[property];
      if (typeof key === 'string') {
        postsMap[key] = post;
      }
    });

    // Map keys to full post objects
    return targetKeys.map((key) => postsMap[key]).filter((post): post is Post => post !== undefined);
  }

  /**
   * Sort posts by date (newest first)
   * @param posts - Array of posts
   * @returns Sorted posts
   */
  function sortPostsByDate(posts: Post[]): Post[] {
    return [...posts].sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  }

  /**
   * Get recent posts
   * @param count - Number of posts to retrieve
   * @returns Array of recent posts
   */
  async function getRecentPosts(count = 3): Promise<Post[]> {
    const posts = await getAllPosts();
    return sortPostsByDate(posts).slice(0, count);
  }

  return {
    getAllPosts,
    getPostByPath,
    getPostBySlug,
    getPostByHash,
    augmentPostsByProperty,
    sortPostsByDate,
    getRecentPosts,
    clearPostsCache,
    _findPostByProperty,
  };
}

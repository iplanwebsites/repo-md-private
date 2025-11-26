/**
 * Tests for the posts retrieval module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createPostRetrieval } from './retrieval.js';

describe('Posts Retrieval Module', () => {
  let mockFetchR2Json;
  let mockFetchJson;
  let mockFetchMapData;
  let mockGetRevisionUrl;
  let mockGetProjectUrl;
  let mockGetSharedFolderUrl;
  let mockStats;

  // Sample post data
  const samplePosts = [
    {
      hash: 'hash-1',
      slug: 'post-one',
      title: 'Post One',
      date: '2024-01-15',
      content: 'Content 1',
    },
    {
      hash: 'hash-2',
      slug: 'post-two',
      title: 'Post Two',
      date: '2024-01-20',
      content: 'Content 2',
    },
    {
      hash: 'hash-3',
      slug: 'post-three',
      title: 'Post Three',
      date: '2024-01-10',
      content: 'Content 3',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    mockFetchR2Json = vi.fn();
    mockFetchJson = vi.fn();
    mockFetchMapData = vi.fn();
    mockGetRevisionUrl = vi.fn().mockResolvedValue('https://example.com/rev/path');
    mockGetProjectUrl = vi.fn().mockReturnValue('https://example.com/project/path');
    mockGetSharedFolderUrl = vi.fn().mockReturnValue('https://example.com/shared/path');

    mockStats = {
      posts: {
        totalLoaded: 0,
        byMethod: {
          memoryCache: 0,
          directHashFile: 0,
          directSlugFile: 0,
          pathMap: 0,
          directPath: 0,
          allPosts: 0,
        },
        individualLoads: 0,
        allPostsLoaded: false,
        lastUpdated: Date.now(),
      },
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createRetrieval(options = {}) {
    return createPostRetrieval({
      getRevisionUrl: mockGetRevisionUrl,
      getProjectUrl: mockGetProjectUrl,
      getSharedFolderUrl: mockGetSharedFolderUrl,
      fetchR2Json: mockFetchR2Json,
      fetchJson: mockFetchJson,
      _fetchMapData: mockFetchMapData,
      stats: mockStats,
      debug: false,
      ...options,
    });
  }

  describe('createPostRetrieval', () => {
    it('should create post retrieval service with all methods', () => {
      const retrieval = createRetrieval();

      expect(retrieval.getAllPosts).toBeInstanceOf(Function);
      expect(retrieval.getPostByPath).toBeInstanceOf(Function);
      expect(retrieval.getPostBySlug).toBeInstanceOf(Function);
      expect(retrieval.getPostByHash).toBeInstanceOf(Function);
      expect(retrieval.augmentPostsByProperty).toBeInstanceOf(Function);
      expect(retrieval.sortPostsByDate).toBeInstanceOf(Function);
      expect(retrieval.getRecentPosts).toBeInstanceOf(Function);
      expect(retrieval._findPostByProperty).toBeInstanceOf(Function);
    });
  });

  describe('getAllPosts', () => {
    it('should fetch all posts from R2', async () => {
      mockFetchR2Json.mockResolvedValue(samplePosts);

      const retrieval = createRetrieval();
      const posts = await retrieval.getAllPosts();

      expect(mockFetchR2Json).toHaveBeenCalledWith('/posts.json', {
        defaultValue: [],
        useCache: true,
      });
      expect(posts).toEqual(samplePosts);
    });

    it('should use cached posts on subsequent calls', async () => {
      mockFetchR2Json.mockResolvedValue(samplePosts);

      const retrieval = createRetrieval();

      // First call
      await retrieval.getAllPosts();

      // Second call - should use cache
      const posts = await retrieval.getAllPosts();

      // Should only fetch once
      expect(mockFetchR2Json).toHaveBeenCalledOnce();
      expect(posts).toEqual(samplePosts);
    });

    it('should force refresh when requested', async () => {
      mockFetchR2Json.mockResolvedValue(samplePosts);

      const retrieval = createRetrieval();

      // First call
      await retrieval.getAllPosts();

      // Force refresh
      await retrieval.getAllPosts(true, true);

      // Should have fetched twice
      expect(mockFetchR2Json).toHaveBeenCalledTimes(2);
    });

    it('should return empty array when no posts', async () => {
      mockFetchR2Json.mockResolvedValue([]);

      const retrieval = createRetrieval();
      const posts = await retrieval.getAllPosts();

      expect(posts).toEqual([]);
    });

    it('should update stats when posts are loaded', async () => {
      mockFetchR2Json.mockResolvedValue(samplePosts);

      const retrieval = createRetrieval();
      await retrieval.getAllPosts();

      expect(mockStats.posts.totalLoaded).toBe(samplePosts.length);
      expect(mockStats.posts.byMethod.allPosts).toBe(1);
      expect(mockStats.posts.allPostsLoaded).toBe(true);
    });
  });

  describe('getPostBySlug', () => {
    it('should throw error when slug is not provided', async () => {
      const retrieval = createRetrieval();

      await expect(retrieval.getPostBySlug()).rejects.toThrow('Slug is required');
      await expect(retrieval.getPostBySlug('')).rejects.toThrow('Slug is required');
      await expect(retrieval.getPostBySlug(null)).rejects.toThrow('Slug is required');
    });

    it('should throw error when slug is not a string', async () => {
      const retrieval = createRetrieval();

      await expect(retrieval.getPostBySlug(123)).rejects.toThrow('Slug must be a string');
      await expect(retrieval.getPostBySlug({ slug: 'test' })).rejects.toThrow('Slug must be a string');
    });

    it('should find post from memory cache', async () => {
      mockFetchR2Json.mockResolvedValue(samplePosts);

      const retrieval = createRetrieval();

      // Load posts into cache
      await retrieval.getAllPosts();

      // Now search by slug
      const post = await retrieval.getPostBySlug('post-two');

      expect(post).toEqual(samplePosts[1]);
      expect(mockStats.posts.byMethod.memoryCache).toBe(1);
    });

    it('should try direct slug file when not in cache', async () => {
      mockFetchR2Json.mockResolvedValue(samplePosts[0]);

      const retrieval = createRetrieval();
      const post = await retrieval.getPostBySlug('post-one');

      expect(mockFetchR2Json).toHaveBeenCalledWith('/_posts/slug/post-one.json', {
        defaultValue: null,
        useCache: true,
      });
      expect(post).toEqual(samplePosts[0]);
    });

    it('should fall back to slug map when direct file fails', async () => {
      mockFetchR2Json.mockRejectedValueOnce(new Error('Not found'));
      mockFetchMapData.mockResolvedValue({ 'post-one': 'hash-1' });
      mockFetchJson.mockResolvedValue(samplePosts[0]);

      const retrieval = createRetrieval();
      const post = await retrieval.getPostBySlug('post-one');

      expect(mockFetchMapData).toHaveBeenCalledWith('/posts-slug-map.json');
      expect(post).toEqual(samplePosts[0]);
    });

    it('should fall back to all posts when other methods fail', async () => {
      mockFetchR2Json
        .mockRejectedValueOnce(new Error('Direct file not found'))
        .mockResolvedValue(samplePosts);
      mockFetchMapData.mockResolvedValue({});

      const retrieval = createRetrieval();
      const post = await retrieval.getPostBySlug('post-two');

      expect(post).toEqual(samplePosts[1]);
    });

    it('should return null when post not found', async () => {
      // First call: direct slug file lookup returns null
      mockFetchR2Json.mockResolvedValueOnce(null);
      // Second call: getAllPosts fallback returns empty array
      mockFetchR2Json.mockResolvedValueOnce([]);
      // Slug map returns empty (no mapping found)
      mockFetchMapData.mockResolvedValue({});

      const retrieval = createRetrieval();
      const post = await retrieval.getPostBySlug('non-existent');

      expect(post).toBeNull();
    });
  });

  describe('getPostByHash', () => {
    it('should throw error when hash is not provided', async () => {
      const retrieval = createRetrieval();

      await expect(retrieval.getPostByHash()).rejects.toThrow('Hash is required');
      await expect(retrieval.getPostByHash('')).rejects.toThrow('Hash is required');
    });

    it('should throw error when hash is not a string', async () => {
      const retrieval = createRetrieval();

      await expect(retrieval.getPostByHash(123)).rejects.toThrow('Hash must be a string');
    });

    it('should find post from memory cache', async () => {
      mockFetchR2Json.mockResolvedValue(samplePosts);

      const retrieval = createRetrieval();

      // Load posts into cache
      await retrieval.getAllPosts();

      // Now search by hash
      const post = await retrieval.getPostByHash('hash-1');

      expect(post).toEqual(samplePosts[0]);
    });

    it('should try direct hash file from shared folder', async () => {
      mockFetchJson.mockResolvedValue(samplePosts[0]);

      const retrieval = createRetrieval();
      const post = await retrieval.getPostByHash('hash-1');

      expect(mockGetSharedFolderUrl).toHaveBeenCalledWith('/posts/hash-1.json');
      expect(mockFetchJson).toHaveBeenCalled();
      expect(post).toEqual(samplePosts[0]);
    });

    it('should fall back to path map when direct file fails', async () => {
      mockFetchJson.mockRejectedValueOnce(new Error('Not found'));
      mockFetchMapData.mockResolvedValue({ 'hash-1': '/posts/path/to/post.json' });
      mockFetchR2Json.mockResolvedValue(samplePosts[0]);

      const retrieval = createRetrieval();
      const post = await retrieval.getPostByHash('hash-1');

      expect(mockFetchMapData).toHaveBeenCalledWith('/posts-path-map.json');
      expect(post).toEqual(samplePosts[0]);
    });

    it('should return null when post not found', async () => {
      mockFetchJson.mockRejectedValueOnce(new Error('Not found'));
      mockFetchMapData.mockResolvedValue({});
      mockFetchR2Json.mockResolvedValue([]);

      const retrieval = createRetrieval();
      const post = await retrieval.getPostByHash('non-existent-hash');

      expect(post).toBeNull();
    });
  });

  describe('getPostByPath', () => {
    it('should throw error when path is not provided', async () => {
      const retrieval = createRetrieval();

      await expect(retrieval.getPostByPath()).rejects.toThrow('Path is required');
      await expect(retrieval.getPostByPath('')).rejects.toThrow('Path is required');
    });

    it('should throw error when path is not a string', async () => {
      const retrieval = createRetrieval();

      await expect(retrieval.getPostByPath(123)).rejects.toThrow('Path must be a string');
    });

    it('should fetch post by path', async () => {
      mockFetchR2Json.mockResolvedValue(samplePosts[0]);

      const retrieval = createRetrieval();
      const post = await retrieval.getPostByPath('/posts/test-post.json');

      expect(mockFetchR2Json).toHaveBeenCalledWith('/posts/test-post.json', {
        defaultValue: null,
        useCache: true,
      });
      expect(post).toEqual(samplePosts[0]);
    });

    it('should return null on error', async () => {
      mockFetchR2Json.mockRejectedValue(new Error('Not found'));

      const retrieval = createRetrieval();
      const post = await retrieval.getPostByPath('/invalid/path.json');

      expect(post).toBeNull();
    });

    it('should update stats when post is loaded', async () => {
      mockFetchR2Json.mockResolvedValue(samplePosts[0]);

      const retrieval = createRetrieval();
      await retrieval.getPostByPath('/posts/test.json');

      expect(mockStats.posts.totalLoaded).toBe(1);
      expect(mockStats.posts.byMethod.directPath).toBe(1);
      expect(mockStats.posts.individualLoads).toBe(1);
    });
  });

  describe('sortPostsByDate', () => {
    it('should sort posts by date (newest first)', () => {
      const retrieval = createRetrieval();
      const sorted = retrieval.sortPostsByDate(samplePosts);

      expect(sorted[0].slug).toBe('post-two'); // Jan 20
      expect(sorted[1].slug).toBe('post-one'); // Jan 15
      expect(sorted[2].slug).toBe('post-three'); // Jan 10
    });

    it('should not mutate original array', () => {
      const retrieval = createRetrieval();
      const original = [...samplePosts];
      const sorted = retrieval.sortPostsByDate(samplePosts);

      expect(samplePosts).toEqual(original);
      expect(sorted).not.toBe(samplePosts);
    });

    it('should handle empty array', () => {
      const retrieval = createRetrieval();
      const sorted = retrieval.sortPostsByDate([]);

      expect(sorted).toEqual([]);
    });

    it('should handle single post', () => {
      const retrieval = createRetrieval();
      const sorted = retrieval.sortPostsByDate([samplePosts[0]]);

      expect(sorted).toEqual([samplePosts[0]]);
    });
  });

  describe('getRecentPosts', () => {
    it('should return recent posts sorted by date', async () => {
      mockFetchR2Json.mockResolvedValue(samplePosts);

      const retrieval = createRetrieval();
      const recent = await retrieval.getRecentPosts(2);

      expect(recent.length).toBe(2);
      expect(recent[0].slug).toBe('post-two'); // Newest
      expect(recent[1].slug).toBe('post-one');
    });

    it('should default to 3 posts', async () => {
      mockFetchR2Json.mockResolvedValue(samplePosts);

      const retrieval = createRetrieval();
      const recent = await retrieval.getRecentPosts();

      expect(recent.length).toBe(3);
    });

    it('should return all posts if count exceeds total', async () => {
      mockFetchR2Json.mockResolvedValue(samplePosts);

      const retrieval = createRetrieval();
      const recent = await retrieval.getRecentPosts(10);

      expect(recent.length).toBe(3);
    });
  });

  describe('_findPostByProperty', () => {
    it('should find post by specified property', () => {
      const retrieval = createRetrieval();

      expect(retrieval._findPostByProperty(samplePosts, 'slug', 'post-one')).toEqual(samplePosts[0]);
      expect(retrieval._findPostByProperty(samplePosts, 'hash', 'hash-2')).toEqual(samplePosts[1]);
      expect(retrieval._findPostByProperty(samplePosts, 'title', 'Post Three')).toEqual(samplePosts[2]);
    });

    it('should return null when not found', () => {
      const retrieval = createRetrieval();

      expect(retrieval._findPostByProperty(samplePosts, 'slug', 'non-existent')).toBeNull();
    });

    it('should handle empty array', () => {
      const retrieval = createRetrieval();

      expect(retrieval._findPostByProperty([], 'slug', 'test')).toBeNull();
    });

    it('should handle null/undefined posts array', () => {
      const retrieval = createRetrieval();

      expect(retrieval._findPostByProperty(null, 'slug', 'test')).toBeNull();
      expect(retrieval._findPostByProperty(undefined, 'slug', 'test')).toBeNull();
    });
  });

  describe('augmentPostsByProperty', () => {
    it('should augment keys with full post objects', async () => {
      mockFetchR2Json.mockResolvedValue(samplePosts);

      const retrieval = createRetrieval();
      const posts = await retrieval.augmentPostsByProperty(
        ['hash-1', 'hash-3'],
        'hash'
      );

      expect(posts.length).toBe(2);
      expect(posts[0].hash).toBe('hash-1');
      expect(posts[1].hash).toBe('hash-3');
    });

    it('should handle empty keys array', async () => {
      const retrieval = createRetrieval();

      const posts = await retrieval.augmentPostsByProperty([], 'hash');

      expect(posts).toEqual([]);
    });

    it('should respect count option', async () => {
      mockFetchR2Json.mockResolvedValue(samplePosts);

      const retrieval = createRetrieval();
      const posts = await retrieval.augmentPostsByProperty(
        ['hash-1', 'hash-2', 'hash-3'],
        'hash',
        { count: 2 }
      );

      expect(posts.length).toBe(2);
    });

    it('should filter out null values for missing posts', async () => {
      mockFetchR2Json.mockResolvedValue(samplePosts);

      const retrieval = createRetrieval();
      const posts = await retrieval.augmentPostsByProperty(
        ['hash-1', 'non-existent', 'hash-2'],
        'hash'
      );

      expect(posts.length).toBe(2);
    });

    it('should use cached posts for bulk augmentation', async () => {
      mockFetchR2Json.mockResolvedValue(samplePosts);

      const retrieval = createRetrieval();

      // First load all posts
      await retrieval.getAllPosts();

      // Now augment with many keys
      const posts = await retrieval.augmentPostsByProperty(
        ['hash-1', 'hash-2', 'hash-3', 'hash-4', 'hash-5'],
        'hash'
      );

      // Should only have called fetch once (for getAllPosts)
      expect(mockFetchR2Json).toHaveBeenCalledOnce();
    });
  });

  describe('Debug Mode', () => {
    it('should log debug info when enabled', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      mockFetchR2Json.mockResolvedValue(samplePosts);

      const retrieval = createRetrieval({ debug: true });
      await retrieval.getAllPosts();

      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('Cache Invalidation on Revision Change', () => {
    let currentRevision;
    let mockGetActiveRev;

    beforeEach(() => {
      currentRevision = 'rev-001';
      mockGetActiveRev = vi.fn(() => currentRevision);
    });

    const createServiceWithRevision = () => {
      return createPostRetrieval({
        getRevisionUrl: mockGetRevisionUrl,
        getProjectUrl: mockGetProjectUrl,
        getSharedFolderUrl: mockGetSharedFolderUrl,
        fetchR2Json: mockFetchR2Json,
        fetchJson: mockFetchJson,
        _fetchMapData: mockFetchMapData,
        stats: null,
        debug: false,
        getActiveRev: mockGetActiveRev,
      });
    };

    it('should cache posts on first fetch', async () => {
      mockFetchR2Json.mockResolvedValue([
        { hash: 'post1', title: 'Post 1', slug: 'post-1' },
        { hash: 'post2', title: 'Post 2', slug: 'post-2' },
      ]);

      const service = createServiceWithRevision();

      // First call - should fetch
      const posts1 = await service.getAllPosts(true);
      expect(mockFetchR2Json).toHaveBeenCalledTimes(1);
      expect(posts1).toHaveLength(2);

      // Second call - should use cache
      const posts2 = await service.getAllPosts(true);
      expect(mockFetchR2Json).toHaveBeenCalledTimes(1); // Still 1, used cache
      expect(posts2).toHaveLength(2);
    });

    it('should invalidate cache when revision changes', async () => {
      mockFetchR2Json.mockResolvedValue([
        { hash: 'post1', title: 'Post 1', slug: 'post-1' },
        { hash: 'post2', title: 'Post 2', slug: 'post-2' },
      ]);

      const service = createServiceWithRevision();

      // First call with rev-001
      await service.getAllPosts(true);
      expect(mockFetchR2Json).toHaveBeenCalledTimes(1);

      // Change revision
      currentRevision = 'rev-002';

      // Update mock to return different posts
      mockFetchR2Json.mockResolvedValueOnce([
        { hash: 'post3', title: 'Post 3', slug: 'post-3' },
      ]);

      // Next call should detect revision change and refetch
      const posts = await service.getAllPosts(true);
      expect(mockFetchR2Json).toHaveBeenCalledTimes(2); // Refetched!
      expect(posts).toHaveLength(1);
      expect(posts[0].hash).toBe('post3');
    });

    it('should not invalidate cache if revision unchanged', async () => {
      mockFetchR2Json.mockResolvedValue([
        { hash: 'post1', title: 'Post 1', slug: 'post-1' },
        { hash: 'post2', title: 'Post 2', slug: 'post-2' },
      ]);

      const service = createServiceWithRevision();

      // First call
      await service.getAllPosts(true);
      expect(mockFetchR2Json).toHaveBeenCalledTimes(1);

      // Multiple calls with same revision
      await service.getAllPosts(true);
      await service.getAllPosts(true);
      await service.getAllPosts(true);

      // Should still only have fetched once
      expect(mockFetchR2Json).toHaveBeenCalledTimes(1);
    });

    it('should clear cache with clearPostsCache', async () => {
      mockFetchR2Json.mockResolvedValue([
        { hash: 'post1', title: 'Post 1', slug: 'post-1' },
        { hash: 'post2', title: 'Post 2', slug: 'post-2' },
      ]);

      const service = createServiceWithRevision();

      // First call - cache posts
      await service.getAllPosts(true);
      expect(mockFetchR2Json).toHaveBeenCalledTimes(1);

      // Clear cache
      service.clearPostsCache();

      // Next call should refetch
      await service.getAllPosts(true);
      expect(mockFetchR2Json).toHaveBeenCalledTimes(2);
    });

    it('should bypass cache with forceRefresh', async () => {
      mockFetchR2Json.mockResolvedValue([
        { hash: 'post1', title: 'Post 1', slug: 'post-1' },
        { hash: 'post2', title: 'Post 2', slug: 'post-2' },
      ]);

      const service = createServiceWithRevision();

      // First call - cache posts
      await service.getAllPosts(true);
      expect(mockFetchR2Json).toHaveBeenCalledTimes(1);

      // Force refresh
      await service.getAllPosts(true, true);
      expect(mockFetchR2Json).toHaveBeenCalledTimes(2);
    });

    it('should work without getActiveRev (backward compatibility)', async () => {
      mockFetchR2Json.mockResolvedValue([
        { hash: 'post1', title: 'Post 1', slug: 'post-1' },
        { hash: 'post2', title: 'Post 2', slug: 'post-2' },
      ]);

      const service = createPostRetrieval({
        getRevisionUrl: mockGetRevisionUrl,
        getProjectUrl: mockGetProjectUrl,
        getSharedFolderUrl: mockGetSharedFolderUrl,
        fetchR2Json: mockFetchR2Json,
        fetchJson: mockFetchJson,
        _fetchMapData: mockFetchMapData,
        stats: null,
        debug: false,
        // No getActiveRev provided
      });

      // Should work without errors
      const posts = await service.getAllPosts(true);
      expect(posts).toHaveLength(2);
    });
  });
});

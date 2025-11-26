import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPostRetrieval } from './retrieval.js';

describe('createPostRetrieval', () => {
  let mockFetchR2Json;
  let mockGetActiveRev;
  let currentRevision;

  beforeEach(() => {
    currentRevision = 'rev-001';
    mockGetActiveRev = vi.fn(() => currentRevision);
    mockFetchR2Json = vi.fn(() => Promise.resolve([
      { hash: 'post1', title: 'Post 1', slug: 'post-1' },
      { hash: 'post2', title: 'Post 2', slug: 'post-2' },
    ]));
  });

  const createService = () => {
    return createPostRetrieval({
      getRevisionUrl: vi.fn(),
      getProjectUrl: vi.fn(),
      getSharedFolderUrl: vi.fn(),
      fetchR2Json: mockFetchR2Json,
      fetchJson: vi.fn(),
      _fetchMapData: vi.fn(),
      stats: null,
      debug: false,
      getActiveRev: mockGetActiveRev,
    });
  };

  describe('cache invalidation on revision change', () => {
    it('should cache posts on first fetch', async () => {
      const service = createService();

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
      const service = createService();

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
      const service = createService();

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
      const service = createService();

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
      const service = createService();

      // First call - cache posts
      await service.getAllPosts(true);
      expect(mockFetchR2Json).toHaveBeenCalledTimes(1);

      // Force refresh
      await service.getAllPosts(true, true);
      expect(mockFetchR2Json).toHaveBeenCalledTimes(2);
    });

    it('should work without getActiveRev (backward compatibility)', async () => {
      const service = createPostRetrieval({
        getRevisionUrl: vi.fn(),
        getProjectUrl: vi.fn(),
        getSharedFolderUrl: vi.fn(),
        fetchR2Json: mockFetchR2Json,
        fetchJson: vi.fn(),
        _fetchMapData: vi.fn(),
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

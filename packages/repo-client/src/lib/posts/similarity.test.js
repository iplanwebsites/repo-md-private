import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPostSimilarity } from './similarity.js';

describe('createPostSimilarity', () => {
  let mockFetchMapData;
  let mockGetActiveRev;
  let currentRevision;
  let similarityDataSet;

  beforeEach(() => {
    currentRevision = 'rev-001';
    mockGetActiveRev = vi.fn(() => currentRevision);

    similarityDataSet = 'initial';
    mockFetchMapData = vi.fn((path) => {
      if (path === '/posts-similarity.json') {
        if (similarityDataSet === 'initial') {
          return Promise.resolve({
            post1: { post2: 0.9, post3: 0.7 },
            post2: { post1: 0.9, post3: 0.5 },
          });
        } else {
          return Promise.resolve({
            post4: { post5: 0.8 },
          });
        }
      }
      return Promise.resolve({});
    });
  });

  const createService = (withActiveRev = true) => {
    return createPostSimilarity({
      fetchR2Json: vi.fn(),
      _fetchMapData: mockFetchMapData,
      getRecentPosts: vi.fn(() => Promise.resolve([])),
      getPostBySlug: vi.fn(),
      augmentPostsByProperty: vi.fn((posts) => Promise.resolve(posts)),
      debug: false,
      getActiveRev: withActiveRev ? mockGetActiveRev : null,
    });
  };

  describe('cache invalidation on revision change', () => {
    it('should cache similarity data on first fetch', async () => {
      const service = createService();

      // First call - should fetch
      const data1 = await service.getPostsSimilarity();
      expect(mockFetchMapData).toHaveBeenCalledTimes(1);
      expect(data1).toHaveProperty('post1');

      // Second call - should use cache
      const data2 = await service.getPostsSimilarity();
      expect(mockFetchMapData).toHaveBeenCalledTimes(1); // Still 1
    });

    it('should invalidate cache when revision changes', async () => {
      const service = createService();

      // First call with rev-001
      const data1 = await service.getPostsSimilarity();
      expect(mockFetchMapData).toHaveBeenCalledTimes(1);
      expect(data1).toHaveProperty('post1');

      // Change revision
      currentRevision = 'rev-002';
      similarityDataSet = 'updated';

      // Next call should detect revision change and refetch
      const data2 = await service.getPostsSimilarity();
      expect(mockFetchMapData).toHaveBeenCalledTimes(2);
      expect(data2).toHaveProperty('post4');
      expect(data2).not.toHaveProperty('post1');
    });

    it('should not invalidate cache if revision unchanged', async () => {
      const service = createService();

      // Multiple calls with same revision
      await service.getPostsSimilarity();
      await service.getPostsSimilarity();
      await service.getPostsSimilarity();

      // Should only fetch once
      expect(mockFetchMapData).toHaveBeenCalledTimes(1);
    });

    it('should clear cache with clearSimilarityCache', async () => {
      const service = createService();

      // First call - cache data
      await service.getPostsSimilarity();
      expect(mockFetchMapData).toHaveBeenCalledTimes(1);

      // Clear cache
      service.clearSimilarityCache();

      // Next call should refetch
      await service.getPostsSimilarity();
      expect(mockFetchMapData).toHaveBeenCalledTimes(2);
    });

    it('should work without getActiveRev (backward compatibility)', async () => {
      const service = createService(false);

      // Should work without errors
      const data = await service.getPostsSimilarity();
      expect(data).toHaveProperty('post1');
    });
  });
});

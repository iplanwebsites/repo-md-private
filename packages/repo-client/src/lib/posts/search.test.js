import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPostSearch } from './search.js';

describe('createPostSearch', () => {
  let mockGetAllPosts;
  let mockGetActiveRev;
  let currentRevision;
  let postSet;

  beforeEach(() => {
    currentRevision = 'rev-001';
    mockGetActiveRev = vi.fn(() => currentRevision);

    postSet = 'initial';
    mockGetAllPosts = vi.fn(() => {
      if (postSet === 'initial') {
        return Promise.resolve([
          { hash: 'post1', title: 'Hello World', slug: 'hello-world', excerpt: 'First post', plain: 'Hello world content' },
          { hash: 'post2', title: 'Goodbye World', slug: 'goodbye-world', excerpt: 'Second post', plain: 'Goodbye world content' },
        ]);
      } else {
        return Promise.resolve([
          { hash: 'post3', title: 'New Content', slug: 'new-content', excerpt: 'New post', plain: 'Brand new content' },
        ]);
      }
    });
  });

  const createService = (withActiveRev = true) => {
    return createPostSearch({
      getAllPosts: mockGetAllPosts,
      getPostsEmbeddings: vi.fn(() => Promise.resolve({})),
      getAllMedia: vi.fn(() => Promise.resolve([])),
      getMediaEmbeddings: vi.fn(() => Promise.resolve({})),
      debug: false,
      getActiveRev: withActiveRev ? mockGetActiveRev : null,
    });
  };

  describe('search index invalidation on revision change', () => {
    it('should build index on first search', async () => {
      const service = createService();

      const results = await service.searchPosts({ text: 'hello', mode: 'memory' });
      expect(mockGetAllPosts).toHaveBeenCalledTimes(1);
      expect(results.length).toBeGreaterThan(0);
    });

    it('should reuse index on subsequent searches with same revision', async () => {
      const service = createService();

      // First search
      await service.searchPosts({ text: 'hello', mode: 'memory' });
      expect(mockGetAllPosts).toHaveBeenCalledTimes(1);

      // Second search - should reuse index
      await service.searchPosts({ text: 'goodbye', mode: 'memory' });
      expect(mockGetAllPosts).toHaveBeenCalledTimes(1); // Still 1
    });

    it('should rebuild index when revision changes', async () => {
      const service = createService();

      // First search with rev-001
      const results1 = await service.searchPosts({ text: 'hello', mode: 'memory' });
      expect(mockGetAllPosts).toHaveBeenCalledTimes(1);
      expect(results1.length).toBeGreaterThan(0);

      // Change revision and post set
      currentRevision = 'rev-002';
      postSet = 'updated';

      // Next search should detect revision change and rebuild index
      const results2 = await service.searchPosts({ text: 'new', mode: 'memory' });
      expect(mockGetAllPosts).toHaveBeenCalledTimes(2); // Rebuilt!
      expect(results2.length).toBeGreaterThan(0);
    });

    it('should clear index with clearSearchIndex', async () => {
      const service = createService();

      // First search - build index
      await service.searchPosts({ text: 'hello', mode: 'memory' });
      expect(mockGetAllPosts).toHaveBeenCalledTimes(1);

      // Clear index
      service.clearSearchIndex();

      // Next search should rebuild
      await service.searchPosts({ text: 'hello', mode: 'memory' });
      expect(mockGetAllPosts).toHaveBeenCalledTimes(2);
    });

    it('should refresh index with refreshMemoryIndex', async () => {
      const service = createService();

      // First search - build index
      await service.searchPosts({ text: 'hello', mode: 'memory' });
      expect(mockGetAllPosts).toHaveBeenCalledTimes(1);

      // Refresh index
      await service.refreshMemoryIndex();
      expect(mockGetAllPosts).toHaveBeenCalledTimes(2);
    });

    it('should work without getActiveRev (backward compatibility)', async () => {
      const service = createService(false);

      // Should work without errors
      const results = await service.searchPosts({ text: 'hello', mode: 'memory' });
      expect(results).toBeDefined();
    });
  });

  describe('autocomplete invalidation on revision change', () => {
    it('should rebuild index for autocomplete when revision changes', async () => {
      const service = createService();

      // First autocomplete with rev-001
      await service.searchAutocomplete('hel');
      expect(mockGetAllPosts).toHaveBeenCalledTimes(1);

      // Change revision
      currentRevision = 'rev-002';
      postSet = 'updated';

      // Next autocomplete should detect revision change and rebuild
      await service.searchAutocomplete('new');
      expect(mockGetAllPosts).toHaveBeenCalledTimes(2);
    });
  });
});

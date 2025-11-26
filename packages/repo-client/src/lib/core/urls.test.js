/**
 * Tests for the URL generator module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createUrlGenerator } from './urls.js';

describe('URL Generator Module', () => {
  const PROJECT_ID = 'test-project-123';
  const ACTIVE_REV = 'rev-abc123';

  let mockResolveLatestRev;

  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveLatestRev = vi.fn().mockResolvedValue(ACTIVE_REV);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createUrlGenerator', () => {
    it('should create URL generator with required config', () => {
      const urls = createUrlGenerator({
        projectId: PROJECT_ID,
        rev: 'latest',
        resolveLatestRev: mockResolveLatestRev,
      });

      expect(urls).toBeDefined();
      expect(urls.getProjectUrl).toBeInstanceOf(Function);
      expect(urls.getRevisionUrl).toBeInstanceOf(Function);
      expect(urls.getMediaUrl).toBeInstanceOf(Function);
      expect(urls.getSqliteUrl).toBeInstanceOf(Function);
      expect(urls.getSharedFolderUrl).toBeInstanceOf(Function);
      expect(urls.getActiveRevState).toBeInstanceOf(Function);
      expect(urls.getRevisionCacheStats).toBeInstanceOf(Function);
    });
  });

  describe('getProjectUrl', () => {
    it('should generate correct project URL without path', () => {
      const urls = createUrlGenerator({
        projectId: PROJECT_ID,
        rev: 'latest',
        resolveLatestRev: mockResolveLatestRev,
      });

      const url = urls.getProjectUrl();

      expect(url).toBe(`https://static.repo.md/projects/${PROJECT_ID}`);
    });

    it('should generate correct project URL with path', () => {
      const urls = createUrlGenerator({
        projectId: PROJECT_ID,
        rev: 'latest',
        resolveLatestRev: mockResolveLatestRev,
      });

      const url = urls.getProjectUrl('/test/path.json');

      expect(url).toBe(`https://static.repo.md/projects/${PROJECT_ID}/test/path.json`);
    });

    it('should log in debug mode', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const urls = createUrlGenerator({
        projectId: PROJECT_ID,
        rev: 'latest',
        resolveLatestRev: mockResolveLatestRev,
        debug: true,
      });

      urls.getProjectUrl('/test');

      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('getRevisionUrl', () => {
    it('should use specific revision directly when not "latest"', async () => {
      const SPECIFIC_REV = 'specific-rev-456';

      const urls = createUrlGenerator({
        projectId: PROJECT_ID,
        rev: SPECIFIC_REV,
        resolveLatestRev: mockResolveLatestRev,
      });

      const url = await urls.getRevisionUrl('/test.json');

      expect(url).toBe(`https://static.repo.md/projects/${PROJECT_ID}/${SPECIFIC_REV}/test.json`);
      expect(mockResolveLatestRev).not.toHaveBeenCalled();
    });

    it('should resolve latest revision when rev is "latest" and no cache', async () => {
      const urls = createUrlGenerator({
        projectId: PROJECT_ID,
        rev: 'latest',
        resolveLatestRev: mockResolveLatestRev,
      });

      const url = await urls.getRevisionUrl('/test.json');

      expect(url).toBe(`https://static.repo.md/projects/${PROJECT_ID}/${ACTIVE_REV}/test.json`);
      expect(mockResolveLatestRev).toHaveBeenCalledOnce();
    });

    it('should use cached revision on subsequent calls', async () => {
      const urls = createUrlGenerator({
        projectId: PROJECT_ID,
        rev: 'latest',
        resolveLatestRev: mockResolveLatestRev,
      });

      // First call - should resolve
      await urls.getRevisionUrl('/test1.json');

      // Second call - should use cache
      await urls.getRevisionUrl('/test2.json');

      // Should only have called resolve once
      expect(mockResolveLatestRev).toHaveBeenCalledOnce();
    });

    it('should throw error when revision resolution fails', async () => {
      const failingResolver = vi.fn().mockRejectedValue(new Error('Resolution failed'));

      const urls = createUrlGenerator({
        projectId: PROJECT_ID,
        rev: 'latest',
        resolveLatestRev: failingResolver,
      });

      await expect(urls.getRevisionUrl('/test.json')).rejects.toThrow('Resolution failed');
    });

    it('should throw error when resolver returns empty revision', async () => {
      const emptyResolver = vi.fn().mockResolvedValue(null);

      const urls = createUrlGenerator({
        projectId: PROJECT_ID,
        rev: 'latest',
        resolveLatestRev: emptyResolver,
      });

      await expect(urls.getRevisionUrl('/test.json')).rejects.toThrow('empty revision');
    });

    it('should work with initial activeRev provided', async () => {
      const urls = createUrlGenerator({
        projectId: PROJECT_ID,
        activeRev: ACTIVE_REV,
        rev: 'latest',
        resolveLatestRev: mockResolveLatestRev,
      });

      const url = await urls.getRevisionUrl('/test.json');

      expect(url).toBe(`https://static.repo.md/projects/${PROJECT_ID}/${ACTIVE_REV}/test.json`);
      // Should not need to resolve since activeRev was provided
      expect(mockResolveLatestRev).not.toHaveBeenCalled();
    });
  });

  describe('getMediaUrl', () => {
    it('should generate correct media URL', () => {
      const urls = createUrlGenerator({
        projectId: PROJECT_ID,
        rev: 'latest',
        resolveLatestRev: mockResolveLatestRev,
      });

      const url = urls.getMediaUrl('image-hash.jpg');

      expect(url).toBe(`https://static.repo.md/projects/${PROJECT_ID}/_shared/medias/image-hash.jpg`);
    });

    it('should handle various media file types', () => {
      const urls = createUrlGenerator({
        projectId: PROJECT_ID,
        rev: 'latest',
        resolveLatestRev: mockResolveLatestRev,
      });

      expect(urls.getMediaUrl('test.jpg')).toContain('_shared/medias/test.jpg');
      expect(urls.getMediaUrl('test.png')).toContain('_shared/medias/test.png');
      expect(urls.getMediaUrl('test.gif')).toContain('_shared/medias/test.gif');
      expect(urls.getMediaUrl('test.webp')).toContain('_shared/medias/test.webp');
    });
  });

  describe('getSqliteUrl', () => {
    it('should generate correct SQLite URL with specific revision', async () => {
      const SPECIFIC_REV = 'specific-rev-456';

      const urls = createUrlGenerator({
        projectId: PROJECT_ID,
        rev: SPECIFIC_REV,
        resolveLatestRev: mockResolveLatestRev,
      });

      const url = await urls.getSqliteUrl();

      expect(url).toBe(`https://static.repo.md/projects/${PROJECT_ID}/${SPECIFIC_REV}/content.sqlite`);
    });

    it('should resolve latest revision for SQLite URL', async () => {
      const urls = createUrlGenerator({
        projectId: PROJECT_ID,
        rev: 'latest',
        resolveLatestRev: mockResolveLatestRev,
      });

      const url = await urls.getSqliteUrl();

      expect(url).toContain('/content.sqlite');
      expect(url).toContain(ACTIVE_REV);
    });
  });

  describe('getSharedFolderUrl', () => {
    it('should generate correct shared folder URL without path', () => {
      const urls = createUrlGenerator({
        projectId: PROJECT_ID,
        rev: 'latest',
        resolveLatestRev: mockResolveLatestRev,
      });

      const url = urls.getSharedFolderUrl();

      expect(url).toBe(`https://static.repo.md/projects/${PROJECT_ID}/_shared`);
    });

    it('should generate correct shared folder URL with path', () => {
      const urls = createUrlGenerator({
        projectId: PROJECT_ID,
        rev: 'latest',
        resolveLatestRev: mockResolveLatestRev,
      });

      const url = urls.getSharedFolderUrl('/embeddings/posts.json');

      expect(url).toBe(`https://static.repo.md/projects/${PROJECT_ID}/_shared/embeddings/posts.json`);
    });
  });

  describe('getActiveRevState', () => {
    it('should return undefined initially when no activeRev provided', () => {
      const urls = createUrlGenerator({
        projectId: PROJECT_ID,
        rev: 'latest',
        resolveLatestRev: mockResolveLatestRev,
      });

      expect(urls.getActiveRevState()).toBeUndefined();
    });

    it('should return activeRev when provided in config', () => {
      const urls = createUrlGenerator({
        projectId: PROJECT_ID,
        activeRev: ACTIVE_REV,
        rev: 'latest',
        resolveLatestRev: mockResolveLatestRev,
      });

      expect(urls.getActiveRevState()).toBe(ACTIVE_REV);
    });

    it('should return resolved revision after URL generation', async () => {
      const urls = createUrlGenerator({
        projectId: PROJECT_ID,
        rev: 'latest',
        resolveLatestRev: mockResolveLatestRev,
      });

      // Before resolution
      expect(urls.getActiveRevState()).toBeUndefined();

      // Trigger resolution
      await urls.getRevisionUrl('/test.json');

      // After resolution
      expect(urls.getActiveRevState()).toBe(ACTIVE_REV);
    });
  });

  describe('getRevisionCacheStats', () => {
    it('should return cache statistics', () => {
      const urls = createUrlGenerator({
        projectId: PROJECT_ID,
        rev: 'latest',
        resolveLatestRev: mockResolveLatestRev,
        revCacheExpirySeconds: 300,
      });

      const stats = urls.getRevisionCacheStats();

      expect(stats).toBeDefined();
      expect(stats.revisionType).toBe('latest');
      expect(stats.expirySeconds).toBe(300);
      expect(stats.expiryMs).toBe(300000);
    });

    it('should track cache expiry status', async () => {
      const urls = createUrlGenerator({
        projectId: PROJECT_ID,
        rev: 'latest',
        resolveLatestRev: mockResolveLatestRev,
        revCacheExpirySeconds: 300,
      });

      // Resolve revision first
      await urls.getRevisionUrl('/test.json');

      const stats = urls.getRevisionCacheStats();

      expect(stats.isExpired).toBe(false);
      expect(stats.msUntilExpiry).toBeGreaterThan(0);
      expect(stats.cacheValue).toBe(ACTIVE_REV);
    });

    it('should return null msUntilExpiry for specific revision', () => {
      const urls = createUrlGenerator({
        projectId: PROJECT_ID,
        rev: 'specific-rev',
        resolveLatestRev: mockResolveLatestRev,
      });

      const stats = urls.getRevisionCacheStats();

      expect(stats.revisionType).toBe('specific-rev');
      expect(stats.msUntilExpiry).toBeNull();
      expect(stats.isExpired).toBe(false);
    });
  });

  describe('Cache Expiry Behavior', () => {
    it('should not expire for specific revision', async () => {
      const urls = createUrlGenerator({
        projectId: PROJECT_ID,
        rev: 'specific-rev',
        resolveLatestRev: mockResolveLatestRev,
        revCacheExpirySeconds: 1, // Very short expiry
      });

      // Make multiple calls
      await urls.getRevisionUrl('/test1.json');
      await urls.getRevisionUrl('/test2.json');
      await urls.getRevisionUrl('/test3.json');

      // Should never call resolver for specific revision
      expect(mockResolveLatestRev).not.toHaveBeenCalled();
    });

    it('should respect cache expiry seconds config', () => {
      const urls = createUrlGenerator({
        projectId: PROJECT_ID,
        rev: 'latest',
        resolveLatestRev: mockResolveLatestRev,
        revCacheExpirySeconds: 600,
      });

      const stats = urls.getRevisionCacheStats();

      expect(stats.expiryMs).toBe(600000);
      expect(stats.expirySeconds).toBe(600);
    });
  });

  describe('Debug Logging', () => {
    it('should log debug info when debug_rev_caching is true', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const urls = createUrlGenerator({
        projectId: PROJECT_ID,
        rev: 'latest',
        resolveLatestRev: mockResolveLatestRev,
        debug_rev_caching: true,
      });

      await urls.getRevisionUrl('/test.json');

      // Should have some debug logging
      expect(consoleSpy).toHaveBeenCalled();
    });
  });
});

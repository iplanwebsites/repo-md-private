/**
 * Tests for the media handler module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMediaHandler } from './handler.js';

describe('Media Handler Module', () => {
  let mockFetchR2Json;
  let mockGetProjectUrl;
  let mockGetRevisionUrl;

  // Sample media data
  const sampleMediaData = {
    images: [
      { hash: 'img-hash-1', filename: 'image1.jpg', type: 'image/jpeg' },
      { hash: 'img-hash-2', filename: 'image2.png', type: 'image/png' },
    ],
    count: 2,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockFetchR2Json = vi.fn();
    mockGetProjectUrl = vi.fn().mockReturnValue('https://static.repo.md/projects/test-project');
    mockGetRevisionUrl = vi.fn().mockResolvedValue('https://static.repo.md/projects/test-project/rev123');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createHandler(options = {}) {
    return createMediaHandler({
      fetchR2Json: mockFetchR2Json,
      getProjectUrl: mockGetProjectUrl,
      getRevisionUrl: mockGetRevisionUrl,
      debug: false,
      ...options,
    });
  }

  describe('createMediaHandler', () => {
    it('should create media handler with all methods', () => {
      const handler = createHandler();

      expect(handler.getMediaUrl).toBeInstanceOf(Function);
      expect(handler.getAllMedia).toBeInstanceOf(Function);
      expect(handler.getAllMedias).toBeInstanceOf(Function);
      expect(handler.getMediaItems).toBeInstanceOf(Function);
      expect(handler.handleCloudflareRequest).toBeInstanceOf(Function);
    });
  });

  describe('getMediaUrl', () => {
    it('should generate correct media URL', async () => {
      const handler = createHandler();
      const url = await handler.getMediaUrl('test-image.jpg');

      expect(mockGetProjectUrl).toHaveBeenCalledWith('/_shared/medias/test-image.jpg');
      expect(url).toContain('test-project');
    });

    it('should handle various media paths', async () => {
      const handler = createHandler();

      await handler.getMediaUrl('image.jpg');
      expect(mockGetProjectUrl).toHaveBeenCalledWith('/_shared/medias/image.jpg');

      await handler.getMediaUrl('subfolder/image.png');
      expect(mockGetProjectUrl).toHaveBeenCalledWith('/_shared/medias/subfolder/image.png');

      await handler.getMediaUrl('hash123-sm.webp');
      expect(mockGetProjectUrl).toHaveBeenCalledWith('/_shared/medias/hash123-sm.webp');
    });

    it('should log in debug mode', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const handler = createHandler({ debug: true });
      await handler.getMediaUrl('test.jpg');

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Generated media URL'));
    });
  });

  describe('getAllMedia', () => {
    it('should fetch all media data', async () => {
      mockFetchR2Json.mockResolvedValue(sampleMediaData);

      const handler = createHandler();
      const media = await handler.getAllMedia();

      expect(mockFetchR2Json).toHaveBeenCalledWith('/medias.json', {
        defaultValue: {},
        useCache: true,
      });
      expect(media).toEqual(sampleMediaData);
    });

    it('should pass useCache option', async () => {
      mockFetchR2Json.mockResolvedValue(sampleMediaData);

      const handler = createHandler();
      await handler.getAllMedia(false);

      expect(mockFetchR2Json).toHaveBeenCalledWith('/medias.json', {
        defaultValue: {},
        useCache: false,
      });
    });

    it('should return empty object when no media', async () => {
      mockFetchR2Json.mockResolvedValue({});

      const handler = createHandler();
      const media = await handler.getAllMedia();

      expect(media).toEqual({});
    });

    it('should log in debug mode', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      mockFetchR2Json.mockResolvedValue(sampleMediaData);

      const handler = createHandler({ debug: true });
      await handler.getAllMedia();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Fetched media data'));
    });
  });

  describe('getAllMedias', () => {
    it('should be an alias for getAllMedia', async () => {
      mockFetchR2Json.mockResolvedValue(sampleMediaData);

      const handler = createHandler();
      const media = await handler.getAllMedias();

      expect(media).toEqual(sampleMediaData);
      expect(mockFetchR2Json).toHaveBeenCalledWith('/medias.json', expect.any(Object));
    });

    it('should pass useCache option', async () => {
      mockFetchR2Json.mockResolvedValue(sampleMediaData);

      const handler = createHandler();
      await handler.getAllMedias(false);

      expect(mockFetchR2Json).toHaveBeenCalledWith('/medias.json', {
        defaultValue: {},
        useCache: false,
      });
    });
  });

  describe('getMediaItems', () => {
    it('should return media items', async () => {
      mockFetchR2Json.mockResolvedValue(sampleMediaData);

      const handler = createHandler();
      const items = await handler.getMediaItems();

      expect(items).toEqual(sampleMediaData);
    });

    it('should pass useCache option', async () => {
      mockFetchR2Json.mockResolvedValue(sampleMediaData);

      const handler = createHandler();
      await handler.getMediaItems(false);

      expect(mockFetchR2Json).toHaveBeenCalledWith('/medias.json', {
        defaultValue: {},
        useCache: false,
      });
    });
  });

  describe('handleCloudflareRequest', () => {
    it('should handle media requests', async () => {
      const mockRequest = {
        url: 'https://example.com/_repo/medias/image.jpg',
      };

      const handler = createHandler();

      // The handleCloudflareRequest calls the imported mediaProxy handler
      // which may return null for non-matching requests
      const response = await handler.handleCloudflareRequest(mockRequest);

      // Just verify it doesn't throw
      expect(response).toBeDefined;
    });

    it('should log in debug mode', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const mockRequest = {
        url: 'https://example.com/medias/image.jpg',
      };

      const handler = createHandler({ debug: true });

      try {
        await handler.handleCloudflareRequest(mockRequest);
      } catch {
        // May throw if mediaProxy isn't properly mocked
      }

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Handling Cloudflare request'));
    });
  });

  describe('Caching Behavior', () => {
    it('should use cache by default', async () => {
      mockFetchR2Json.mockResolvedValue(sampleMediaData);

      const handler = createHandler();
      await handler.getAllMedia();

      expect(mockFetchR2Json).toHaveBeenCalledWith('/medias.json', {
        defaultValue: {},
        useCache: true,
      });
    });

    it('should skip cache when requested', async () => {
      mockFetchR2Json.mockResolvedValue(sampleMediaData);

      const handler = createHandler();
      await handler.getAllMedia(false);

      expect(mockFetchR2Json).toHaveBeenCalledWith('/medias.json', {
        defaultValue: {},
        useCache: false,
      });
    });
  });
});

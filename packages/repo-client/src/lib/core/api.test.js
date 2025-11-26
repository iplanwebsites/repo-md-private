/**
 * Tests for the API client module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createApiClient } from './api.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('API Client Module', () => {
  const PROJECT_ID = 'test-project-123';
  const PROJECT_SLUG = 'test-project-slug';
  const ACTIVE_REV = 'rev-abc123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to create mock fetch response
  const createMockResponse = (data, status = 200, ok = true) => ({
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: () => Promise.resolve({ success: true, data }),
    clone: () => ({
      text: () => Promise.resolve(JSON.stringify(data)),
    }),
    headers: new Map(),
  });

  describe('createApiClient', () => {
    it('should create API client with required config', () => {
      const api = createApiClient({
        projectId: PROJECT_ID,
        projectSlug: PROJECT_SLUG,
      });

      expect(api).toBeDefined();
      expect(api.fetchPublicApi).toBeInstanceOf(Function);
      expect(api.fetchProjectDetails).toBeInstanceOf(Function);
      expect(api.fetchProjectActiveRev).toBeInstanceOf(Function);
      expect(api.getActiveProjectRev).toBeInstanceOf(Function);
      expect(api.ensureLatestRev).toBeInstanceOf(Function);
      expect(api.cleanup).toBeInstanceOf(Function);
    });
  });

  describe('fetchPublicApi', () => {
    it('should fetch from public API successfully', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ test: 'data' }));

      const api = createApiClient({
        projectId: PROJECT_ID,
        projectSlug: PROJECT_SLUG,
      });

      const result = await api.fetchPublicApi('/test-endpoint');

      expect(mockFetch).toHaveBeenCalledOnce();
      expect(mockFetch.mock.calls[0][0]).toContain('api.repo.md');
      expect(mockFetch.mock.calls[0][0]).toContain('/v1/test-endpoint');
    });

    it('should throw error on API failure', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(null, 500, false));

      const api = createApiClient({
        projectId: PROJECT_ID,
        projectSlug: PROJECT_SLUG,
      });

      await expect(api.fetchPublicApi('/test')).rejects.toThrow();
    });

    it('should use project ID path when available', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse('test-data'));

      const api = createApiClient({
        projectId: PROJECT_ID,
        projectSlug: PROJECT_SLUG,
      });

      await api.fetchPublicApi(`/project-id/${PROJECT_ID}`);

      expect(mockFetch.mock.calls[0][0]).toContain(PROJECT_ID);
    });
  });

  describe('fetchProjectDetails', () => {
    it('should fetch project details successfully', async () => {
      const projectDetails = {
        id: PROJECT_ID,
        slug: PROJECT_SLUG,
        activeRev: ACTIVE_REV,
        name: 'Test Project',
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(projectDetails));

      const api = createApiClient({
        projectId: PROJECT_ID,
        projectSlug: PROJECT_SLUG,
      });

      const result = await api.fetchProjectDetails();

      expect(result).toEqual(projectDetails);
    });

    it('should throw error when projectId is invalid', async () => {
      const api = createApiClient({
        projectId: 'undefined-project-id',
        projectSlug: PROJECT_SLUG,
      });

      await expect(api.fetchProjectDetails()).rejects.toThrow('No valid projectId');
    });
  });

  describe('fetchProjectActiveRev', () => {
    it('should fetch active revision successfully', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(ACTIVE_REV));

      const api = createApiClient({
        projectId: PROJECT_ID,
        projectSlug: PROJECT_SLUG,
      });

      const result = await api.fetchProjectActiveRev();

      expect(result).toBe(ACTIVE_REV);
    });

    it('should throw error on empty response', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(null));

      const api = createApiClient({
        projectId: PROJECT_ID,
        projectSlug: PROJECT_SLUG,
      });

      await expect(api.fetchProjectActiveRev()).rejects.toThrow();
    });

    it('should use /rev endpoint', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(ACTIVE_REV));

      const api = createApiClient({
        projectId: PROJECT_ID,
        projectSlug: PROJECT_SLUG,
      });

      await api.fetchProjectActiveRev();

      expect(mockFetch.mock.calls[0][0]).toContain('/rev');
    });
  });

  describe('getActiveProjectRev', () => {
    it('should return active revision', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(ACTIVE_REV));

      const api = createApiClient({
        projectId: PROJECT_ID,
        projectSlug: PROJECT_SLUG,
      });

      const result = await api.getActiveProjectRev();

      expect(result).toBe(ACTIVE_REV);
    });

    it('should reuse in-flight promise', async () => {
      // Create a slow response
      let resolvePromise;
      const slowPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      mockFetch.mockReturnValueOnce(
        slowPromise.then(() => createMockResponse(ACTIVE_REV))
      );

      const api = createApiClient({
        projectId: PROJECT_ID,
        projectSlug: PROJECT_SLUG,
      });

      // Start two parallel requests
      const promise1 = api.getActiveProjectRev();
      const promise2 = api.getActiveProjectRev();

      // Resolve the slow promise
      resolvePromise();

      const [result1, result2] = await Promise.all([promise1, promise2]);

      // Should only have made one fetch call
      expect(mockFetch).toHaveBeenCalledOnce();
      expect(result1).toBe(ACTIVE_REV);
      expect(result2).toBe(ACTIVE_REV);
    });

    it('should fall back to project details if /rev fails', async () => {
      // First call fails (to /rev endpoint)
      mockFetch
        .mockRejectedValueOnce(new Error('Rev endpoint failed'))
        // Fallback call succeeds
        .mockResolvedValueOnce(createMockResponse({
          activeRev: ACTIVE_REV,
          id: PROJECT_ID,
        }));

      const api = createApiClient({
        projectId: PROJECT_ID,
        projectSlug: PROJECT_SLUG,
      });

      const result = await api.getActiveProjectRev();

      expect(result).toBe(ACTIVE_REV);
    });

    it('should throw when both /rev and project details fail', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Rev endpoint failed'))
        .mockRejectedValueOnce(new Error('Project details failed'));

      const api = createApiClient({
        projectId: PROJECT_ID,
        projectSlug: PROJECT_SLUG,
      });

      await expect(api.getActiveProjectRev()).rejects.toThrow();
    });

    it('should force refresh when requested', async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse('rev-1'))
        .mockResolvedValueOnce(createMockResponse('rev-2'));

      const api = createApiClient({
        projectId: PROJECT_ID,
        projectSlug: PROJECT_SLUG,
      });

      // First call
      const result1 = await api.getActiveProjectRev();

      // Force refresh
      const result2 = await api.getActiveProjectRev(true);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result1).toBe('rev-1');
      expect(result2).toBe('rev-2');
    });
  });

  describe('ensureLatestRev', () => {
    it('should return specific revision directly', async () => {
      const api = createApiClient({
        projectId: PROJECT_ID,
        projectSlug: PROJECT_SLUG,
      });

      const result = await api.ensureLatestRev('specific-rev', null);

      expect(result).toBe('specific-rev');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return provided activeRev', async () => {
      const api = createApiClient({
        projectId: PROJECT_ID,
        projectSlug: PROJECT_SLUG,
      });

      const result = await api.ensureLatestRev('latest', ACTIVE_REV);

      expect(result).toBe(ACTIVE_REV);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should resolve latest revision when needed', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(ACTIVE_REV));

      const api = createApiClient({
        projectId: PROJECT_ID,
        projectSlug: PROJECT_SLUG,
      });

      const result = await api.ensureLatestRev('latest', null);

      expect(result).toBe(ACTIVE_REV);
    });

    it('should throw error on resolution failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Resolution failed'));

      const api = createApiClient({
        projectId: PROJECT_ID,
        projectSlug: PROJECT_SLUG,
      });

      await expect(api.ensureLatestRev('latest', null)).rejects.toThrow('Failed to resolve latest revision');
    });
  });

  describe('cleanup', () => {
    it('should clear in-flight promises', () => {
      const api = createApiClient({
        projectId: PROJECT_ID,
        projectSlug: PROJECT_SLUG,
      });

      // Cleanup should not throw
      expect(() => api.cleanup()).not.toThrow();
    });

    it('should log in debug mode', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const api = createApiClient({
        projectId: PROJECT_ID,
        projectSlug: PROJECT_SLUG,
        debug: true,
      });

      api.cleanup();

      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should provide helpful error messages with project info', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const api = createApiClient({
        projectId: PROJECT_ID,
        projectSlug: PROJECT_SLUG,
      });

      try {
        await api.fetchPublicApi('/test');
      } catch (error) {
        expect(error.message).toContain(PROJECT_ID);
      }
    });

    it('should handle invalid projectId', async () => {
      const api = createApiClient({
        projectId: undefined,
        projectSlug: PROJECT_SLUG,
      });

      await expect(api.fetchProjectDetails()).rejects.toThrow('No valid projectId');
    });
  });

  describe('Debug Mode', () => {
    it('should log debug info when enabled', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      mockFetch.mockResolvedValueOnce(createMockResponse(ACTIVE_REV));

      const api = createApiClient({
        projectId: PROJECT_ID,
        projectSlug: PROJECT_SLUG,
        debug: true,
      });

      await api.fetchProjectActiveRev();

      expect(consoleSpy).toHaveBeenCalled();
    });
  });
});

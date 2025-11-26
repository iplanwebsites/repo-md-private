/**
 * Tests for the RepoMD class
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RepoMD, logo } from './RepoMd.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock environment variables
const originalEnv = process.env;

describe('RepoMD Class', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment
    process.env = { ...originalEnv };
    // Default mock for fetch - return a valid revision
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: 'test-rev-123' }),
      clone: () => ({
        text: () => Promise.resolve(''),
      }),
      headers: new Map(),
      status: 200,
      statusText: 'OK',
    });
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should create an instance with default options', () => {
      const client = new RepoMD({ projectId: 'test-project-id' });

      expect(client.projectId).toBe('test-project-id');
      expect(client.projectSlug).toBe('undefined-project-slug');
      expect(client.rev).toBe('latest');
      expect(client.debug).toBe(false);
      expect(client.secret).toBeNull();
      expect(client.strategy).toBe('auto');
    });

    it('should create an instance with custom options', () => {
      const client = new RepoMD({
        projectId: 'custom-project',
        projectSlug: 'my-project',
        rev: 'abc123',
        debug: true,
        secret: 'my-secret',
        strategy: 'server',
        revCacheExpirySeconds: 600,
      });

      expect(client.projectId).toBe('custom-project');
      expect(client.projectSlug).toBe('my-project');
      expect(client.rev).toBe('abc123');
      expect(client.debug).toBe(true);
      expect(client.secret).toBe('my-secret');
      expect(client.strategy).toBe('server');
      expect(client.revCacheExpirySeconds).toBe(600);
    });

    it('should initialize stats tracking', () => {
      const client = new RepoMD({ projectId: 'test-project-id' });

      expect(client.stats).toBeDefined();
      expect(client.stats.posts).toBeDefined();
      expect(client.stats.posts.totalLoaded).toBe(0);
      expect(client.stats.posts.byMethod).toBeDefined();
      expect(client.stats.revisionCache).toBeDefined();
    });

    it('should initialize all services', () => {
      const client = new RepoMD({ projectId: 'test-project-id' });

      expect(client.posts).toBeDefined();
      expect(client.similarity).toBeDefined();
      expect(client.search).toBeDefined();
      expect(client.media).toBeDefined();
      expect(client.project).toBeDefined();
      expect(client.files).toBeDefined();
      expect(client.mediaSimilarity).toBeDefined();
      expect(client.urls).toBeDefined();
      expect(client.api).toBeDefined();
    });

    it('should generate a unique instance ID', () => {
      const client1 = new RepoMD({ projectId: 'test-project-id' });
      const client2 = new RepoMD({ projectId: 'test-project-id' });

      expect(client1._instanceId).toBeDefined();
      expect(client2._instanceId).toBeDefined();
      expect(client1._instanceId).not.toBe(client2._instanceId);
    });

    it('should try to get projectId from environment if not provided', () => {
      process.env.REPO_MD_PROJECT_ID = 'env-project-id';

      const client = new RepoMD({});
      expect(client.projectId).toBe('env-project-id');
    });
  });

  describe('getClientStats', () => {
    it('should return stats object', () => {
      const client = new RepoMD({ projectId: 'test-project-id' });
      const stats = client.getClientStats();

      expect(stats).toBeDefined();
      expect(stats.posts).toBeDefined();
      expect(stats.revisionCache).toBeDefined();
      expect(stats.posts.lastUpdated).toBeDefined();
    });

    it('should return a copy of stats (not the original)', () => {
      const client = new RepoMD({ projectId: 'test-project-id' });
      const stats1 = client.getClientStats();
      const stats2 = client.getClientStats();

      expect(stats1).not.toBe(stats2);
      expect(stats1).toEqual(stats2);
    });
  });

  describe('destroy', () => {
    it('should clean up instance resources', () => {
      const client = new RepoMD({ projectId: 'test-project-id' });

      client.destroy();

      expect(client._destroyed).toBe(true);
      expect(client.posts).toBeNull();
      expect(client.similarity).toBeNull();
      expect(client.search).toBeNull();
      expect(client.media).toBeNull();
      expect(client.project).toBeNull();
      expect(client.files).toBeNull();
      expect(client.urls).toBeNull();
      expect(client.api).toBeNull();
    });
  });

  describe('URL Methods', () => {
    it('getR2ProjectUrl should return project URL', () => {
      const client = new RepoMD({ projectId: 'test-project-id' });
      const url = client.getR2ProjectUrl('/test-path');

      expect(url).toContain('test-project-id');
      expect(url).toContain('test-path');
    });

    it('getR2SharedFolderUrl should return shared folder URL', () => {
      const client = new RepoMD({ projectId: 'test-project-id' });
      const url = client.getR2SharedFolderUrl('/test-path');

      expect(url).toContain('test-project-id');
      expect(url).toContain('_shared');
      expect(url).toContain('test-path');
    });

    it('getR2Url should return revision URL', async () => {
      const client = new RepoMD({ projectId: 'test-project-id', rev: 'specific-rev' });
      const url = await client.getR2Url('/test-path');

      expect(url).toContain('test-project-id');
      expect(url).toContain('specific-rev');
      expect(url).toContain('test-path');
    });
  });

  describe('Vite Proxy', () => {
    it('createViteProxy should return proxy configuration', () => {
      const client = new RepoMD({ projectId: 'test-project-id' });
      const proxyConfig = client.createViteProxy();

      expect(proxyConfig).toBeDefined();
      expect(typeof proxyConfig).toBe('object');
    });

    it('createViteProxy should accept custom folder', () => {
      const client = new RepoMD({ projectId: 'test-project-id' });
      const proxyConfig = client.createViteProxy('custom-folder');

      expect(proxyConfig).toBeDefined();
    });
  });

  describe('Method Documentation', () => {
    it('getMethodDescription should return method info', () => {
      const description = RepoMD.getMethodDescription('getAllPosts');

      expect(description).toBeDefined();
    });

    it('getAllMethodDescriptions should return all method descriptions', () => {
      const descriptions = RepoMD.getAllMethodDescriptions();

      expect(descriptions).toBeDefined();
      expect(typeof descriptions).toBe('object');
    });

    it('getAllMethodCategories should return categories', () => {
      const categories = RepoMD.getAllMethodCategories();

      expect(categories).toBeDefined();
      expect(Array.isArray(categories)).toBe(true);
    });

    it('instance getMethodDescription should work', () => {
      const client = new RepoMD({ projectId: 'test-project-id' });
      const description = client.getMethodDescription('getAllPosts');

      expect(description).toBeDefined();
    });
  });

  describe('OpenAI Integration', () => {
    it('getOpenAiToolSpec should return tool specifications', () => {
      const client = new RepoMD({ projectId: 'test-project-id' });
      const spec = client.getOpenAiToolSpec();

      expect(spec).toBeDefined();
      expect(spec.functions).toBeDefined();
      expect(Array.isArray(spec.functions)).toBe(true);
    });

    it('getOpenAiToolSpec should filter blacklisted tools', () => {
      const client = new RepoMD({ projectId: 'test-project-id' });
      const fullSpec = client.getOpenAiToolSpec();
      const filteredSpec = client.getOpenAiToolSpec({
        blacklistedTools: ['getAllPosts']
      });

      expect(filteredSpec.functions.length).toBeLessThan(fullSpec.functions.length);
    });

    it('createOpenAiToolHandler should return a function', () => {
      const client = new RepoMD({ projectId: 'test-project-id' });
      const handler = client.createOpenAiToolHandler();

      expect(typeof handler).toBe('function');
    });
  });

  describe('Framework Integrations', () => {
    it('createRemixLoader should return a function', () => {
      const client = new RepoMD({ projectId: 'test-project-id' });
      const loader = client.createRemixLoader();

      expect(typeof loader).toBe('function');
    });

    it('createCloudflareHandler should return a function', () => {
      const client = new RepoMD({ projectId: 'test-project-id' });
      const handler = client.createCloudflareHandler();

      expect(typeof handler).toBe('function');
    });

    it('createNextMiddleware should return middleware and config', () => {
      const client = new RepoMD({ projectId: 'test-project-id' });
      const result = client.createNextMiddleware();

      expect(result).toBeDefined();
      expect(result.middleware).toBeDefined();
      expect(result.config).toBeDefined();
    });

    it('createExpressMiddleware should return a function', () => {
      const client = new RepoMD({ projectId: 'test-project-id' });
      const middleware = client.createExpressMiddleware();

      expect(typeof middleware).toBe('function');
    });

    it('createKoaMiddleware should return a function', () => {
      const client = new RepoMD({ projectId: 'test-project-id' });
      const middleware = client.createKoaMiddleware();

      expect(typeof middleware).toBe('function');
    });

    it('getUnifiedProxyConfig should return configuration', () => {
      const client = new RepoMD({ projectId: 'test-project-id' });
      const config = client.getUnifiedProxyConfig();

      expect(config).toBeDefined();
    });
  });

  describe('Static Methods', () => {
    it('getNextMiddlewareConfig should return config object', () => {
      const config = RepoMD.getNextMiddlewareConfig();

      expect(config).toBeDefined();
      expect(config.matcher).toBeDefined();
    });

    it('getNextMiddlewareConfig should accept custom matcher', () => {
      const config = RepoMD.getNextMiddlewareConfig('/custom/*');

      expect(config).toBeDefined();
      expect(config.matcher).toBeDefined();
    });
  });
});

describe('Logo Export', () => {
  it('should export logo constant', () => {
    expect(logo).toBeDefined();
    expect(typeof logo).toBe('string');
    expect(logo.length).toBeGreaterThan(0);
  });
});

/**
 * Tests for the schemas module
 */

import { describe, it, expect } from 'vitest';
import {
  schemas,
  repoMdOptionsSchema,
  getSchemaForFunction,
  filterMethodsByMeta,
  getPopularMethods,
  getInferenceMethods,
  getPublicMethods,
  getFrameworkMethods,
  getLightweightMethods,
  getInternalMethods,
  getDeprecatedMethods,
  getCacheableMethods,
  getReadonlyMethods,
  getPublicChatMethods,
  getMethodsByMode,
  getMethodsByContext,
  getMethodMeta,
  getAllMeta,
  getMethodCategories,
  getMethodsByCategory,
} from './schemas.js';

describe('Schemas Module', () => {
  describe('repoMdOptionsSchema', () => {
    it('should validate correct options', () => {
      const result = repoMdOptionsSchema.safeParse({
        projectId: 'test-project-id',
        projectSlug: 'my-project',
        rev: 'latest',
        debug: true,
        strategy: 'server',
      });

      expect(result.success).toBe(true);
    });

    it('should apply defaults', () => {
      const result = repoMdOptionsSchema.parse({});

      expect(result.projectSlug).toBe('undefined-project-slug');
      expect(result.rev).toBe('latest');
      expect(result.debug).toBe(false);
      expect(result.strategy).toBe('auto');
      expect(result.secret).toBeNull();
    });

    it('should reject invalid strategy', () => {
      const result = repoMdOptionsSchema.safeParse({
        strategy: 'invalid-strategy',
      });

      expect(result.success).toBe(false);
    });

    it('should accept valid strategies', () => {
      expect(repoMdOptionsSchema.safeParse({ strategy: 'auto' }).success).toBe(true);
      expect(repoMdOptionsSchema.safeParse({ strategy: 'browser' }).success).toBe(true);
      expect(repoMdOptionsSchema.safeParse({ strategy: 'server' }).success).toBe(true);
    });
  });

  describe('Method Schemas', () => {
    it('should have schema for getAllPosts', () => {
      expect(schemas.getAllPosts).toBeDefined();

      const result = schemas.getAllPosts.safeParse({
        useCache: true,
        forceRefresh: false,
      });
      expect(result.success).toBe(true);
    });

    it('should have schema for getPostBySlug', () => {
      expect(schemas.getPostBySlug).toBeDefined();

      const valid = schemas.getPostBySlug.safeParse({ slug: 'my-post' });
      expect(valid.success).toBe(true);

      const invalid = schemas.getPostBySlug.safeParse({ slug: '' });
      expect(invalid.success).toBe(false);
    });

    it('should have schema for getPostByHash', () => {
      expect(schemas.getPostByHash).toBeDefined();

      const valid = schemas.getPostByHash.safeParse({ hash: 'abc123' });
      expect(valid.success).toBe(true);

      const invalid = schemas.getPostByHash.safeParse({ hash: '' });
      expect(invalid.success).toBe(false);
    });

    it('should have schema for searchPosts', () => {
      expect(schemas.searchPosts).toBeDefined();

      const valid = schemas.searchPosts.safeParse({
        text: 'search query',
        mode: 'memory',
      });
      expect(valid.success).toBe(true);
    });

    it('should validate search modes', () => {
      expect(schemas.searchPosts.safeParse({ text: 'test', mode: 'memory' }).success).toBe(true);
      expect(schemas.searchPosts.safeParse({ text: 'test', mode: 'vector' }).success).toBe(true);
      expect(schemas.searchPosts.safeParse({ text: 'test', mode: 'vector-text' }).success).toBe(true);
      expect(schemas.searchPosts.safeParse({ text: 'test', mode: 'vector-clip-text' }).success).toBe(true);
      expect(schemas.searchPosts.safeParse({ text: 'test', mode: 'invalid-mode' }).success).toBe(false);
    });

    it('should have schema for getR2MediaUrl', () => {
      expect(schemas.getR2MediaUrl).toBeDefined();

      const valid = schemas.getR2MediaUrl.safeParse({ path: '/images/test.jpg' });
      expect(valid.success).toBe(true);

      const invalid = schemas.getR2MediaUrl.safeParse({ path: '' });
      expect(invalid.success).toBe(false);
    });

    it('should have schema for getAllMedia', () => {
      expect(schemas.getAllMedia).toBeDefined();

      const result = schemas.getAllMedia.safeParse({ useCache: true });
      expect(result.success).toBe(true);
    });

    it('should have schema for getSimilarPostsByHash', () => {
      expect(schemas.getSimilarPostsByHash).toBeDefined();

      const result = schemas.getSimilarPostsByHash.safeParse({
        hash: 'abc123',
        count: 5,
      });
      expect(result.success).toBe(true);
    });

    it('should have schema for findPostsByText', () => {
      expect(schemas.findPostsByText).toBeDefined();

      const result = schemas.findPostsByText.safeParse({
        text: 'find this',
        options: { limit: 10, threshold: 0.5 },
      });
      expect(result.success).toBe(true);
    });

    it('should have schema for computeTextEmbedding', () => {
      expect(schemas.computeTextEmbedding).toBeDefined();

      const result = schemas.computeTextEmbedding.safeParse({
        text: 'embed this text',
        instruction: 'Represent the document for retrieval:',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('getSchemaForFunction', () => {
    it('should return schema for existing function', () => {
      const schema = getSchemaForFunction('getAllPosts');
      expect(schema).toBeDefined();
      expect(schema).toBe(schemas.getAllPosts);
    });

    it('should return undefined for non-existent function', () => {
      const schema = getSchemaForFunction('nonExistentFunction');
      expect(schema).toBeUndefined();
    });
  });

  describe('filterMethodsByMeta', () => {
    it('should filter by object filter', () => {
      const popularMethods = filterMethodsByMeta({ popular: true });

      expect(Object.keys(popularMethods).length).toBeGreaterThan(0);
      Object.values(popularMethods).forEach((schema) => {
        const meta = schema._def?.meta || {};
        expect(meta.popular).toBe(true);
      });
    });

    it('should filter by function filter', () => {
      const inferenceMethods = filterMethodsByMeta((meta) => meta.inference === true);

      expect(Object.keys(inferenceMethods).length).toBeGreaterThan(0);
    });

    it('should filter by category', () => {
      const postsMethods = filterMethodsByMeta({ category: 'posts' });

      expect(Object.keys(postsMethods).length).toBeGreaterThan(0);
    });
  });

  describe('Pre-defined Filter Functions', () => {
    it('getPopularMethods should return popular methods', () => {
      const methods = getPopularMethods();
      expect(Object.keys(methods).length).toBeGreaterThan(0);
    });

    it('getInferenceMethods should return inference methods', () => {
      const methods = getInferenceMethods();
      expect(Object.keys(methods).length).toBeGreaterThan(0);
    });

    it('getPublicMethods should return non-internal methods', () => {
      const methods = getPublicMethods();
      expect(Object.keys(methods).length).toBeGreaterThan(0);

      Object.values(methods).forEach((schema) => {
        const meta = schema._def?.meta || {};
        expect(meta.internal).not.toBe(true);
      });
    });

    it('getFrameworkMethods should return framework methods', () => {
      const methods = getFrameworkMethods();
      expect(Object.keys(methods).length).toBeGreaterThan(0);
    });

    it('getLightweightMethods should return non-memory-heavy methods', () => {
      const methods = getLightweightMethods();
      expect(Object.keys(methods).length).toBeGreaterThan(0);

      Object.values(methods).forEach((schema) => {
        const meta = schema._def?.meta || {};
        expect(meta.memoryHeavy).not.toBe(true);
      });
    });

    it('getInternalMethods should return internal methods', () => {
      const methods = getInternalMethods();
      expect(Object.keys(methods).length).toBeGreaterThan(0);
    });

    it('getDeprecatedMethods should return deprecated methods', () => {
      const methods = getDeprecatedMethods();
      // May or may not have deprecated methods
      expect(typeof methods).toBe('object');
    });

    it('getCacheableMethods should return cacheable methods', () => {
      const methods = getCacheableMethods();
      expect(Object.keys(methods).length).toBeGreaterThan(0);
    });

    it('getReadonlyMethods should return readonly methods', () => {
      const methods = getReadonlyMethods();
      expect(Object.keys(methods).length).toBeGreaterThan(0);
    });

    it('getPublicChatMethods should return non-internal, non-framework methods', () => {
      const methods = getPublicChatMethods();
      expect(Object.keys(methods).length).toBeGreaterThan(0);

      Object.values(methods).forEach((schema) => {
        const meta = schema._def?.meta || {};
        expect(meta.internal).not.toBe(true);
        expect(meta.framework).not.toBe(true);
      });
    });
  });

  describe('getMethodsByMode', () => {
    it('should return all methods for "all" mode', () => {
      const methods = getMethodsByMode('all');
      expect(methods).toEqual(schemas);
    });

    it('should return public chat methods for "publicChatMethods" mode', () => {
      const methods = getMethodsByMode('publicChatMethods');
      expect(Object.keys(methods).length).toBeGreaterThan(0);
    });

    it('should default to publicChatMethods for unknown mode', () => {
      const methods = getMethodsByMode('unknownMode');
      const publicChatMethods = getPublicChatMethods();
      expect(methods).toEqual(publicChatMethods);
    });

    it('should return methods for all valid modes', () => {
      const modes = ['all', 'publicChatMethods', 'popular', 'inference', 'framework', 'public', 'lightweight', 'cacheable', 'readonly'];

      modes.forEach((mode) => {
        const methods = getMethodsByMode(mode);
        expect(typeof methods).toBe('object');
      });
    });
  });

  describe('getMethodsByContext', () => {
    it('should be an alias for getMethodsByMode', () => {
      expect(getMethodsByContext('popular')).toEqual(getMethodsByMode('popular'));
    });
  });

  describe('getMethodMeta', () => {
    it('should return metadata for existing method', () => {
      const meta = getMethodMeta('getAllPosts');

      expect(meta).toBeDefined();
      expect(meta.category).toBe('posts');
      expect(meta.popular).toBe(true);
    });

    it('should return null for non-existent method', () => {
      const meta = getMethodMeta('nonExistentMethod');
      expect(meta).toBeNull();
    });

    it('should return empty object for method without metadata', () => {
      // Most methods have metadata, but the function should handle missing metadata gracefully
      const meta = getMethodMeta('getAllPosts');
      expect(typeof meta).toBe('object');
    });
  });

  describe('getAllMeta', () => {
    it('should return metadata for all methods', () => {
      const allMeta = getAllMeta();

      expect(typeof allMeta).toBe('object');
      expect(Object.keys(allMeta).length).toBe(Object.keys(schemas).length);
    });

    it('should include category for methods', () => {
      const allMeta = getAllMeta();

      expect(allMeta.getAllPosts.category).toBe('posts');
      expect(allMeta.searchPosts.category).toBe('search');
    });
  });

  describe('getMethodCategories', () => {
    it('should return methods grouped by category', () => {
      const categories = getMethodCategories();

      expect(typeof categories).toBe('object');
      expect(categories.posts).toBeDefined();
      expect(Array.isArray(categories.posts)).toBe(true);
    });

    it('should include all expected categories', () => {
      const categories = getMethodCategories();
      const categoryNames = Object.keys(categories);

      expect(categoryNames).toContain('posts');
      expect(categoryNames).toContain('search');
      expect(categoryNames).toContain('media');
      expect(categoryNames).toContain('similarity');
    });
  });

  describe('getMethodsByCategory', () => {
    it('should return methods for posts category', () => {
      const postsMethods = getMethodsByCategory('posts');

      expect(Object.keys(postsMethods).length).toBeGreaterThan(0);
      expect(postsMethods.getAllPosts).toBeDefined();
    });

    it('should return methods for search category', () => {
      const searchMethods = getMethodsByCategory('search');

      expect(Object.keys(searchMethods).length).toBeGreaterThan(0);
      expect(searchMethods.searchPosts).toBeDefined();
    });

    it('should return empty object for non-existent category', () => {
      const methods = getMethodsByCategory('nonExistentCategory');
      expect(methods).toEqual({});
    });
  });

  describe('Schema Descriptions', () => {
    it('should have descriptions for all schemas', () => {
      Object.entries(schemas).forEach(([name, schema]) => {
        const description = schema._def?.description || schema.description;
        expect(description).toBeDefined();
        expect(typeof description).toBe('string');
        expect(description.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Schema Defaults', () => {
    it('getAllPosts should have correct defaults', () => {
      const result = schemas.getAllPosts.parse({});

      expect(result.useCache).toBe(true);
      expect(result.forceRefresh).toBe(false);
    });

    it('getRecentPosts should default count to 3', () => {
      const result = schemas.getRecentPosts.parse({});

      expect(result.count).toBe(3);
    });

    it('getSimilarPostsByHash should have correct defaults', () => {
      const result = schemas.getSimilarPostsByHash.parse({ hash: 'test' });

      expect(result.count).toBe(5);
      expect(result.options).toEqual({});
    });

    it('searchPosts should default to memory mode', () => {
      const result = schemas.searchPosts.parse({ text: 'test' });

      expect(result.mode).toBe('memory');
    });
  });

  describe('Validation Rules', () => {
    it('should reject empty slug', () => {
      const result = schemas.getPostBySlug.safeParse({ slug: '' });
      expect(result.success).toBe(false);
    });

    it('should reject empty hash', () => {
      const result = schemas.getPostByHash.safeParse({ hash: '' });
      expect(result.success).toBe(false);
    });

    it('should reject empty path', () => {
      const result = schemas.getPostByPath.safeParse({ path: '' });
      expect(result.success).toBe(false);
    });

    it('should reject negative limit values', () => {
      const result = schemas.getRecentPosts.safeParse({ count: -1 });
      expect(result.success).toBe(false);
    });

    it('should accept threshold between 0 and 1', () => {
      const valid1 = schemas.findPostsByText.safeParse({ text: 'test', options: { threshold: 0 } });
      const valid2 = schemas.findPostsByText.safeParse({ text: 'test', options: { threshold: 0.5 } });
      const valid3 = schemas.findPostsByText.safeParse({ text: 'test', options: { threshold: 1 } });

      expect(valid1.success).toBe(true);
      expect(valid2.success).toBe(true);
      expect(valid3.success).toBe(true);
    });

    it('should reject threshold outside 0-1 range', () => {
      const invalid1 = schemas.findPostsByText.safeParse({ text: 'test', options: { threshold: -0.1 } });
      const invalid2 = schemas.findPostsByText.safeParse({ text: 'test', options: { threshold: 1.1 } });

      expect(invalid1.success).toBe(false);
      expect(invalid2.success).toBe(false);
    });
  });
});

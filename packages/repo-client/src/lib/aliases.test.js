/**
 * Tests for the aliases module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { aliases, createAliasFunction, applyAliases } from './aliases.js';

describe('Aliases Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('aliases object', () => {
    it('should define expected aliases', () => {
      expect(aliases).toBeDefined();
      expect(typeof aliases).toBe('object');
    });

    it('should have getPostsBySlug alias', () => {
      expect(aliases.getPostsBySlug).toBe('getPostBySlug');
    });

    it('should have getSourceFiles alias', () => {
      expect(aliases.getSourceFiles).toBe('getSourceFilesList');
    });

    it('should have getSqliteURL alias', () => {
      expect(aliases.getSqliteURL).toBe('getSqliteUrl');
    });
  });

  describe('createAliasFunction', () => {
    it('should create a wrapper function', () => {
      const mockInstance = {
        targetMethod: vi.fn().mockReturnValue('result'),
      };

      const aliasFunc = createAliasFunction(mockInstance, 'aliasName', 'targetMethod');

      expect(typeof aliasFunc).toBe('function');
    });

    it('should call target method when alias is invoked', () => {
      const mockInstance = {
        targetMethod: vi.fn().mockReturnValue('result'),
      };

      const aliasFunc = createAliasFunction(mockInstance, 'aliasName', 'targetMethod');
      const result = aliasFunc('arg1', 'arg2');

      expect(mockInstance.targetMethod).toHaveBeenCalledWith('arg1', 'arg2');
      expect(result).toBe('result');
    });

    it('should log deprecation warning', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const mockInstance = {
        newName: vi.fn().mockReturnValue('result'),
      };

      const aliasFunc = createAliasFunction(mockInstance, 'oldName', 'newName');
      aliasFunc();

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Deprecated'));
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('oldName'));
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('newName'));
    });

    it('should preserve this context', () => {
      const mockInstance = {
        value: 42,
        targetMethod: function() {
          return this.value;
        },
      };

      const aliasFunc = createAliasFunction(mockInstance, 'alias', 'targetMethod');
      const result = aliasFunc();

      expect(result).toBe(42);
    });

    it('should pass all arguments to target', () => {
      const mockInstance = {
        targetMethod: vi.fn(),
      };

      const aliasFunc = createAliasFunction(mockInstance, 'alias', 'targetMethod');
      aliasFunc('a', 'b', 'c', 123, { key: 'value' });

      expect(mockInstance.targetMethod).toHaveBeenCalledWith('a', 'b', 'c', 123, { key: 'value' });
    });

    it('should return async results correctly', async () => {
      const mockInstance = {
        targetMethod: vi.fn().mockResolvedValue('async result'),
      };

      const aliasFunc = createAliasFunction(mockInstance, 'alias', 'targetMethod');
      const result = await aliasFunc();

      expect(result).toBe('async result');
    });
  });

  describe('applyAliases', () => {
    it('should apply all defined aliases to instance', () => {
      const mockInstance = {
        getPostBySlug: vi.fn(),
        getSourceFilesList: vi.fn(),
        getSqliteUrl: vi.fn(),
      };

      applyAliases(mockInstance);

      // Check aliases were created
      expect(mockInstance.getPostsBySlug).toBeDefined();
      expect(mockInstance.getSourceFiles).toBeDefined();
      expect(mockInstance.getSqliteURL).toBeDefined();
    });

    it('should handle null instance gracefully', () => {
      expect(() => applyAliases(null)).not.toThrow();
    });

    it('should handle undefined instance gracefully', () => {
      expect(() => applyAliases(undefined)).not.toThrow();
    });

    it('should skip aliases for non-existent target methods', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const mockInstance = {};

      applyAliases(mockInstance, true);

      // Should have logged warnings about missing target methods
      expect(warnSpy).toHaveBeenCalled();
    });

    it('should not override existing methods', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const existingMethod = vi.fn();
      const mockInstance = {
        getPostBySlug: vi.fn(),
        getPostsBySlug: existingMethod, // Already exists
      };

      applyAliases(mockInstance, true);

      // Should keep the original method
      expect(mockInstance.getPostsBySlug).toBe(existingMethod);
      // Should have logged a warning
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('already exists'));
    });

    it('should log in debug mode', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const mockInstance = {
        getPostBySlug: vi.fn(),
        getSourceFilesList: vi.fn(),
        getSqliteUrl: vi.fn(),
      };

      applyAliases(mockInstance, true);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Created alias'));
    });

    it('should not log when debug is false', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const mockInstance = {
        getPostBySlug: vi.fn(),
        getSourceFilesList: vi.fn(),
        getSqliteUrl: vi.fn(),
      };

      applyAliases(mockInstance, false);

      // Should not log creation messages
      expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('Created alias'));
    });
  });

  describe('Alias Functionality', () => {
    it('alias should invoke target method with correct arguments', () => {
      const mockInstance = {
        getPostBySlug: vi.fn().mockReturnValue({ slug: 'test-post' }),
      };

      applyAliases(mockInstance);

      // Suppress warning
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = mockInstance.getPostsBySlug('test-slug');

      expect(mockInstance.getPostBySlug).toHaveBeenCalledWith('test-slug');
      expect(result).toEqual({ slug: 'test-post' });
    });

    it('alias should work with async methods', async () => {
      const mockInstance = {
        getSqliteUrl: vi.fn().mockResolvedValue('https://example.com/db.sqlite'),
      };

      applyAliases(mockInstance);

      // Suppress warning
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await mockInstance.getSqliteURL();

      expect(result).toBe('https://example.com/db.sqlite');
    });

    it('deprecated alias should log warning on each call', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const mockInstance = {
        getPostBySlug: vi.fn().mockReturnValue({}),
      };

      applyAliases(mockInstance);

      // Call multiple times
      mockInstance.getPostsBySlug('slug1');
      mockInstance.getPostsBySlug('slug2');
      mockInstance.getPostsBySlug('slug3');

      // Should warn each time
      expect(warnSpy).toHaveBeenCalledTimes(3);
    });
  });

  describe('Alias Consistency', () => {
    it('all alias targets should be valid method names', () => {
      // All targets should be valid identifiers
      Object.values(aliases).forEach((target) => {
        expect(typeof target).toBe('string');
        expect(target.length).toBeGreaterThan(0);
        // Should be a valid JavaScript identifier
        expect(/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(target)).toBe(true);
      });
    });

    it('all alias names should be valid method names', () => {
      Object.keys(aliases).forEach((aliasName) => {
        expect(typeof aliasName).toBe('string');
        expect(aliasName.length).toBeGreaterThan(0);
        // Should be a valid JavaScript identifier
        expect(/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(aliasName)).toBe(true);
      });
    });

    it('alias names should be different from targets', () => {
      Object.entries(aliases).forEach(([aliasName, targetName]) => {
        expect(aliasName).not.toBe(targetName);
      });
    });
  });
});

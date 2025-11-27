/**
 * Slug Utility Tests
 */

import { describe, it, expect } from 'vitest';
import {
  toSlug,
  generateBaseSlug,
  resolveSlugConflict,
  SlugManager,
} from './slug.js';

describe('toSlug', () => {
  it('should convert simple text to slug', () => {
    expect(toSlug('Hello World')).toBe('hello-world');
  });

  it('should handle apostrophes', () => {
    expect(toSlug("Don't repeat yourself")).toBe('dont-repeat-yourself');
    expect(toSlug("Conway's Law")).toBe('conways-law');
  });

  it('should preserve camelCase', () => {
    expect(toSlug('JavaScript')).toBe('javascript');
  });

  it('should handle special characters', () => {
    expect(toSlug('Hello & Goodbye!')).toBe('hello-and-goodbye');
    expect(toSlug('Test@#$%Test')).toBe('test-test');
  });

  it('should handle unicode', () => {
    expect(toSlug('Café')).toBe('cafe');
  });
});

describe('generateBaseSlug', () => {
  it('should generate slug from filename', () => {
    const result = generateBaseSlug({ fileName: 'Test File' });
    expect(result.slug).toBe('test-file');
    expect(result.source).toBe('filename');
  });

  it('should prefer frontmatter slug', () => {
    const result = generateBaseSlug({
      fileName: 'Test File',
      frontmatterSlug: 'custom-slug',
    });
    expect(result.slug).toBe('custom-slug');
    expect(result.source).toBe('frontmatter');
  });

  it('should use parent folder for index.md without siblings', () => {
    const result = generateBaseSlug({
      fileName: 'index',
      parentFolder: 'Projects',
      siblingCount: 1,
    });
    expect(result.slug).toBe('projects');
    expect(result.source).toBe('folder');
  });

  it('should use filename for index.md with siblings', () => {
    const result = generateBaseSlug({
      fileName: 'index',
      parentFolder: 'Projects',
      siblingCount: 3,
    });
    expect(result.slug).toBe('index');
    expect(result.source).toBe('filename');
  });
});

describe('resolveSlugConflict', () => {
  it('should return original slug if no conflict', () => {
    const usedSlugs = new Set(['existing-slug']);
    const result = resolveSlugConflict('new-slug', usedSlugs);
    expect(result).toBe('new-slug');
  });

  it('should add number suffix on conflict with number strategy', () => {
    const usedSlugs = new Set(['my-slug']);
    const result = resolveSlugConflict('my-slug', usedSlugs, 'number');
    expect(result).toBe('my-slug2');
  });

  it('should increment number until unique', () => {
    const usedSlugs = new Set(['my-slug', 'my-slug2', 'my-slug3']);
    const result = resolveSlugConflict('my-slug', usedSlugs, 'number');
    expect(result).toBe('my-slug4');
  });

  it('should add hash suffix on conflict with hash strategy', () => {
    const usedSlugs = new Set(['my-slug']);
    const result = resolveSlugConflict('my-slug', usedSlugs, 'hash');
    expect(result).toMatch(/^my-slug-[a-f0-9]{6}$/);
  });
});

describe('SlugManager', () => {
  it('should reserve and track slugs', () => {
    const manager = new SlugManager();

    const info1 = manager.reserve('/path/file1.md', { fileName: 'Hello World' });
    expect(info1.slug).toBe('hello-world');
    expect(info1.wasModified).toBe(false);

    const info2 = manager.reserve('/path/file2.md', { fileName: 'Other Post' });
    expect(info2.slug).toBe('other-post');

    expect(manager.isUsed('hello-world')).toBe(true);
    expect(manager.isUsed('other-post')).toBe(true);
    expect(manager.isUsed('nonexistent')).toBe(false);
  });

  it('should resolve conflicts automatically', () => {
    const manager = new SlugManager();

    const info1 = manager.reserve('/path/file1.md', { fileName: 'Test' });
    expect(info1.slug).toBe('test');
    expect(info1.wasModified).toBe(false);

    const info2 = manager.reserve('/path/file2.md', { fileName: 'Test' });
    expect(info2.slug).toBe('test2');
    expect(info2.wasModified).toBe(true);
    expect(info2.originalSlug).toBe('test');
  });

  it('should retrieve slug info by file path', () => {
    const manager = new SlugManager();
    manager.reserve('/path/file.md', { fileName: 'My File' });

    const info = manager.getSlugInfo('/path/file.md');
    expect(info).toBeDefined();
    expect(info?.slug).toBe('my-file');

    expect(manager.getSlugInfo('/nonexistent')).toBeUndefined();
  });

  it('should get all slugs', () => {
    const manager = new SlugManager();
    manager.reserve('/path/a.md', { fileName: 'A' });
    manager.reserve('/path/b.md', { fileName: 'B' });

    const allSlugs = manager.getAllSlugs();
    expect(allSlugs.size).toBe(2);
    expect(allSlugs.get('/path/a.md')?.slug).toBe('a');
    expect(allSlugs.get('/path/b.md')?.slug).toBe('b');
  });
});

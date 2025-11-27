/**
 * Hash Utility Tests
 */

import { describe, it, expect } from 'vitest';
import { hashContent, hashBuffer, shortHash, combineHashes } from './hash.js';

describe('hashContent', () => {
  it('should return SHA-256 hash of string', () => {
    const hash = hashContent('hello');
    expect(hash).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  });

  it('should return consistent hashes', () => {
    expect(hashContent('test')).toBe(hashContent('test'));
  });

  it('should return different hashes for different content', () => {
    expect(hashContent('hello')).not.toBe(hashContent('world'));
  });

  it('should handle empty string', () => {
    const hash = hashContent('');
    expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('should handle unicode', () => {
    const hash = hashContent('Hello 世界');
    expect(hash).toHaveLength(64);
  });
});

describe('hashBuffer', () => {
  it('should return SHA-256 hash of buffer', () => {
    const buffer = Buffer.from('hello');
    const hash = hashBuffer(buffer);
    expect(hash).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  });

  it('should match hashContent for same input', () => {
    const content = 'test content';
    expect(hashBuffer(Buffer.from(content))).toBe(hashContent(content));
  });
});

describe('shortHash', () => {
  it('should return first 8 characters by default', () => {
    const hash = shortHash('hello');
    expect(hash).toBe('2cf24dba');
    expect(hash).toHaveLength(8);
  });

  it('should respect custom length', () => {
    expect(shortHash('hello', 4)).toBe('2cf2');
    expect(shortHash('hello', 12)).toBe('2cf24dba5fb0');
  });

  it('should return consistent short hashes', () => {
    expect(shortHash('test')).toBe(shortHash('test'));
  });
});

describe('combineHashes', () => {
  it('should combine multiple values into single hash', () => {
    const hash = combineHashes('a', 'b', 'c');
    expect(hash).toHaveLength(64);
  });

  it('should be deterministic', () => {
    expect(combineHashes('x', 'y')).toBe(combineHashes('x', 'y'));
  });

  it('should be order-sensitive', () => {
    expect(combineHashes('a', 'b')).not.toBe(combineHashes('b', 'a'));
  });

  it('should handle single value', () => {
    const hash = combineHashes('single');
    expect(hash).toHaveLength(64);
  });

  it('should handle empty array', () => {
    const hash = combineHashes();
    expect(hash).toBe(hashContent(''));
  });
});

import { describe, it, expect } from 'vitest';
import { isValidProjectId } from '../utils.js';

describe('isValidProjectId', () => {
  it('should accept valid project IDs', () => {
    expect(isValidProjectId('project123')).toBe(true);
    expect(isValidProjectId('my-project_v2')).toBe(true);
    expect(isValidProjectId('test.project')).toBe(true);
  });

  it('should reject invalid project IDs', () => {
    expect(isValidProjectId('')).toBe(false);
    expect(isValidProjectId('.invalid')).toBe(false);
    expect(isValidProjectId('-invalid')).toBe(false);
    expect(isValidProjectId('a'.repeat(101))).toBe(false);
  });

  it('should reject special characters', () => {
    expect(isValidProjectId('project@domain')).toBe(false);
    expect(isValidProjectId('project/path')).toBe(false);
    expect(isValidProjectId('project space')).toBe(false);
  });
});
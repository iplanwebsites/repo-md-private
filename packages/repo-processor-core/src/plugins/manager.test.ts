/**
 * Plugin Manager Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { topologicalSort, PluginManager } from './manager.js';
import type { Plugin, PluginContext } from './types.js';
import { createIssueCollector } from '../services/issueCollector.js';

// Mock plugin factory
const createMockPlugin = (
  name: string,
  requires?: readonly string[]
): Plugin => ({
  name: name as any,
  requires,
  initialize: vi.fn().mockResolvedValue(undefined),
  isReady: () => true,
});

describe('topologicalSort', () => {
  it('should return plugins in any order when no dependencies', () => {
    const plugins = [
      createMockPlugin('a'),
      createMockPlugin('b'),
      createMockPlugin('c'),
    ];

    const sorted = topologicalSort(plugins);
    expect(sorted).toHaveLength(3);
    expect(sorted.map((p) => p.name)).toEqual(expect.arrayContaining(['a', 'b', 'c']));
  });

  it('should order plugins by dependencies', () => {
    const a = createMockPlugin('a');
    const b = createMockPlugin('b', ['a']); // b requires a
    const c = createMockPlugin('c', ['b']); // c requires b

    const sorted = topologicalSort([c, a, b]);
    const names = sorted.map((p) => p.name);

    expect(names.indexOf('a')).toBeLessThan(names.indexOf('b'));
    expect(names.indexOf('b')).toBeLessThan(names.indexOf('c'));
  });

  it('should handle multiple dependencies', () => {
    const a = createMockPlugin('a');
    const b = createMockPlugin('b');
    const c = createMockPlugin('c', ['a', 'b']); // c requires both a and b

    const sorted = topologicalSort([c, b, a]);
    const names = sorted.map((p) => p.name);

    expect(names.indexOf('a')).toBeLessThan(names.indexOf('c'));
    expect(names.indexOf('b')).toBeLessThan(names.indexOf('c'));
  });

  it('should detect circular dependencies', () => {
    const a = createMockPlugin('a', ['c']);
    const b = createMockPlugin('b', ['a']);
    const c = createMockPlugin('c', ['b']);

    expect(() => topologicalSort([a, b, c])).toThrow(/circular/i);
  });

  it('should handle plugins with external dependencies', () => {
    // External deps (not in list) should be ignored
    const a = createMockPlugin('a', ['external-plugin']);
    const b = createMockPlugin('b', ['a']);

    const sorted = topologicalSort([b, a]);
    expect(sorted.map((p) => p.name)).toEqual(['a', 'b']);
  });

  it('should handle empty plugin list', () => {
    const sorted = topologicalSort([]);
    expect(sorted).toEqual([]);
  });
});

describe('PluginManager', () => {
  const createManager = (plugins: Record<string, Plugin> = {}) => {
    const issues = createIssueCollector();
    return new PluginManager({
      config: {
        directories: { input: '/test' },
        plugins,
      },
      outputDir: '/output',
      issues,
      log: () => {}, // Silent logger for tests
    });
  };

  describe('initialize', () => {
    it('should initialize with no plugins', async () => {
      const manager = createManager();
      await expect(manager.initialize()).resolves.not.toThrow();
    });

    it('should initialize plugins in dependency order', async () => {
      const initOrder: string[] = [];

      const a: Plugin = {
        name: 'a' as any,
        initialize: vi.fn(async () => { initOrder.push('a'); }),
        isReady: () => true,
      };

      const b: Plugin = {
        name: 'b' as any,
        requires: ['a'],
        initialize: vi.fn(async () => { initOrder.push('b'); }),
        isReady: () => true,
      };

      const manager = createManager({ a, b });
      await manager.initialize();

      expect(initOrder).toEqual(['a', 'b']);
    });

    it('should not re-initialize', async () => {
      const manager = createManager();
      await manager.initialize();
      await manager.initialize(); // Should not throw
    });
  });

  describe('getPlugin', () => {
    it('should return undefined before initialization', () => {
      const plugin = createMockPlugin('imageProcessor');
      const manager = createManager({ imageProcessor: plugin });

      expect(manager.getPlugin('imageProcessor')).toBeUndefined();
    });

    it('should return plugin after initialization', async () => {
      const plugin = createMockPlugin('imageProcessor');
      const manager = createManager({ imageProcessor: plugin });

      await manager.initialize();
      expect(manager.getPlugin('imageProcessor')).toBe(plugin);
    });
  });

  describe('hasPlugin', () => {
    it('should check plugin existence', async () => {
      const plugin = createMockPlugin('textEmbedder');
      const manager = createManager({ textEmbedder: plugin });

      await manager.initialize();

      expect(manager.hasPlugin('textEmbedder')).toBe(true);
      expect(manager.hasPlugin('nonexistent')).toBe(false);
    });
  });

  describe('dispose', () => {
    it('should dispose all plugins', async () => {
      const dispose = vi.fn();
      const plugin: Plugin = {
        name: 'test' as any,
        initialize: vi.fn(),
        isReady: () => true,
        dispose,
      };

      const manager = createManager({ test: plugin });
      await manager.initialize();
      await manager.dispose();

      expect(dispose).toHaveBeenCalled();
    });

    it('should dispose in reverse order', async () => {
      const disposeOrder: string[] = [];

      const a: Plugin = {
        name: 'a' as any,
        initialize: vi.fn(),
        isReady: () => true,
        dispose: async () => { disposeOrder.push('a'); },
      };

      const b: Plugin = {
        name: 'b' as any,
        requires: ['a'],
        initialize: vi.fn(),
        isReady: () => true,
        dispose: async () => { disposeOrder.push('b'); },
      };

      const manager = createManager({ a, b });
      await manager.initialize();
      await manager.dispose();

      expect(disposeOrder).toEqual(['b', 'a']);
    });
  });
});

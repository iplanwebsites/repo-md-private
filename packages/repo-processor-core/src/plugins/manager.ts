/**
 * Plugin Manager
 *
 * Manages plugin lifecycle with dependency resolution using topological sort.
 * Ensures plugins are initialized in the correct order based on dependencies.
 */

import type {
  Plugin,
  PluginContext,
  PluginConfig,
  PluginName,
  LogLevel,
} from './types.js';
import type { ProcessConfig } from '../types/config.js';
import type { IssueCollector } from '../services/issueCollector.js';

// ============================================================================
// Types
// ============================================================================

export interface PluginManagerConfig {
  readonly config: ProcessConfig;
  readonly outputDir: string;
  readonly issues: IssueCollector;
  readonly log?: (message: string, level?: LogLevel) => void;
}

// ============================================================================
// Plugin Manager Class
// ============================================================================

export class PluginManager {
  private readonly plugins = new Map<string, Plugin>();
  private readonly config: ProcessConfig;
  private readonly outputDir: string;
  private readonly issues: IssueCollector;
  private readonly log: (message: string, level?: LogLevel) => void;
  private initialized = false;

  constructor(config: PluginManagerConfig) {
    this.config = config.config;
    this.outputDir = config.outputDir;
    this.issues = config.issues;
    this.log = config.log ?? defaultLogger;
  }

  // --------------------------------------------------------------------------
  // Initialization
  // --------------------------------------------------------------------------

  /**
   * Initialize all plugins in dependency order
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      this.log('Plugin manager already initialized', 'warn');
      return;
    }

    const pluginConfigs = this.config.plugins ?? {};
    const allPlugins = Object.values(pluginConfigs).filter(
      (p): p is Plugin => p != null
    );

    if (allPlugins.length === 0) {
      this.log('No plugins configured', 'debug');
      this.initialized = true;
      return;
    }

    this.log(`Initializing ${allPlugins.length} plugin(s)...`, 'info');

    // Sort plugins by dependencies (topological sort)
    const sorted = topologicalSort(allPlugins);

    // Create context with getPlugin accessor
    const context = this.createContext();

    // Initialize in dependency order
    for (const plugin of sorted) {
      await this.initializePlugin(plugin, context);
    }

    this.initialized = true;
    this.log(`All plugins initialized successfully`, 'info');
  }

  /**
   * Initialize a single plugin
   */
  private async initializePlugin(plugin: Plugin, context: PluginContext): Promise<void> {
    const { name, requires } = plugin;

    this.log(`Initializing plugin: ${name}`, 'debug');

    // Validate dependencies are available
    for (const dep of requires ?? []) {
      if (!this.plugins.has(dep)) {
        const error = `Plugin "${name}" requires "${dep}" which is not configured`;
        this.issues.addPluginError({
          pluginName: name,
          operation: 'initialize',
          errorMessage: error,
        });
        throw new Error(error);
      }
    }

    try {
      await plugin.initialize(context);
      this.plugins.set(name, plugin);
      this.log(`Plugin "${name}" initialized`, 'debug');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.issues.addPluginError({
        pluginName: name,
        operation: 'initialize',
        errorMessage,
      });
      throw new Error(`Failed to initialize plugin "${name}": ${errorMessage}`);
    }
  }

  /**
   * Create plugin context
   */
  private createContext(): PluginContext {
    return {
      outputDir: this.outputDir,
      issues: this.issues,
      log: this.log,
      config: this.config,
      getPlugin: <T extends Plugin>(name: string) => this.getPlugin<T>(name),
    };
  }

  // --------------------------------------------------------------------------
  // Plugin Access
  // --------------------------------------------------------------------------

  /**
   * Get a plugin by name
   */
  getPlugin<T extends Plugin>(name: string): T | undefined {
    return this.plugins.get(name) as T | undefined;
  }

  /**
   * Get a typed plugin by its config key
   */
  getPluginByKey<K extends PluginName>(key: K): NonNullable<PluginConfig[K]> | undefined {
    // Plugin names match config keys
    return this.plugins.get(key) as NonNullable<PluginConfig[K]> | undefined;
  }

  /**
   * Check if a plugin is available
   */
  hasPlugin(name: string): boolean {
    return this.plugins.has(name);
  }

  /**
   * Get all initialized plugin names
   */
  getPluginNames(): readonly string[] {
    return [...this.plugins.keys()];
  }

  // --------------------------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------------------------

  /**
   * Dispose all plugins
   */
  async dispose(): Promise<void> {
    const plugins = [...this.plugins.values()].reverse();

    for (const plugin of plugins) {
      if (plugin.dispose) {
        try {
          await plugin.dispose();
          this.log(`Plugin "${plugin.name}" disposed`, 'debug');
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.issues.addPluginError({
            pluginName: plugin.name,
            operation: 'dispose',
            errorMessage,
          });
        }
      }
    }

    this.plugins.clear();
    this.initialized = false;
  }
}

// ============================================================================
// Topological Sort (Kahn's Algorithm)
// ============================================================================

/**
 * Sort plugins in dependency order using Kahn's algorithm
 * Ensures plugins are initialized after their dependencies
 */
export const topologicalSort = (plugins: readonly Plugin[]): readonly Plugin[] => {
  // Build maps for lookup
  const pluginMap = new Map<string, Plugin>();
  const adjacency = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  // Initialize
  for (const plugin of plugins) {
    pluginMap.set(plugin.name, plugin);
    adjacency.set(plugin.name, []);
    inDegree.set(plugin.name, 0);
  }

  // Build graph: if A requires B, then B -> A (B must come before A)
  for (const plugin of plugins) {
    for (const dep of plugin.requires ?? []) {
      // Only add edge if dependency is in our plugin list
      if (adjacency.has(dep)) {
        adjacency.get(dep)!.push(plugin.name);
        inDegree.set(plugin.name, (inDegree.get(plugin.name) ?? 0) + 1);
      }
    }
  }

  // Kahn's algorithm
  const queue: string[] = [];
  const result: Plugin[] = [];

  // Start with nodes that have no dependencies
  for (const [name, degree] of inDegree) {
    if (degree === 0) {
      queue.push(name);
    }
  }

  while (queue.length > 0) {
    const name = queue.shift()!;
    const plugin = pluginMap.get(name);

    if (plugin) {
      result.push(plugin);
    }

    // Reduce in-degree for neighbors
    for (const neighbor of adjacency.get(name) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 0) - 1;
      inDegree.set(neighbor, newDegree);

      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  // Check for circular dependencies
  if (result.length !== plugins.length) {
    const unresolved = plugins
      .filter((p) => !result.includes(p))
      .map((p) => p.name);
    throw new Error(
      `Circular plugin dependency detected involving: ${unresolved.join(', ')}`
    );
  }

  return result;
};

// ============================================================================
// Default Logger
// ============================================================================

const defaultLogger = (message: string, level: LogLevel = 'info'): void => {
  const prefix = `[processor-core]`;
  switch (level) {
    case 'error':
      console.error(`${prefix} ERROR: ${message}`);
      break;
    case 'warn':
      console.warn(`${prefix} WARN: ${message}`);
      break;
    case 'debug':
      // Only log debug in development
      if (process.env.NODE_ENV === 'development' || process.env.DEBUG) {
        console.log(`${prefix} DEBUG: ${message}`);
      }
      break;
    default:
      console.log(`${prefix} ${message}`);
  }
};

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create and initialize a plugin manager
 */
export const createPluginManager = async (
  config: PluginManagerConfig
): Promise<PluginManager> => {
  const manager = new PluginManager(config);
  await manager.initialize();
  return manager;
};

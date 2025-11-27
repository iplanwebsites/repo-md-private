/**
 * Plugin System Exports
 *
 * @repo-md/processor-core plugin architecture
 */

// Types
export type {
  Plugin,
  PluginContext,
  PluginConfig,
  PluginName,
  PluginByName,
  LogLevel,
  // Image processor
  ImageProcessorPlugin,
  ImageMetadata,
  ImageProcessOptions,
  ImageProcessResult,
  // Text embedding
  TextEmbeddingPlugin,
  // Image embedding
  ImageEmbeddingPlugin,
  // Similarity
  SimilarityPlugin,
  SimilarityResult,
  // Database
  DatabasePlugin,
  DatabaseBuildInput,
  DatabaseResult,
  // Mermaid
  MermaidRendererPlugin,
  MermaidStrategy,
  MermaidRenderOptions,
  MermaidResult,
} from './types.js';

// Plugin Manager
export {
  PluginManager,
  createPluginManager,
  topologicalSort,
  type PluginManagerConfig,
} from './manager.js';

// Default Plugins
export {
  CopyOnlyImageProcessor,
  PassthroughMermaidRenderer,
  NoOpTextEmbedder,
  NoOpImageEmbedder,
  NoOpSimilarity,
  NoOpDatabase,
  createDefaultPlugins,
  createAllNoOpPlugins,
} from './defaults.js';

/**
 * @repo-md/processor-core
 *
 * Core markdown processing engine with plugin architecture.
 * Lightweight, extensible, and suitable for npm distribution.
 */

// Types
export * from './types/index.js';

// Plugins
export * from './plugins/index.js';

// Services
export * from './services/index.js';

// Processor
export * from './processor/index.js';

// Markdown
export * from './markdown/index.js';

// Utils (excluding SlugInfo which conflicts with output types)
export {
  toSlug,
  generateBaseSlug,
  resolveSlugConflict,
  SlugManager,
  type SlugConfig,
  type SlugAssignment,
  type BaseSlugOptions,
} from './utils/slug.js';
export * from './utils/hash.js';
export * from './utils/file.js';

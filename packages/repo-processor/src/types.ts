// Central type exports - re-export all types from the type directory
import * as core from './types/core';
import * as media from './types/media';
import * as obsidian from './types/obsidian';

// Export specific types from each module
export type {
  FileData,
  TocItem,
  FilePathAllowSetBuilder,
  UnifiedProcessorBuilder,
  ToLinkBuilderOpts,
  ToLinkBuilder,
  ProcessOptions,
  // Graph relationship types
  RelationshipType,
  GraphNode,
  GraphEdge,
  GraphData,
  // Slug tracking types
  SlugInfo
} from './types/core';

export type {
  MediaFileData,
  MediaPathMap,
  ProcessMediaOptions
} from './types/media';

export type {
  WikiLink,
  ObsidianLink,
  PageOnly,
  PageAndHeader,
  PageAndBlock,
  HeaderOnly,
  BlockOnly,
  ObsidianProcessOptions
} from './types/obsidian';




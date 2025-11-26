/**
 * Posts module barrel export for RepoMD
 */

import { createPostRetrieval } from './retrieval.js';
import { createPostSimilarity } from './similarity.js';
import { createPostSearch } from './search.js';

export {
  createPostRetrieval,
  createPostSimilarity,
  createPostSearch,
};

// Re-export types
export type { Post, PostStats, PostRetrievalConfig, PostRetrievalService, AugmentOptions } from './retrieval.js';
export type { PostSimilarityConfig, PostSimilarityService } from './similarity.js';
export type { Media, SearchResult, SearchOptions, SearchParams, PostSearchConfig, PostSearchService } from './search.js';

/**
 * Main barrel export file for RepoMD
 */

// Core exports
import { RepoMD, logo, createOpenAiSpecs } from './RepoMd.js';
import { createOpenAiToolHandler, handleOpenAiRequest } from './openai/index.js';

// Module exports for direct access if needed
import * as coreModule from './core/index.js';
import * as postsModule from './posts/index.js';
import * as mediaModule from './media/index.js';
import * as projectModule from './project/index.js';
import * as filesModule from './files/index.js';
import * as openaiModule from './openai/index.js';

// Import alias mechanism
import { aliases, createAliasFunction, applyAliases } from './aliases.js';

// Import schema/validation utilities
import {
  repoMdOptionsSchema,
  schemas,
  validateFunctionParams,
  functionParamMetadata,
  applyValidation,
  getMethodDescription,
  getAllMethodDescriptions,
  getMethodsByCategory
} from './schemas/index.js';

// Re-export all public APIs
export {
  // Main classes and utilities
  RepoMD,
  logo,
  createOpenAiSpecs,
  createOpenAiToolHandler,
  handleOpenAiRequest,

  // Modules for direct access
  coreModule,
  postsModule,
  mediaModule,
  projectModule,
  filesModule,
  openaiModule,

  // Alias mechanism for extending and compatibility
  aliases,
  createAliasFunction,
  applyAliases,

  // Schema and validation exports
  repoMdOptionsSchema,
  schemas,
  validateFunctionParams,
  functionParamMetadata,
  applyValidation,
  getMethodDescription,
  getAllMethodDescriptions,
  getMethodsByCategory
};

// Default export
export default RepoMD;

// Legacy exports
export * from './frameworkSnipets.js';
export * from './logger.js';

// Next.js middleware exports
export { RepoNextMiddleware, createRepoMiddleware } from './middleware/RepoNextMiddleware.js';

// Unified proxy configuration exports
export { UnifiedProxyConfig, createUnifiedProxyConfig, REPO_MD_DEFAULTS } from './proxy/UnifiedProxyConfig.js';

// Simplified integration exports
export {
  repoMdProxy,
  viteRepoMdProxy,
  nextRepoMdMiddleware,
  nextRepoMdConfig,
  remixRepoMdLoader,
  cloudflareRepoMdHandler,
  createRepoMd,
  // New framework integrations
  nuxtRepoMdPlugin,
  nuxtRepoMdCachedHandler,
  nuxtRepoMdModuleConfig,
  createNuxtModuleSetup,
  nuxtModuleExample,
  svelteKitRepoMdHandle,
  svelteKitRepoMdSequenceHandle,
  expressRepoMdMiddleware,
  expressRepoMdErrorHandler,
  fastifyRepoMdPlugin,
  koaRepoMdMiddleware,
  koaRepoMdStreamingMiddleware,
  astroRepoMdMiddleware,
  astroRepoMdIntegration,
  astroRepoMdFullIntegration
} from './integrations/index.js';

// Re-export types from RepoMd
export type {
  PostMethodStats,
  PostStats,
  RevisionCacheStats,
  ClientStats,
  RepoMDStrategy,
  RepoMDOptions,
  GetOpenAiToolSpecOptions,
  UnifiedProxyOptions,
  NextMiddlewareOptions,
  NextMiddlewareResult,
  CloudflareHandlerOptions,
  FindOptions,
  ContentSearchResult,
  AugmentPostsOptions,
} from './RepoMd.js';

// Re-export types from modules
export type {
  Post,
  PostRetrievalConfig,
  PostRetrievalService,
} from './posts/retrieval.js';

export type {
  SearchResult,
  SearchParams,
  PostSearchConfig,
  PostSearchService,
} from './posts/search.js';

export type {
  PostSimilarityConfig,
  PostSimilarityService,
} from './posts/similarity.js';

export type {
  MediaItem,
  MediaHandlerConfig,
  MediaHandlerService,
} from './media/handler.js';

export type {
  MediaSimilarityConfig,
  MediaSimilarityService,
} from './media/similarity.js';

export type {
  SourceFile,
  DistFile,
  GraphData,
  FileHandlerConfig,
  FileHandlerService,
} from './files/index.js';

export type {
  ReleaseInfo,
  ProjectMetadata,
  ProjectConfigService,
} from './project/config.js';

export type {
  UrlGeneratorConfig,
  UrlGenerator,
} from './core/urls.js';

export type {
  ApiClientConfig,
  ApiClient,
  ProjectDetails,
} from './core/api.js';

export type {
  CacheConfig,
  CacheStats,
  CacheManager,
} from './core/cache.js';

export type {
  OpenAiProperty,
  OpenAiFunctionParameters,
  OpenAiFunction,
  OpenAiSpecs,
  CreateOpenAiSpecsOptions,
} from './openai/OpenAiToolSpec.js';

export type {
  RepoMDInstance,
  ToolCall,
  OpenAiRequest,
  ToolCallResult,
  OpenAiResponse,
  OpenAiToolHandler,
} from './openai/OpenAiToolHandler.js';

export type {
  SchemaWithMeta,
  MethodMeta,
  MethodMode,
} from './schemas/schemas.js';

export type {
  MethodDescription,
  MethodDescriptions,
} from './schemas/types.js';

export type {
  AliasMap,
  AliasableInstance,
} from './aliases.js';

// Shared types and utilities
export type {
  BaseProxyOptions,
  FetchR2JsonFn,
  FetchMapDataFn,
  GetActiveRevFn,
  BaseServiceConfig,
  FetchableServiceConfig,
  SearchMode,
  RevisionCacheConfig,
} from './types/common.js';

// Utility functions
export {
  normalizeOptions,
  getMediaUrlPrefix,
  resolveDebug,
} from './utils/options.js';

// Revision-aware cache utilities
export {
  createRevisionAwareCache,
  createRevisionAwareMapCache,
  type RevisionAwareCache,
  type RevisionAwareMapCache,
} from './core/revisionCache.js';

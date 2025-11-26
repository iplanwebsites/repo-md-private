# TypeScript Conversion Plan for @repo-md/client

> **Status**: ✅ Complete
> **Started**: 2024-01-26
> **Completed**: 2024-11-26
> **Result**: Converted 50 JavaScript files (~14,219 LOC) to TypeScript

---

## Benefits of TypeScript Conversion

### Developer Experience
| Benefit | Description |
|---------|-------------|
| **Type Safety** | Catch errors at compile-time instead of runtime. Prevents passing wrong types like `getPostBySlug(123)` instead of `getPostBySlug("my-post")` |
| **IDE Support** | Auto-complete, inline documentation, go-to-definition, and refactoring tools work seamlessly |
| **Self-Documenting** | Types serve as living documentation - interfaces define the contract |
| **Safer Refactoring** | Rename a property and TypeScript shows all places that need updates |

### Maintenance Benefits
| Benefit | Description |
|---------|-------------|
| **Eliminate .d.ts Sync** | Currently maintaining separate `index.d.ts` - types will be generated from source |
| **Zod Schema Inference** | Use `z.infer<typeof schema>` to derive types directly from Zod schemas |
| **Better Errors** | Precise error locations vs runtime "undefined is not a function" |
| **API Stability** | Breaking changes caught immediately, protecting SDK consumers |

### Codebase Quality
| Benefit | Description |
|---------|-------------|
| **Explicit Contracts** | Function signatures clearly define inputs/outputs |
| **Reduced Bugs** | Studies show 15% fewer bugs with TypeScript |
| **Onboarding** | New developers understand code faster with type hints |
| **Confidence** | Ship with confidence knowing types are validated |

---

## Current State Analysis

| Metric | Value |
|--------|-------|
| Total JS files | 50 |
| Total lines of code | ~14,219 |
| Existing .d.ts files | 2 (`index.d.ts`, `_zod.d.ts`) |
| JSDoc coverage | Good (most functions documented) |
| TypeScript config | ✅ `tsconfig.json` with strict mode |

### Complexity Distribution

| Category | Files | LOC | % Effort |
|----------|-------|-----|----------|
| High (>600 LOC) | 9 | ~6,000 | 45% |
| Medium (150-600 LOC) | 15 | ~4,500 | 35% |
| Light (50-150 LOC) | 20 | ~2,500 | 15% |
| Minimal (<50 LOC) | 6 | ~200 | 5% |

---

## Conversion Progress

### Phase 1: Foundation ✅
> Simple utilities to establish patterns

| File | Status | Notes |
|------|--------|-------|
| `version.js` → `version.ts` | ✅ | Added `VersionInfo` interface |
| `vector.js` → `vector.ts` | ✅ | Added `Embedding` type |
| `logger.js` → `logger.ts` | ✅ | Added `LogPrefixes` interface |
| `utils/env.js` → `utils/env.ts` | ✅ | Added `EnvContext`, `EnvVarMap` types |
| `frameworkSnipets.js` → `frameworkSnipets.ts` | ✅ | Added `as const` assertions |
| `core/index.js` → `core/index.ts` | ✅ | Added type re-exports |
| `core/cache.js` → `core/cache.ts` | ✅ | Added `CacheConfig`, `CacheStats`, `CacheManager` |
| `aliases.js` → `aliases.ts` | ✅ | Added `AliasMap`, `AliasableInstance` |

**Completed**: 2024-11-26

**Migration infrastructure added:**
- `vitest.config.ts` updated with `jsToTsPlugin()` for `.js` → `.ts` resolution

---

### Phase 2: Core Infrastructure ✅
> URL generation, API client, utilities

| File | Status | Notes |
|------|--------|-------|
| `core/urls.js` → `core/urls.ts` | ✅ | Added `UrlGenerator`, `UrlGeneratorConfig`, `RevisionCacheStats` |
| `core/api.js` → `core/api.ts` | ✅ | Added `ApiClient`, `ApiClientConfig`, `ProjectDetails` |
| `core/logger-wrapper.js` → `core/logger-wrapper.ts` | ✅ | Added typed formatters, `AnyFunction`, `LoggableObject` |
| `utils.js` → `utils.ts` | ✅ | Added `FetchJsonOptions`, `FetchErrorResponse` |
| `inference.js` → `inference.ts` | ✅ | Added `EmbeddingData`, inference payload types |
| `mediaProxy.js` → `mediaProxy.ts` | ✅ | Added `GetR2MediaUrlFn`, MIME type mapping |

**Completed**: 2024-11-26

---

### Phase 3: Schemas & Validation ✅
> Zod schemas, type extraction, validation

| File | Status | Notes |
|------|--------|-------|
| `schemas/schemas.js` → `schemas/schemas.ts` | ✅ | 1,205 LOC, added `SchemaWithMeta`, `MethodMeta` types |
| `schemas/types.js` → `schemas/types.ts` | ✅ | 164 LOC, added `ZodDef` helper, proper type safety |
| `schemas/validator.js` → `schemas/validator.ts` | ✅ | 144 LOC, added `AnyFunction`, `ValidatableInstance` |
| `schemas/index.js` → `schemas/index.ts` | ✅ | barrel |
| `test-schema-coverage.js` → `test-schema-coverage.ts` | ✅ | Test file converted |

**Completed**: 2024-11-26

---

### Phase 4: Domain Modules ✅
> Posts, media, files, project modules

| File | Status | Notes |
|------|--------|-------|
| `posts/retrieval.js` → `.ts` | ✅ | Added `Post`, `PostStats`, `PostRetrievalConfig`, `PostRetrievalService` |
| `posts/search.js` → `.ts` | ✅ | Added `SearchResult`, `SearchParams`, `PostSearchConfig` |
| `posts/similarity.js` → `.ts` | ✅ | Added `PostSimilarityConfig`, `PostSimilarityService` |
| `posts/index.js` → `.ts` | ✅ | barrel with type re-exports |
| `media/handler.js` → `.ts` | ✅ | Added `MediaHandlerConfig`, `MediaHandlerService` |
| `media/similarity.js` → `.ts` | ✅ | Added `MediaSimilarityConfig`, `MediaSimilarityService` |
| `media/index.js` → `.ts` | ✅ | barrel with type re-exports |
| `files/index.js` → `.ts` | ✅ | Added `SourceFile`, `DistFile`, `GraphData`, `FileHandlerService` |
| `project/config.js` → `.ts` | ✅ | Added `ReleaseInfo`, `ProjectMetadata`, `ProjectConfigService` |
| `project/index.js` → `.ts` | ✅ | barrel with type re-exports |

**Completed**: 2024-11-26

---

### Phase 5: OpenAI Integration ✅
> Tool handlers and specifications

| File | Status | Notes |
|------|--------|-------|
| `openai/OpenAiToolHandler.js` → `.ts` | ✅ | Added `RepoMDInstance`, `ToolCall`, `OpenAiRequest`, `OpenAiResponse`, `OpenAiToolHandler` |
| `openai/OpenAiToolSpec.js` → `.ts` | ✅ | Added `OpenAiProperty`, `OpenAiFunction`, `OpenAiSpecs`, `CreateOpenAiSpecsOptions` |
| `openai/OpenAiToolSpec_staticexample.js` → `.ts` | ✅ | Added `ToolSpecWrapper`, `ToolSpecsMap` types |
| `openai/index.js` → `.ts` | ✅ | barrel with type re-exports |

**Completed**: 2024-11-26

---

### Phase 6: Framework Integrations ✅
> Next.js, Express, Cloudflare, etc.

| File | Status | Notes |
|------|--------|-------|
| `proxy/nodeUtils.js` → `.ts` | ✅ | Added `HeaderMap`, `ProxyFetchOptions`, `StreamTarget`, `ProxyErrorResponse` |
| `proxy/UnifiedProxyConfig.js` → `.ts` | ✅ | Added `ProxyConfigOptions`, `ViteProxyConfig`, `NextConfig`, `RemixLoader` |
| `middleware/RepoNextMiddleware.js` → `.ts` | ✅ | Added `NextRequest`, `NextMiddlewareHandler` |
| `integrations/index.js` → `.ts` | ✅ | Added `DetectedFramework`, `RepoMdProxyOptions`, `ProxyResult` |
| `integrations/nextjs.js` → `.ts` | ✅ | Added `NextRepoMdOptions`, `NextMiddlewareResult`, `MergedNextConfig` |
| `integrations/express.js` → `.ts` | ✅ | Added `ExpressRequest`, `ExpressResponse`, `ExpressMiddleware` |
| `integrations/cloudflare.js` → `.ts` | ✅ | Added `CloudflareEnv`, `CloudflareWorker`, `CloudflarePagesFunction` |
| `integrations/astro.js` → `.ts` | ✅ | Added `AstroContext`, `AstroMiddleware`, `AstroIntegration` |
| `integrations/nuxt.js` → `.ts` | ✅ | Added `NitroApp`, `NuxtPlugin`, `CachedHandlerResult` |
| `integrations/sveltekit.js` → `.ts` | ✅ | Added `SvelteKitEvent`, `SvelteKitHandle` |
| `integrations/fastify.js` → `.ts` | ✅ | Added `FastifyRequest`, `FastifyReply`, `FastifyPlugin` |
| `integrations/koa.js` → `.ts` | ✅ | Added `KoaContext`, `KoaMiddleware` |
| `integrations/remix.js` → `.ts` | ✅ | Added `RemixAction`, `RemixRouteModule` |
| `integrations/vite.js` → `.ts` | ✅ | Added `ViteRepoMdOptions`, `VitePlugin`, `VitePluginConfig` |

**Completed**: 2024-11-26

---

### Phase 7: Main Class ✅
> Core RepoMD class and entry point

| File | Status | Notes |
|------|--------|-------|
| `RepoMd.js` → `RepoMd.ts` | ✅ | 1,200+ LOC, added `RepoMDOptions`, `ClientStats`, `FindOptions`, all service types |
| `index.js` → `index.ts` | ✅ | Barrel exports with full type re-exports |
| Delete `index.d.ts` | ✅ | Types now generated from source |

**Completed**: 2024-11-26

---

## Key Type Definitions

These core types will be created/derived:

```typescript
// Derived from Zod schemas (single source of truth)
export type Post = z.infer<typeof PostSchema>;
export type Media = z.infer<typeof MediaSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type SourceFile = z.infer<typeof SourceFileSchema>;

// Configuration
export interface RepoMDOptions {
  projectId: string;
  rev?: string;
  strategy?: 'browser' | 'server' | 'edge';
  instance?: string;
  debug?: boolean;
  cache?: boolean;
  cacheMaxSize?: number;
  cacheTtl?: number;
}

// Factory return types
export interface UrlGenerator {
  getRevisionUrl(path: string): Promise<string>;
  getProjectUrl(path: string): string;
  getSharedFolderUrl(path: string): string;
  getMediaUrl(path: string): string;
  getActiveRev(): string | undefined;
  getActiveRevState(): RevisionState | undefined;
}

export interface PostRetrieval {
  getAllPosts(includeContent?: boolean, forceRefresh?: boolean): Promise<Post[]>;
  getPostBySlug(slug: string): Promise<Post | null>;
  getPostByHash(hash: string): Promise<Post | null>;
  getPostByPath(path: string): Promise<Post | null>;
  getRecentPosts(count?: number): Promise<Post[]>;
  sortPostsByDate(posts: Post[]): Post[];
  clearPostsCache(): void;
}

export interface ApiClient {
  fetchJson<T>(url: string, options?: FetchOptions): Promise<T>;
  fetchR2Json<T>(path: string, options?: R2FetchOptions): Promise<T>;
}

export interface CacheManager {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): void;
  has(key: string): boolean;
  delete(key: string): boolean;
  clear(): void;
  getStats(): CacheStats;
}
```

---

## Migration Guidelines

### Do's
- ✅ Convert one file at a time, ensure tests pass
- ✅ Use `z.infer<>` to derive types from Zod schemas
- ✅ Define explicit return types for all functions
- ✅ Convert corresponding `.test.js` to `.test.ts` together
- ✅ Use `unknown` instead of `any` where type is uncertain
- ✅ Add JSDoc comments for public API methods

### Don'ts
- ❌ Don't use `any` - define proper types or use `unknown`
- ❌ Don't skip strict mode checks
- ❌ Don't leave `// @ts-ignore` without explanation
- ❌ Don't convert all files at once - incremental is safer

### Testing Strategy
1. Convert file `.js` → `.ts`
2. Convert test file `.test.js` → `.test.ts`
3. Run `npm run test:unit` to verify
4. Run `npm run typecheck` to verify types
5. Commit when both pass

---

## Summary

| Metric | Value |
|--------|-------|
| **Total files** | 50 |
| **Total LOC** | ~14,219 |
| **Phases** | 7 |
| **Estimated time** | 11-13 days |
| **Test files to convert** | 11 |

---

## Changelog

| Date | Phase | Files Converted | Notes |
|------|-------|-----------------|-------|
| 2024-11-26 | 7 | 3 | **COMPLETE** - Phase 7 complete - Main class (RepoMd.ts, index.ts, deleted index.d.ts) |
| 2024-11-26 | 6 | 14 | Phase 6 complete - Framework integrations (proxy, middleware, integrations) |
| 2024-11-26 | 5 | 4 | Phase 5 complete - OpenAI integration (handler, spec, staticexample, index) |
| 2024-11-26 | 4 | 10 | Phase 4 complete - Domain modules (posts, media, files, project) |
| 2024-11-26 | 3 | 5 | Phase 3 complete - Schemas & validation (schemas, types, validator, index, test-schema-coverage) |
| 2024-11-26 | 2 | 6 | Phase 2 complete - Core infrastructure (urls, api, utils, inference, mediaProxy, logger-wrapper) |
| 2024-11-26 | 1 | 8 | Phase 1 complete - Foundation files converted |
| 2024-11-26 | - | 0 | Plan created, vitest plugin for .js→.ts resolution |


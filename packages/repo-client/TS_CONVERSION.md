# TypeScript Conversion Plan for @repo-md/client

> **Status**: In Progress
> **Started**: 2024-01-26
> **Target**: Convert 50 JavaScript files (~14,219 LOC) to TypeScript

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

### Phase 2: Core Infrastructure ⬜
> URL generation, API client, utilities

| File | Status | Notes |
|------|--------|-------|
| `core/urls.js` → `core/urls.ts` | ⬜ | 364 LOC, URL factory |
| `core/api.js` → `core/api.ts` | ⬜ | 305 LOC, API client |
| `core/logger-wrapper.js` → `core/logger-wrapper.ts` | ⬜ | 558 LOC, complex |
| `utils.js` → `utils.ts` | ⬜ | 315 LOC |
| `inference.js` → `inference.ts` | ⬜ | 135 LOC |
| `mediaProxy.js` → `mediaProxy.ts` | ⬜ | 223 LOC |

**Estimated effort**: 2 days

---

### Phase 3: Schemas & Validation ⬜
> Zod schemas, type extraction, validation

| File | Status | Notes |
|------|--------|-------|
| `schemas/schemas.js` → `schemas/schemas.ts` | ⬜ | 1,205 LOC, **largest file** |
| `schemas/types.js` → `schemas/types.ts` | ⬜ | 164 LOC |
| `schemas/validator.js` → `schemas/validator.ts` | ⬜ | 144 LOC |
| `schemas/index.js` → `schemas/index.ts` | ⬜ | barrel |

**Estimated effort**: 2 days

---

### Phase 4: Domain Modules ⬜
> Posts, media, files, project modules

| File | Status | Notes |
|------|--------|-------|
| `posts/retrieval.js` → `.ts` | ⬜ | 667 LOC, caching logic |
| `posts/search.js` → `.ts` | ⬜ | 378 LOC, MiniSearch |
| `posts/similarity.js` → `.ts` | ⬜ | 443 LOC, vectors |
| `posts/index.js` → `.ts` | ⬜ | barrel |
| `media/handler.js` → `.ts` | ⬜ | 103 LOC |
| `media/similarity.js` → `.ts` | ⬜ | 355 LOC |
| `media/index.js` → `.ts` | ⬜ | barrel |
| `files/index.js` → `.ts` | ⬜ | 101 LOC |
| `project/config.js` → `.ts` | ⬜ | 86 LOC |
| `project/index.js` → `.ts` | ⬜ | barrel |

**Estimated effort**: 2-3 days

---

### Phase 5: OpenAI Integration ⬜
> Tool handlers and specifications

| File | Status | Notes |
|------|--------|-------|
| `openai/OpenAiToolHandler.js` → `.ts` | ⬜ | 201 LOC |
| `openai/OpenAiToolSpec.js` → `.ts` | ⬜ | 207 LOC |
| `openai/OpenAiToolSpec_staticexample.js` → `.ts` | ⬜ | 155 LOC |
| `openai/index.js` → `.ts` | ⬜ | barrel |

**Estimated effort**: 1 day

---

### Phase 6: Framework Integrations ⬜
> Next.js, Express, Cloudflare, etc.

| File | Status | Notes |
|------|--------|-------|
| `integrations/index.js` → `.ts` | ⬜ | 179 LOC |
| `integrations/nextjs.js` → `.ts` | ⬜ | 104 LOC |
| `integrations/express.js` → `.ts` | ⬜ | 113 LOC |
| `integrations/cloudflare.js` → `.ts` | ⬜ | 103 LOC |
| `integrations/astro.js` → `.ts` | ⬜ | 147 LOC |
| `integrations/nuxt.js` → `.ts` | ⬜ | 134 LOC |
| `integrations/sveltekit.js` → `.ts` | ⬜ | 127 LOC |
| `integrations/fastify.js` → `.ts` | ⬜ | 143 LOC |
| `integrations/koa.js` → `.ts` | ⬜ | 180 LOC |
| `integrations/remix.js` → `.ts` | ⬜ | ~100 LOC |
| `integrations/vite.js` → `.ts` | ⬜ | ~100 LOC |
| `proxy/UnifiedProxyConfig.js` → `.ts` | ⬜ | 280 LOC |
| `proxy/nodeUtils.js` → `.ts` | ⬜ | 169 LOC |
| `middleware/RepoNextMiddleware.js` → `.ts` | ⬜ | 96 LOC |

**Estimated effort**: 2 days

---

### Phase 7: Main Class ⬜
> Core RepoMD class and entry point

| File | Status | Notes |
|------|--------|-------|
| `RepoMd.js` → `RepoMd.ts` | ⬜ | 1,044 LOC, **main class** |
| `index.js` → `index.ts` | ⬜ | 103 LOC, 34 exports |
| Delete `index.d.ts` | ⬜ | Types now from source |

**Estimated effort**: 1-2 days

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
| 2024-11-26 | 1 | 8 | Phase 1 complete - Foundation files converted |
| 2024-11-26 | - | 0 | Plan created, vitest plugin for .js→.ts resolution |


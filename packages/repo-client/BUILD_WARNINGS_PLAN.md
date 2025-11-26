# Build Warnings Fix Plan

## 1. Dynamic Import Warning

**Warning:**
```
inference.ts is dynamically imported by RepoMd.ts but also statically imported by search.ts,
dynamic import will not move module into another chunk.
```

**Cause:** `inference.ts` is imported two ways:
- Dynamically in `RepoMd.ts` (for lazy loading)
- Statically in `search.ts`

**Fix Options:**
- [ ] Option A: Make all imports static (simpler, slightly larger initial bundle)
- [ ] Option B: Make all imports dynamic (keeps lazy loading, more complex)
- [ ] Option C: Leave as-is (warning is informational, not an error)

**Files to modify:**
- `src/lib/RepoMd.ts`
- `src/lib/posts/search.ts`

---

## 2. External Module Globals (UMD Build)

**Warning:**
```
No name was provided for external module "quick-lru" in "output.globals" – guessing "QuickLRU"
```

**Cause:** UMD build needs global variable names for external deps when used via `<script>` tag.

**Fix:** Add explicit globals in vite.config.ts:

```typescript
rollupOptions: {
  external: ['quick-lru', 'envizion', 'compute-cosine-similarity', 'minisearch', 'zod'],
  output: {
    globals: {
      'quick-lru': 'QuickLRU',
      'envizion': 'envizion',
      'compute-cosine-similarity': 'computeCosineSimilarity',
      'minisearch': 'MiniSearch',
      'zod': 'zod'
    }
  }
}
```

**Files to modify:**
- [ ] `packages/repo-client/vite.config.ts`

---

## 3. Type Name Collisions

**Warning:**
```
The following type nodes were renamed because of name collisions:
- ProjectDetails
- CacheHeaders
- PostStats
- RevisionCacheStats
- FastifyInstance
- NextMiddlewareResult
```

**Cause:** Multiple files define types with the same name. When bundling into single .d.ts, they collide.

**Fix:** Rename the duplicate types to be unique, or explicitly re-export the ones that should be public API.

**Duplicate locations found:**

| Type | Keep (source of truth) | Remove (duplicate) |
|------|------------------------|-------------------|
| `ProjectDetails` | `core/api.ts:24` | `project/config.ts:33` |
| `PostStats` | `posts/retrieval.ts:22` | `RepoMd.ts:75` |
| `NextMiddlewareResult` | `integrations/nextjs.ts:17` | `RepoMd.ts:139` |
| `RevisionCacheStats` | `core/urls.ts:21` | `RepoMd.ts:84` |
| `CacheHeaders` | `proxy/nodeUtils.ts:13` | `proxy/UnifiedProxyConfig.ts:21` |
| `FastifyInstance` | `integrations/fastify.ts:41` | `RepoMd.ts:172` |

**Fix approach:**
1. Remove duplicate definitions from `RepoMd.ts` - import from source modules instead
2. Remove `CacheHeaders` from `UnifiedProxyConfig.ts` - import from `nodeUtils.ts`
3. Remove `ProjectDetails` from `project/config.ts` - import from `core/api.ts`

**Files to modify:**
- [x] `src/lib/RepoMd.ts` - renamed types to be unique (ClientPostStats, ClientRevisionCacheStats, RepoNextMiddlewareResult), imported FastifyInstance from fastify.ts
- [x] `src/lib/proxy/UnifiedProxyConfig.ts` - imported CacheHeaders from nodeUtils.ts
- [x] `src/lib/core/api.ts` - imported ProjectDetails from project/config.ts

---

## Priority

1. ~~**Type collisions** - Most impactful for API consumers~~ ✅ FIXED
2. ~~**UMD globals** - Quick fix, improves UMD usage~~ ✅ FIXED
3. **Dynamic import** - Low priority, just informational (can ignore)

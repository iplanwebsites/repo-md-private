# TypeScript Migration Plan for @repo-md/client

## Summary

When running `npx tsc --noEmit` from `packages/npm-repo-md` (which consumes repo-client), we encounter TypeScript errors.

## Errors to Fix

### 1. Missing declaration file for `nuxt-module.mjs`

**Location:** `src/lib/integrations/index.ts:240`

**Error:**
```
error TS7016: Could not find a declaration file for module './nuxt-module.mjs'.
'/Users/felix/web/git/repo-md/repo-monorepo/packages/repo-client/src/lib/integrations/nuxt-module.mjs'
implicitly has an 'any' type.
```

**Fix:** Create a `.d.mts` declaration file for the nuxt-module.mjs file, OR convert it to TypeScript.

---

### 2. Zod version mismatch

**Location:** `src/lib/schemas/schemas.ts:4`

**Error:**
```
error TS2345: Argument of type 'typeof import(".../repo-client/node_modules/zod/dist/types/v3/external")'
is not assignable to parameter of type 'typeof import(".../node_modules/zod/index")'.
Property 'z' is missing in type...
```

**Cause:** Different Zod versions in repo-client vs monorepo root cause type incompatibility.

**Fix:** Ensure consistent Zod versions across the monorepo using workspace hoisting.

---

### 3. Property 'meta' does not exist on ZodObject (60+ errors)

**Location:** `src/lib/schemas/schemas.ts` (lines 129, 143, 157, 164, 173, etc.)

**Error:**
```
error TS2339: Property 'meta' does not exist on type 'ZodObject<...>'
```

**Cause:** The `zod-metadata` package extends Zod schemas with a `.meta()` method, but TypeScript doesn't see it when:
1. zod-metadata types aren't properly imported/registered
2. Different Zod versions cause type augmentation to fail

**Fix:**
- Ensure `zod-metadata` is properly initialized BEFORE any schema definitions
- Verify type augmentation is working with consistent Zod version

---

## Fix Order

1. **Fix Zod version inconsistency first** - This likely causes the `.meta()` issue
2. **Fix nuxt-module.mjs declaration** - Isolated issue, easy to fix
3. **Verify `.meta()` works** - Should resolve after Zod fix

## Progress

- [x] Fix Zod version mismatch - Simplified zod-metadata import in schemas.ts
- [x] Add declaration for nuxt-module.mjs - Created nuxt-module.d.mts
- [x] Verify all errors resolved - Both repo-client and npm-repo-md typecheck passes

## Fixes Applied

### 1. Simplified zod-metadata import (schemas.ts)
Changed from redundant registration:
```typescript
import "zod-metadata/register";
import { register } from "zod-metadata";
import zod from "zod";
register(zod);
```
To simple import:
```typescript
import "zod-metadata/register";
import { z, type ZodTypeAny } from "zod";
```

### 2. Created nuxt-module.d.mts
Added type declarations for the nuxt-module.mjs file with proper interfaces for NuxtRepoMdModuleOptions, NuxtModuleContext, etc.

# CLAUDE.md - @repo-md/git-cache

## Overview

Git repository caching layer using R2 storage to minimize clone bandwidth costs on Cloudflare Containers.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     GitCache.restore()                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Check R2 cache  │
                    │  for consumer    │
                    └────────┬─────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
              ▼                             ▼
       ┌─────────────┐              ┌─────────────┐
       │  Cache HIT  │              │ Cache MISS  │
       └──────┬──────┘              └──────┬──────┘
              │                            │
              ▼                            ▼
    ┌─────────────────┐          ┌─────────────────┐
    │ Download tar    │          │ git clone       │
    │ from R2 (FREE)  │          │ (egress cost)   │
    └────────┬────────┘          └────────┬────────┘
             │                            │
             ▼                            │
    ┌─────────────────┐                   │
    │ Extract tar     │                   │
    │ git pull (small)│                   │
    └────────┬────────┘                   │
             │                            │
             └──────────────┬─────────────┘
                            ▼
                  ┌─────────────────┐
                  │ GitCache.save() │
                  │ Upload new tar  │
                  └─────────────────┘
```

## R2 Structure

```
repo-md-git-cache/
├── git-cache/
│   ├── {consumer-id}/
│   │   ├── repo.tar.gz      # Compressed repo
│   │   └── meta.json        # Cache metadata
```

## Key Files

- `src/git-cache.ts` - Main GitCache class
- `src/types.ts` - TypeScript interfaces
- `src/optimizations.ts` - Git optimization utilities

## Usage

```typescript
import { GitCache } from "@repo-md/git-cache";

const cache = new GitCache({
  r2Bucket: env.GIT_CACHE_BUCKET,
  prefix: "git-cache",
  verbose: true
});

// Restore or clone
const result = await cache.restore({
  consumerId: "consumer-123",
  repoUrl: "https://github.com/user/repo",
  branch: "main",
  targetPath: "/tmp/build/repo",
  auth: { type: "token", token: process.env.GITHUB_TOKEN }
});

console.log(result.hit);        // true if cache hit
console.log(result.staleCommits); // commits pulled since cache

// After processing, save cache
await cache.save({
  consumerId: "consumer-123",
  repoPath: "/tmp/build/repo"
});
```

## Commands

```bash
npm run build      # Build TypeScript
npm run dev        # Watch mode
npm run typecheck  # Type check
```

## Dependencies

- `tar` - For creating/extracting tarballs
- R2 bucket binding - Cloudflare R2 for storage

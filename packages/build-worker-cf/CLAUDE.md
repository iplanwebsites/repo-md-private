# CLAUDE.md - @repo-md/build-worker-cf

## Overview

Cloudflare Container-optimized build worker for processing markdown repositories into deployable asset bundles.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          build-worker-cf Flow                                │
└─────────────────────────────────────────────────────────────────────────────┘

  GitHub/GitLab Webhook          AI Agent API            Manual Trigger
         │                            │                        │
         └────────────────────────────┼────────────────────────┘
                                      │
                                      ▼
                        ┌─────────────────────────────┐
                        │        repo-api             │
                        │   POST /repos/{id}/build    │
                        └─────────────┬───────────────┘
                                      │
                                      ▼
                        ┌─────────────────────────────┐
                        │    Cloudflare Queue         │
                        │    (repo-md-build-queue)    │
                        └─────────────┬───────────────┘
                                      │
                                      ▼
                        ┌─────────────────────────────┐
                        │    Worker (index.ts)        │
                        │    Queue Consumer           │
                        └─────────────┬───────────────┘
                                      │
                                      ▼
                        ┌─────────────────────────────┐
                        │   BuildContainer            │
                        │   (Durable Object)          │
                        │   Routes to container       │
                        └─────────────┬───────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Cloudflare Container                                  │
│                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │ 1. Restore   │───▶│ 2. Process   │───▶│ 3. Bundle    │                   │
│  │    Git Repo  │    │    Markdown  │    │    & Upload  │                   │
│  └──────────────┘    └──────────────┘    └──────────────┘                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Files

- `src/index.ts` - Worker entrypoint (queue consumer, HTTP handler)
- `src/container.ts` - Durable Object for container routing
- `src/server.ts` - HTTP server running inside container
- `src/processing/pipeline.ts` - Main build orchestration
- `src/processing/markdown.ts` - Markdown to HTML processing
- `src/image/processor.ts` - WASM image optimization
- `src/output/r2.ts` - R2 upload utilities
- `container/Dockerfile` - Container image definition
- `wrangler.jsonc` - Cloudflare Worker configuration

## Commands

```bash
# Build TypeScript
npm run build

# Build Docker container
npm run build:container

# Local development
npm run dev

# Deploy to Cloudflare
npm run deploy

# View logs
npm run tail

# Set secrets
wrangler secret put API_SECRET
```

## API Endpoints

```bash
# Queue a build job
POST /build
Authorization: Bearer $API_SECRET
Content-Type: application/json

{
  "jobId": "job-123",
  "consumerId": "consumer-abc",
  "repoUrl": "https://github.com/user/repo",
  "branch": "main",
  "contentPaths": ["docs"],
  "outputPrefix": "consumer-abc",
  "config": {
    "imageOptimization": true,
    "imageMaxWidth": 1200,
    "imageQuality": 80,
    "outputFormat": "webp",
    "generateSearchIndex": true,
    "minifyHtml": true
  }
}

# Invalidate cache
POST /cache/invalidate
Authorization: Bearer $API_SECRET
Content-Type: application/json

{"consumerId": "consumer-abc"}

# Get cache stats
GET /cache/stats/{consumerId}
Authorization: Bearer $API_SECRET

# Health check
GET /health
```

## Output Structure

```
repo-md-outputs/
├── {consumer-id}/
│   ├── latest.json              # Points to current deploy
│   ├── {deploy-id}/
│   │   ├── manifest.json
│   │   ├── content/*.html
│   │   ├── assets/*.webp
│   │   └── search-index.json
```

## Dependencies

- `@repo-md/git-cache` - Git repository caching
- `wasm-image-optimization` - WASM image processing
- `unified` + remark/rehype - Markdown processing

## Differences from repo-build-worker-ts

| Feature | worker-ts | build-worker-cf |
|---------|-----------|-----------------|
| Runtime | Node.js / Docker | CF Container |
| Images | Sharp (native) | WASM |
| Git | Direct git CLI | git + cache |
| Output | S3/local | R2 |
| Invocation | Direct/Queue | CF Queue + Worker |

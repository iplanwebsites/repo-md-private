# Processor Library Requirements

This document outlines requirements and recommendations for the `repo-processor` library when used in Cloudflare Workers/Containers environments.

## Overview

The `repo-processor` library (located at `src/modules/repo-processor/`) is a core TypeScript module that handles markdown parsing, frontmatter extraction, and content transformation. When deploying to Cloudflare Containers, there are specific requirements to ensure compatibility.

## Embeddings Flag Support

### SKIP_EMBEDDINGS Environment Variable

The build worker now supports a `SKIP_EMBEDDINGS` configuration flag that can be used to disable AI embeddings generation. This is critical for Cloudflare Workers deployment due to:

1. **Model Size Constraints**: ML models (CLIP: 300MB, MiniLM: 100MB) exceed CF Workers memory limits
2. **Cold Start Performance**: Model download would cause unacceptable latency
3. **Cost Optimization**: External embedding APIs (OpenAI, Together.ai) are more cost-effective at scale

### Usage

#### Environment Variable
```bash
export SKIP_EMBEDDINGS=true
```

#### In Job Data
```javascript
{
  jobId: "job-123",
  task: "process-all",
  skipEmbeddings: true,  // Pass directly in job data
  data: {
    // ... other job data
  }
}
```

### Implementation Details

When `SKIP_EMBEDDINGS=true` or `data.skipEmbeddings=true`:
- Post embeddings generation is skipped (src/process/buildAssets.js:624)
- Image embeddings generation is skipped (src/process/buildAssets.js:800)
- Empty embedding objects are returned with proper structure
- Vector databases (Vectra, SQLite) still function but without semantic search capability

### Return Structure When Skipped

```javascript
// Post embeddings result
{
  slugMap: {},
  hashMap: {},
  titleMap: {},
  filesProcessed: 0,
  filesReused: 0,
  error: null,
}

// Image embeddings result
{
  hashMap: {},
  pathMap: {},
  filesProcessed: 0,
  filesReused: 0,
  error: null,
}
```

## Processor Library Compatibility Requirements

### Current Architecture

The `repo-processor` module is:
- Written in TypeScript
- Compiled to JavaScript (dist/index.js)
- Embedded in the worker via local path: `"repo-processor": "./src/modules/repo-processor"`
- Uses pure JavaScript with minimal native dependencies

### Cloudflare Containers Recommendations

For optimal compatibility with Cloudflare Containers, the processor library should:

1. **Avoid Native Modules**
   - No C++ addons or compiled binaries
   - Use pure JavaScript/TypeScript implementations
   - If Sharp is needed for images, use WASM version or external API

2. **Minimize File System Operations**
   - Use in-memory processing where possible
   - Support streaming for large files
   - Consider using Cloudflare R2 for temporary storage

3. **Memory Efficiency**
   - Process files in chunks/streams
   - Clear buffers after processing
   - Avoid loading entire repositories into memory

4. **Bundle Size Optimization**
   - Keep dependencies minimal
   - Use tree-shaking compatible exports
   - Consider code splitting for large features

### Testing Processor Compatibility

```bash
# Test processor without embeddings
SKIP_EMBEDDINGS=true npm run testFullWorkflow

# Test in Docker (similar to CF Containers)
npm run test:docker
```

## Migration Path for Embeddings

When migrating to Cloudflare Containers, embeddings should be:

### Option 1: External API (Recommended)
- Use OpenAI Embeddings API ($0.00002/1K tokens)
- Use Together.ai for cheaper alternative
- Implement in separate microservice

### Option 2: Separate Worker
- Create dedicated embedding worker on GPU-enabled platform
- Call via HTTP from main worker
- Use Cloudflare Queues for async processing

### Option 3: Client-Side Generation
- Generate embeddings on user's machine (browser/CLI)
- Upload pre-computed embeddings with content
- Reduces server-side processing load

## Database Considerations

### SQLite with Vector Extensions

Current implementation uses:
- `better-sqlite3` (native module - **NOT compatible** with CF Workers)
- `sqlite-vec` for vector similarity search

### CF Workers Alternatives

1. **Neon PostgreSQL** (Recommended)
   - Serverless Postgres with pgvector
   - HTTP/WebSocket API (no native drivers needed)
   - Cost: $5-50/month

2. **Cloudflare D1** (Beta)
   - SQLite-compatible serverless database
   - Native integration with Workers
   - Free tier available

3. **sql.js** (WASM)
   - SQLite compiled to WebAssembly
   - Runs in-browser/worker
   - No persistence (save to R2)

## Performance Targets

### With Embeddings Disabled

| Metric | Target | Notes |
|--------|--------|-------|
| Memory | < 128MB | Without ML models |
| CPU Time | < 60s | Medium repo (500 posts) |
| Cold Start | < 5s | Container initialization |
| File Processing | 10-20 posts/sec | Markdown parsing only |

### Build Pipeline Stages

1. **Parse Repository** (5-10s)
   - Read markdown files
   - Extract frontmatter
   - Build link graph

2. **Process Media** (10-20s)
   - Image optimization
   - Hash generation
   - Upload to R2

3. **Generate Database** (5-10s)
   - Create SQLite/Postgres schema
   - Index content
   - Build search indexes (BM25)

4. **Upload Artifacts** (10-15s)
   - Deploy to R2
   - Invalidate CDN
   - Call webhook

**Total: ~30-55s** (without embeddings)

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `SKIP_EMBEDDINGS` | `false` | Skip AI embeddings generation |
| `SKIP_VECTRA` | `false` | Skip Vectra index creation |
| `SKIP_SQLITE_VECTORS` | `false` | Skip SQLite vector extension |
| `KEEP_TMP_FILES` | `false` | Keep temp files for debugging |
| `PURGE_TMP_DIR` | `true` | Clean up temp folders after job |
| `TEMP_DIR` | `/tmp` | Base directory for temp files |

## Implementation Checklist for Processor Library

- [ ] Remove/make optional any native module dependencies
- [ ] Implement streaming file processing
- [ ] Add memory usage monitoring and limits
- [ ] Support in-memory processing (no filesystem)
- [ ] Add `skipEmbeddings` configuration option
- [ ] Optimize bundle size (< 10MB)
- [ ] Test with Node.js 20+ (CF Workers runtime)
- [ ] Document memory requirements per operation
- [ ] Add progress callbacks for long operations
- [ ] Implement graceful degradation when features unavailable

## Next Steps

1. **Current State**: SKIP_EMBEDDINGS flag implemented in build worker
2. **Processor Lib**: May need updates if it directly calls embedding functions
3. **Testing**: Verify processor works without embeddings
4. **Migration**: Plan transition to external embedding service

## Questions?

For more details on Cloudflare Containers migration, see:
- `CLOUDFLARE_MIGRATION_INDEX.md` - Overview and decision guide
- `CF_CONTAINERS_ANALYSIS.md` - Detailed technical analysis
- `ARCHITECTURE_COMPARISON.md` - Visual architecture comparison

---

**Last Updated**: November 2, 2025
**Maintained By**: Build Worker Team

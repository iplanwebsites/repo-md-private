# CLAUDE.md

This file provides guidance for the @repo-md/worker-ts package.

## Overview

**@repo-md/worker-ts** is a modern TypeScript worker that orchestrates markdown processing using the @repo-md/processor-core plugin architecture. It serves as the production build service for repo.md, running on Cloud Run or Cloudflare Containers.

## Key Principle

**Worker = Orchestrator Only**: The worker does NOT generate any files directly. It:
1. Configures processor with plugins based on job requirements
2. Runs the processor
3. Deploys the output to R2

All file generation happens in @repo-md/processor-core and its plugins.

## Commands

```bash
npm run build      # Build TypeScript
npm run dev        # Watch mode with auto-restart
npm start          # Run production server
npm run typecheck  # Type checking
```

## Architecture

```
Job Request
    │
    ├── Configure plugins based on job data
    │      • SharpImageProcessor (always)
    │      • TransformersTextEmbedder (if !skipEmbeddings)
    │      • ClipImageEmbedder (if !skipEmbeddings)
    │      • SqliteDatabasePlugin (if !skipEmbeddings)
    │
    ├── processor.process()
    │      → ALL files generated here
    │
    └── Deploy to R2
```

## API Endpoints

### Health Check
```
GET /health
```
Returns service status and version.

### Build Assets
```
POST /build
Content-Type: application/json

{
  "jobId": "job-123",
  "repoInfo": {
    "name": "my-repo",
    "path": "/tmp/repos/my-repo",
    "distPath": "/tmp/dist/my-repo"
  },
  "skipEmbeddings": false,
  "skipDatabase": false,
  "config": {
    "imageSizes": [...],
    "imageFormat": "webp"
  }
}
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 5522) |
| `HOST` | No | Server host (default: 0.0.0.0) |
| `SKIP_EMBEDDINGS` | No | Disable embeddings (for CF Containers) |

## Dependencies

```json
{
  "@repo-md/processor-core": "workspace:*",
  "@repo-md/plugin-image-sharp": "workspace:*",
  "@repo-md/plugin-embed-transformers": "workspace:*",
  "@repo-md/plugin-embed-clip": "workspace:*",
  "@repo-md/plugin-database-sqlite": "workspace:*"
}
```

## Plugin Configuration

```typescript
// src/process/buildAssets.ts
const plugins: ProcessConfig['plugins'] = {
  imageProcessor: new SharpImageProcessor(),
};

if (!skipEmbeddings) {
  plugins.textEmbedder = new TransformersTextEmbedder();
  plugins.imageEmbedder = new ClipImageEmbedder();
  plugins.database = new SqliteDatabasePlugin();
}

const processor = new Processor(config);
await processor.initialize();
const result = await processor.process();
await processor.dispose();
```

## Differences from Legacy Worker

| Aspect | Legacy (@repo-md/worker) | Modern (@repo-md/worker-ts) |
|--------|-------------------------|----------------------------|
| Language | JavaScript | TypeScript |
| Architecture | Monolithic | Plugin-based |
| File generation | Worker + processor | Processor only |
| Embeddings | Built-in | Plugin |
| Database | Built-in | Plugin |
| Configuration | Hard-coded | Pluggable |

## Directory Structure

```
src/
├── index.ts              # Package exports
├── worker.ts             # Express server entry point
├── process/
│   └── buildAssets.ts    # Job processing (orchestration only)
└── types/
    └── job.ts            # Job data types
```

## Output

The worker returns the processor's result:

```typescript
interface BuildResult {
  jobId: string;
  assets: {
    distFolder: string;
    postsCount: number;
    mediaCount: number;
    hasEmbeddings: boolean;
    hasSimilarity: boolean;
    hasDatabase: boolean;
  };
  contentHealth: ContentHealth;
  embeddingsMetadata?: EmbeddingsMetadata;
}
```

## Deployment

### Cloud Run
```bash
docker build -t worker-ts .
docker run -p 5522:5522 worker-ts
```

### Cloudflare Containers
Set `SKIP_EMBEDDINGS=true` for memory-constrained environments.

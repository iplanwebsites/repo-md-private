# @repo-md/embedding-worker

Cloudflare Containers worker for generating text and image embeddings using Transformer.js.

## Overview

This package provides a dedicated embedding service optimized for Cloudflare Containers:

- **Pre-loaded models**: Models are downloaded during Docker build, eliminating cold-start downloads
- **Fast inference**: Uses ONNX runtime for efficient embedding generation
- **Two model types**:
  - **CLIP** (MobileCLIP S0): For text and image embeddings (~512 dimensions)
  - **Sentence** (MiniLM-L6-v2): For text embeddings (~384 dimensions)

## Image Size & Cold Start

| Image Type | Size | Cold Start (first request) |
|-----------|------|---------------------------|
| With pre-loaded models | ~800MB | ~5-10s (model loading) |
| Without pre-loading | ~100MB | ~30-60s (download + load) |

Pre-loading models during build significantly improves cold start times.

## API Endpoints

### Health & Status

```bash
# Health check
GET /health

# Ready check (models loaded)
GET /ready

# Initialize models
POST /init
```

### Text Embeddings (CLIP)

```bash
POST /embed/text
Content-Type: application/json

{
  "text": "A photo of a cat"
}

# Response
{
  "embedding": [0.123, -0.456, ...],
  "dimensions": 512,
  "durationMs": 45,
  "model": "mobileclip_s0"
}
```

### Image Embeddings (CLIP)

```bash
# By URL
POST /embed/image
{
  "url": "https://example.com/image.jpg"
}

# By base64
POST /embed/image
{
  "base64": "data:image/jpeg;base64,/9j/4AAQ..."
}
```

### Sentence Embeddings (MiniLM)

```bash
POST /embed/sentence
{
  "text": "This is a document about machine learning.",
  "instruction": "Represent the document for retrieval:" // optional
}

# Batch
POST /embed/sentence/batch
{
  "texts": ["First document", "Second document"],
  "instruction": "Represent the document:"
}
```

### Similarity

```bash
POST /similarity
{
  "a": [0.1, 0.2, ...],
  "b": [0.15, 0.25, ...]
}

# Response
{
  "similarity": 0.95
}
```

## Local Development

```bash
# Install dependencies
npm install

# Run locally (downloads models on first run)
npm run dev

# Test embeddings
npm test
```

## Docker Build

```bash
# Build image (includes model download)
npm run docker:build
# or
docker build -t repo-embedding-worker .

# Run container
npm run docker:run
# or
docker run -p 8787:8787 repo-embedding-worker

# Test in container
npm run docker:test
```

## Cloudflare Deployment

### Prerequisites

1. Cloudflare account with Workers Paid plan
2. Containers beta access (request at [Containers Beta](https://developers.cloudflare.com/containers/beta-info/))
3. Wrangler CLI installed

### Deploy

```bash
# Login to Cloudflare
npx wrangler login

# Deploy to Cloudflare Containers
npm run cf:deploy
# or
npx wrangler deploy
```

### Configuration

Edit `wrangler.jsonc` to adjust:

- `max_instances`: Number of container instances (default: 3)
- `sleepAfter`: How long to keep container alive after last request (default: 10m)

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 8787 | Server port |
| `PRELOAD_MODELS` | true | Load models on startup |
| `TRANSFORMERS_CACHE` | /app/models | Model cache directory |

## Models Used

### MobileCLIP S0 (Xenova/mobileclip_s0)
- **Purpose**: Text and image embeddings
- **Dimensions**: 512
- **Size**: ~300MB
- **Use case**: Image search, image-text similarity

### All-MiniLM-L6-v2 (Xenova/all-MiniLM-L6-v2)
- **Purpose**: Sentence embeddings
- **Dimensions**: 384
- **Size**: ~90MB
- **Use case**: Semantic search, document similarity

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Cloudflare Worker (src/worker.js)                       │
│ - Routes requests to container                          │
│ - Manages container lifecycle                           │
└───────────────────────────┬─────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│ Docker Container                                        │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Node.js Server (src/index.js)                       │ │
│ │ - HTTP endpoints                                    │ │
│ │ - Request handling                                  │ │
│ └───────────────────────────┬─────────────────────────┘ │
│                             │                           │
│ ┌─────────────────────┐ ┌───┴───────────────────────┐  │
│ │ CLIP Embedder       │ │ Sentence Embedder         │  │
│ │ - Text embedding    │ │ - Text embedding          │  │
│ │ - Image embedding   │ │ - Batch processing        │  │
│ └─────────────────────┘ └───────────────────────────┘  │
│                             │                           │
│ ┌───────────────────────────┴───────────────────────┐  │
│ │ Pre-loaded Models (/app/models)                   │  │
│ │ - mobileclip_s0 (~300MB)                          │  │
│ │ - all-MiniLM-L6-v2 (~90MB)                        │  │
│ └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Cost Considerations

### Cloudflare Containers Pricing
- Pay per container-second
- Memory: 256MB-2GB per instance
- CPU: Shared

### Optimization Tips
1. Use `sleepAfter` to keep containers warm for frequent requests
2. Limit `max_instances` to control costs
3. Use batch endpoints for multiple embeddings

## Integration with repo-build-worker

To use this embedding service from the main build worker:

```javascript
// In repo-build-worker
const EMBEDDING_URL = process.env.EMBEDDING_SERVICE_URL || 'http://localhost:8787';

async function getTextEmbedding(text) {
  const response = await fetch(`${EMBEDDING_URL}/embed/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const data = await response.json();
  return data.embedding;
}

async function getImageEmbedding(url) {
  const response = await fetch(`${EMBEDDING_URL}/embed/image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  const data = await response.json();
  return data.embedding;
}
```

## Troubleshooting

### "Model not found" errors
Models should be pre-downloaded during Docker build. Check:
```bash
docker run --rm repo-embedding-worker ls -la /app/models
```

### Slow first request
This is expected - models are loaded into memory on first embedding request.
Set `PRELOAD_MODELS=true` to load on startup instead.

### Out of memory
CLIP models require ~500MB RAM. Ensure container has sufficient memory allocation.

## License

Private - repo.md

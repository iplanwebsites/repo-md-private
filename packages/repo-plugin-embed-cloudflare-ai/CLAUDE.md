# @repo-md/plugin-embed-cloudflare-ai

Cloudflare Workers AI text embedding plugin for @repo-md/processor-core.

## Overview

This plugin provides text embeddings using Cloudflare Workers AI. It supports two modes of operation:

1. **Binding mode**: Direct access when running inside a Cloudflare Worker (fastest, no auth needed)
2. **REST API mode**: HTTP access from anywhere (requires auth)

## Available Models

| Model | Dimensions | Notes |
|-------|------------|-------|
| `@cf/baai/bge-small-en-v1.5` | 384 | Fast, English only (default) |
| `@cf/baai/bge-base-en-v1.5` | 768 | Balanced quality/speed |
| `@cf/baai/bge-large-en-v1.5` | 1024 | Best quality, English |
| `@cf/baai/bge-m3` | 1024 | Multilingual |

## Pooling Strategies

- **`cls`**: Use [CLS] token embedding - recommended for retrieval tasks (default)
- **`mean`**: Average of all token embeddings - backward compatible

**Important**: Embeddings created with different pooling strategies are NOT compatible!

## Usage

### In Cloudflare Worker (Binding Mode)

```ts
import { CloudflareAITextEmbedder } from '@repo-md/plugin-embed-cloudflare-ai';

// In your Worker handler
export default {
  async fetch(request, env) {
    const embedder = new CloudflareAITextEmbedder({
      binding: env.AI,
      pooling: 'cls',
    });

    // Use with processor
    const config = {
      plugins: {
        textEmbedder: embedder,
      },
    };
  }
};
```

Requires `wrangler.toml`:
```toml
[ai]
binding = "AI"
```

### External (REST API Mode)

```ts
import { createCloudflareAIEmbedderFromEnv } from '@repo-md/plugin-embed-cloudflare-ai';

const embedder = createCloudflareAIEmbedderFromEnv({
  modelId: '@cf/baai/bge-small-en-v1.5',
  pooling: 'cls',
});
```

Requires environment variables:
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

### On-Demand Query Embedding

This plugin is ideal for on-demand search query embedding:

```ts
// For search queries at runtime
const queryEmbedding = await embedder.embed("user search query");

// Then use for vector similarity search
const results = await vectorDB.search(queryEmbedding, { limit: 10 });
```

## Architecture Considerations

### Build Worker vs Query-Time

For build-time processing of large content sets, consider:
- Using Transformers.js locally (no network overhead)
- Pre-loading models in Docker images for CF Containers

For query-time embedding (search queries):
- Cloudflare AI is ideal - low latency, no cold start
- Use `bge-small-en-v1.5` for fastest response

### Hybrid Approach

```ts
// Build time: Use Transformers.js locally
const buildEmbedder = new TransformersTextEmbedder();

// Query time: Use Cloudflare AI
const queryEmbedder = new CloudflareAITextEmbedder({ binding: env.AI });
```

**Note**: Ensure both use the same model family and pooling strategy for compatible embeddings!

## Development

```bash
npm run build    # Build TypeScript
npm run dev      # Watch mode
npm run typecheck
```

## Dependencies

- Peer: `@repo-md/processor-core`
- No runtime dependencies (uses native fetch)

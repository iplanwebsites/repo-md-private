# CLAUDE.md

This file provides guidance for the @repo-md/plugin-embed-transformers package.

## Overview

HuggingFace Transformers.js text embedding plugin for @repo-md/processor-core. Generates text embeddings using local models with no external API calls.

## Commands

```bash
npm run build      # Build TypeScript
npm run dev        # Watch mode
npm run typecheck  # Type checking
```

## Usage

```typescript
import { Processor } from '@repo-md/processor-core';
import { TransformersTextEmbedder } from '@repo-md/plugin-embed-transformers';

const processor = new Processor({
  dir: { input: './vault' },
  plugins: {
    textEmbedder: new TransformersTextEmbedder({
      // Optional: override default model
      model: 'Xenova/all-MiniLM-L6-v2',
    }),
  },
});
```

## Features

- **Local inference**: No API keys required
- **Batch processing**: Efficient batched embedding generation
- **Model caching**: Models downloaded once and cached
- **Consistent dimensions**: 384-dimensional embeddings (MiniLM)

## Configuration

```typescript
interface TransformersEmbedderOptions {
  model?: string;  // Default: 'Xenova/all-MiniLM-L6-v2'
}
```

## Available Models

| Model | Dimensions | Use Case |
|-------|------------|----------|
| `Xenova/all-MiniLM-L6-v2` | 384 | General purpose (default) |
| `Xenova/bge-small-en-v1.5` | 384 | Retrieval-focused |
| `Xenova/e5-small-v2` | 384 | Semantic similarity |

## Output

The plugin generates `posts-embedding-hash-map.json`:

```json
{
  "model": "Xenova/all-MiniLM-L6-v2",
  "dimensions": 384,
  "generatedAt": "2025-01-27T...",
  "embeddings": {
    "abc123": [0.123, -0.456, ...],
    "def456": [0.789, -0.012, ...]
  }
}
```

## Dependencies

- `@huggingface/transformers` - ML inference
- `@repo-md/processor-core` - Peer dependency

## Memory Considerations

First run downloads the model (~90MB). For memory-constrained environments, set `SKIP_EMBEDDINGS=true` to disable.

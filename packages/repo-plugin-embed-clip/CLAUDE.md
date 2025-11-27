# CLAUDE.md

This file provides guidance for the @repo-md/plugin-embed-clip package.

## Overview

CLIP image embedding plugin for @repo-md/processor-core. Generates semantic image embeddings using CLIP models for text-to-image and image-to-image similarity search.

## Commands

```bash
npm run build      # Build TypeScript
npm run dev        # Watch mode
npm run typecheck  # Type checking
```

## Usage

```typescript
import { Processor } from '@repo-md/processor-core';
import { ClipImageEmbedder } from '@repo-md/plugin-embed-clip';

const processor = new Processor({
  dir: { input: './vault' },
  plugins: {
    imageEmbedder: new ClipImageEmbedder({
      // Optional: override default model
      model: 'Xenova/mobileclip_s0',
    }),
  },
});
```

## Features

- **Semantic search**: Find images by text description
- **Image similarity**: Find visually similar images
- **Local inference**: No API keys required
- **Multiple input types**: File path or buffer

## Configuration

```typescript
interface ClipEmbedderOptions {
  model?: string;  // Default: 'Xenova/mobileclip_s0'
}
```

## Available Models

| Model | Dimensions | Size | Speed |
|-------|------------|------|-------|
| `Xenova/mobileclip_s0` | 512 | ~100MB | Fast (default) |
| `Xenova/clip-vit-base-patch32` | 512 | ~350MB | Standard |
| `Xenova/clip-vit-large-patch14` | 768 | ~1.5GB | Best quality |

## Output

The plugin generates `media-embedding-hash-map.json`:

```json
{
  "model": "Xenova/mobileclip_s0",
  "dimensions": 512,
  "generatedAt": "2025-01-27T...",
  "embeddings": {
    "img123": [0.123, -0.456, ...],
    "img456": [0.789, -0.012, ...]
  }
}
```

## API

```typescript
class ClipImageEmbedder implements ImageEmbeddingPlugin {
  readonly name = 'imageEmbedder';
  readonly model: string;
  readonly dimensions: number;

  // Embed from file path
  embedFile(filePath: string): Promise<readonly number[]>;

  // Embed from buffer
  embedBuffer(buffer: Buffer, mimeType: string): Promise<readonly number[]>;
}
```

## Dependencies

- `@huggingface/transformers` - ML inference with CLIP
- `@repo-md/processor-core` - Peer dependency

## Memory Considerations

CLIP models require significant memory. For memory-constrained environments, use `mobileclip_s0` or set `SKIP_EMBEDDINGS=true` to disable.

# Repo-Processor & Repo-Build-Worker Refactoring Analysis

## Executive Summary

This analysis identifies opportunities to improve modularity, reduce duplication, and make `@repo-md/processor` more suitable for open-source npm distribution by implementing a plugin architecture for image processing, embeddings, and other extensible components.

---

## Current Architecture Overview

### @repo-md/processor

**Purpose**: Markdown processing library that converts Obsidian vaults to structured JSON.

**Core Responsibilities**:
- Parse markdown with unified.js pipeline (remark/rehype)
- Resolve wiki-links and markdown links
- Process media files (images, videos)
- Generate slugs and hashes
- Handle frontmatter parsing
- Render mermaid diagrams

**Key Dependencies** (26 production deps):
| Dependency | Size Impact | Purpose | Pluggable? |
|------------|-------------|---------|------------|
| `sharp` | ~100MB+ native | Image optimization/resizing | **No** (hard-coded) |
| `playwright` | ~200MB+ | Mermaid server-side rendering | **No** (hard-coded) |
| `unified/remark/rehype` | ~2MB | Markdown pipeline | Core, keep |
| `gray-matter` | ~50KB | Frontmatter parsing | Core, keep |
| `@sindresorhus/slugify` | ~20KB | Slug generation | Core, keep |

**Bundle Size Concern**: The current processor is **~300MB+ installed** due to Sharp and Playwright.

### @repo-md/worker

**Purpose**: Full build pipeline orchestrator with proprietary features.

**Core Responsibilities**:
- Invoke processor for markdown/media processing
- Generate text embeddings (HuggingFace Transformers)
- Generate image embeddings (CLIP models)
- Build SQLite databases with vector search
- Compute post similarity
- Deploy to R2 storage
- WordPress import
- AI-powered project generation

**Key Dependencies**:
| Dependency | Purpose | Should Stay in Worker? |
|------------|---------|------------------------|
| `@huggingface/transformers` | Text/image embeddings | **Yes** (proprietary) |
| `better-sqlite3` | SQLite database | **Yes** (proprietary) |
| `sqlite-vec` | Vector search | **Yes** (proprietary) |
| `vectra` | Vector database | **Yes** (proprietary) |
| `openai` | AI features | **Yes** (proprietary) |
| `@anthropic-ai/claude-code` | AI features | **Yes** (proprietary) |

---

## Duplication Identified

### 1. IssueCollector (High Priority)

**Location A**: `packages/repo-processor/src/services/issueCollector.ts` (338 lines)
**Location B**: `packages/repo-build-worker/src/services/issueCollector.js` (232 lines)

**Analysis**:
- Both implement similar patterns for collecting processing issues
- Processor version is TypeScript with rich typing
- Worker version is JavaScript with worker-specific error types (embedding, database, deployment)

**Recommendation**: Create a shared base interface/class, extend for specific needs:
```typescript
// @repo-md/processor-core
export interface IssueCollectorBase { ... }

// Processor adds: broken-link, missing-media, mermaid-error
// Worker adds: embedding-error, database-error, deployment-error
```

### 2. Image Size Configurations

**Location A**: `packages/repo-processor/src/process/processMedia.ts:37-44`
```javascript
const DEFAULT_IMAGE_SIZES = [
  { width: 320, height: null, suffix: "xs" },
  { width: 640, height: null, suffix: "sm" },
  { width: 1024, height: null, suffix: "md" },
  { width: 1920, height: null, suffix: "lg" },
  { width: 3840, height: null, suffix: "xl" },
];
```

**Location B**: `packages/repo-build-worker/src/process/buildAssets.js:278-292`
```javascript
const DEFAULT_IMAGE_SIZES = [
  { width: 100, height: null, suffix: "xs" },
  { width: 300, height: null, suffix: "sm" },
  { width: 700, height: null, suffix: "md" },
  { width: 1400, height: null, suffix: "lg" },
  { width: 2160, height: null, suffix: "xl" },
];
```

**Issue**: Different defaults in each location, worker overrides processor defaults.

**Recommendation**: Single source of truth with ability to override via config.

### 3. Hash Calculation Utilities

**Location A**: `packages/repo-processor/src/lib/utility.ts:38-54`
**Location B**: `packages/repo-build-worker/src/process/computeImageEmbeddings.js:400-450`

Both implement SHA-256 hashing with slightly different approaches.

**Recommendation**: Export from processor, import in worker.

---

## Tight Coupling Issues

### 1. Direct File Copy Pattern

```json
// repo-processor/package.json:8
"postbuild": "cp -r dist package.json ../repo-build-worker/src/modules/repo-processor/"
```

The processor is literally copied into the worker's source tree, creating:
- Version synchronization issues
- Duplicate code in the monorepo
- Unclear dependency boundaries

### 2. Local File Dependency

```json
// repo-build-worker/package.json:69
"@repo-md/processor": "file:../repo-processor"
```

This prevents:
- Independent versioning
- npm publication
- External consumption

### 3. Hard-Coded Sharp Dependency

`processMedia.ts` directly imports and uses Sharp:
```typescript
import sharp from "sharp";
// ... used directly throughout
```

Sharp has known issues:
- Native compilation requirements
- Platform-specific builds
- Heavy bundle size (~100MB)
- Doesn't work in Cloudflare Workers, some serverless environments

### 4. Hard-Coded Playwright Dependency

`rehypeMermaidWrapper.ts` depends on Playwright for server-side mermaid rendering:
- Requires browser binary installation
- ~200MB+ disk space
- Not suitable for edge/serverless

---

## Proposed Plugin Architecture

### Core Design Principles

1. **Interface-First Design**: Define contracts before implementations
2. **Optional Heavy Dependencies**: Image processing, mermaid rendering should be opt-in
3. **Sensible Defaults**: Work out-of-box with no plugins (skip processing)
4. **Dependency Injection**: Pass plugins via configuration

### Package Restructuring

```
@repo-md/processor-core      # Core markdown processing (~2MB)
@repo-md/image-sharp         # Sharp-based image processing
@repo-md/image-jimp          # Jimp-based image processing (pure JS)
@repo-md/image-cloudinary    # Cloud-based image processing
@repo-md/mermaid-playwright  # Playwright mermaid renderer
@repo-md/mermaid-kroki       # Kroki.io mermaid renderer
@repo-md/embeddings          # Embedding interfaces & implementations
@repo-md/worker              # Full orchestrator (proprietary)
```

### 1. Image Processor Plugin Interface

```typescript
// @repo-md/processor-core/src/plugins/imageProcessor.ts

export interface ImageSize {
  width: number | null;
  height: number | null;
  suffix: string;
}

export interface ImageFormat {
  format: 'webp' | 'avif' | 'jpeg' | 'png';
  quality?: number;
  options?: Record<string, unknown>;
}

export interface ImageProcessorResult {
  outputPath: string;
  publicPath: string;
  width: number;
  height: number;
  format: string;
  size: number;
}

export interface ImageProcessorPlugin {
  name: string;

  /** Check if this processor can handle the file */
  canProcess(filePath: string, mimeType: string): boolean;

  /** Get image metadata without processing */
  getMetadata(filePath: string): Promise<{
    width: number;
    height: number;
    format: string;
  }>;

  /** Process/optimize an image */
  process(
    inputPath: string,
    outputPath: string,
    options: {
      size: ImageSize;
      format: ImageFormat;
    }
  ): Promise<ImageProcessorResult>;

  /** Copy file without processing (for non-images) */
  copy(inputPath: string, outputPath: string): Promise<void>;
}

// No-op implementation for when no processor is configured
export class NoOpImageProcessor implements ImageProcessorPlugin {
  name = 'noop';

  canProcess() { return false; }

  async getMetadata() {
    return { width: 0, height: 0, format: 'unknown' };
  }

  async process() {
    throw new Error('No image processor configured');
  }

  async copy(inputPath: string, outputPath: string) {
    // Just copy the file as-is
    await fs.copyFile(inputPath, outputPath);
  }
}
```

### 2. Sharp Implementation (Separate Package)

```typescript
// @repo-md/image-sharp/src/index.ts

import sharp from 'sharp';
import type { ImageProcessorPlugin, ImageSize, ImageFormat } from '@repo-md/processor-core';

export class SharpImageProcessor implements ImageProcessorPlugin {
  name = 'sharp';

  canProcess(filePath: string, mimeType: string): boolean {
    return /\.(jpg|jpeg|png|webp|avif|gif)$/i.test(filePath);
  }

  async getMetadata(filePath: string) {
    const meta = await sharp(filePath).metadata();
    return {
      width: meta.width || 0,
      height: meta.height || 0,
      format: meta.format || 'unknown'
    };
  }

  async process(inputPath: string, outputPath: string, options: {
    size: ImageSize;
    format: ImageFormat;
  }) {
    let pipeline = sharp(inputPath);

    // Resize
    if (options.size.width || options.size.height) {
      pipeline = pipeline.resize({
        width: options.size.width || undefined,
        height: options.size.height || undefined,
        withoutEnlargement: true,
        fit: 'inside'
      });
    }

    // Convert format
    switch (options.format.format) {
      case 'webp':
        pipeline = pipeline.webp({ quality: options.format.quality || 80 });
        break;
      case 'avif':
        pipeline = pipeline.avif({ quality: options.format.quality || 65 });
        break;
      case 'jpeg':
        pipeline = pipeline.jpeg({ quality: options.format.quality || 85 });
        break;
      case 'png':
        pipeline = pipeline.png(options.format.options);
        break;
    }

    await pipeline.toFile(outputPath);

    const stats = await fs.stat(outputPath);
    const meta = await this.getMetadata(outputPath);

    return {
      outputPath,
      publicPath: '', // Set by caller
      width: meta.width,
      height: meta.height,
      format: options.format.format,
      size: stats.size
    };
  }

  async copy(inputPath: string, outputPath: string) {
    await fs.copyFile(inputPath, outputPath);
  }
}
```

### 3. Mermaid Renderer Plugin Interface

```typescript
// @repo-md/processor-core/src/plugins/mermaidRenderer.ts

export type MermaidStrategy = 'img-png' | 'img-svg' | 'inline-svg' | 'pre-mermaid';

export interface MermaidRendererPlugin {
  name: string;

  /** Render mermaid code to the specified format */
  render(
    code: string,
    options: {
      strategy: MermaidStrategy;
      dark?: boolean;
    }
  ): Promise<{
    output: string;  // SVG string, PNG base64, or original code
    strategy: MermaidStrategy;
  }>;

  /** Check if renderer is available */
  isAvailable(): Promise<boolean>;
}

// Default: passthrough (keep as code block)
export class PassthroughMermaidRenderer implements MermaidRendererPlugin {
  name = 'passthrough';

  async render(code: string) {
    return {
      output: code,
      strategy: 'pre-mermaid' as const
    };
  }

  async isAvailable() {
    return true;
  }
}
```

### 4. Embedding Provider Plugin Interface

```typescript
// @repo-md/embeddings/src/index.ts

export interface TextEmbeddingProvider {
  name: string;
  model: string;
  dimensions: number;

  /** Generate embedding for text */
  embed(text: string): Promise<number[]>;

  /** Batch embed multiple texts */
  batchEmbed(texts: string[]): Promise<number[][]>;

  /** Check if provider is ready */
  isReady(): Promise<boolean>;

  /** Initialize provider (load models, etc.) */
  initialize(): Promise<void>;
}

export interface ImageEmbeddingProvider {
  name: string;
  model: string;
  dimensions: number;

  /** Generate embedding for image file */
  embedFile(filePath: string): Promise<number[]>;

  /** Generate embedding for image buffer */
  embedBuffer(buffer: Buffer, mimeType: string): Promise<number[]>;

  /** Check if provider is ready */
  isReady(): Promise<boolean>;

  /** Initialize provider */
  initialize(): Promise<void>;
}

// HuggingFace implementation
export class HuggingFaceTextEmbedder implements TextEmbeddingProvider {
  name = 'huggingface';
  model = 'Xenova/all-MiniLM-L6-v2';
  dimensions = 384;

  private pipeline: any = null;

  async initialize() {
    const { pipeline } = await import('@huggingface/transformers');
    this.pipeline = await pipeline('feature-extraction', this.model);
  }

  async isReady() {
    return this.pipeline !== null;
  }

  async embed(text: string): Promise<number[]> {
    if (!this.pipeline) await this.initialize();
    const result = await this.pipeline(text, { pooling: 'mean', normalize: true });
    return result.tolist()[0];
  }

  async batchEmbed(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map(t => this.embed(t)));
  }
}

// OpenAI implementation
export class OpenAITextEmbedder implements TextEmbeddingProvider {
  name = 'openai';
  model = 'text-embedding-3-small';
  dimensions = 1536;

  constructor(private apiKey: string) {}

  async initialize() {}
  async isReady() { return true; }

  async embed(text: string): Promise<number[]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ input: text, model: this.model })
    });
    const data = await response.json();
    return data.data[0].embedding;
  }

  async batchEmbed(texts: string[]): Promise<number[][]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ input: texts, model: this.model })
    });
    const data = await response.json();
    return data.data.map((d: any) => d.embedding);
  }
}
```

### 5. Updated ProcessConfig with Plugins

```typescript
// @repo-md/processor-core/src/types/config.ts

import type { ImageProcessorPlugin } from '../plugins/imageProcessor';
import type { MermaidRendererPlugin } from '../plugins/mermaidRenderer';

export interface ProcessConfig {
  // ... existing config options ...

  /** Plugin configuration */
  plugins?: {
    /** Image processor plugin (default: NoOpImageProcessor) */
    imageProcessor?: ImageProcessorPlugin;

    /** Mermaid renderer plugin (default: PassthroughMermaidRenderer) */
    mermaidRenderer?: MermaidRendererPlugin;
  };
}
```

### 6. Usage Example

```typescript
// User code - minimal dependencies
import { RepoProcessor } from '@repo-md/processor-core';

const processor = new RepoProcessor({
  dir: { input: './vault' },
  // No plugins = no image optimization, mermaid passthrough
});

// User code - with image processing
import { RepoProcessor } from '@repo-md/processor-core';
import { SharpImageProcessor } from '@repo-md/image-sharp';

const processor = new RepoProcessor({
  dir: { input: './vault' },
  plugins: {
    imageProcessor: new SharpImageProcessor()
  }
});

// User code - full featured
import { RepoProcessor } from '@repo-md/processor-core';
import { SharpImageProcessor } from '@repo-md/image-sharp';
import { PlaywrightMermaidRenderer } from '@repo-md/mermaid-playwright';

const processor = new RepoProcessor({
  dir: { input: './vault' },
  plugins: {
    imageProcessor: new SharpImageProcessor(),
    mermaidRenderer: new PlaywrightMermaidRenderer()
  }
});
```

---

## Worker Proprietary Features

Keep these **exclusive** to `@repo-md/worker`:

1. **Embeddings Pipeline**
   - Text embeddings (HuggingFace/OpenAI)
   - Image embeddings (CLIP)
   - Similarity computation
   - Vector database (Vectra)

2. **Database Features**
   - SQLite generation with `better-sqlite3`
   - Vector search with `sqlite-vec`
   - Frontmatter schema extraction

3. **Deployment Features**
   - R2 upload/management
   - Asset optimization
   - Cache invalidation

4. **AI Features**
   - Project generation from briefs
   - WordPress import
   - Content enrichment

---

## Implementation Roadmap

### Phase 1: Extract Core (2-3 weeks)

1. Create `@repo-md/processor-core` package
2. Move markdown pipeline (remark/rehype) to core
3. Define plugin interfaces
4. Implement no-op default plugins
5. Remove Sharp/Playwright from core

**Result**: Core package installable with `npm install @repo-md/processor-core` at ~2MB

### Phase 2: Create Plugin Packages (1-2 weeks)

1. `@repo-md/image-sharp` - Sharp implementation
2. `@repo-md/image-jimp` - Pure JS alternative
3. `@repo-md/mermaid-playwright` - Playwright implementation
4. `@repo-md/mermaid-kroki` - Kroki.io API implementation

### Phase 3: Refactor Worker (1-2 weeks)

1. Update worker to use new plugin architecture
2. Remove duplicate code
3. Keep embeddings/database as worker-exclusive
4. Clean up issue collector duplication

### Phase 4: Documentation & Publication (1 week)

1. Document plugin APIs
2. Create migration guide
3. Publish packages to npm
4. Update README examples

---

## Benefits Summary

| Aspect | Current | After Refactoring |
|--------|---------|-------------------|
| Core Install Size | ~300MB | ~2MB |
| npm Publishable | No | Yes |
| Open Source Ready | No (heavy deps) | Yes (core) |
| Edge/Serverless | No | Yes (core) |
| Customizable | No | Yes (plugins) |
| Duplicate Code | Yes | Minimal |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking changes for existing users | Provide migration guide, keep old package as wrapper |
| Plugin API too rigid | Design for extensibility, use interfaces not classes |
| Performance overhead from plugins | Lazy loading, optional async initialization |
| Documentation debt | Document as we build |

---

## Next Steps

1. **Review this proposal** with the team
2. **Decide on package names** and structure
3. **Start Phase 1** with core extraction
4. **Set up CI/CD** for multi-package publishing

---

*Generated: 2025-01-27*
*Author: Claude Code Analysis*

# Repo-Processor & Repo-Build-Worker Refactoring Analysis

## Executive Summary

This analysis identifies opportunities to improve modularity, reduce duplication, and make `@repo-md/processor` more suitable for open-source npm distribution by implementing a plugin architecture for image processing, embeddings, and other extensible components.

**Key Insight**: The Processor should be the **single source of file generation**. The Worker should only **orchestrate** (configure + run the processor).

---

## Current Architecture Problems

### The "Many Writers" Problem

Currently, both packages write to the same `dist/` folder independently:

```
Worker receives job
    │
    ├─► processor.process()      → writes posts.json, media files
    ├─► computePostEmbeddings()  → writes embedding files (WORKER CODE)
    ├─► computeImageEmbeddings() → writes image embedding files (WORKER CODE)
    ├─► createVectraIndex()      → writes vectra index (WORKER CODE)
    ├─► buildSqliteDatabase()    → writes sqlite db (WORKER CODE)
    └─► publishR2()              → uploads to R2
```

**Problems**:
- Worker has file generation logic that should be in processor
- Tight coupling between worker and output structure
- Can't use processor independently for embeddings/database
- Hard to test, hard to extend

### Proposed Architecture

```
Worker receives job
    │
    ├─► Configure processor with plugins
    │       • imageProcessor: SharpImageProcessor
    │       • textEmbedder: HuggingFaceTextEmbedder
    │       • imageEmbedder: ClipImageEmbedder
    │       • similarity: SimilarityPlugin (requires: textEmbedder)
    │       • database: SqlitePlugin (requires: textEmbedder)
    │
    ├─► processor.process()  → ALL FILES GENERATED HERE
    │       • posts.json
    │       • media files
    │       • embeddings (if plugin provided)
    │       • similarity maps (if plugin provided)
    │       • sqlite database (if plugin provided)
    │
    └─► publishR2()  → uploads result
```

**Benefits**:
- Single source of file generation
- Worker is pure orchestration
- Processor can be used standalone with any combination of plugins
- Clear plugin dependencies

---

## Current Architecture Overview

### @repo-md/processor

**Purpose**: Markdown processing library that converts Obsidian vaults to structured JSON.

**Key Dependencies** (26 production deps):
| Dependency | Size Impact | Purpose | Pluggable? |
|------------|-------------|---------|------------|
| `sharp` | ~100MB+ native | Image optimization/resizing | **No** (hard-coded) |
| `playwright` | ~200MB+ | Mermaid server-side rendering | **No** (hard-coded) |
| `unified/remark/rehype` | ~2MB | Markdown pipeline | Core, keep |
| `gray-matter` | ~50KB | Frontmatter parsing | Core, keep |

**Bundle Size Concern**: ~300MB+ installed due to Sharp and Playwright.

### @repo-md/worker

**Purpose**: Full build pipeline orchestrator.

**Current Responsibilities** (should be reduced):
- ~~Generate text embeddings~~ → Move to processor plugin
- ~~Generate image embeddings~~ → Move to processor plugin
- ~~Build SQLite databases~~ → Move to processor plugin
- ~~Compute post similarity~~ → Move to processor plugin
- Invoke processor ✓ (keep)
- Deploy to R2 ✓ (keep)
- WordPress import ✓ (keep)
- AI-powered project generation ✓ (keep)

---

## Duplication Identified

### 1. IssueCollector (High Priority)

**Location A**: `packages/repo-processor/src/services/issueCollector.ts` (338 lines)
**Location B**: `packages/repo-build-worker/src/services/issueCollector.js` (232 lines)

**Recommendation**: Single implementation in processor, extended by worker-specific error types.

### 2. Image Size Configurations

**Location A**: `packages/repo-processor/src/process/processMedia.ts:37-44`
```javascript
const DEFAULT_IMAGE_SIZES = [
  { width: 320, suffix: "xs" }, { width: 640, suffix: "sm" },
  { width: 1024, suffix: "md" }, { width: 1920, suffix: "lg" },
  { width: 3840, suffix: "xl" }
];
```

**Location B**: `packages/repo-build-worker/src/process/buildAssets.js:278-292`
```javascript
const DEFAULT_IMAGE_SIZES = [
  { width: 100, suffix: "xs" }, { width: 300, suffix: "sm" },
  { width: 700, suffix: "md" }, { width: 1400, suffix: "lg" },
  { width: 2160, suffix: "xl" }
];
```

**Issue**: Different defaults, worker overrides processor.

### 3. Hash Calculation Utilities

Both packages implement SHA-256 hashing with slightly different approaches.

---

## Proposed Plugin Architecture

### Core Design Principles

1. **Processor = Single File Generator**: All output files come from processor
2. **Worker = Orchestrator**: Configure and run processor, then deploy
3. **Plugins Have Dependencies**: Some plugins require others
4. **Separate Concerns**: Text embeddings ≠ Image embeddings

### Package Structure

```
@repo-md/processor              # Core + plugin system (~2MB base)
├── plugins/
│   ├── image/                  # Image processing plugins
│   ├── embeddings/             # Embedding plugins
│   ├── database/               # Database plugins
│   └── mermaid/                # Mermaid rendering plugins

# Separate npm packages for heavy dependencies:
@repo-md/plugin-image-sharp         # Sharp-based image processing
@repo-md/plugin-image-jimp          # Pure JS alternative
@repo-md/plugin-embed-hf            # HuggingFace text embeddings
@repo-md/plugin-embed-openai        # OpenAI text embeddings
@repo-md/plugin-embed-cloudflare    # Cloudflare AI Gateway embeddings
@repo-md/plugin-embed-clip          # CLIP image embeddings
@repo-md/plugin-database-sqlite     # SQLite + vector search
@repo-md/plugin-mermaid-playwright  # Playwright mermaid
@repo-md/plugin-mermaid-kroki       # Kroki.io API

@repo-md/worker                     # Orchestrator (proprietary)
```

---

## Plugin Interfaces

### 1. Base Plugin Interface

```typescript
// @repo-md/processor/src/plugins/base.ts

export interface PluginContext {
  /** Output directory for all generated files */
  outputDir: string;
  /** Issue collector for reporting problems */
  issues: IssueCollector;
  /** Logger */
  log: (level: number, message: string) => void;
  /** Access to other plugins (for dependencies) */
  getPlugin<T>(name: string): T | undefined;
}

export interface Plugin {
  /** Unique plugin name */
  name: string;

  /** Plugin dependencies (other plugin names required) */
  requires?: string[];

  /** Initialize plugin with context */
  initialize(context: PluginContext): Promise<void>;

  /** Check if plugin is ready */
  isReady(): boolean;
}
```

### 2. Image Processor Plugin

```typescript
// @repo-md/processor/src/plugins/image/types.ts

export interface ImageProcessorPlugin extends Plugin {
  name: 'imageProcessor';

  canProcess(filePath: string): boolean;

  getMetadata(filePath: string): Promise<{
    width: number;
    height: number;
    format: string;
  }>;

  process(input: string, output: string, options: {
    width?: number;
    height?: number;
    format: 'webp' | 'avif' | 'jpeg' | 'png';
    quality?: number;
  }): Promise<ImageResult>;

  copy(input: string, output: string): Promise<void>;
}

// No-op default - just copies files
export class CopyOnlyImageProcessor implements ImageProcessorPlugin {
  name = 'imageProcessor' as const;

  canProcess() { return false; }
  async getMetadata() { return { width: 0, height: 0, format: 'unknown' }; }
  async process() { throw new Error('No image processor - use copy()'); }
  async copy(input, output) { await fs.copyFile(input, output); }
}
```

### 3. Text Embedding Plugin (Separate from Image!)

```typescript
// @repo-md/processor/src/plugins/embeddings/text.ts

export interface TextEmbeddingPlugin extends Plugin {
  name: 'textEmbedder';

  /** Model identifier */
  model: string;

  /** Embedding dimensions */
  dimensions: number;

  /** Embed single text */
  embed(text: string): Promise<number[]>;

  /** Embed multiple texts (batch) */
  batchEmbed(texts: string[]): Promise<number[][]>;
}

// --- IMPLEMENTATIONS IN SEPARATE PACKAGES ---

// @repo-md/plugin-embed-hf
export class HuggingFaceTextEmbedder implements TextEmbeddingPlugin {
  name = 'textEmbedder' as const;
  model = 'Xenova/all-MiniLM-L6-v2';
  dimensions = 384;
  // Uses @huggingface/transformers
}

// @repo-md/plugin-embed-openai
export class OpenAITextEmbedder implements TextEmbeddingPlugin {
  name = 'textEmbedder' as const;
  model = 'text-embedding-3-small';
  dimensions = 1536;
  // Uses OpenAI API
}

// @repo-md/plugin-embed-cloudflare
export class CloudflareTextEmbedder implements TextEmbeddingPlugin {
  name = 'textEmbedder' as const;
  model = '@cf/baai/bge-base-en-v1.5';
  dimensions = 768;

  constructor(private config: {
    accountId: string;
    apiToken: string;
    gateway?: string;  // AI Gateway for caching/rate limiting
  }) {}

  async embed(text: string): Promise<number[]> {
    const url = this.config.gateway
      ? `https://gateway.ai.cloudflare.com/v1/${this.config.accountId}/${this.config.gateway}/workers-ai/@cf/baai/bge-base-en-v1.5`
      : `https://api.cloudflare.com/client/v4/accounts/${this.config.accountId}/ai/run/@cf/baai/bge-base-en-v1.5`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.config.apiToken}` },
      body: JSON.stringify({ text: [text] })
    });
    const data = await response.json();
    return data.result.data[0];
  }
}
```

### 4. Image Embedding Plugin (Separate!)

```typescript
// @repo-md/processor/src/plugins/embeddings/image.ts

export interface ImageEmbeddingPlugin extends Plugin {
  name: 'imageEmbedder';

  model: string;
  dimensions: number;

  /** Embed image from file path */
  embedFile(filePath: string): Promise<number[]>;

  /** Embed image from buffer */
  embedBuffer(buffer: Buffer, mimeType: string): Promise<number[]>;
}

// @repo-md/plugin-embed-clip
export class ClipImageEmbedder implements ImageEmbeddingPlugin {
  name = 'imageEmbedder' as const;
  model = 'Xenova/mobileclip_s0';
  dimensions = 512;
  // Uses @huggingface/transformers CLIP models
}

// @repo-md/plugin-embed-cloudflare-image
export class CloudflareImageEmbedder implements ImageEmbeddingPlugin {
  name = 'imageEmbedder' as const;
  model = '@cf/openai/clip-vit-base-patch32';
  dimensions = 512;
  // Uses Cloudflare AI
}
```

### 5. Similarity Plugin (Has Dependency!)

```typescript
// @repo-md/processor/src/plugins/similarity/types.ts

export interface SimilarityPlugin extends Plugin {
  name: 'similarity';

  /** THIS PLUGIN REQUIRES textEmbedder */
  requires: ['textEmbedder'];

  /** Compute similarity between two posts */
  computeSimilarity(embeddingA: number[], embeddingB: number[]): number;

  /** Generate similarity map for all posts */
  generateSimilarityMap(posts: ProcessedPost[]): Promise<{
    /** pairKey (hash1-hash2) -> similarity score */
    similarityMap: Record<string, number>;
    /** hash -> array of similar post hashes (sorted by similarity) */
    similarPostsMap: Record<string, string[]>;
  }>;
}

export class CosineSimilarityPlugin implements SimilarityPlugin {
  name = 'similarity' as const;
  requires = ['textEmbedder'] as const;

  private textEmbedder!: TextEmbeddingPlugin;

  async initialize(context: PluginContext) {
    // Get required plugin
    this.textEmbedder = context.getPlugin<TextEmbeddingPlugin>('textEmbedder')!;
    if (!this.textEmbedder) {
      throw new Error('SimilarityPlugin requires textEmbedder plugin');
    }
  }

  computeSimilarity(a: number[], b: number[]): number {
    // Cosine similarity
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async generateSimilarityMap(posts: ProcessedPost[]) {
    // Generate embeddings using the textEmbedder plugin
    const embeddings = await Promise.all(
      posts.map(p => this.textEmbedder.embed(p.plain || ''))
    );

    // Compute pairwise similarity...
    // Return maps...
  }
}
```

### 6. Database Plugin (Has Dependencies!)

```typescript
// @repo-md/processor/src/plugins/database/types.ts

export interface DatabasePlugin extends Plugin {
  name: 'database';

  /** Can optionally use embeddings for vector search */
  requires?: ['textEmbedder'];  // Optional dependency

  /** Build database from processed data */
  build(data: {
    posts: ProcessedPost[];
    media: ProcessedMedia[];
    embeddings?: Record<string, number[]>;  // If textEmbedder available
  }): Promise<{
    databasePath: string;
    tables: string[];
    rowCounts: Record<string, number>;
  }>;
}

// @repo-md/plugin-database-sqlite
export class SqliteDatabasePlugin implements DatabasePlugin {
  name = 'database' as const;
  requires = ['textEmbedder'];  // Optional but recommended

  private textEmbedder?: TextEmbeddingPlugin;

  async initialize(context: PluginContext) {
    // textEmbedder is optional - vector search disabled without it
    this.textEmbedder = context.getPlugin<TextEmbeddingPlugin>('textEmbedder');
    if (!this.textEmbedder) {
      context.log(1, '⚠️ No textEmbedder plugin - vector search disabled');
    }
  }

  async build(data) {
    const db = new Database(path.join(this.outputDir, 'repo.db'));

    // Create tables...
    // If textEmbedder available, create vector search table...

    return { databasePath: '...', tables: [...], rowCounts: {...} };
  }
}
```

---

## Updated Processor Configuration

```typescript
// @repo-md/processor/src/types/config.ts

export interface ProcessConfig {
  dir: {
    input: string;
    output?: string;
  };

  // ... existing options ...

  /** Plugins to use */
  plugins?: {
    /** Image processor (default: CopyOnlyImageProcessor) */
    imageProcessor?: ImageProcessorPlugin;

    /** Text embedding provider */
    textEmbedder?: TextEmbeddingPlugin;

    /** Image embedding provider */
    imageEmbedder?: ImageEmbeddingPlugin;

    /** Post similarity generator (requires: textEmbedder) */
    similarity?: SimilarityPlugin;

    /** Database generator */
    database?: DatabasePlugin;

    /** Mermaid renderer */
    mermaidRenderer?: MermaidRendererPlugin;
  };
}
```

---

## Processor Output Structure

With the new architecture, the processor generates ALL files:

```
dist/
├── posts.json                    # Always generated
├── posts-slug-map.json           # Always generated
├── posts-path-map.json           # Always generated
├── _posts/                       # If exportPosts enabled
│   └── {hash}.json
├── _medias/                      # Always generated (copies or optimized)
│   └── {hash}.{ext}
├── medias.json                   # Always generated
├── media-path-map.json           # Always generated
│
│ # --- PLUGIN-GENERATED FILES ---
│
├── posts-embedding-hash-map.json # If textEmbedder plugin
├── media-embedding-hash-map.json # If imageEmbedder plugin
├── posts-similarity.json         # If similarity plugin
├── posts-similar-hash.json       # If similarity plugin
├── repo.db                       # If database plugin
├── graph.json                    # If relationship tracking
└── processor-issues.json         # Always generated
```

---

## Worker Simplification

The worker becomes pure orchestration:

```typescript
// @repo-md/worker/src/process/buildAssets.js

import { RepoProcessor } from '@repo-md/processor';
import { SharpImageProcessor } from '@repo-md/plugin-image-sharp';
import { HuggingFaceTextEmbedder } from '@repo-md/plugin-embed-hf';
import { ClipImageEmbedder } from '@repo-md/plugin-embed-clip';
import { CosineSimilarityPlugin } from '@repo-md/processor/plugins/similarity';
import { SqliteDatabasePlugin } from '@repo-md/plugin-database-sqlite';

async function buildAssets(data) {
  const logger = data.logger;

  // Configure processor with plugins
  const processor = new RepoProcessor({
    dir: {
      input: data.repoInfo.path,
      output: data.repoInfo.distPath
    },
    plugins: {
      imageProcessor: new SharpImageProcessor(),
      textEmbedder: new HuggingFaceTextEmbedder(),
      imageEmbedder: new ClipImageEmbedder(),
      similarity: new CosineSimilarityPlugin(),
      database: new SqliteDatabasePlugin()
    }
  });

  // Single call generates EVERYTHING
  const result = await processor.process();

  // Worker just returns the result
  return {
    ...data,
    assets: {
      processed: true,
      distFolder: result.buildDir,
      filesCount: result.vaultData.length,
      mediaCount: result.mediaData.length,
      // Plugin results included automatically
      hasEmbeddings: !!result.textEmbeddings,
      hasSimilarity: !!result.similarity,
      hasDatabase: !!result.database
    }
  };
}
```

---

## Usage Examples

### Minimal (Open Source Friendly)

```typescript
import { RepoProcessor } from '@repo-md/processor';

// No plugins = minimal processing
const processor = new RepoProcessor({
  dir: { input: './vault' }
});

const result = await processor.process();
// Generates: posts.json, media copies (not optimized)
```

### With Image Optimization

```typescript
import { RepoProcessor } from '@repo-md/processor';
import { SharpImageProcessor } from '@repo-md/plugin-image-sharp';

const processor = new RepoProcessor({
  dir: { input: './vault' },
  plugins: {
    imageProcessor: new SharpImageProcessor()
  }
});
```

### With Text Embeddings (HuggingFace)

```typescript
import { RepoProcessor } from '@repo-md/processor';
import { HuggingFaceTextEmbedder } from '@repo-md/plugin-embed-hf';

const processor = new RepoProcessor({
  dir: { input: './vault' },
  plugins: {
    textEmbedder: new HuggingFaceTextEmbedder()
  }
});

// Generates: posts-embedding-hash-map.json
```

### With Text Embeddings (Cloudflare AI Gateway)

```typescript
import { RepoProcessor } from '@repo-md/processor';
import { CloudflareTextEmbedder } from '@repo-md/plugin-embed-cloudflare';

const processor = new RepoProcessor({
  dir: { input: './vault' },
  plugins: {
    textEmbedder: new CloudflareTextEmbedder({
      accountId: process.env.CF_ACCOUNT_ID,
      apiToken: process.env.CF_API_TOKEN,
      gateway: 'my-ai-gateway'  // Optional: use AI Gateway
    })
  }
});
```

### Full Featured (Worker Default)

```typescript
import { RepoProcessor } from '@repo-md/processor';
import { SharpImageProcessor } from '@repo-md/plugin-image-sharp';
import { HuggingFaceTextEmbedder } from '@repo-md/plugin-embed-hf';
import { ClipImageEmbedder } from '@repo-md/plugin-embed-clip';
import { CosineSimilarityPlugin } from '@repo-md/processor/plugins/similarity';
import { SqliteDatabasePlugin } from '@repo-md/plugin-database-sqlite';
import { PlaywrightMermaidRenderer } from '@repo-md/plugin-mermaid-playwright';

const processor = new RepoProcessor({
  dir: { input: './vault' },
  plugins: {
    imageProcessor: new SharpImageProcessor(),
    textEmbedder: new HuggingFaceTextEmbedder(),
    imageEmbedder: new ClipImageEmbedder(),
    similarity: new CosineSimilarityPlugin(),  // Requires textEmbedder
    database: new SqliteDatabasePlugin(),       // Uses textEmbedder if available
    mermaidRenderer: new PlaywrightMermaidRenderer()
  }
});

// Generates ALL files
const result = await processor.process();
```

---

## Plugin Dependency Resolution

The processor validates and initializes plugins in order:

```typescript
// @repo-md/processor/src/plugins/manager.ts

class PluginManager {
  private plugins = new Map<string, Plugin>();
  private context: PluginContext;

  async loadPlugins(config: ProcessConfig['plugins']) {
    // 1. Collect all plugins
    const allPlugins = Object.values(config || {}).filter(Boolean);

    // 2. Build dependency graph
    const graph = this.buildDependencyGraph(allPlugins);

    // 3. Topological sort (dependencies first)
    const ordered = this.topologicalSort(graph);

    // 4. Initialize in order
    for (const plugin of ordered) {
      // Validate dependencies are satisfied
      for (const dep of plugin.requires || []) {
        if (!this.plugins.has(dep)) {
          throw new Error(
            `Plugin "${plugin.name}" requires "${dep}" plugin which is not configured`
          );
        }
      }

      // Initialize with context
      await plugin.initialize(this.context);
      this.plugins.set(plugin.name, plugin);
    }
  }

  getPlugin<T extends Plugin>(name: string): T | undefined {
    return this.plugins.get(name) as T | undefined;
  }
}
```

---

## Benefits Summary

| Aspect | Current | After Refactoring |
|--------|---------|-------------------|
| Core Install Size | ~300MB | ~2MB |
| File Generation | Split (processor + worker) | **Unified (processor only)** |
| Worker Responsibility | Generation + Orchestration | **Orchestration only** |
| Plugin Dependencies | N/A | **Explicit & validated** |
| Text vs Image Embeddings | Mixed in one module | **Separate plugins** |
| Embedding Providers | HuggingFace only | **Multiple (HF, OpenAI, Cloudflare, etc.)** |
| npm Publishable | No | Yes |
| Open Source Ready | No | Yes (core) |

---

## Implementation Roadmap

### Phase 1: Plugin System (1-2 weeks)

1. Define plugin interfaces in processor
2. Implement PluginManager with dependency resolution
3. Create no-op default plugins
4. Refactor processor to use plugin hooks

### Phase 2: Extract Image Processing (1 week)

1. Create `@repo-md/plugin-image-sharp`
2. Make Sharp optional in core
3. Implement CopyOnlyImageProcessor default

### Phase 3: Extract Embeddings (1-2 weeks)

1. Create `@repo-md/plugin-embed-hf` (text)
2. Create `@repo-md/plugin-embed-openai` (text)
3. Create `@repo-md/plugin-embed-cloudflare` (text)
4. Create `@repo-md/plugin-embed-clip` (image)
5. Move embedding logic from worker to plugins

### Phase 4: Extract Database & Similarity (1 week)

1. Create similarity plugin (move from worker)
2. Create `@repo-md/plugin-database-sqlite`
3. Move SQLite/vector logic from worker

### Phase 5: Simplify Worker (1 week)

1. Remove all file generation from worker
2. Worker only configures and runs processor
3. Clean up duplication

---

## Worker Proprietary Features (Post-Refactor)

After refactoring, worker keeps **orchestration-only** responsibilities:

1. **Job Queue Management** - Receive jobs, manage callbacks
2. **R2 Deployment** - Upload generated files
3. **AI Content Generation** - Project from brief (uses Claude/GPT)
4. **WordPress Import** - Convert WP exports
5. **GitHub Integration** - Clone repos, create repos
6. **Plugin Configuration** - Choose which plugins based on plan/features

The **proprietary value** shifts from "we generate embeddings" to "we orchestrate the full pipeline with premium plugins and deployment".

---

*Updated: 2025-01-27*
*Author: Claude Code Analysis*

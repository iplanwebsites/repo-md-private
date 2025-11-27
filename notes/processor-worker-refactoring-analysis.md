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

## Migration Plan

### Overview

This migration plan creates a new `@repo-md/processor-core` package alongside the existing `@repo-md/processor`, enabling incremental migration with feature parity testing at each step.

**Strategy**: Strangler Fig Pattern
- Build new system alongside old
- Migrate features incrementally
- Test for parity at each step
- Switch over when ready
- Remove old code

---

### Workspace Package Structure

```
packages/
├── repo-processor/              # EXISTING - keep during migration
├── repo-processor-core/         # NEW - lightweight core
├── repo-plugin-image-sharp/     # NEW - Sharp image processor
├── repo-plugin-embed-hf/        # NEW - HuggingFace text embeddings
├── repo-plugin-embed-clip/      # NEW - CLIP image embeddings
├── repo-plugin-database-sqlite/ # NEW - SQLite + vector
├── repo-plugin-mermaid-playwright/ # NEW - Mermaid renderer
└── repo-build-worker/           # EXISTING - update to use new processor
```

**Package naming convention**: `repo-{name}` in folder, `@repo-md/{name}` in npm.

---

### Step 1: Create processor-core Package

#### 1.1 Initialize Package

```bash
mkdir -p packages/repo-processor-core/src/{plugins,types,process,services,lib}
```

**packages/repo-processor-core/package.json**:
```json
{
  "name": "@repo-md/processor-core",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./plugins": {
      "types": "./dist/plugins/index.d.ts",
      "import": "./dist/plugins/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "unified": "^11.0.0",
    "remark-parse": "^11.0.0",
    "remark-rehype": "^11.0.0",
    "remark-gfm": "^4.0.0",
    "rehype-stringify": "^10.0.0",
    "gray-matter": "^4.0.3",
    "@sindresorhus/slugify": "^2.2.1",
    "mdast-util-to-string": "^4.0.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vitest": "^2.0.0",
    "@types/node": "^22.0.0"
  },
  "peerDependencies": {},
  "files": ["dist"],
  "engines": {
    "node": ">=20.0.0"
  }
}
```

#### 1.2 Define Plugin Interfaces

Create `packages/repo-processor-core/src/plugins/types.ts`:

```typescript
// Base plugin interface
export interface PluginContext {
  outputDir: string;
  issues: IssueCollector;
  log: (message: string, level?: 'info' | 'warn' | 'error') => void;
  getPlugin<T extends Plugin>(name: string): T | undefined;
  config: ProcessConfig;
}

export interface Plugin {
  readonly name: string;
  readonly requires?: readonly string[];
  initialize(context: PluginContext): Promise<void>;
  isReady(): boolean;
}

// Specific plugin interfaces
export interface ImageProcessorPlugin extends Plugin {
  readonly name: 'imageProcessor';
  canProcess(filePath: string): boolean;
  getMetadata(filePath: string): Promise<ImageMetadata>;
  process(input: string, output: string, options: ImageProcessOptions): Promise<ImageResult>;
  copy(input: string, output: string): Promise<void>;
}

export interface TextEmbeddingPlugin extends Plugin {
  readonly name: 'textEmbedder';
  readonly model: string;
  readonly dimensions: number;
  embed(text: string): Promise<number[]>;
  batchEmbed(texts: string[]): Promise<number[][]>;
}

export interface ImageEmbeddingPlugin extends Plugin {
  readonly name: 'imageEmbedder';
  readonly model: string;
  readonly dimensions: number;
  embedFile(filePath: string): Promise<number[]>;
  embedBuffer(buffer: Buffer, mimeType: string): Promise<number[]>;
}

export interface SimilarityPlugin extends Plugin {
  readonly name: 'similarity';
  readonly requires: readonly ['textEmbedder'];
  computeSimilarity(a: number[], b: number[]): number;
  generateSimilarityMap(posts: ProcessedPost[]): Promise<SimilarityResult>;
}

export interface DatabasePlugin extends Plugin {
  readonly name: 'database';
  build(data: DatabaseBuildInput): Promise<DatabaseResult>;
}

export interface MermaidRendererPlugin extends Plugin {
  readonly name: 'mermaidRenderer';
  render(code: string, options: MermaidRenderOptions): Promise<MermaidResult>;
  isAvailable(): Promise<boolean>;
}
```

#### 1.3 Implement Plugin Manager

Create `packages/repo-processor-core/src/plugins/manager.ts`:

```typescript
export class PluginManager {
  private plugins = new Map<string, Plugin>();
  private context!: PluginContext;

  async initialize(config: ProcessConfig, context: Omit<PluginContext, 'getPlugin'>) {
    this.context = {
      ...context,
      getPlugin: <T extends Plugin>(name: string) => this.getPlugin<T>(name)
    };

    const pluginConfigs = config.plugins || {};
    const allPlugins = Object.values(pluginConfigs).filter(Boolean) as Plugin[];

    // Topological sort based on dependencies
    const sorted = this.topologicalSort(allPlugins);

    // Initialize in dependency order
    for (const plugin of sorted) {
      await this.initializePlugin(plugin);
    }
  }

  private async initializePlugin(plugin: Plugin) {
    // Validate dependencies
    for (const dep of plugin.requires || []) {
      if (!this.plugins.has(dep)) {
        throw new Error(
          `Plugin "${plugin.name}" requires "${dep}" which is not configured`
        );
      }
    }

    await plugin.initialize(this.context);
    this.plugins.set(plugin.name, plugin);
  }

  getPlugin<T extends Plugin>(name: string): T | undefined {
    return this.plugins.get(name) as T | undefined;
  }

  private topologicalSort(plugins: Plugin[]): Plugin[] {
    // Build adjacency list and in-degree count
    const graph = new Map<string, string[]>();
    const inDegree = new Map<string, number>();
    const pluginMap = new Map<string, Plugin>();

    for (const p of plugins) {
      pluginMap.set(p.name, p);
      graph.set(p.name, []);
      inDegree.set(p.name, 0);
    }

    for (const p of plugins) {
      for (const dep of p.requires || []) {
        if (graph.has(dep)) {
          graph.get(dep)!.push(p.name);
          inDegree.set(p.name, (inDegree.get(p.name) || 0) + 1);
        }
      }
    }

    // Kahn's algorithm
    const queue: string[] = [];
    for (const [name, degree] of inDegree) {
      if (degree === 0) queue.push(name);
    }

    const result: Plugin[] = [];
    while (queue.length > 0) {
      const name = queue.shift()!;
      result.push(pluginMap.get(name)!);

      for (const neighbor of graph.get(name) || []) {
        const newDegree = (inDegree.get(neighbor) || 0) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) queue.push(neighbor);
      }
    }

    if (result.length !== plugins.length) {
      throw new Error('Circular plugin dependency detected');
    }

    return result;
  }
}
```

#### 1.4 Create Default No-Op Plugins

Create `packages/repo-processor-core/src/plugins/defaults.ts`:

```typescript
import fs from 'node:fs/promises';

export class CopyOnlyImageProcessor implements ImageProcessorPlugin {
  readonly name = 'imageProcessor' as const;
  private ready = false;

  async initialize() { this.ready = true; }
  isReady() { return this.ready; }

  canProcess() { return false; }

  async getMetadata(): Promise<ImageMetadata> {
    return { width: 0, height: 0, format: 'unknown' };
  }

  async process(): Promise<ImageResult> {
    throw new Error('No image processor configured. Use copy() instead.');
  }

  async copy(input: string, output: string) {
    await fs.copyFile(input, output);
  }
}

export class PassthroughMermaidRenderer implements MermaidRendererPlugin {
  readonly name = 'mermaidRenderer' as const;
  private ready = false;

  async initialize() { this.ready = true; }
  isReady() { return this.ready; }

  async render(code: string): Promise<MermaidResult> {
    return { output: code, strategy: 'pre-mermaid' };
  }

  async isAvailable() { return true; }
}
```

---

### Step 2: Migrate Core Processing Logic

#### 2.1 Copy and Adapt Core Files

Copy from `repo-processor/src/` to `repo-processor-core/src/`:

| Source | Destination | Changes |
|--------|-------------|---------|
| `types/*.ts` | `types/*.ts` | Add plugin config types |
| `lib/utility.ts` | `lib/utility.ts` | Keep as-is |
| `services/issueCollector.ts` | `services/issueCollector.ts` | Keep as-is |
| `remark/*.ts` | `remark/*.ts` | Keep as-is |
| `rehype/*.ts` | `rehype/*.ts` | Remove mermaid (plugin) |
| `process/process.ts` | `process/process.ts` | Refactor for plugins |
| `process/processMedia.ts` | `process/processMedia.ts` | Use imageProcessor plugin |

#### 2.2 Refactor processMedia for Plugin

```typescript
// packages/repo-processor-core/src/process/processMedia.ts

export async function processMedia(
  media: MediaFile[],
  config: ProcessConfig,
  plugins: PluginManager
): Promise<ProcessedMedia[]> {
  const imageProcessor = plugins.getPlugin<ImageProcessorPlugin>('imageProcessor');
  const imageEmbedder = plugins.getPlugin<ImageEmbeddingPlugin>('imageEmbedder');

  const results: ProcessedMedia[] = [];

  for (const file of media) {
    const result: ProcessedMedia = {
      hash: calculateFileHash(file.path),
      originalPath: file.path,
      // ...
    };

    // Use plugin for image processing
    if (imageProcessor?.canProcess(file.path)) {
      const sizes = config.imageSizes || DEFAULT_IMAGE_SIZES;
      result.sizes = {};

      for (const size of sizes) {
        const outputPath = getOutputPath(file, size, config.dir.output);
        const processed = await imageProcessor.process(file.path, outputPath, {
          width: size.width,
          format: config.imageFormat || 'webp',
          quality: config.imageQuality || 80
        });
        result.sizes[size.suffix] = processed;
      }
    } else {
      // Fallback: just copy
      const outputPath = getOutputPath(file, null, config.dir.output);
      await (imageProcessor || new CopyOnlyImageProcessor()).copy(file.path, outputPath);
      result.copyPath = outputPath;
    }

    // Generate image embedding if plugin available
    if (imageEmbedder && isImage(file.path)) {
      try {
        result.embedding = await imageEmbedder.embedFile(file.path);
      } catch (e) {
        // Log but don't fail
      }
    }

    results.push(result);
  }

  return results;
}
```

#### 2.3 Add Post-Processing Hook Points

```typescript
// packages/repo-processor-core/src/process/process.ts

export async function process(config: ProcessConfig): Promise<ProcessResult> {
  const plugins = new PluginManager();
  await plugins.initialize(config, { /* context */ });

  // 1. Parse markdown files (core)
  const posts = await parseMarkdownFiles(config);

  // 2. Process media (uses imageProcessor plugin)
  const media = await processMedia(extractMedia(posts), config, plugins);

  // 3. Generate text embeddings (if plugin available)
  const textEmbedder = plugins.getPlugin<TextEmbeddingPlugin>('textEmbedder');
  if (textEmbedder) {
    for (const post of posts) {
      post.embedding = await textEmbedder.embed(post.plain || '');
    }
  }

  // 4. Generate similarity (if plugin available, requires textEmbedder)
  const similarity = plugins.getPlugin<SimilarityPlugin>('similarity');
  let similarityResult;
  if (similarity) {
    similarityResult = await similarity.generateSimilarityMap(posts);
  }

  // 5. Build database (if plugin available)
  const database = plugins.getPlugin<DatabasePlugin>('database');
  let databaseResult;
  if (database) {
    databaseResult = await database.build({ posts, media });
  }

  // 6. Write output files
  await writeOutputFiles(config.dir.output, {
    posts,
    media,
    embeddings: textEmbedder ? extractEmbeddings(posts) : undefined,
    similarity: similarityResult,
    database: databaseResult
  });

  return { posts, media, similarity: similarityResult, database: databaseResult };
}
```

---

### Step 3: Create Plugin Packages

#### 3.1 @repo-md/plugin-image-sharp

**packages/repo-plugin-image-sharp/package.json**:
```json
{
  "name": "@repo-md/plugin-image-sharp",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "peerDependencies": {
    "@repo-md/processor-core": "workspace:*"
  },
  "dependencies": {
    "sharp": "^0.33.0"
  }
}
```

**packages/repo-plugin-image-sharp/src/index.ts**:
```typescript
import sharp from 'sharp';
import type { ImageProcessorPlugin, PluginContext } from '@repo-md/processor-core/plugins';

export class SharpImageProcessor implements ImageProcessorPlugin {
  readonly name = 'imageProcessor' as const;
  private ready = false;

  async initialize(context: PluginContext) {
    this.ready = true;
  }

  isReady() { return this.ready; }

  canProcess(filePath: string) {
    return /\.(jpe?g|png|webp|avif|gif|tiff?)$/i.test(filePath);
  }

  async getMetadata(filePath: string) {
    const meta = await sharp(filePath).metadata();
    return {
      width: meta.width || 0,
      height: meta.height || 0,
      format: meta.format || 'unknown'
    };
  }

  async process(input: string, output: string, options: ImageProcessOptions) {
    let pipeline = sharp(input);

    if (options.width || options.height) {
      pipeline = pipeline.resize({
        width: options.width || undefined,
        height: options.height || undefined,
        withoutEnlargement: true,
        fit: 'inside'
      });
    }

    const formatMap = {
      webp: () => pipeline.webp({ quality: options.quality || 80 }),
      avif: () => pipeline.avif({ quality: options.quality || 65 }),
      jpeg: () => pipeline.jpeg({ quality: options.quality || 85 }),
      png: () => pipeline.png()
    };

    if (formatMap[options.format]) {
      pipeline = formatMap[options.format]();
    }

    await pipeline.toFile(output);

    const meta = await this.getMetadata(output);
    const stats = await fs.stat(output);

    return {
      outputPath: output,
      width: meta.width,
      height: meta.height,
      format: options.format,
      size: stats.size
    };
  }

  async copy(input: string, output: string) {
    await fs.copyFile(input, output);
  }
}
```

#### 3.2 @repo-md/plugin-embed-hf

**packages/repo-plugin-embed-hf/package.json**:
```json
{
  "name": "@repo-md/plugin-embed-hf",
  "version": "0.1.0",
  "type": "module",
  "peerDependencies": {
    "@repo-md/processor-core": "workspace:*"
  },
  "dependencies": {
    "@huggingface/transformers": "^3.0.0"
  }
}
```

#### 3.3 @repo-md/plugin-embed-clip

**packages/repo-plugin-embed-clip/package.json**:
```json
{
  "name": "@repo-md/plugin-embed-clip",
  "version": "0.1.0",
  "type": "module",
  "peerDependencies": {
    "@repo-md/processor-core": "workspace:*"
  },
  "dependencies": {
    "@huggingface/transformers": "^3.0.0"
  }
}
```

#### 3.4 @repo-md/plugin-database-sqlite

**packages/repo-plugin-database-sqlite/package.json**:
```json
{
  "name": "@repo-md/plugin-database-sqlite",
  "version": "0.1.0",
  "type": "module",
  "peerDependencies": {
    "@repo-md/processor-core": "workspace:*"
  },
  "dependencies": {
    "better-sqlite3": "^11.0.0",
    "sqlite-vec": "^0.1.0"
  }
}
```

---

### Step 4: Test Strategy & Feature Parity

#### 4.1 Test Fixtures

Create shared test fixtures in `packages/repo-processor-core/test/fixtures/`:

```
test/fixtures/
├── vault-minimal/           # Minimal vault (2-3 posts, no media)
│   ├── post-one.md
│   ├── post-two.md
│   └── _config.yaml
├── vault-with-media/        # Posts + images
│   ├── posts/
│   │   └── article.md
│   └── images/
│       ├── photo.jpg
│       └── diagram.png
├── vault-with-links/        # Wiki-links, backlinks
│   ├── index.md
│   ├── page-a.md
│   └── page-b.md
├── vault-obsidian/          # Full Obsidian vault
│   ├── .obsidian/
│   ├── notes/
│   ├── attachments/
│   └── daily/
└── expected-outputs/        # Golden master outputs for comparison
    ├── vault-minimal/
    │   ├── posts.json
    │   └── posts-slug-map.json
    ├── vault-with-media/
    │   ├── posts.json
    │   ├── medias.json
    │   └── _medias/
    └── ...
```

#### 4.2 Feature Parity Test Suite

**packages/repo-processor-core/test/parity.test.ts**:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { RepoProcessor as OldProcessor } from '@repo-md/processor';
import { RepoProcessor as NewProcessor } from '../src/index.js';
import { SharpImageProcessor } from '@repo-md/plugin-image-sharp';

describe('Feature Parity: Old vs New Processor', () => {
  const fixtures = [
    'vault-minimal',
    'vault-with-media',
    'vault-with-links',
    'vault-obsidian'
  ];

  for (const fixture of fixtures) {
    describe(`Fixture: ${fixture}`, () => {
      let oldResult: ProcessResult;
      let newResult: ProcessResult;

      beforeAll(async () => {
        const inputDir = `./test/fixtures/${fixture}`;

        // Run old processor
        const oldProcessor = new OldProcessor({ dir: { input: inputDir } });
        oldResult = await oldProcessor.process();

        // Run new processor with equivalent plugins
        const newProcessor = new NewProcessor({
          dir: { input: inputDir },
          plugins: {
            imageProcessor: new SharpImageProcessor()
          }
        });
        newResult = await newProcessor.process();
      });

      it('should produce same number of posts', () => {
        expect(newResult.posts.length).toBe(oldResult.posts.length);
      });

      it('should produce same post slugs', () => {
        const oldSlugs = oldResult.posts.map(p => p.slug).sort();
        const newSlugs = newResult.posts.map(p => p.slug).sort();
        expect(newSlugs).toEqual(oldSlugs);
      });

      it('should produce same post hashes', () => {
        const oldHashes = oldResult.posts.map(p => p.hash).sort();
        const newHashes = newResult.posts.map(p => p.hash).sort();
        expect(newHashes).toEqual(oldHashes);
      });

      it('should produce same frontmatter', () => {
        for (const oldPost of oldResult.posts) {
          const newPost = newResult.posts.find(p => p.slug === oldPost.slug);
          expect(newPost?.frontmatter).toEqual(oldPost.frontmatter);
        }
      });

      it('should produce same HTML content', () => {
        for (const oldPost of oldResult.posts) {
          const newPost = newResult.posts.find(p => p.slug === oldPost.slug);
          expect(newPost?.html).toEqual(oldPost.html);
        }
      });

      it('should produce same plain text', () => {
        for (const oldPost of oldResult.posts) {
          const newPost = newResult.posts.find(p => p.slug === oldPost.slug);
          expect(newPost?.plain).toEqual(oldPost.plain);
        }
      });

      it('should resolve same wiki-links', () => {
        for (const oldPost of oldResult.posts) {
          const newPost = newResult.posts.find(p => p.slug === oldPost.slug);
          expect(newPost?.links).toEqual(oldPost.links);
        }
      });

      it('should produce same media count', () => {
        expect(newResult.media.length).toBe(oldResult.media.length);
      });

      it('should produce same media hashes', () => {
        const oldHashes = oldResult.media.map(m => m.hash).sort();
        const newHashes = newResult.media.map(m => m.hash).sort();
        expect(newHashes).toEqual(oldHashes);
      });
    });
  }
});
```

#### 4.3 Plugin-Specific Tests

**packages/repo-plugin-image-sharp/test/sharp.test.ts**:

```typescript
describe('SharpImageProcessor', () => {
  it('should resize images correctly', async () => {
    const processor = new SharpImageProcessor();
    await processor.initialize(mockContext);

    const result = await processor.process(
      './test/fixtures/photo.jpg',
      './test/output/photo-md.webp',
      { width: 700, format: 'webp', quality: 80 }
    );

    expect(result.width).toBeLessThanOrEqual(700);
    expect(result.format).toBe('webp');
  });

  it('should preserve aspect ratio', async () => { /* ... */ });
  it('should not upscale images', async () => { /* ... */ });
  it('should handle various formats', async () => { /* ... */ });
});
```

**packages/repo-plugin-embed-hf/test/embeddings.test.ts**:

```typescript
describe('HuggingFaceTextEmbedder', () => {
  it('should generate embeddings with correct dimensions', async () => {
    const embedder = new HuggingFaceTextEmbedder();
    await embedder.initialize(mockContext);

    const embedding = await embedder.embed('Hello world');

    expect(embedding).toHaveLength(384);
    expect(embedding.every(n => typeof n === 'number')).toBe(true);
  });

  it('should produce consistent embeddings for same text', async () => {
    const e1 = await embedder.embed('Test text');
    const e2 = await embedder.embed('Test text');
    expect(e1).toEqual(e2);
  });

  it('should batch embed efficiently', async () => { /* ... */ });
});
```

#### 4.4 Integration Tests with Worker

**packages/repo-build-worker/test/integration.test.ts**:

```typescript
describe('Worker Integration with New Processor', () => {
  it('should produce identical R2 output structure', async () => {
    // Compare old buildAssets output vs new
  });

  it('should generate valid embeddings file', async () => {
    // Verify posts-embedding-hash-map.json format
  });

  it('should generate valid SQLite database', async () => {
    // Query database, verify tables and data
  });
});
```

#### 4.5 Feature Parity Checklist

| Feature | Old Location | New Location | Test Coverage |
|---------|--------------|--------------|---------------|
| Markdown parsing | processor | processor-core | `parity.test.ts` |
| Frontmatter extraction | processor | processor-core | `parity.test.ts` |
| Wiki-link resolution | processor | processor-core | `parity.test.ts` |
| Slug generation | processor | processor-core | `parity.test.ts` |
| Hash calculation | processor | processor-core | `parity.test.ts` |
| HTML generation | processor | processor-core | `parity.test.ts` |
| Plain text extraction | processor | processor-core | `parity.test.ts` |
| Image resizing | processor (sharp) | plugin-image-sharp | `sharp.test.ts` |
| Image format conversion | processor (sharp) | plugin-image-sharp | `sharp.test.ts` |
| Text embeddings | worker | plugin-embed-hf | `embeddings.test.ts` |
| Image embeddings | worker | plugin-embed-clip | `clip.test.ts` |
| Similarity computation | worker | processor-core (plugin) | `similarity.test.ts` |
| SQLite generation | worker | plugin-database-sqlite | `sqlite.test.ts` |
| Vector search | worker | plugin-database-sqlite | `sqlite.test.ts` |
| Mermaid rendering | processor (playwright) | plugin-mermaid-playwright | `mermaid.test.ts` |
| Issue collection | both | processor-core | `issues.test.ts` |

---

### Step 5: Update Worker to Use New Processor

#### 5.1 Update Worker Dependencies

**packages/repo-build-worker/package.json**:
```json
{
  "dependencies": {
    "@repo-md/processor-core": "workspace:*",
    "@repo-md/plugin-image-sharp": "workspace:*",
    "@repo-md/plugin-embed-hf": "workspace:*",
    "@repo-md/plugin-embed-clip": "workspace:*",
    "@repo-md/plugin-database-sqlite": "workspace:*"
  }
}
```

#### 5.2 Update buildAssets.js

```javascript
// packages/repo-build-worker/src/process/buildAssets.js

import { RepoProcessor } from '@repo-md/processor-core';
import { SharpImageProcessor } from '@repo-md/plugin-image-sharp';
import { HuggingFaceTextEmbedder } from '@repo-md/plugin-embed-hf';
import { ClipImageEmbedder } from '@repo-md/plugin-embed-clip';
import { SqliteDatabasePlugin } from '@repo-md/plugin-database-sqlite';
import { CosineSimilarityPlugin } from '@repo-md/processor-core/plugins';

export async function buildAssets(data) {
  const { repoInfo, logger } = data;

  const processor = new RepoProcessor({
    dir: {
      input: repoInfo.path,
      output: repoInfo.distPath
    },
    plugins: {
      imageProcessor: new SharpImageProcessor(),
      textEmbedder: new HuggingFaceTextEmbedder(),
      imageEmbedder: new ClipImageEmbedder(),
      similarity: new CosineSimilarityPlugin(),
      database: new SqliteDatabasePlugin()
    },
    // Pass existing config options
    imageSizes: data.config?.imageSizes,
    imageFormat: data.config?.imageFormat
  });

  const result = await processor.process();

  return {
    ...data,
    assets: {
      processed: true,
      distFolder: result.outputDir,
      postsCount: result.posts.length,
      mediaCount: result.media.length,
      hasEmbeddings: !!result.embeddings,
      hasSimilarity: !!result.similarity,
      hasDatabase: !!result.database
    }
  };
}
```

#### 5.3 Remove Redundant Worker Code

Delete from worker (now in plugins):
- `src/process/computePostEmbeddings.js`
- `src/process/computeImageEmbeddings.js`
- `src/process/buildSqliteDatabase.js`
- `src/lib/instructor-embedder.js`
- `src/lib/clip-embedder.js`
- `src/services/issueCollector.js` (use from processor-core)

---

### Step 6: Cleanup and Finalization

#### 6.1 Remove Old Processor (When Ready)

After all tests pass and worker is migrated:

1. Update all imports from `@repo-md/processor` to `@repo-md/processor-core`
2. Remove `packages/repo-processor/` directory
3. Rename `@repo-md/processor-core` to `@repo-md/processor` (optional)

#### 6.2 Update Root package.json

```json
{
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "build:processor-core": "turbo run build --filter=@repo-md/processor-core",
    "build:plugins": "turbo run build --filter=@repo-md/plugin-*",
    "test:parity": "turbo run test --filter=@repo-md/processor-core -- --grep parity"
  }
}
```

#### 6.3 Documentation Updates

- Update CLAUDE.md with new package structure
- Create plugin authoring guide
- Document breaking changes from old processor

---

### Step 7: CI/CD Setup

#### 7.1 Test Matrix

```yaml
# .github/workflows/test.yml
jobs:
  test:
    strategy:
      matrix:
        package:
          - repo-processor-core
          - repo-plugin-image-sharp
          - repo-plugin-embed-hf
          - repo-plugin-embed-clip
          - repo-plugin-database-sqlite
    steps:
      - run: npm run test --workspace=packages/${{ matrix.package }}

  parity-test:
    needs: test
    steps:
      - run: npm run test:parity
```

#### 7.2 Publish Workflow

```yaml
# .github/workflows/publish.yml
jobs:
  publish:
    steps:
      - run: |
          npm publish --workspace=packages/repo-processor-core
          npm publish --workspace=packages/repo-plugin-image-sharp
          # ... other packages
```

---

### Migration Checklist

- [ ] **Step 1**: Create processor-core package structure
- [ ] **Step 1.2**: Define all plugin interfaces
- [ ] **Step 1.3**: Implement PluginManager with dependency resolution
- [ ] **Step 1.4**: Create default no-op plugins
- [ ] **Step 2.1**: Copy core processing logic
- [ ] **Step 2.2**: Refactor processMedia to use plugins
- [ ] **Step 2.3**: Add post-processing hooks for embeddings/similarity/database
- [ ] **Step 3.1**: Create plugin-image-sharp package
- [ ] **Step 3.2**: Create plugin-embed-hf package
- [ ] **Step 3.3**: Create plugin-embed-clip package
- [ ] **Step 3.4**: Create plugin-database-sqlite package
- [ ] **Step 4.1**: Create test fixtures
- [ ] **Step 4.2**: Write feature parity tests
- [ ] **Step 4.3**: Write plugin-specific tests
- [ ] **Step 4.4**: Write integration tests
- [ ] **Step 4.5**: Verify all features in checklist
- [ ] **Step 5.1**: Update worker dependencies
- [ ] **Step 5.2**: Refactor buildAssets.js
- [ ] **Step 5.3**: Remove redundant worker code
- [ ] **Step 6.1**: Remove old processor package
- [ ] **Step 6.2**: Update root package.json
- [ ] **Step 6.3**: Update documentation
- [ ] **Step 7.1**: Set up test CI
- [ ] **Step 7.2**: Set up publish workflow

---

*Updated: 2025-01-27*
*Author: Claude Code Analysis*

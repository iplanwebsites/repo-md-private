# Architecture Comparison: Current vs. Cloudflare Containers

## Current Architecture (GCP Cloud Run)

```
┌─────────────────────────────────────────────────────────────┐
│                     INCOMING REQUEST                        │
│                   POST /process (JSON)                      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │   Express.js Server   │ ◄─── Port 8080
         │    (src/worker.js)    │
         └────────┬──────────────┘
                  │
      ┌───────────┴──────────────┐
      │  Async Job Processor     │
      │  (processJob function)   │
      └───────────┬──────────────┘
                  │
      ┌───────────▼──────────────────────────────────┐
      │          TASK ROUTER (switch)               │
      └───────────┬──────────────────────────────────┘
                  │
      ┌───────────▼──────────────────────────────────────────────┐
      │                   PROCESSING PIPELINE                    │
      │                                                          │
      │  1. fetchExistingAssets()                              │
      │     └─ Read from R2 (prev revision)                    │
      │                                                          │
      │  2. buildAssets()                                       │
      │     ├─ RepoProcessor (markdown → JSON)                │
      │     ├─ computePostEmbeddings()                        │
      │     │  ├─ Load: CLIP model (300MB) to /tmp           │ ◄── ⚠️ PROBLEM
      │     │  ├─ Inference: 2-3s per embedding              │
      │     │  └─ Write: vectors to temp files                │
      │     ├─ computeImageEmbeddings()                       │
      │     │  ├─ Load: Vision model (200MB) to /tmp          │ ◄── ⚠️ PROBLEM
      │     │  └─ Process: images from memory                 │
      │     ├─ createVectraIndex()                           │
      │     │  └─ Memory-based vector index (OK)             │
      │     └─ buildSqliteDatabase()                         │
      │        ├─ better-sqlite3 native module               │ ◄── ⚠️ PROBLEM
      │        ├─ Create: search.db on disk                  │ ◄── ⚠️ PROBLEM
      │        ├─ Vector: sqlite-vec extensions              │
      │        └─ Full-text: BM25 indexing                   │
      │                                                          │
      │  3. enrichData()                                        │
      │     └─ Read/write JSON files to /tmp                  │ ◄── ⚠️ PROBLEM
      │                                                          │
      └──────────────┬─────────────────────────────────────────┘
                     │
         ┌───────────▼──────────────┐
         │   publishR2()            │
         │ ┌─────────────────────┐  │
         │ │ Upload dist/ to R2  │  │ ◄── ✓ OK (pure JS SDK)
         │ └─────────────────────┘  │
         └───────────┬──────────────┘
                     │
         ┌───────────▼──────────────┐
         │  Callback to Client      │
         │  POST {result} to URL    │
         └──────────────────────────┘

STORAGE ARCHITECTURE:
┌─────────────────────────────────┐
│   /tmp (Container Filesystem)   │
├─────────────────────────────────┤
│ • temp-repo-{jobId}/            │ ◄─ Source repository
│ • {distFolder}/                 │ ◄─ Built assets
│   ├─ posts.json                 │
│   ├─ media.json                 │
│   ├─ search.db                  │ ◄─ SQLite database
│   └─ {post-embeddings}.json     │
│ • TRANSFORMERS_CACHE/           │ ◄─ Model cache (hundreds MB)
└─────────────────────────────────┘

ISSUES WITH CURRENT ARCH:
1. ❌ Model downloads to disk (300-500MB each)
2. ❌ File system operations on temp folders
3. ❌ SQLite native module (better-sqlite3)
4. ❌ Long processes (30+ minutes for large repos)
5. ⚠️ No horizontal scaling (state in memory)
```

---

## Proposed Architecture (Cloudflare Containers)

```
┌─────────────────────────────────────────────────────────────┐
│                     INCOMING REQUEST                        │
│                   POST /process (JSON)                      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │   Express.js Server   │ ◄─── Port 5000 (CF default)
         │   (src/worker.js)     │
         └────────┬──────────────┘
                  │
      ┌───────────┴──────────────┐
      │  Sync Handler            │
      │  (immediate response)    │
      └───────────┬──────────────┘
                  │
         ┌────────▼────────┐
         │ Store in KV     │ ◄─── Cloudflare Workers KV
         │ job:{jobId}     │      (100MB per key, 24h TTL)
         │ state: pending  │
         └────────┬────────┘
                  │
                  ▼
      ┌──────────────────────────────────────┐
      │    Task Queue (KV-based)             │
      │  • Process async or via cron         │
      │  • Multiple tasks per job            │
      │  • Retry logic built in              │
      └──────────┬───────────────────────────┘
                 │
      ┌──────────▼──────────────────────────────────────────────┐
      │              DECOMPOSED TASK PIPELINE                   │
      │                                                          │
      │  Task 1: Fetch & Validate                              │
      │  ├─ Download from R2 to memory                         │ ✓
      │  └─ Validate structure (KV store result)               │
      │                                                          │
      │  Task 2: Parse Markdown                                │
      │  ├─ RepoProcessor (memory only)                        │ ✓
      │  └─ Generate JSON (KV store)                           │
      │                                                          │
      │  Task 3: Compute Text Embeddings                       │
      │  ├─ Call OpenAI API (no model download)                │ ✓
      │  ├─ Batch: 10 posts at a time                          │ ✓
      │  └─ KV store: {post-id: [embeddings]}                  │
      │                                                          │
      │  Task 4: Compute Image Embeddings                      │
      │  ├─ Call OpenAI Vision API                             │ ✓
      │  ├─ Process in parallel (no model mgmt)                │ ✓
      │  └─ KV store: {image-id: [embeddings]}                 │
      │                                                          │
      │  Task 5: Create Database                               │
      │  ├─ Query PostgreSQL (Neon serverless)                 │ ✓
      │  ├─ INSERT posts, metadata, vectors                    │ ✓
      │  └─ Store DB connection strings (KV/env)               │
      │                                                          │
      │  Task 6: Generate Artifacts                            │
      │  ├─ Build JSON files (memory only)                     │ ✓
      │  └─ Create SQL export (optional)                       │
      │                                                          │
      │  Task 7: Upload to R2                                  │
      │  ├─ Stream artifacts to R2                             │ ✓
      │  └─ Update job state: "complete"                       │
      │                                                          │
      └──────────────────────────────────────────────────────────┘
                     │
         ┌───────────▼──────────────┐
         │   Callback Handler       │
         │  (when all tasks done)   │
         │   POST {result} to URL   │
         └──────────────────────────┘

EXTERNAL SERVICES:

┌──────────────────────────────────────────────────────────┐
│  PostgreSQL (Neon Serverless)                           │
├──────────────────────────────────────────────────────────┤
│ ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│ │  posts   │  │ metadata │  │ vectors  │  │   fts    │ │
│ └──────────┘  └──────────┘  └──────────┘  └──────────┘ │
│                                                          │
│ • Replaces SQLite better-sqlite3                        │
│ • Vector extension support (pgvector)                   │
│ • Full-text search via tsearch                          │
│ • Serverless scaling ($5-50/month)                      │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  OpenAI Embeddings API                                  │
├──────────────────────────────────────────────────────────┤
│ • text-embedding-3-small (384-dim)                      │
│ • vision API for image embeddings                       │
│ • $0.00002 per 1K tokens (typical ~$2-5/month)        │
│ • No model management/downloading                       │
│ • Handles batching internally                           │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  Cloudflare Services                                    │
├──────────────────────────────────────────────────────────┤
│ • Workers KV: Job state, intermediate data             │
│ • R2: Artifact storage (same as before)                │
│ • Containers: HTTP handler + task processor            │
│ • Cron Triggers: Optional async task runner            │
└──────────────────────────────────────────────────────────┘

STORAGE ARCHITECTURE:

┌─────────────────────────────────────┐
│   Cloudflare Workers KV             │
├─────────────────────────────────────┤
│ job:{jobId}                         │
│ ├─ state: 'pending|processing|done' │
│ ├─ currentTask: 'task-3'            │
│ ├─ results: {...}                   │
│ └─ ttl: 86400 (24 hours)            │
│                                     │
│ processed:{jobId}                   │
│ ├─ posts: {...JSON...}              │
│ ├─ embeddings: {...}                │
│ └─ metadata: {...}                  │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│   Cloudflare R2 Storage             │
├─────────────────────────────────────┤
│ {revisionId}/                       │
│ ├─ posts.json                       │
│ ├─ media.json                       │
│ ├─ search.json (exportable)         │
│ └─ ...assets...                     │
└─────────────────────────────────────┘

KEY IMPROVEMENTS:
1. ✓ No model downloads (API-based)
2. ✓ No persistent filesystem (memory + KV only)
3. ✓ No native modules (pure JavaScript)
4. ✓ Decomposed tasks (fit within timeout)
5. ✓ Horizontal scaling (stateless tasks)
6. ✓ Resilient to failures (task retry via KV state)
```

---

## Side-by-Side Task Execution

### Task: "process-all" (100 posts)

**Current Architecture**:
```
Time 0s ─────────────────────────────────────────── Time 45s
│                                                  │
├─ 1-2s: Load source                             │
├─ 3-5s: Parse markdown (RepoProcessor)          │
├─ 15-20s: Download + run CLIP embeddings       │ ◄─── Model: 300MB, slow
├─ 10s: Create SQLite database                   │ ◄─── better-sqlite3 native
├─ 2-3s: Create Vectra index                    │
├─ 8-10s: Upload to R2                          │
└─ 2s: Callback                                  │

Memory Usage: 200-250MB (medium repo)
Filesystem: /tmp (300MB+ for models + temp files)
```

**Proposed Architecture**:
```
TIME 0s ───────────────────────────────────────────────────── TIME 120s+
│
├─ REQUEST 1 (0-1s): Store in KV, return 202 Accepted
│  └─ Trigger Task 1
│
│ [KV/Database Async Processing]
│
├─ TASK 1 (5-10s): Fetch & Validate
│  ├─ Download from R2
│  ├─ Validate structure
│  └─ Store in KV: processed:{jobId}
│
├─ TASK 2 (10-15s): Parse Markdown
│  ├─ RepoProcessor (in-memory)
│  └─ Store parsed JSON in KV
│
├─ TASK 3 (15-45s): Compute Text Embeddings
│  ├─ Batch 10 posts per API call
│  ├─ API calls (10 total): ~3s each
│  ├─ Results stored in KV
│  └─ Each batch: ~3-5s
│
├─ TASK 4 (45-60s): Compute Image Embeddings
│  ├─ API calls for images: ~2s each
│  └─ Results stored in KV
│
├─ TASK 5 (60-80s): Create Database
│  ├─ PostgreSQL INSERT (batched): ~15s total
│  └─ Vectors inserted via pgvector
│
├─ TASK 6 (80-100s): Generate Artifacts
│  ├─ Build JSON outputs: ~15s
│  └─ Prepare upload manifest
│
├─ TASK 7 (100-120s+): Upload to R2
│  ├─ Stream uploads (parallel): ~20s
│  └─ Update job state: "complete"
│
└─ CALLBACK (120s+): Send result to client
   └─ All data available in KV/DB

Memory Usage: 80-120MB (no models, small buffers)
Filesystem: None (all memory/KV/DB)
Database: PostgreSQL (persistent, separate scaling)
API Calls: 10+ to OpenAI (batch efficient)
```

---

## Memory Comparison

```
CURRENT (GCP Cloud Run):
┌───────────────────────┐
│ Typical Medium Repo   │
├───────────────────────┤
│ Post content:     50MB│
│ Embeddings:       50MB│
│ SQLite DB:        30MB│
│ Model buffers:    50MB│ ◄─── CLIP model inference
│ Node/Express:     20MB│
├───────────────────────┤
│ TOTAL:           200MB│ ✓ OK for Cloud Run (2GB available)
└───────────────────────┘

CLOUDFLARE CONTAINERS (256MB limit):
┌───────────────────────┐
│ Typical Medium Repo   │
├───────────────────────┤
│ Post content:     30MB│
│ Embeddings (temps):10MB│
│ API response buffers:10MB│
│ Processing state:  5MB│
│ Node/Express:     15MB│
├───────────────────────┤
│ TOTAL:            70MB│ ✓ OK (plenty of headroom)
└───────────────────────┘

LARGE REPO (1000+ posts):
┌───────────────────────┐
│ Before: 300MB+   ❌  │ Exceeds limit
│ After: 150MB     ✓   │ Well within limit
└───────────────────────┘
```

---

## API Compatibility

### Current API Unchanged

The job submission API remains compatible:

```javascript
POST /process
{
  jobId: "unique-id",
  task: "process-all",         // or other tasks
  data: {
    repoUrl: "...",
    distFolder: "/path",
    ...
  },
  callbackUrl: "https://..."   // Results posted here
}

Response:
202 Accepted
{
  status: "accepted",
  jobId: "unique-id"
}

Later → POST callbackUrl
{
  jobId: "unique-id",
  status: "completed",
  result: {...},
  processedAt: "2025-11-02T...",
  duration: 120000,           // Now in ms, longer due to API calls
  logs: [...]
}
```

**Changes for Clients**:
- Duration will increase 2-3x (expected)
- Callback may arrive with longer delay
- No structural changes to request/response format

---

## Deployment Comparison

```
CURRENT: GCP Cloud Run
┌─────────────────────┐
│ Docker build        │
│ ├─ Node 20          │
│ ├─ Python 3.10      │
│ ├─ Build tools      │
│ ├─ System libs      │
│ └─ ~1.2GB image     │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ GCP Container Reg   │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Cloud Run           │
│ (auto-scaling)      │
└─────────────────────┘

PROPOSED: Cloudflare Containers
┌─────────────────────────┐
│ Docker build            │
│ ├─ Node 20              │
│ ├─ NO build tools       │ ✓ Smaller
│ ├─ NO system libs       │ ✓ Fewer deps
│ ├─ NO heavy modules     │ ✓ Slimmer
│ └─ ~200MB image         │ ✓ 6x smaller
└──────┬──────────────────┘
       │
       ▼
┌──────────────────────────┐
│ Cloudflare Registry      │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│ Cloudflare Containers    │
│ (auto-scaling)           │
│ + Workers KV (state)     │
│ + PostgreSQL (data)      │
│ + OpenAI API (inference) │
└──────────────────────────┘
```

---

## Error Handling & Resilience

```
CURRENT:
Job fails → Entire process lost
→ Must re-submit from scratch
→ No partial result recovery

PROPOSED:
Task 1 fails → KV has job state
→ Retry Task 1 with exponential backoff
→ Move to next task when recovered
→ Partial results available in KV/DB
→ Resume from failure point

Example:
├─ Task 1: ✓ Fetch & Validate
├─ Task 2: ✓ Parse Markdown
├─ Task 3: ✗ Embeddings API timeout
│  └─ Retry (KV remembers progress)
│     ├─ Attempt 1: Failed
│     ├─ Attempt 2: Failed
│     └─ Attempt 3: Success ✓
├─ Task 4: ✓ Image Embeddings
├─ Task 5: ✓ Create Database
├─ Task 6: ✓ Generate Artifacts
├─ Task 7: ✓ Upload to R2
└─ CALLBACK: Success with full data
```

---

## Cost & Performance Summary

```
                          CURRENT        PROPOSED       DELTA
───────────────────────────────────────────────────────────────
Infrastructure            $100-300       $200-500       +100-150%
Compute (per job)         $0.02-0.05     $0.10-0.15     +400-500%
Database                  Included       $5-50/mo       + external
Embeddings (per job)      $0            $0.01-0.05     + cost
Processing Time           45s            120s           +167%
Memory per job            200MB          70MB           -65%
Filesystem usage          200MB+         0 (KV-based)   -100%
Model downloads           300MB+         0              -100%
Native modules            3 required     0              -100%
Scaling limitation        Memory bound   Horizontally   ✓
                                         scalable
```


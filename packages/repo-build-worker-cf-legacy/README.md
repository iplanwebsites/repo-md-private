# Repo Build Worker - Cloudflare Containers

![Cloudflare](https://img.shields.io/badge/Cloudflare-Containers-orange)
![Node.js](https://img.shields.io/badge/Node.js-20%2B-green)

A worker service that processes repository data asynchronously using **Cloudflare Containers**. This worker handles markdown processing, asset optimization, embedding generation, and site deployment.

## Features

- **Cloudflare Containers** - Runs Docker containers at the edge with Durable Objects
- **Pre-loaded ML Models** - transformer.js models baked into Docker image for fast cold starts
- **Async Job Processing** - HTTP endpoint receives jobs, processes async, calls back with results
- **Full Build Pipeline** - Markdown → HTML, image optimization, embeddings, SQLite DB, R2 upload

## Quick Start

### Prerequisites

- Node.js 20+
- Docker (for local testing)
- Cloudflare account with Containers beta access
- Wrangler CLI (`npm install -g wrangler`)

### Local Development

```bash
# Install dependencies
npm install

# Copy environment config
cp .env.example .env

# Run locally (Node.js)
npm run dev

# Or run with Docker
npm run docker:build
npm run docker:run
```

### Test the Worker

```bash
# Health check
curl http://localhost:8080/health

# Run build pipeline test (returns timing metrics)
curl http://localhost:8080/test

# Full integration test with sample repo
curl http://localhost:8080/test/full
```

---

## Cloudflare Deployment Guide

### Step 1: Authenticate with Cloudflare

```bash
# Login to Cloudflare (opens browser)
npm run cf:login

# Or use wrangler directly
npx wrangler login

# Verify authentication
npx wrangler whoami
```

### Step 2: Configure wrangler.toml

The `wrangler.toml` is pre-configured. Update if needed:

```toml
name = "repo-build-worker-cf"
main = "src/cf-worker.js"
compatibility_date = "2024-11-01"
compatibility_flags = ["nodejs_compat"]

# Container configuration
[[containers]]
max_instances = 5
class_name = "RepoBuildContainer"
image = "./Dockerfile"

# Durable Object for container management
[[durable_objects.bindings]]
name = "BUILD_CONTAINER"
class_name = "RepoBuildContainer"
```

### Step 3: Set Up Secrets

```bash
# Required: Authentication secret for API endpoints
npx wrangler secret put WORKER_SECRET

# GitHub access (for cloning private repos)
npx wrangler secret put GITHUB_TOKEN

# R2 Storage (for deploying built sites)
npx wrangler secret put R2_ACCESS_KEY_ID
npx wrangler secret put R2_SECRET_ACCESS_KEY
npx wrangler secret put R2_ACCOUNT_ID
npx wrangler secret put R2_BUCKET_NAME

# Optional: OpenAI for AI-powered features
npx wrangler secret put OPENAI_API_KEY
```

### Step 4: Deploy to Cloudflare

```bash
# Deploy the worker with containers
npm run cf:deploy

# Or use wrangler directly
npx wrangler deploy
```

### Step 5: Verify Deployment

```bash
# Get your worker URL (shown after deploy)
WORKER_URL="https://repo-build-worker-cf.<your-subdomain>.workers.dev"

# Test health endpoint
curl $WORKER_URL/health

# Test build pipeline
curl $WORKER_URL/test
```

---

## Development Commands

```bash
# Local Development
npm run dev              # Start with nodemon (auto-restart)
npm start                # Start production mode

# Docker
npm run docker:build     # Build Docker image with pre-loaded models
npm run docker:run       # Run container locally (port 8080)
npm run docker:test      # Test embeddings inside container

# Cloudflare
npm run cf:login         # Authenticate with Cloudflare
npm run cf:dev           # Local development with wrangler
npm run cf:deploy        # Deploy to Cloudflare Containers

# Testing
npm run test:local       # Test against localhost:8080
npm run test:wrangler    # Test against wrangler dev (port 5522)
npm run test:deployed    # Test against deployed CF worker
npm run test:http        # Quick curl test of /test endpoint
npm run test:http:full   # Quick curl test of /test/full endpoint
```

---

## API Reference

### Health Check

```bash
GET /health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Build Pipeline Test

```bash
GET /test
```

Runs a self-contained build test with synthetic content. Returns timing metrics.

Response:
```json
{
  "status": "success",
  "timing": {
    "total": 512,
    "breakdown": {
      "setup": 2,
      "build": 507,
      "cleanup": 3
    }
  },
  "result": {
    "filesGenerated": 24,
    "files": ["posts.json", "content.sqlite", "graph.json", "..."]
  }
}
```

### Full Integration Test

```bash
GET /test/full?repo=https://github.com/owner/repo
```

Clones a real repo and runs the full pipeline. Defaults to `repo-md/sample-blog`.

### Submit Job

```bash
POST /process
Authorization: Bearer <WORKER_SECRET>
Content-Type: application/json

{
  "jobId": "unique-job-id",
  "task": "deploy-repo",
  "data": { ... },
  "callbackUrl": "https://your-api.com/callback"
}
```

The worker acknowledges immediately and calls back when done.

#### Task Types

| Task | Description |
|------|-------------|
| `deploy-repo` | Clone repo, build assets, upload to R2 |
| `process-all` | Full pipeline: assets → database → embeddings → enrich |
| `build-assets` | Only build assets (markdown → HTML, images) |
| `build-database` | Only build SQLite database |
| `enrich-data` | Only run data enrichment |
| `acquire-user-repo` | Clone a GitHub repository |
| `new-repo-from-template` | Create repo from template |
| `wp-import` | Import WordPress XML export |
| `generate-project-from-brief` | AI-generate project from description |

#### Example: Deploy Repository

```bash
curl -X POST https://your-worker.workers.dev/process \
  -H "Authorization: Bearer YOUR_WORKER_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "deploy-123",
    "task": "deploy-repo",
    "data": {
      "repoUrl": "https://github.com/user/repo",
      "gitToken": "ghp_xxx",
      "r2": {
        "accessKeyId": "xxx",
        "secretAccessKey": "xxx",
        "accountId": "xxx",
        "bucketName": "my-bucket"
      }
    },
    "callbackUrl": "https://your-api.com/job-callback"
  }'
```

#### Example: Generate Project from Brief

```bash
curl -X POST https://your-worker.workers.dev/process \
  -H "Authorization: Bearer YOUR_WORKER_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "gen-456",
    "task": "generate-project-from-brief",
    "data": {
      "brief": "Create a personal blog about web development",
      "repoName": "my-dev-blog",
      "gitToken": "ghp_xxx"
    },
    "callbackUrl": "https://your-api.com/job-callback"
  }'
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Edge                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌──────────────────────────────────┐   │
│  │  CF Worker  │───▶│   Durable Object (Container)     │   │
│  │ cf-worker.js│    │  ┌────────────────────────────┐  │   │
│  └─────────────┘    │  │  Docker Container          │  │   │
│        │            │  │  ┌──────────────────────┐  │  │   │
│        │            │  │  │  Express App         │  │  │   │
│        ▼            │  │  │  (worker.js)         │  │  │   │
│   Routes requests   │  │  │                      │  │  │   │
│   to containers     │  │  │  • /health           │  │  │   │
│                     │  │  │  • /test             │  │  │   │
│                     │  │  │  • /process          │  │  │   │
│                     │  │  │  • /inference/*      │  │  │   │
│                     │  │  └──────────────────────┘  │  │   │
│                     │  │                            │  │   │
│                     │  │  Pre-loaded Models:        │  │   │
│                     │  │  • Xenova/mobileclip_s0    │  │   │
│                     │  │  • Xenova/all-MiniLM-L6-v2 │  │   │
│                     │  └────────────────────────────┘  │   │
│                     └──────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Request Flow

1. Request hits CF Worker (`cf-worker.js`)
2. Worker routes to appropriate Durable Object container
3. Container runs Express app (`worker.js`)
4. Job processed async, callback sent when complete

### Key Files

| File | Purpose |
|------|---------|
| `src/cf-worker.js` | Cloudflare Worker entry point, routes to containers |
| `src/worker.js` | Express app running inside container |
| `src/process/*.js` | Individual processing modules |
| `src/lib/*.js` | Utility libraries (embeddings, parsers) |
| `wrangler.toml` | Cloudflare configuration |
| `Dockerfile` | Container image with pre-loaded models |

---

## Environment Variables

### Required for Production

| Variable | Description |
|----------|-------------|
| `WORKER_SECRET` | Auth token for /process endpoint |
| `GITHUB_TOKEN` | GitHub access for cloning repos |
| `R2_ACCESS_KEY_ID` | R2 storage access key |
| `R2_SECRET_ACCESS_KEY` | R2 storage secret |
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_BUCKET_NAME` | R2 bucket for deployments |

### Optional

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | For AI-powered project generation |
| `SKIP_EMBEDDINGS` | Set to "true" to disable embeddings |
| `KEEP_TMP_FILES` | Set to "true" to preserve temp files |

---

## Troubleshooting

### Container not starting

```bash
# Check wrangler logs
npx wrangler tail

# Verify Docker builds locally
npm run docker:build
npm run docker:run
```

### Secrets not working

```bash
# List secrets
npx wrangler secret list

# Re-add secret
npx wrangler secret put WORKER_SECRET
```

### Cold start too slow

The Docker image includes pre-loaded models (~1-2GB). If cold starts are slow:
- Increase `max_instances` in wrangler.toml
- Adjust `sleepAfter` in cf-worker.js (default 10m)

### Build failures

```bash
# Clear Docker cache and rebuild
npm run docker:build:no-cache

# Check for native module issues
npm rebuild better-sqlite3
```

---

## Testing Checklist

Before deploying to production:

- [ ] `npm run docker:build` succeeds
- [ ] `npm run docker:run` starts without errors
- [ ] `curl localhost:8080/health` returns healthy
- [ ] `curl localhost:8080/test` returns success with timing
- [ ] Secrets configured in Cloudflare
- [ ] `npm run cf:deploy` succeeds
- [ ] Production health check works

---

## License

Copyright (c) 2025 repo.md

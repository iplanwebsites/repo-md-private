# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Repo Build Worker CF** is a Cloudflare Containers-optimized version of the repo.md build worker. This version includes **pre-loaded transformer.js models** in the Docker image for fast cold starts with embedding support.

### Key Differences from repo-build-worker

| Feature | repo-build-worker | repo-build-worker-cf |
|---------|------------------|---------------------|
| Platform | GCP Cloud Run | Cloudflare Containers |
| Embeddings | Downloads models at runtime | Pre-loaded in Docker image |
| Cold Start | 30-60s (model download) | ~5s (cached models) |
| SKIP_EMBEDDINGS | Optional | Always `false` (enabled) |
| Image Size | Smaller | Larger (~1-2GB with models) |

### Pre-loaded Models
- `Xenova/mobileclip_s0` - CLIP model for text and image embeddings (512 dimensions)
- `Xenova/all-MiniLM-L6-v2` - Text embedding model (384 dimensions)

## Development Commands

### Core Development
- `npm run dev` - Start development server with auto-restart (port 5522)
- `npm start` - Run production server
- `npm install` - Install dependencies
- `npm run preload-models` - Pre-download transformer models locally

### Docker Build & Test
- `npm run docker:build` - Build Docker image with pre-loaded models
- `npm run docker:build:no-cache` - Force rebuild without cache
- `npm run docker:run` - Run containerized service (port 8080)
- `npm run docker:test` - Test embeddings inside container

### Cloudflare Containers Deployment
- `npm run cf:login` - Authenticate with Cloudflare
- `npm run cf:dev` - Start local development
- `npm run cf:deploy` - Deploy to Cloudflare Containers

### Building the Docker Image
```bash
# Build with pre-loaded models (takes ~5-10 min first time)
npm run docker:build

# Verify embeddings work
npm run docker:test

# Run locally
npm run docker:run
```

## Architecture

### Task-Based Processing Pipeline
The service processes jobs asynchronously through HTTP endpoints with callback URLs. Key task types:

- `process-all` - Complete pipeline: assets → database → embeddings → enrichment
- `generate-project-from-brief` - AI-powered project generation from natural language
- `wp-import` - WordPress to markdown conversion
- `deploy-repo` - Full deployment pipeline
- `acquire-user-repo` - GitHub repository cloning

### Modular Structure
- **`src/worker.js`** - Main Express application and job processor
- **`src/inferenceRouter.js`** - AI inference endpoints for embeddings
- **`src/lib/`** - Core libraries (embedding engines, WordPress importer, markdown agent)
- **`src/modules/repo-processor/`** - Embedded TypeScript module for markdown processing
- **`src/process/`** - Task processing modules (asset building, database creation, deployment)
- **`src/services/`** - Utility services (GitHub API, logging, R2 storage)

### AI Integration
- CLIP embeddings for text-to-image semantic search
- Hugging Face transformers for text embeddings
- Vector database integration with Vectra
- OpenAI integration for project generation from natural language briefs
- SQLite with vector extensions for similarity search

### Job Isolation
Each job gets:
- Isolated logger instance with anonymized sensitive data
- Temporary folder with automatic cleanup
- Memory-efficient concurrent processing
- Comprehensive error handling

## Key Development Patterns

### Environment Variables
Required environment variables:
- `GITHUB_TOKEN` - GitHub API access
- `OPENAI_API_KEY` - AI project generation
- R2 storage credentials for deployment

**Note**: This CF version has `SKIP_EMBEDDINGS=false` by default because models are pre-loaded in the Docker image. The container runs in offline mode (`TRANSFORMERS_OFFLINE=1`) to use cached models.

### Repository Processing Workflow
1. **Acquisition** - Clone or create repositories via GitHub API
2. **Processing** - Parse markdown with frontmatter using embedded repo-processor
3. **Enhancement** - Generate embeddings and build SQLite databases with vector search
4. **Deployment** - Upload to Cloudflare R2 with optimized structure

### Testing Strategy
No formal test suite - uses dedicated script files in `/scripts/` for integration testing with real-world data. Always run `npm run testFullWorkflow` before major deployments.

### Content Generation
The service can generate structured markdown projects from natural language briefs, including:
- Contextually relevant frontmatter fields
- Wiki-style linking with `[[filename]]` syntax
- Template-based repository creation
- WordPress XML to markdown conversion with preserved metadata

## Technology Stack

### Core Dependencies
- **Express.js** - Web framework
- **repo-processor** - Custom TypeScript module (embedded in src/modules/)
- **better-sqlite3** - SQLite with vector extensions
- **@huggingface/transformers** - AI embeddings
- **octokit** - GitHub API integration
- **vectra** - Vector database for semantic search
- **openai** - Project generation from briefs

### Development Tools
- **nodemon** - Development auto-restart
- **Docker** - Containerization with Python/Node.js base image
- No formal linting/formatting tools configured
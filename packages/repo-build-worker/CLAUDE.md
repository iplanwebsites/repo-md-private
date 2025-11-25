# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Repo Build Worker** is an asynchronous processing service for the repo.md platform that transforms markdown repositories into deployable websites. It runs on GCP Cloud Run and Cloudflare Containers, processing repository data to generate static sites, documentation, blogs, and other markdown-based projects with AI-powered features.

### Platform Support
- **GCP Cloud Run** - Current production platform with full AI embeddings
- **Cloudflare Containers** - New deployment target with optional embeddings (configurable via `SKIP_EMBEDDINGS` flag)

## Development Commands

### Core Development
- `npm run dev` - Start development server with auto-restart (port 5522)
- `npm start` - Run production server
- `npm install` - Install dependencies

### Testing & Validation
- `npm run testFullWorkflow` - Test complete processing pipeline (recommended for major changes)
- `npm run testProjectStarterGenerator` - Test AI project generation from briefs
- `npm run test:wp` - Test WordPress import functionality
- `npm run test:img` - Test image embedding processing
- `npm run test:docker` - Test Docker containerization

### Docker Development
- `npm run copy:repo-processor` - Copy embedded repo-processor module for Docker
- `docker build -t repo-worker .` - Build Docker image
- `docker run -p 5522:5522 repo-worker` - Run containerized service

### Deployment
- `npm run dokku` - Deploy to Dokku platform
- Uses GitLab CI/CD for GCP Cloud Run deployment

### Cloudflare Containers (New)
- `npm run cf:workflow` - Test CF deployment readiness
- `npm run cf:test` - Run CF container tests locally
- `npm run cf:dev` - Start local development (CF mode)
- `npm run cf:deploy:dev` - Deploy to Cloudflare (dev)
- `npm run cf:deploy:staging` - Deploy to Cloudflare (staging)
- `npm run cf:deploy:production` - Deploy to Cloudflare (production)
- `npm run cf:status` - Check deployment status
- `npm run cf:logs` - Stream live logs
- `npm run cf:manage` - Management CLI for CF operations
- See `DEV/CF_DEPLOYMENT_GUIDE.md` for complete guide (all CF docs in `DEV/` folder)

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

### Environment Dependencies
Required environment variables:
- `GITHUB_TOKEN` - GitHub API access
- `OPENAI_API_KEY` - AI project generation
- `SKIP_EMBEDDINGS` - Set to `true` to disable embeddings (required for CF Containers)
- R2 storage credentials for deployment
- Various service tokens for integrations

**Note**: When `SKIP_EMBEDDINGS=true`, the worker skips local ML model downloads and embeddings generation. This is required for Cloudflare Containers due to memory constraints. See `DEV/PROCESSOR_LIB_REQUIREMENTS.md` for details.

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
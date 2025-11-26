# Repo Build Worker API Guide

## Overview
The Repo Build Worker is an asynchronous processing service that transforms markdown repositories into deployable websites. It runs on GCP Cloud Run and processes jobs through HTTP endpoints with callback URLs.

**Base URL:** `http://localhost:5522` (development) or your deployed URL

## Health Check Endpoints

### GET /
Basic health check endpoint.

**Response:**
```json
{
  "status": "healthy ❤️",
  "msg": "This is a build worker for repo.md"
}
```

### GET /health
Detailed health check with timestamp.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2023-12-01T10:00:00.000Z"
}
```

## Main Processing Endpoint

### POST /process
Submit asynchronous processing jobs.

**Required Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "jobId": "unique-job-identifier",
  "task": "task-type",
  "data": {
    // Task-specific parameters
  },
  "callbackUrl": "https://your-api.com/callback"
}
```

**Response (Immediate):**
```json
{
  "status": "accepted",
  "jobId": "unique-job-identifier"
}
```

**Callback Response (Async):**
Success:
```json
{
  "jobId": "unique-job-identifier",
  "status": "completed",
  "result": {
    // Task-specific results
  },
  "processedAt": "2023-12-01T10:00:00.000Z",
  "duration": 5000,
  "logs": [
    // Processing logs
  ]
}
```

Error:
```json
{
  "jobId": "unique-job-identifier",
  "status": "failed",
  "error": "Error message",
  "processedAt": "2023-12-01T10:00:00.000Z",
  "logs": [
    // Processing logs
  ]
}
```

## Task Types

### 1. process-all
Complete processing pipeline: assets → database → embeddings → enrichment.

**Parameters:**
```json
{
  "repoUrl": "https://github.com/user/repo",
  "branch": "main",
  "gitToken": "ghp_xxxx" // Optional for public repos
}
```

**What it does:**
1. Builds assets from markdown files
2. Generates embeddings for semantic search
3. Creates SQLite database with vector extensions
4. Enriches data with metadata

### 2. build-assets
Process markdown files and build static assets.

**Parameters:**
```json
{
  "repoUrl": "https://github.com/user/repo",
  "branch": "main",
  "gitToken": "ghp_xxxx" // Optional for public repos
}
```

**What it does:**
1. Parses markdown with frontmatter
2. Processes embedded images
3. Generates embeddings for text and images
4. Creates Vectra index for semantic search
5. Builds SQLite database

### 3. build-database
Create SQLite database from processed assets.

**Parameters:**
```json
{
  "assets": {
    "distFolder": "/path/to/processed/assets"
  }
}
```

### 4. enrich-data
Add metadata and enhance processed content.

**Parameters:**
```json
{
  "assets": {
    "distFolder": "/path/to/processed/assets",
    "databasePath": "/path/to/database.db"
  }
}
```

### 5. acquire-user-repo
Clone GitHub repository to temporary folder.

**Parameters:**
```json
{
  "repoUrl": "https://github.com/user/repo",
  "branch": "main", // Optional, defaults to "main"
  "gitToken": "ghp_xxxx", // Optional for public repos
  "depth": 1 // Optional, shallow clone depth
}
```

**What it does:**
1. Validates repository URL
2. Clones repository with specified branch
3. Returns temporary folder path

### 6. process-with-repo
Acquire repository then run full processing pipeline.

**Parameters:**
```json
{
  "repoUrl": "https://github.com/user/repo",
  "branch": "main",
  "gitToken": "ghp_xxxx"
}
```

**What it does:**
1. Clones repository
2. Runs `build-assets`
3. Runs `enrich-data`

### 7. deploy-repo
Deploy repository and publish to R2 storage.

**Parameters:**
```json
{
  "repoUrl": "https://github.com/user/repo",
  "gitToken": "ghp_xxxx",
  "r2Config": {
    "accountId": "cloudflare-account-id",
    "accessKeyId": "r2-access-key",
    "secretAccessKey": "r2-secret-key",
    "bucketName": "your-bucket"
  }
}
```

**What it does:**
1. Deploys repository
2. Builds assets with embeddings
3. Enriches data
4. Publishes to Cloudflare R2

### 8. wp-import
Import WordPress XML export and create repository.

**Parameters:**
```json
{
  "wpXml": "base64-encoded-xml-data",
  "repoName": "imported-wp-site",
  "repoDescription": "WordPress import",
  "isPrivate": false,
  "gitToken": "ghp_xxxx",
  "wpImportOptions": {
    // WordPress import options
  }
}
```

**What it does:**
1. Converts WordPress XML to markdown
2. Creates GitHub repository
3. Commits converted content
4. Runs full deployment pipeline

### 9. generate-project-from-brief
Generate project from natural language description.

**Parameters:**
```json
{
  "brief": "Create a personal blog about web development",
  "repoName": "my-dev-blog", // Optional
  "repoDescription": "Personal development blog", // Optional
  "isPrivate": false,
  "gitToken": "ghp_xxxx" // Optional
}
```

**What it does:**
1. Uses AI to generate structured markdown project
2. Creates contextually relevant content
3. Optionally creates GitHub repository
4. Returns generated files and repo info

### 10. generate-and-deploy-project
Generate project from brief and deploy it.

**Parameters:**
```json
{
  "brief": "Create a portfolio website for a designer",
  "repoName": "designer-portfolio",
  "gitToken": "ghp_xxxx",
  "r2Config": {
    // R2 storage configuration
  }
}
```

**What it does:**
1. Generates project from brief
2. Builds assets with embeddings
3. Enriches data
4. Publishes to R2 storage

### 11. publish-r2
Publish repository files to Cloudflare R2.

**Parameters:**
```json
{
  "assets": {
    "distFolder": "/path/to/assets"
  },
  "r2Config": {
    "accountId": "cloudflare-account-id",
    "accessKeyId": "r2-access-key",
    "secretAccessKey": "r2-secret-key",
    "bucketName": "your-bucket"
  }
}
```

## AI Inference Endpoints

### POST /inference/clip-by-text
Generate CLIP embeddings from text for semantic image search.

**Request:**
```json
{
  "text": "A beautiful sunset over mountains"
}
```

**Response:**
```json
{
  "status": "success",
  "embedding": [0.1, 0.2, ...], // 512-dimensional array
  "metadata": {
    "model": "mobileclip",
    "dimension": 512,
    "duration": 150,
    "timestamp": "2023-12-01T10:00:00.000Z"
  }
}
```

### POST /inference/clip-by-image
Generate CLIP embeddings from images.

**Request:**
```json
{
  "imageUrl": "https://example.com/image.jpg"
  // OR
  "imageData": "base64-encoded-image-data"
}
```

**Response:**
```json
{
  "status": "success",
  "embedding": [0.1, 0.2, ...],
  "metadata": {
    "model": "mobileclip",
    "dimension": 512,
    "duration": 200,
    "timestamp": "2023-12-01T10:00:00.000Z"
  }
}
```

### POST /inference/text-embedding
Generate text embeddings for semantic search.

**Request:**
```json
{
  "text": "Machine learning fundamentals",
  "instruction": "Represent the document for semantic search:" // Optional
}
```

**Response:**
```json
{
  "status": "success",
  "embedding": [0.1, 0.2, ...], // 384-dimensional array
  "metadata": {
    "model": "all-MiniLM-L6-v2",
    "dimension": 384,
    "duration": 100,
    "instruction": "Represent the document for semantic search:",
    "timestamp": "2023-12-01T10:00:00.000Z"
  }
}
```

## Environment Variables

Required environment variables:
- `GITHUB_TOKEN` - GitHub API access
- `OPENAI_API_KEY` - AI project generation (optional)
- `TEMP_DIR` - Temporary file storage (defaults to /tmp)
- `KEEP_TMP_FILES` - Set to "true" to skip cleanup (development)

R2 Storage (for deployment tasks):
- R2 credentials passed in task data

## Error Handling

All endpoints return appropriate HTTP status codes:
- `200` - Success
- `400` - Bad request (missing required fields)
- `500` - Internal server error

Error responses include:
```json
{
  "status": "error",
  "message": "Descriptive error message"
}
```

## Security Notes

- Sensitive data (tokens, keys) is automatically anonymized in logs
- Each job gets isolated logger and temporary folder
- Automatic cleanup of temporary files after processing
- GitHub tokens are masked in git command logs

## Usage Examples

### Basic Repository Processing
```bash
curl -X POST http://localhost:5522/process \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "job-123",
    "task": "process-all",
    "data": {
      "repoUrl": "https://github.com/user/repo",
      "gitToken": "ghp_xxxx"
    },
    "callbackUrl": "https://your-api.com/callback"
  }'
```

### Generate Project from Brief
```bash
curl -X POST http://localhost:5522/process \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "job-456",
    "task": "generate-project-from-brief",
    "data": {
      "brief": "Create a technical blog about machine learning",
      "repoName": "ml-blog",
      "gitToken": "ghp_xxxx"
    },
    "callbackUrl": "https://your-api.com/callback"
  }'
```

### Get Text Embedding
```bash
curl -X POST http://localhost:5522/inference/text-embedding \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Deep learning and neural networks"
  }'
```
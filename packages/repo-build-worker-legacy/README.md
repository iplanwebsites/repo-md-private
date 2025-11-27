# Repo Worker Service & Project Brief Generator

![GCP Cloud Run](https://img.shields.io/badge/GCP-Cloud%20Run-blue)
![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)

A worker service that processes repository data asynchronously using GCP Cloud Run. This worker handles various tasks in the processing pipeline including building assets, computing embeddings, and enriching data.

## Project Brief to Starter Repository Generator

### Overview

This module includes a Node.js tool that takes a project brief as input and uses OpenAI to generate a JSON array of files to be created for a starter repo.md (platform) project. The generated files are markdown documents with appropriate frontmatter for various use cases like blogs, websites, or applications.

### Project Brief Summary

The system processes natural language project descriptions and automatically generates:
- Markdown files with relevant frontmatter
- Inter-linked content using wiki syntax `[[filename]]`
- Structured project layouts appropriate for the requested use case

### Repo.md Platform Integration

This is designed as a starter repository generator for the repo.md platform, which processes markdown files with frontmatter to create dynamic websites and applications.

### Frontmatter Parameters

The generated files include contextually relevant frontmatter fields that vary based on the project brief:

#### Common Fields
- `title`: Page or post title
- `date`: Creation or publication date
- `slug`: URL-friendly identifier
- `description`: Brief content summary

#### Content-Specific Fields
- **Blog/News**: `author`, `tags`, `category`, `featured`, `excerpt`
- **Documentation**: `section`, `order`, `prev`, `next`, `toc`
- **Portfolio**: `project_type`, `technologies`, `demo_url`, `github_url`
- **E-commerce**: `price`, `sku`, `availability`, `images`

### Wiki-Style Linking

Files can reference each other using wiki syntax `[[filename]]` (without extension), enabling:
- Automatic cross-referencing between pages
- Dynamic navigation generation
- Content relationship mapping

### Usage

```javascript
const { createStarterProjectFromBrief } = require('./lib/mdAgent');

const brief = "Create a personal blog about web development with posts about React, Node.js, and deployment";
const options = {
  outputDir: './output',
  includeAssets: true
};

await createStarterProjectFromBrief(brief, options);
```

### Environment Variables

- `OPENAI_API_KEY`: Your OpenAI API key for content generation

### Testing

Run the project generator test:

```bash
npm run testProjectStarterGenerator
```

## 🚀 Features

- HTTP endpoint for job submission
- Asynchronous processing with callbacks
- Multiple task types support
- Automatic deployment via GitLab CI/CD
- Emoji-rich logging for clear visibility

## 🛠️ Architecture

The worker service follows a simple architecture:

1. Exposes an HTTP endpoint to receive job requests
2. Acknowledges requests immediately
3. Processes tasks asynchronously
4. Calls back to the specified URL with results

## 📋 Task Types

- `process-all`: Runs the full pipeline (build assets → build SQLite database → compute embeddings → enrich data)
- `build-assets`: Only runs the asset building step
- `build-database`: Only runs the SQLite database building step
- `compute-embeddings`: Only computes embeddings
- `enrich-data`: Only performs data enrichment
- `acquire-user-repo`: Clones a GitHub repository to a temporary folder
- `new-repo-from-template`: Creates a new repository from a template and clones it
- `process-with-repo`: Acquires a repository and then runs the full processing pipeline
- `process-from-template`: Creates a repository from template and then runs the full processing pipeline
- `generate-project-from-brief`: Generates a project from a natural language brief, optionally creates GitHub repo
- `generate-and-deploy-project`: Generates project from brief, creates repo, and runs full deployment pipeline

## 🏃‍♂️ Running Locally

```bash
# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env file to set custom PORT if needed (defaults to 5522)

# Run in development mode with auto-restart
npm run dev

# Run in production mode
npm start
```

## 📦 Docker Build

```bash
docker build -t repo-worker .
docker run -p 5522:5522 repo-worker
```

## 🌐 API Usage

### Health Check

```bash
curl http://localhost:5522/health
```

### Submit Job

#### Process All
```bash
curl -X POST http://localhost:5522/process \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "job-123",
    "task": "process-all",
    "data": { "repoUrl": "https://github.com/user/repo" },
    "callbackUrl": "https://your-api.example.com/job-callback"
  }'
```

#### Acquire User Repository
```bash
curl -X POST http://localhost:5522/process \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "job-456",
    "task": "acquire-user-repo",
    "data": { 
      "repoUrl": "https://github.com/user/repo",
      "branch": "main",
      "gitToken": "YOUR_GITHUB_TOKEN"
    },
    "callbackUrl": "https://your-api.example.com/job-callback"
  }'
```

#### Create New Repository from Template
```bash
curl -X POST http://localhost:5522/process \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "job-789",
    "task": "new-repo-from-template",
    "data": { 
      "templateRepoUrl": "https://github.com/template-owner/template-repo",
      "newRepoName": "my-new-project",
      "newRepoDescription": "Created from template",
      "isPrivate": false,
      "gitToken": "YOUR_GITHUB_TOKEN"
    },
    "callbackUrl": "https://your-api.example.com/job-callback"
  }'
```

#### Process with Repository Acquisition
```bash
curl -X POST http://localhost:5522/process \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "job-101112",
    "task": "process-with-repo",
    "data": { 
      "repoUrl": "https://github.com/user/repo",
      "branch": "main",
      "gitToken": "YOUR_GITHUB_TOKEN"
    },
    "callbackUrl": "https://your-api.example.com/job-callback"
  }'
```

#### Build Database from Content
```bash
curl -X POST http://localhost:5522/process \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "job-db123",
    "task": "build-database",
    "data": { 
      "assets": {
        "distFolder": "/path/to/dist",
        "contentPath": "/path/to/dist/content.json"
      }
    },
    "callbackUrl": "https://your-api.example.com/job-callback"
  }'
```

#### Generate Project from Brief
```bash
curl -X POST http://localhost:5522/process \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "job-gen123",
    "task": "generate-project-from-brief",
    "data": {
      "brief": "Create a personal blog about web development with posts about React, Node.js, and deployment best practices",
      "repoName": "my-dev-blog",
      "repoDescription": "Personal blog about web development",
      "isPrivate": false,
      "gitToken": "YOUR_GITHUB_TOKEN"
    },
    "callbackUrl": "https://your-api.example.com/job-callback"
  }'
```

#### Generate and Deploy Project
```bash
curl -X POST http://localhost:5522/process \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "job-deploy123",
    "task": "generate-and-deploy-project", 
    "data": {
      "brief": "Build documentation for a SaaS API product including getting started guide, API reference, and tutorials",
      "repoName": "api-docs",
      "isPrivate": false,
      "gitToken": "YOUR_GITHUB_TOKEN"
    },
    "callbackUrl": "https://your-api.example.com/job-callback"
  }'
```

## 🚢 GCP Cloud Run Setup

### Initial Setup

1. **Create a GCP Project**

```bash
gcloud projects create your-project-id
gcloud config set project your-project-id
```

2. **Enable Required APIs**

```bash
gcloud services enable cloudbuild.googleapis.com run.googleapis.com artifactregistry.googleapis.com containerregistry.googleapis.com
```

3. **Set up Service Account for GitLab CI/CD**

```bash
# Create service account
gcloud iam service-accounts create gitlab-ci-account \
  --display-name="GitLab CI Service Account"

# Grant necessary roles
gcloud projects add-iam-policy-binding your-project-id \
  --member="serviceAccount:gitlab-ci-account@your-project-id.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding your-project-id \
  --member="serviceAccount:gitlab-ci-account@your-project-id.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding your-project-id \
  --member="serviceAccount:gitlab-ci-account@your-project-id.iam.gserviceaccount.com" \
  --role="roles/cloudbuild.builds.builder"

gcloud projects add-iam-policy-binding your-project-id \
  --member="serviceAccount:gitlab-ci-account@your-project-id.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# Create and download key
gcloud iam service-accounts keys create gitlab-ci-key.json \
  --iam-account=gitlab-ci-account@your-project-id.iam.gserviceaccount.com
```

4. **Add Service Account Key to GitLab CI/CD Variables**

   - Go to your GitLab project → Settings → CI/CD → Variables
   - Add a new variable called `GCP_SERVICE_ACCOUNT`
   - Paste the content of the `gitlab-ci-key.json` file
   - Make sure it's masked but not protected

5. **Update GitLab CI/CD Variables**

   - Add `GCP_PROJECT_ID` with your actual GCP project ID
   - Optionally customize `REGION` and `SERVICE_NAME` if needed

### Manual Deployment

If you need to deploy manually without GitLab CI/CD:

```bash
# Build the image
gcloud builds submit --tag gcr.io/your-project-id/repo-worker

# Deploy to Cloud Run
gcloud run deploy repo-worker \
  --image gcr.io/your-project-id/repo-worker \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 512M \
  --cpu 1 \
  --concurrency 80 \
  --timeout 5m
```

## 🔒 Security Considerations

For production deployments, consider:

1. **Authentication**: Remove `--allow-unauthenticated` and set up proper authentication
2. **Secrets Management**: Use GCP Secret Manager for sensitive values
3. **VPC-SC**: Configure VPC Service Controls for additional network security
4. **Logging**: Set up structured logging with Cloud Logging

## 📊 Monitoring

Use GCP Cloud Monitoring to:

- Set up alerts for service errors
- Monitor CPU and memory usage
- Track job processing times and throughput
- Create custom dashboards for service health

## 🧩 Customization

To add new task types:

1. Create a new process module in `src/process/`
2. Import the new process in the worker.js file
3. Add the new task type to the switch statement in `doWork()` function
4. Deploy the updated service

### SQLite Database Integration

The service builds an SQLite database (`content.sqlite`) in the dist folder alongside the existing content files. This database provides efficient querying capabilities for the processed content. The database is created by the `buildSqliteDatabase` process.

#### Database Schema

- **notes**: Main table containing all document content and metadata
  - `id`: Unique identifier for the note
  - `slug`: URL-friendly version of the title
  - `title`: Document title
  - `content`: HTML or markdown content
  - `backlinks`: JSON array of backlinks to this document
  - `wordCount`: Number of words in the document
  - `created`: Creation timestamp
  - `modified`: Last modification timestamp
  - `path`: Original file path
  - `type`: Document type

- **tags**: Table containing all unique tags
  - `id`: Unique identifier
  - `tag`: Tag name

- **note_tags**: Junction table for many-to-many relationship between notes and tags
  - `note_id`: Reference to notes.id
  - `tag_id`: Reference to tags.id

- **links**: Table storing relationships between documents
  - `source_id`: Source document ID
  - `target_id`: Target document ID

#### Example Queries

```sql
-- Get all documents with a specific tag
SELECT n.* FROM notes n
JOIN note_tags nt ON n.id = nt.note_id
JOIN tags t ON t.id = nt.tag_id
WHERE t.tag = 'important';

-- Find all linked documents
SELECT target.* FROM notes source
JOIN links l ON source.id = l.source_id
JOIN notes target ON l.target_id = target.id
WHERE source.slug = 'home-page';
```

### GitHub Integration

This service includes GitHub integration capabilities:

- **Repository Cloning**: Clone any GitHub repository to a temporary folder
- **Template Repository**: Create new repositories from templates
- **Advanced Operations**: The service supports repository creation, forking, and build operations

Make sure to set up the required GitHub authentication tokens in your environment:

```bash
# In your .env file
GITHUB_TOKEN=your_github_personal_access_token
```

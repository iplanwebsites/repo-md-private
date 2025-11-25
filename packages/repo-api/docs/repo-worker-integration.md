# Repo Worker Integration

This document outlines how the PushMD API integrates with the Repo Worker service for processing repository-related tasks.

## Overview

The Repo Worker is a standalone service that handles repository operations such as:
- Cloning repositories
- Creating repositories from templates
- Building assets
- Computing embeddings
- Enriching data

The API communicates with the worker via HTTP requests and receives asynchronous responses through a callback endpoint.

## Configuration

The worker integration is configured through environment variables:

```
# Primary worker API URL
REPO_WORKER_API_URL=http://localhost:8080

# Optional development worker URL (when USE_DEV_CLOUDRUN_WORKER=true)
REPO_WORKER_API_URL_DEV=http://localhost:8081

# Toggle between production and dev worker environments
USE_DEV_CLOUDRUN_WORKER=true
```

## Communication Flow

1. API receives a request to process a repository
2. API creates a job record in the database
3. API sends a request to the worker service
4. Worker processes the request asynchronously
5. Worker sends results to the callback URL when complete
6. API updates the job record with the results

## Request Format

The API sends requests to the worker's `/process` endpoint with the following structure:

```json
{
  "jobId": "unique-job-id",
  "task": "task-type",
  "callbackUrl": "https://api.example.com/api/cloudrun/callback",
  "data": {
    // Task-specific parameters
  }
}
```

Common task types include:
- `acquire-user-repo` - Clones a GitHub repository
- `process-with-repo` - Acquires a repo and then runs the full processing pipeline

## Callback Format

The worker sends results to the callback URL when processing is complete:

### Success Response

```json
{
  "jobId": "job123",
  "status": "completed",
  "result": {
    // Task-specific result data
  },
  "processedAt": "2025-04-27T12:34:56.789Z",
  "duration": 1234 // milliseconds
}
```

### Error Response

```json
{
  "jobId": "job123",
  "status": "failed",
  "error": "Error message details",
  "processedAt": "2025-04-27T12:34:56.789Z"
}
```

## Fallback Mechanism

The system includes a fallback to the legacy Cloud Run job implementation if:
- The worker API URL is not configured
- The request to the worker API fails

This ensures backward compatibility and system resilience.

## Local Development

For local development:

1. Set `NODE_ENV=development` and `REPO_WORKER_API_URL=http://localhost:8080`
2. If the worker is not available, the system will simulate job execution

## Implementation Files

The worker integration is implemented in the following files:

- `lib/cloudRun.js` - Main integration logic with the worker API
- `routes/cloudRunCallbackRoutes.js` - Callback endpoint handler
- `routes/cloudRunRoutes.js` - API routes for repository operations
- `lib/cloudrun/jobModel.js` - Database models for job tracking

## Adding New Task Types

To add support for a new worker task type:

1. Add the task to the `mapTaskToWorkerTask` function in `cloudRun.js`
2. Add data processing logic in the `processDataForWorker` function
3. Update the job model if necessary to support new parameters
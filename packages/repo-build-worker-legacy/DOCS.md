# Repo Worker API Documentation

This document describes how to interface with the repository worker service, including available methods and their parameters.

## API Endpoints

### Health Check

```
GET /health
```

Returns a simple health status check with a timestamp.

**Response:**

```json
{
  "status": "healthy",
  "timestamp": "2025-04-27T12:34:56.789Z"
}
```

### Process

```
POST /process
```

Initiates an asynchronous processing job.

**Required Parameters:**

- `jobId` (string): Unique identifier for the job
- `task` (string): Task type to execute
- `callbackUrl` (string): URL to send results when processing completes

**Optional Parameters:**

- `data` (object): Task-specific parameters

**Response:**

```json
{
  "status": "accepted",
  "jobId": "your-job-id"
}
```

Results will be sent to the provided `callbackUrl` upon completion.

## Task Types

The worker supports the following task types:

| Task Type                | Description                                                                       |
| ------------------------ | --------------------------------------------------------------------------------- |
| `process-all`            | Runs the full processing pipeline (build assets, compute embeddings, enrich data) |
| `build-assets`           | Only builds assets                                                                |
| `compute-embeddings`     | Only computes embeddings                                                          |
| `enrich-data`            | Only enriches data                                                                |
| `acquire-user-repo`      | Clones a GitHub repository                                                        |
| `new-repo-from-template` | Creates a new repository from a template                                          |
| `process-with-repo`      | Acquires a repo and then runs the full processing pipeline                        |
| `process-from-template`  | Creates a repo from template and then runs the full processing pipeline           |

## Task Parameters

### acquire-user-repo

Clones a GitHub repository to a temporary folder.

**Required Parameters:**

- `repoUrl` (string): GitHub repository URL

**Optional Parameters:**

- `branch` (string): Branch to clone (defaults to 'main')
- `gitToken` (string): GitHub token for authentication (optional for public repos)
- `jobId` (string): Unique job identifier
- `tempFolderPath` (string): Path to temporary folder (generated if not provided)
- `depth` (number): Git clone depth (defaults to 1)

**Example:**

```json
{
  "jobId": "job123",
  "task": "acquire-user-repo",
  "callbackUrl": "https://your-service.com/callback",
  "data": {
    "repoUrl": "https://github.com/username/repo-name",
    "branch": "main",
    "gitToken": "github_pat_..."
  }
}
```

### build-assets

Builds assets from the repository data.

**Required Parameters:**

- `jobId` (string): Unique job identifier

**Optional Parameters:**

- None

### compute-embeddings

Computes embeddings for the repository data.

**Required Parameters:**

- `jobId` (string): Unique job identifier

**Optional Parameters:**

- None

### enrich-data

Enriches repository data with additional information.

**Required Parameters:**

- `jobId` (string): Unique job identifier

**Optional Parameters:**

- None

### new-repo-from-template

Creates a new repository from a template repository and clones it.

**Required Parameters:**

- `templateRepoUrl` (string): Template repository URL
- `newRepoName` (string): Name for the new repository
- `gitToken` (string): GitHub token for authentication

**Optional Parameters:**

- `newRepoDescription` (string): Description for the new repository
- `isPrivate` (boolean): Whether the new repository should be private (defaults to false)
- `jobId` (string): Unique job identifier
- `tempFolderPath` (string): Path to temporary folder (generated if not provided)

**Example:**

```json
{
  "jobId": "job123",
  "task": "new-repo-from-template",
  "callbackUrl": "https://your-service.com/callback",
  "data": {
    "templateRepoUrl": "https://github.com/username/template-repo",
    "newRepoName": "my-new-repo",
    "newRepoDescription": "Created from template",
    "isPrivate": true,
    "gitToken": "github_pat_..."
  }
}
```

## Callback Format

Upon task completion, the worker sends a callback to the provided URL.

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

## Environment Variables

The worker service can be configured with the following environment variables:

- `PORT`: Server port (default: 8080)
- `GITHUB_TOKEN`: Default GitHub token if not provided in the request
- `TEMP_DIR`: Directory for temporary files (default: "/tmp")

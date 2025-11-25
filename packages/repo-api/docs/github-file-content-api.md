# GitHub File Content API

This document describes how to use the new tRPC method to retrieve file content from a GitHub repository associated with a project.

## Overview

The `getGitHubFileContent` method allows you to fetch the content of individual files from a GitHub repository that's linked to a project. This method uses the GitHub REST API and requires the user to have a valid GitHub access token stored in their profile.

## Endpoint

**tRPC Method:** `projects.getGitHubFileContent`

**Type:** Query

**Access Level:** Project Viewer (requires at least viewer access to the project)

## Parameters

```typescript
{
  projectId: string;    // Required: The ID of the project (provided automatically by projectViewerProcedure)
  path: string;         // Required: File path in the repository (e.g., "README.md", "src/app.js")
  ref?: string;         // Optional: Git reference (branch, tag, or commit SHA). Defaults to "main"
}
```

## Requirements

1. **Project Setup**: The project must have a linked GitHub repository with `owner` and `name` fields populated
2. **User Authentication**: User must be authenticated and have access to the project (viewer level or higher)
3. **GitHub Token**: User must have a valid GitHub access token stored in their profile (`githubSupaToken` field)

## Response Format

### Success Response

```typescript
{
  success: true;
  file: {
    type: "file" | "dir";
    name: string;
    path: string;
    sha: string;
    size: number;
    content?: string;        // File content (decoded from base64) - only for files
    contents?: Array<{       // Directory listing - only for directories
      type: string;
      name: string;
      path: string;
      sha: string;
      size: number;
      html_url: string;
    }>;
    download_url?: string;
    html_url: string;
    encoding?: string;
  };
  repository: {
    owner: string;
    name: string;
    fullName: string;
  };
}
```

### Error Responses

- **400 Bad Request**: Project doesn't have a linked GitHub repository
- **401 Unauthorized**: No GitHub access token found for user
- **403 Forbidden**: Access denied to repository (invalid token or private repo)
- **404 Not Found**: File not found in repository
- **500 Internal Server Error**: Other errors

## Usage Examples

### Basic File Retrieval

```typescript
// Get the content of README.md from the main branch
const result = await trpc.projects.getGitHubFileContent.query({
  projectId: "project_123",
  path: "README.md"
});

if (result.success) {
  console.log("File content:", result.file.content);
}
```

### Get File from Specific Branch

```typescript
// Get package.json from the develop branch
const result = await trpc.projects.getGitHubFileContent.query({
  projectId: "project_123",
  path: "package.json",
  ref: "develop"
});
```

### Get File from Specific Commit

```typescript
// Get file from a specific commit SHA
const result = await trpc.projects.getGitHubFileContent.query({
  projectId: "project_123",
  path: "src/app.js",
  ref: "a1b2c3d4e5f6789"
});
```

### Directory Listing

```typescript
// Get directory contents
const result = await trpc.projects.getGitHubFileContent.query({
  projectId: "project_123",
  path: "src"
});

if (result.success && result.file.type === "dir") {
  console.log("Directory contents:", result.file.contents);
}
```

## Implementation Details

### GitHub Token Storage

The method retrieves the user's GitHub token from the database using the `getUserGithubToken()` function, which:

1. Looks for `githubSupaToken` in the user's profile
2. Falls back to `process.env.TEMP_GH_TOKEN_FELIX` if no user token is found

### File Content Processing

- File content is automatically decoded from base64 encoding
- Binary files are supported but content will be returned as decoded text
- Large files are subject to GitHub API limits (typically 1MB)

### Error Handling

The method includes comprehensive error handling for:
- GitHub API rate limits
- Authentication failures
- File not found scenarios
- Network errors

## Security Considerations

- Users can only access files from repositories linked to projects they have access to
- GitHub tokens are stored securely and not exposed in responses
- Access is controlled through the existing project permission system
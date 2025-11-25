# GitHub File Operations API

Simple API endpoints for browsing directories, reading/updating files, and uploading images to GitHub repositories.

> **Note**: For advanced git operations like branch management, pull requests, and automated workflows, see [GitHub Git Workflows API](./github-git-workflows-api.md).

## Prerequisites

- User must be authenticated with GitHub OAuth
- Project must have a linked GitHub repository
- User needs appropriate permissions (Editor role for write operations)

## Available Operations

### 1. List Directory Contents

```javascript
const directory = await trpc.projects.listGitHubDirectory.query({
  projectId: 'your-project-id',
  path: 'src/components', // optional, defaults to root ''
  ref: 'main' // optional, defaults to 'main'
});

// Response
{
  success: true,
  directory: {
    type: 'dir',
    path: 'src/components',
    ref: 'main',
    items: [
      {
        type: 'dir',
        name: 'layout',
        path: 'src/components/layout',
        sha: 'abc123...',
        size: 0,
        download_url: null,
        html_url: 'https://github.com/...',
        has_contents: true
      },
      {
        type: 'file',
        name: 'Button.jsx',
        path: 'src/components/Button.jsx',
        sha: 'def456...',
        size: 1234,
        download_url: 'https://raw.githubusercontent.com/...',
        html_url: 'https://github.com/...'
      }
    ]
  },
  repository: {
    owner: 'username',
    name: 'repo-name',
    fullName: 'username/repo-name'
  }
}
```

### 2. Read File Content

```javascript
const fileContent = await trpc.projects.getGitHubFileContent.query({
  projectId: 'your-project-id',
  path: 'path/to/file.md',
  ref: 'main' // optional, defaults to 'main'
});

// Response
{
  success: true,
  file: {
    type: 'file',
    name: 'file.md',
    path: 'path/to/file.md',
    sha: 'abc123...', // SHA needed for updates
    size: 1234,
    content: 'File content here...',
    download_url: 'https://raw.githubusercontent.com/...',
    html_url: 'https://github.com/...'
  },
  repository: {
    owner: 'username',
    name: 'repo-name',
    fullName: 'username/repo-name'
  }
}
```

### 3. Update File Content

```javascript
const result = await trpc.projects.updateGitHubFile.mutate({
  projectId: 'your-project-id',
  path: 'path/to/file.md',
  content: 'New file content here...',
  message: 'Update file.md with new content',
  branch: 'main', // optional, defaults to 'main'
  sha: 'abc123...' // Required for existing files (get from read operation)
});

// Response
{
  success: true,
  commit: {
    sha: 'def456...',
    message: 'Update file.md with new content',
    author: {...},
    committer: {...}
  },
  content: {
    sha: 'ghi789...', // New SHA for future updates
    path: 'path/to/file.md',
    size: 2345
  }
}
```

### 4. Upload Image

Two options: provide a remote URL or base64 data.

#### Option A: Upload from URL

```javascript
const result = await trpc.projects.uploadGitHubImage.mutate({
  projectId: 'your-project-id',
  imageUrl: 'https://example.com/image.jpg',
  fileName: 'my-image.jpg',
  folder: 'uploads', // optional, defaults to 'uploads'
  message: 'Add new image', // optional
  branch: 'main' // optional, defaults to 'main'
});
```

#### Option B: Upload base64 data

```javascript
const result = await trpc.projects.uploadGitHubImage.mutate({
  projectId: 'your-project-id',
  imageBase64: 'iVBORw0KGgoAAAANS...', // base64 encoded image
  fileName: 'my-image.png',
  folder: 'uploads', // optional, defaults to 'uploads'
  message: 'Add new image', // optional
  branch: 'main' // optional, defaults to 'main'
});

// Response for both options
{
  success: true,
  image: {
    path: 'uploads/my-image.jpg',
    sha: 'abc123...',
    size: 45678,
    download_url: 'https://raw.githubusercontent.com/...',
    html_url: 'https://github.com/...'
  },
  commit: {
    sha: 'def456...',
    message: 'Add new image',
    author: {...},
    committer: {...}
  }
}
```

## Example Workflow

```javascript
// 1. Browse repository structure
const rootDir = await trpc.projects.listGitHubDirectory.query({
  projectId: 'project-123',
  path: '', // root directory
  ref: 'main'
});

// 2. Navigate to a subdirectory
const contentDir = await trpc.projects.listGitHubDirectory.query({
  projectId: 'project-123',
  path: 'content',
  ref: 'main'
});

// 3. Read existing file
const fileData = await trpc.projects.getGitHubFileContent.query({
  projectId: 'project-123',
  path: 'content/article.md'
});

// 4. Update the file
const updatedContent = fileData.file.content + '\n\n## New Section\nAdded content...';

await trpc.projects.updateGitHubFile.mutate({
  projectId: 'project-123',
  path: 'content/article.md',
  content: updatedContent,
  message: 'Add new section to article',
  sha: fileData.file.sha // Important: use SHA from read operation
});

// 5. Upload an image
const imageResult = await trpc.projects.uploadGitHubImage.mutate({
  projectId: 'project-123',
  imageUrl: 'https://example.com/diagram.png',
  fileName: 'architecture-diagram.png',
  folder: 'uploads/diagrams',
  message: 'Add architecture diagram'
});

// 6. Reference the uploaded image in content
const contentWithImage = `![Architecture](${imageResult.image.download_url})`;
```

## Error Handling

```javascript
try {
  const result = await trpc.projects.updateGitHubFile.mutate({...});
} catch (error) {
  if (error.code === 'UNAUTHORIZED') {
    // User needs to authenticate with GitHub
  } else if (error.code === 'BAD_REQUEST') {
    // Check if project has linked GitHub repo
  } else if (error.code === 'FORBIDDEN') {
    // User doesn't have editor permissions
  }
}
```

## Notes

- File paths should not start with '/'
- Image uploads create folders automatically if they don't exist
- All operations use the authenticated user's GitHub token
- SHA is required when updating existing files (prevents conflicts)
- Maximum file size depends on GitHub API limits (100MB)
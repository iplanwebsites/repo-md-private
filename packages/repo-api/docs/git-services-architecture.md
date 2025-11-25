# Git Services Architecture

Clean, modular architecture for git operations with provider abstraction.

## Architecture Overview

```
┌─────────────────┐
│   tRPC Routes   │  ← Frontend API
├─────────────────┤
│ GitWorkflowSvc  │  ← High-level workflows
├─────────────────┤
│  GitFileService │  ← Provider abstraction
├─────────────────┤
│  GitHubService  │  ← Provider implementation
└─────────────────┘
```

## Service Layers

### 1. **Provider Implementation** (`GitHubService`)
- Direct GitHub API integration using Octokit
- Handles authentication and API specifics
- Returns standardized responses

### 2. **Provider Abstraction** (`GitFileService`)
- Provider-agnostic interface
- Supports multiple git providers (GitHub, GitLab future)
- Consistent API across providers

### 3. **Workflow Service** (`GitWorkflowService`)
- High-level operations combining multiple actions
- Business logic for common workflows
- Atomic operations with proper error handling

### 4. **tRPC Routes** (`projectRoutes`)
- Type-safe API endpoints
- Permission-based access control
- Input validation with Zod

## Key Design Principles

### KISS (Keep It Simple, Stupid)
- Each service has a single responsibility
- Methods do one thing well
- Clear, descriptive naming

### DRY (Don't Repeat Yourself)
- Shared logic in service layers
- Reusable workflow patterns
- Consistent error handling

### Provider Agnostic
- Easy to add new providers (GitLab, Bitbucket)
- Consistent API regardless of provider
- Future-proof architecture

## Adding a New Provider

1. Create provider service (e.g., `GitLabService`)
2. Implement same methods as `GitHubService`
3. Add to `GitFileService` constructor
4. Update `getGitProviderInfo()` detection

Example:
```javascript
// lib/gitlabService.js
class GitLabService {
  async getFileContent(owner, repo, path, ref) {
    // GitLab-specific implementation
  }
  // ... other methods
}

// lib/gitFileService.js
constructor(provider, token) {
  switch (provider) {
    case 'github':
      this.service = new GitHubService(token);
      break;
    case 'gitlab':
      this.service = new GitLabService(token);
      break;
    // ...
  }
}
```

## Available Operations

### Basic Operations
- List directory contents
- Read file content
- Update/create files
- Upload images
- List branches
- Create branches
- List pull requests
- Create pull requests

### Workflow Operations
- Create branch with immediate PR
- Update file with PR creation/update
- Feature branch workflow (branch + files + PR)
- Batch file updates

## Usage Examples

### Simple Operation
```javascript
// Direct file update
await trpc.projects.updateGitHubFile.mutate({
  projectId: 'abc123',
  path: 'README.md',
  content: 'New content',
  message: 'Update README',
  branch: 'main'
});
```

### Workflow Operation
```javascript
// Complete feature workflow
await trpc.projects.workflowFeatureBranch.mutate({
  projectId: 'abc123',
  featureName: 'New Feature',
  files: [
    { path: 'src/feature.js', content: '...' },
    { path: 'test/feature.test.js', content: '...' }
  ],
  prTitle: 'Add new feature'
});
```

## Benefits

1. **Modularity**: Each layer can be tested and updated independently
2. **Extensibility**: Easy to add new providers or workflows
3. **Maintainability**: Clear separation of concerns
4. **Type Safety**: Full TypeScript/Zod validation
5. **Reusability**: Workflows can be composed from basic operations

## Future Enhancements

- GitLab provider support
- Bitbucket provider support
- Merge/rebase operations
- Conflict resolution workflows
- Branch protection rules
- Code review workflows
- CI/CD integration
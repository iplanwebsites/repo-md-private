# GitHub Git Workflows API

Advanced git operations including branch management, pull requests, and workflow automation.

## Prerequisites

- User must be authenticated with GitHub OAuth
- Project must have a linked GitHub repository
- User needs appropriate permissions (Editor role for write operations)

## Branch Operations

### 1. List Branches

```javascript
const branches = await trpc.projects.listGitHubBranches.query({
  projectId: 'your-project-id',
  protected: false // optional, filter protected branches
});

// Response
{
  success: true,
  branches: [
    {
      name: 'main',
      protected: true,
      commit: {
        sha: 'abc123...',
        url: 'https://api.github.com/...'
      }
    },
    {
      name: 'feature/new-ui',
      protected: false,
      commit: {
        sha: 'def456...',
        url: 'https://api.github.com/...'
      }
    }
  ],
  repository: {
    owner: 'username',
    name: 'repo-name',
    fullName: 'username/repo-name'
  }
}
```

### 2. Create Branch

```javascript
const branch = await trpc.projects.createGitHubBranch.mutate({
  projectId: 'your-project-id',
  branchName: 'feature/awesome-feature',
  fromBranch: 'main' // optional, defaults to default branch
});

// Response
{
  success: true,
  branch: {
    ref: 'refs/heads/feature/awesome-feature',
    sha: 'abc123...',
    branch: 'feature/awesome-feature'
  }
}
```

## Pull Request Operations

### 3. List Pull Requests

```javascript
const prs = await trpc.projects.listGitHubPullRequests.query({
  projectId: 'your-project-id',
  state: 'open', // 'open', 'closed', 'all'
  head: 'feature-branch', // optional, filter by head branch
  base: 'main', // optional, filter by base branch
  sort: 'created', // 'created', 'updated', 'popularity', 'long-running'
  direction: 'desc' // 'asc' or 'desc'
});

// Response
{
  success: true,
  pullRequests: [
    {
      number: 42,
      title: 'Add awesome feature',
      state: 'open',
      html_url: 'https://github.com/...',
      created_at: '2024-01-20T10:00:00Z',
      updated_at: '2024-01-20T11:00:00Z',
      head: { ref: 'feature-branch', sha: 'abc123...' },
      base: { ref: 'main', sha: 'def456...' },
      user: {
        login: 'developer',
        avatar_url: 'https://avatars.githubusercontent.com/...'
      }
    }
  ],
  repository: {...}
}
```

### 4. Create Pull Request

```javascript
const pr = await trpc.projects.createGitHubPullRequest.mutate({
  projectId: 'your-project-id',
  title: 'Add awesome feature',
  body: 'This PR adds an awesome new feature that does...',
  head: 'feature/awesome-feature',
  base: 'main',
  draft: false // optional, create as draft PR
});

// Response
{
  success: true,
  pullRequest: {
    number: 43,
    html_url: 'https://github.com/user/repo/pull/43',
    state: 'open',
    title: 'Add awesome feature',
    body: 'This PR adds an awesome new feature that does...',
    head: { ref: 'feature/awesome-feature', sha: 'abc123...' },
    base: { ref: 'main', sha: 'def456...' },
    mergeable: true,
    created_at: '2024-01-20T12:00:00Z'
  }
}
```

## Workflow Operations

### 5. Create Branch with PR

Create a new branch and immediately open a pull request.

```javascript
const result = await trpc.projects.workflowCreateBranchWithPR.mutate({
  projectId: 'your-project-id',
  branchName: 'feature/quick-fix',
  fromBranch: 'main', // optional
  prTitle: 'Quick fix for bug #123',
  prBody: 'This fixes the issue where...', // optional
  baseBranch: 'main', // optional, defaults to fromBranch
  draft: false // optional
});

// Response
{
  success: true,
  branch: {
    name: 'feature/quick-fix',
    sha: 'abc123...',
    ref: 'refs/heads/feature/quick-fix'
  },
  pullRequest: {
    number: 44,
    html_url: 'https://github.com/user/repo/pull/44',
    state: 'open',
    title: 'Quick fix for bug #123',
    // ... other PR details
  }
}
```

### 6. Update File with PR

Update a file on a branch and automatically create/update associated PR.

```javascript
const result = await trpc.projects.workflowUpdateFileWithPR.mutate({
  projectId: 'your-project-id',
  branch: 'feature/update-docs',
  filePath: 'README.md',
  content: '# Updated README\n\nNew content here...',
  commitMessage: 'Update README with new instructions',
  currentSha: 'abc123...', // optional, for existing files
  prTitle: 'Update documentation', // optional
  prBody: 'Updated README with...', // optional
  baseBranch: 'main',
  updateExistingPR: true // auto-update existing PR if found
});

// Response
{
  success: true,
  commit: {
    sha: 'def456...',
    message: 'Update README with new instructions',
    author: {...},
    committer: {...}
  },
  pullRequest: {
    number: 45,
    html_url: 'https://github.com/user/repo/pull/45',
    // ... PR details
  },
  action: 'created' // or 'updated' if PR already existed
}
```

### 7. Feature Branch Workflow

Complete workflow: create feature branch, make multiple file changes, and create PR.

```javascript
const result = await trpc.projects.workflowFeatureBranch.mutate({
  projectId: 'your-project-id',
  featureName: 'User Authentication',
  fromBranch: 'main',
  files: [
    {
      path: 'src/auth/login.js',
      content: 'export function login() { ... }',
      message: 'Add login function' // optional per-file message
    },
    {
      path: 'src/auth/logout.js',
      content: 'export function logout() { ... }',
      message: 'Add logout function'
    },
    {
      path: 'src/auth/index.js',
      content: 'export * from "./login";\nexport * from "./logout";',
      sha: 'existing-sha...' // optional, for updating existing files
    }
  ],
  commitMessage: 'Implement authentication', // default for all files
  prTitle: 'Feature: User Authentication',
  prBody: 'This PR implements user authentication with login/logout',
  draft: false
});

// Response
{
  success: true,
  branch: {
    name: 'feature/user-authentication',
    sha: 'abc123...',
    ref: 'refs/heads/feature/user-authentication'
  },
  commits: [
    {
      path: 'src/auth/login.js',
      sha: 'new-sha-1...',
      commit: { sha: 'commit-1...', message: 'Add login function' }
    },
    {
      path: 'src/auth/logout.js',
      sha: 'new-sha-2...',
      commit: { sha: 'commit-2...', message: 'Add logout function' }
    },
    {
      path: 'src/auth/index.js',
      sha: 'new-sha-3...',
      commit: { sha: 'commit-3...', message: 'Implement authentication' }
    }
  ],
  pullRequest: {
    number: 46,
    html_url: 'https://github.com/user/repo/pull/46',
    title: 'Feature: User Authentication',
    // ... PR details
  }
}
```

## Common Workflows

### Quick Fix Workflow

```javascript
// 1. Create branch with PR for quick fix
const { branch, pullRequest } = await trpc.projects.workflowCreateBranchWithPR.mutate({
  projectId: 'project-123',
  branchName: 'fix/typo-in-header',
  prTitle: 'Fix typo in header component'
});

// 2. Make the fix
await trpc.projects.updateGitHubFile.mutate({
  projectId: 'project-123',
  path: 'src/components/Header.jsx',
  content: fixedContent,
  message: 'Fix typo: "Helo" -> "Hello"',
  branch: branch.name,
  sha: currentFileSha
});

// PR is automatically linked to the commit!
```

### Feature Development Workflow

```javascript
// Complete feature implementation with multiple files
const result = await trpc.projects.workflowFeatureBranch.mutate({
  projectId: 'project-123',
  featureName: 'Dark Mode',
  files: [
    {
      path: 'src/hooks/useDarkMode.js',
      content: darkModeHookCode
    },
    {
      path: 'src/styles/dark-theme.css',
      content: darkThemeStyles
    },
    {
      path: 'src/components/ThemeToggle.jsx',
      content: themeToggleComponent
    }
  ],
  prTitle: 'Add dark mode support',
  prBody: `## Changes
- Added useDarkMode hook
- Created dark theme styles
- Added theme toggle component

Closes #123`
});
```

### Iterative Development

```javascript
// Work on existing branch and update PR
const result = await trpc.projects.workflowUpdateFileWithPR.mutate({
  projectId: 'project-123',
  branch: 'feature/dashboard',
  filePath: 'src/pages/Dashboard.jsx',
  content: updatedDashboard,
  commitMessage: 'Add user statistics to dashboard',
  prTitle: 'Dashboard improvements - Added statistics',
  updateExistingPR: true // Updates existing PR title
});
```

## Best Practices

1. **Branch Naming**: Use descriptive names like `feature/`, `fix/`, `docs/` prefixes
2. **Commit Messages**: Be descriptive - the workflow service helps generate good messages
3. **PR Descriptions**: Include context, what changed, and why
4. **Draft PRs**: Use draft PRs for work-in-progress features
5. **Atomic Commits**: Each commit should represent one logical change

## Error Handling

```javascript
try {
  const result = await trpc.projects.workflowFeatureBranch.mutate({...});
} catch (error) {
  if (error.code === 'UNAUTHORIZED') {
    // User needs to authenticate with GitHub
  } else if (error.code === 'BAD_REQUEST') {
    // Check input parameters
  } else if (error.message.includes('already exists')) {
    // Branch already exists
  }
}
```

## Notes

- Branch names are automatically sanitized in feature workflows
- PRs are automatically linked to branches and commits
- The workflow service handles PR updates intelligently
- All operations use the authenticated user's GitHub token
- Workflows are atomic - they succeed completely or fail with rollback where possible
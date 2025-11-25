# GitHub Complete Toolkit Guide

Comprehensive guide for all GitHub operations available in the API.

## Table of Contents

1. [File Operations](#file-operations)
2. [Branch Operations](#branch-operations)
3. [Pull Request Operations](#pull-request-operations)
4. [Workflow Operations](#workflow-operations)
5. [Repository Operations](#repository-operations)
6. [Complete PR Workflow Examples](#complete-pr-workflow-examples)

## File Operations

### Browse Repository

```javascript
// List directory contents
const directory = await trpc.projects.listGitHubDirectory.query({
  projectId: 'project-id',
  path: 'src/components', // '' for root
  ref: 'main' // or any branch/tag/commit
});
```

### Read Files

```javascript
// Get file content
const file = await trpc.projects.getGitHubFileContent.query({
  projectId: 'project-id',
  path: 'README.md',
  ref: 'main'
});

// Access: file.file.content, file.file.sha
```

### Update Files

```javascript
// Update existing file
const result = await trpc.projects.updateGitHubFile.mutate({
  projectId: 'project-id',
  path: 'docs/guide.md',
  content: 'Updated content',
  message: 'Update documentation',
  branch: 'main',
  sha: 'current-file-sha' // Required for updates
});

// Create new file (omit sha)
const newFile = await trpc.projects.updateGitHubFile.mutate({
  projectId: 'project-id',
  path: 'src/newfile.js',
  content: 'export default {};',
  message: 'Add new file',
  branch: 'feature-branch'
});
```

### Delete Files

```javascript
// Delete file (requires current SHA)
const deleted = await trpc.projects.deleteGitHubFile.mutate({
  projectId: 'project-id',
  path: 'old-file.js',
  message: 'Remove deprecated file',
  sha: 'file-sha',
  branch: 'main'
});
```

### Upload Images

```javascript
// From URL
const image = await trpc.projects.uploadGitHubImage.mutate({
  projectId: 'project-id',
  imageUrl: 'https://example.com/image.png',
  fileName: 'screenshot.png',
  folder: 'assets/images',
  message: 'Add screenshot',
  branch: 'main'
});

// From base64
const uploaded = await trpc.projects.uploadGitHubImage.mutate({
  projectId: 'project-id',
  imageBase64: 'iVBORw0KGgoAAAANS...',
  fileName: 'diagram.png',
  folder: 'docs/images'
});
```

### File History

```javascript
// Get commit history for a file
const history = await trpc.projects.getGitHubFileHistory.query({
  projectId: 'project-id',
  path: 'src/app.js',
  ref: 'main',
  limit: 20
});

// Returns array of commits with messages, authors, dates
```

## Branch Operations

### List Branches

```javascript
// Get all branches
const branches = await trpc.projects.listGitHubBranches.query({
  projectId: 'project-id',
  protected: false // optional filter
});

// Returns: [{name, protected, commit: {sha, url}}]
```

### Create Branch

```javascript
// Create from default branch
const branch = await trpc.projects.createGitHubBranch.mutate({
  projectId: 'project-id',
  branchName: 'feature/new-feature'
});

// Create from specific branch
const branch = await trpc.projects.createGitHubBranch.mutate({
  projectId: 'project-id',
  branchName: 'hotfix/urgent-fix',
  fromBranch: 'release/v2.0'
});
```

### Delete Branch

```javascript
// Delete branch (cannot delete protected branches)
const deleted = await trpc.projects.deleteGitHubBranch.mutate({
  projectId: 'project-id',
  branchName: 'feature/old-feature'
});
```

## Pull Request Operations

### List Pull Requests

```javascript
// Get all open PRs
const prs = await trpc.projects.listGitHubPullRequests.query({
  projectId: 'project-id',
  state: 'open' // 'open', 'closed', 'all'
});

// Filter by branches
const prs = await trpc.projects.listGitHubPullRequests.query({
  projectId: 'project-id',
  state: 'all',
  head: 'feature-branch', // source branch
  base: 'main', // target branch
  sort: 'updated',
  direction: 'desc'
});
```

### Get Specific PR

```javascript
// Get detailed PR information
const pr = await trpc.projects.getGitHubPullRequest.query({
  projectId: 'project-id',
  pullNumber: 123
});

// Returns: {
//   number, state, title, body, mergeable, mergeable_state,
//   commits, additions, deletions, changed_files,
//   head: {ref, sha}, base: {ref, sha}
// }
```

### Create Pull Request

```javascript
const pr = await trpc.projects.createGitHubPullRequest.mutate({
  projectId: 'project-id',
  title: 'Add new feature',
  body: 'This PR adds...\n\n- Feature A\n- Feature B',
  head: 'feature/new-feature',
  base: 'main',
  draft: false
});
```

### Update Pull Request

```javascript
// Update title/body
const updated = await trpc.projects.updateGitHubPullRequest.mutate({
  projectId: 'project-id',
  pullNumber: 123,
  title: 'Updated: Add new feature',
  body: 'Updated description...'
});

// Close PR
const closed = await trpc.projects.updateGitHubPullRequest.mutate({
  projectId: 'project-id',
  pullNumber: 123,
  state: 'closed'
});
```

### Get PR Commits

```javascript
// List all commits in a PR
const commits = await trpc.projects.getGitHubPullRequestCommits.query({
  projectId: 'project-id',
  pullNumber: 123
});

// Returns array of commits with messages, authors, SHAs
```

### Check PR Mergeability

```javascript
// Check if PR can be merged
const status = await trpc.projects.checkGitHubPullRequestMergeability.query({
  projectId: 'project-id',
  pullNumber: 123
});

// Returns: {
//   mergeable: true/false,
//   mergeable_state: 'clean'/'dirty'/'unstable',
//   merged: false,
//   commits: 5,
//   additions: 120,
//   deletions: 45,
//   changed_files: 8
// }
```

### Merge Pull Request

```javascript
// Merge PR
const merged = await trpc.projects.mergeGitHubPullRequest.mutate({
  projectId: 'project-id',
  pullNumber: 123,
  commitTitle: 'Merge PR #123: Add new feature',
  commitMessage: 'Reviewed and approved by team',
  mergeMethod: 'merge' // 'merge', 'squash', 'rebase'
});

// Squash and merge
const squashed = await trpc.projects.mergeGitHubPullRequest.mutate({
  projectId: 'project-id',
  pullNumber: 123,
  commitTitle: 'Add new feature (#123)',
  mergeMethod: 'squash'
});
```

## Workflow Operations

### Create Branch with PR

```javascript
// One-step: create branch and PR
const result = await trpc.projects.workflowCreateBranchWithPR.mutate({
  projectId: 'project-id',
  branchName: 'feature/quick-fix',
  fromBranch: 'main',
  prTitle: 'Quick fix for issue #456',
  prBody: 'This fixes...',
  baseBranch: 'main',
  draft: false
});

// Returns: { branch, pullRequest }
```

### Update File with PR

```javascript
// Update file and create/update PR automatically
const result = await trpc.projects.workflowUpdateFileWithPR.mutate({
  projectId: 'project-id',
  branch: 'docs/update-readme',
  filePath: 'README.md',
  content: updatedReadme,
  commitMessage: 'Update README with new instructions',
  prTitle: 'Documentation Update',
  prBody: 'Updated installation instructions',
  baseBranch: 'main',
  updateExistingPR: true // Updates existing PR if found
});

// Returns: { commit, pullRequest, action: 'created'|'updated' }
```

### Feature Branch Workflow

```javascript
// Complete feature: branch + multiple files + PR
const feature = await trpc.projects.workflowFeatureBranch.mutate({
  projectId: 'project-id',
  featureName: 'User Dashboard',
  fromBranch: 'develop',
  files: [
    {
      path: 'src/pages/Dashboard.jsx',
      content: dashboardComponent,
      message: 'Add dashboard component'
    },
    {
      path: 'src/pages/Dashboard.css',
      content: dashboardStyles,
      message: 'Add dashboard styles'
    },
    {
      path: 'src/routes/index.js',
      content: updatedRoutes,
      sha: 'current-sha' // For updating existing file
    }
  ],
  prTitle: 'Feature: User Dashboard',
  prBody: 'Implements user dashboard with stats and charts',
  draft: false
});

// Returns: { branch, commits[], pullRequest }
```

## Repository Operations

### Get Repository Info

```javascript
const repo = await trpc.projects.getGitHubRepository.query({
  projectId: 'project-id'
});

// Returns: {
//   name, full_name, default_branch, visibility,
//   description, topics[], created_at, updated_at
// }
```

## Complete PR Workflow Examples

### Example 1: Feature Development with PR

```javascript
// 1. Create feature branch
const branch = await trpc.projects.createGitHubBranch.mutate({
  projectId: 'project-id',
  branchName: 'feature/payment-integration',
  fromBranch: 'develop'
});

// 2. Make multiple commits
await trpc.projects.updateGitHubFile.mutate({
  projectId: 'project-id',
  path: 'src/payments/stripe.js',
  content: stripeIntegration,
  message: 'Add Stripe payment integration',
  branch: 'feature/payment-integration'
});

await trpc.projects.updateGitHubFile.mutate({
  projectId: 'project-id',
  path: 'src/payments/paypal.js',
  content: paypalIntegration,
  message: 'Add PayPal payment integration',
  branch: 'feature/payment-integration'
});

// 3. Create PR
const pr = await trpc.projects.createGitHubPullRequest.mutate({
  projectId: 'project-id',
  title: 'Add payment gateway integration',
  body: `## Changes
- Stripe integration
- PayPal integration
- Payment webhook handlers

## Testing
- [ ] Test Stripe payments
- [ ] Test PayPal payments
- [ ] Test webhook handling`,
  head: 'feature/payment-integration',
  base: 'develop',
  draft: false
});

// 4. Add more commits to PR
await trpc.projects.updateGitHubFile.mutate({
  projectId: 'project-id',
  path: 'tests/payments.test.js',
  content: paymentTests,
  message: 'Add payment integration tests',
  branch: 'feature/payment-integration'
});

// 5. Check mergeability
const status = await trpc.projects.checkGitHubPullRequestMergeability.query({
  projectId: 'project-id',
  pullNumber: pr.pullRequest.number
});

if (status.mergeable) {
  // 6. Merge PR
  await trpc.projects.mergeGitHubPullRequest.mutate({
    projectId: 'project-id',
    pullNumber: pr.pullRequest.number,
    commitTitle: 'Add payment gateway integration (#' + pr.pullRequest.number + ')',
    mergeMethod: 'squash'
  });
}
```

### Example 2: Hotfix Workflow

```javascript
// Quick hotfix workflow
const hotfix = await trpc.projects.workflowUpdateFileWithPR.mutate({
  projectId: 'project-id',
  branch: 'hotfix/critical-bug',
  filePath: 'src/auth/validator.js',
  content: fixedValidator,
  commitMessage: 'Fix critical validation bug',
  prTitle: 'HOTFIX: Critical validation bug',
  prBody: 'Fixes issue where validation was failing for valid inputs',
  baseBranch: 'main',
  updateExistingPR: false
});

// Fast-track merge
await trpc.projects.mergeGitHubPullRequest.mutate({
  projectId: 'project-id',
  pullNumber: hotfix.pullRequest.number,
  commitTitle: 'Hotfix: Critical validation bug',
  mergeMethod: 'merge' // Keep history for hotfixes
});
```

### Example 3: Documentation Update

```javascript
// Batch documentation update
const docs = await trpc.projects.workflowFeatureBranch.mutate({
  projectId: 'project-id',
  featureName: 'docs-update-q4',
  files: [
    { path: 'README.md', content: updatedReadme },
    { path: 'docs/API.md', content: updatedApi },
    { path: 'docs/CONTRIBUTING.md', content: contributingGuide }
  ],
  prTitle: 'Q4 Documentation Update',
  prBody: 'Quarterly documentation review and update',
  draft: true // Start as draft for review
});
```

## Error Handling

```javascript
try {
  const pr = await trpc.projects.createGitHubPullRequest.mutate({...});
} catch (error) {
  if (error.message.includes('already exists')) {
    // PR already exists for this branch
  } else if (error.message.includes('not found')) {
    // Branch doesn't exist
  } else if (error.code === 'FORBIDDEN') {
    // No permission to create PR
  }
}
```

## Best Practices

1. **Always check mergeability** before merging PRs
2. **Use draft PRs** for work-in-progress
3. **Squash merge** for feature branches to keep history clean
4. **Regular merge** for hotfixes to preserve history
5. **Update PR descriptions** as work progresses
6. **Check file SHA** before updates to prevent conflicts
7. **Use workflows** for common patterns to reduce errors

## Available Operations Summary

### File Operations
- ✅ List directory
- ✅ Read file
- ✅ Create/Update file
- ✅ Delete file
- ✅ Upload image
- ✅ Get file history

### Branch Operations
- ✅ List branches
- ✅ Create branch
- ✅ Delete branch

### PR Operations
- ✅ List PRs
- ✅ Get PR details
- ✅ Create PR
- ✅ Update PR
- ✅ Get PR commits
- ✅ Check mergeability
- ✅ Merge PR

### Workflows
- ✅ Create branch with PR
- ✅ Update file with PR
- ✅ Feature branch workflow
- ✅ Batch file updates

### Repository
- ✅ Get repository info